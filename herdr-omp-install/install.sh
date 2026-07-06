#!/usr/bin/env bash
#
# Installs the herdr + omp integration:
#   1. copies the two OMP extensions into the OMP extensions dir
#   2. ensures the two herdr config.toml [ui] keys that surface pane labels
#
# Idempotent. Safe to re-run. Backs up config.toml before any change.
#
# Overridable via env (used by the test harness):
#   OMP_EXT_DIR    default ~/.omp/agent/extensions
#   HERDR_CONFIG   default ~/.config/herdr/config.toml
#
# Usage:
#   ./install.sh            # install
#   ./install.sh --check    # report what would change, touch nothing (exit 1 if drift)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_EXT_DIR="$SCRIPT_DIR/extensions"
UPSERT_AWK="$SCRIPT_DIR/lib/upsert-toml.awk"

OMP_EXT_DIR="${OMP_EXT_DIR:-$HOME/.omp/agent/extensions}"
HERDR_CONFIG="${HERDR_CONFIG:-$HOME/.config/herdr/config.toml}"

CHECK_ONLY=0
if [[ "${1:-}" == "--check" ]]; then
	CHECK_ONLY=1
fi

EXTENSIONS=(herdr-omp-agent-state.ts herdr-workspace-namer.ts)

# section / key / value pairs the integration REQUIRES. Kept minimal on purpose:
# only the key that surfaces the agent state/labels on panes. Sort order,
# theme, etc. are personal taste and left untouched.
CONFIG_KEYS=(
	'ui|show_agent_labels_on_pane_borders|true'
)

drift=0

log()  { printf '%s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die()  { printf 'error: %s\n' "$*" >&2; exit 1; }

files_equal() {
	# 0 if both exist and are identical
	[[ -f "$1" && -f "$2" ]] && cmp -s "$1" "$2"
}

install_extensions() {
	[[ -d "$SRC_EXT_DIR" ]] || die "source extensions dir missing: $SRC_EXT_DIR"
	for name in "${EXTENSIONS[@]}"; do
		local src="$SRC_EXT_DIR/$name"
		local dst="$OMP_EXT_DIR/$name"
		[[ -f "$src" ]] || die "missing source extension: $src"
		if files_equal "$src" "$dst"; then
			log "ok    $name (up to date)"
			continue
		fi
		drift=1
		if (( CHECK_ONLY )); then
			log "DRIFT $name (would install)"
			continue
		fi
		mkdir -p "$OMP_EXT_DIR"
		cp "$src" "$dst"
		log "wrote $name -> $dst"
	done
}

# echo the current value of a bare key inside a section, or nothing.
current_value() {
	local file="$1" section="$2" key="$3"
	[[ -f "$file" ]] || return 0
	awk -v section="$section" -v key="$key" '
		function trim(s){ sub(/^[ \t]+/,"",s); sub(/[ \t]+$/,"",s); return s }
		{
			t = trim($0)
			if (t ~ /^\[[^[]/ && t ~ /\]$/) {
				h = t; sub(/^\[/,"",h); sub(/\][ \t]*$/,"",h)
				in_s = (trim(h) == section); next
			}
			if (in_s && t !~ /^#/ && t ~ ("^" key "[ \t]*=")) {
				sub(/^[^=]*=[ \t]*/, "", t)
				print t; exit
			}
		}
	' "$file"
}

ensure_config() {
	local tmp changed=0
	for triple in "${CONFIG_KEYS[@]}"; do
		local section="${triple%%|*}"
		local rest="${triple#*|}"
		local key="${rest%%|*}"
		local value="${rest#*|}"
		local have
		have="$(current_value "$HERDR_CONFIG" "$section" "$key")"
		if [[ "$have" == "$value" ]]; then
			log "ok    [$section] $key = $value"
			continue
		fi
		changed=1
		drift=1
		if (( CHECK_ONLY )); then
			log "DRIFT [$section] $key: have '${have:-<absent>}' want '$value'"
		fi
	done

	(( CHECK_ONLY )) && return 0
	(( changed )) || return 0

	mkdir -p "$(dirname "$HERDR_CONFIG")"
	[[ -f "$HERDR_CONFIG" ]] || : > "$HERDR_CONFIG"

	if [[ -s "$HERDR_CONFIG" ]]; then
		local backup="$HERDR_CONFIG.bak.$(date +%Y%m%d%H%M%S)"
		cp "$HERDR_CONFIG" "$backup"
		log "backup $HERDR_CONFIG -> $backup"
	fi

	for triple in "${CONFIG_KEYS[@]}"; do
		local section="${triple%%|*}"
		local rest="${triple#*|}"
		local key="${rest%%|*}"
		local value="${rest#*|}"
		tmp="$(mktemp)"
		awk -v section="$section" -v key="$key" -v value="$value" \
			-f "$UPSERT_AWK" "$HERDR_CONFIG" > "$tmp"
		mv "$tmp" "$HERDR_CONFIG"
		log "set   [$section] $key = $value"
	done
}

main() {
	[[ -f "$UPSERT_AWK" ]] || die "missing awk helper: $UPSERT_AWK"
	install_extensions
	ensure_config
	if (( CHECK_ONLY )); then
		if (( drift )); then
			log ""
			log "drift detected (nothing written)"
			exit 1
		fi
		log ""
		log "everything up to date"
		exit 0
	fi
	log ""
	log "done. restart your OMP panes so the extensions load."
}

main "$@"
