#!/usr/bin/env bash
#
# Self-contained test harness for the herdr-omp installer. No bats, no deps
# beyond bash + awk + coreutils. Each test runs in an isolated sandbox HOME.
#
#   ./test/run-tests.sh          # run all
#   ./test/run-tests.sh -v       # also echo captured output on failure
#
# Exit 0 = all passed, 1 = one or more failed.

set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE_DIR="$(cd "$TEST_DIR/.." && pwd)"
INSTALL="$BUNDLE_DIR/install.sh"
UPSERT="$BUNDLE_DIR/lib/upsert-toml.awk"

VERBOSE=0
[[ "${1:-}" == "-v" ]] && VERBOSE=1

pass=0
fail=0
CURRENT=""

# --- assertions -------------------------------------------------------------

_fail() {
	fail=$((fail + 1))
	printf 'FAIL  %s\n      %s\n' "$CURRENT" "$1" >&2
}
_ok() { pass=$((pass + 1)); }

assert_eq() { # want, got, msg
	if [[ "$1" == "$2" ]]; then _ok; else
		_fail "$3: want [$1] got [$2]"
	fi
}
assert_contains() { # haystack, needle, msg
	if [[ "$1" == *"$2"* ]]; then _ok; else
		_fail "$3: [$2] not found in output"
		(( VERBOSE )) && printf '      --- output ---\n%s\n' "$1" >&2
	fi
}
assert_not_contains() { # haystack, needle, msg
	if [[ "$1" != *"$2"* ]]; then _ok; else
		_fail "$3: [$2] unexpectedly present"
	fi
}
assert_file() { # path, msg
	if [[ -f "$1" ]]; then _ok; else _fail "$2: file missing: $1"; fi
}

# run upsert-toml.awk over stdin-file, echo result
upsert() { # file section key value
	awk -v section="$2" -v key="$3" -v value="$4" -f "$UPSERT" "$1"
}

# fresh sandbox: sets HOME-like env, echoes the sandbox dir
new_sandbox() {
	local d
	d="$(mktemp -d)"
	mkdir -p "$d/omp" "$d/herdr"
	printf '%s' "$d"
}

test_case() { CURRENT="$1"; }

# ===========================================================================
# unit: upsert-toml.awk
# ===========================================================================

test_case "upsert: appends section+key to empty file"
{
	f="$(mktemp)"; : > "$f"
	out="$(upsert "$f" ui show_labels true)"
	assert_contains "$out" "[ui]" "section header written"
	assert_contains "$out" "show_labels = true" "key written"
}

test_case "upsert: adds key to existing section, preserves siblings"
{
	f="$(mktemp)"
	printf '[ui]\nexisting = 1\n' > "$f"
	out="$(upsert "$f" ui show_labels true)"
	assert_contains "$out" "existing = 1" "sibling preserved"
	assert_contains "$out" "show_labels = true" "new key added"
	# key must land inside [ui], i.e. before EOF with no other section intervening
	assert_eq "1" "$(printf '%s\n' "$out" | grep -c '^\[ui\]')" "single [ui] header"
}

test_case "upsert: replaces existing value in place (idempotent target)"
{
	f="$(mktemp)"
	printf '[ui]\nsort = "name"\n' > "$f"
	out="$(upsert "$f" ui sort '"priority"')"
	assert_contains "$out" 'sort = "priority"' "value replaced"
	assert_not_contains "$out" '"name"' "old value gone"
	assert_eq "1" "$(printf '%s\n' "$out" | grep -c '^sort')" "no duplicate key"
}

test_case "upsert: no-op when key already correct"
{
	f="$(mktemp)"
	printf '[ui]\nsort = "priority"\n' > "$f"
	out="$(upsert "$f" ui sort '"priority"')"
	pass_before=$pass
	assert_contains "$out" 'sort = "priority"' "value intact"
	assert_eq "1" "$(printf '%s\n' "$out" | grep -c 'sort')" "still single key"
}

test_case "upsert: idempotent across repeated runs"
{
	f="$(mktemp)"
	printf '[theme]\nname = "x"\n' > "$f"
	once="$(upsert "$f" ui k true)"
	printf '%s\n' "$once" > "$f"
	twice="$(upsert "$f" ui k true)"
	assert_eq "$once" "$twice" "second run identical to first"
}

test_case "upsert: does not touch other sections' same-named key"
{
	f="$(mktemp)"
	printf '[a]\nk = 1\n\n[ui]\nk = 2\n' > "$f"
	out="$(upsert "$f" ui k 9)"
	assert_contains "$out" 'k = 9' "target section updated"
	# [a] k must still be 1
	a_val="$(printf '%s\n' "$out" | awk '/^\[a\]/{s=1;next} /^\[/{s=0} s&&/^k/{print;exit}')"
	assert_eq "k = 1" "$a_val" "other section untouched"
}

test_case "upsert: ignores commented header and commented key"
{
	f="$(mktemp)"
	printf '# [ui]\n# k = old\n[ui]\n' > "$f"
	out="$(upsert "$f" ui k new)"
	assert_contains "$out" "# k = old" "commented key preserved"
	assert_contains "$out" "k = new" "real key written"
	assert_eq "1" "$(printf '%s\n' "$out" | grep -c '^k = new')" "written once"
}

test_case "upsert: key with regex metachars is literal"
{
	f="$(mktemp)"; : > "$f"
	out="$(upsert "$f" ui 'a.b' true)"
	assert_contains "$out" "a.b = true" "dotted key written verbatim"
}

# ===========================================================================
# integration: install.sh
# ===========================================================================

run_install() { # sandbox, [args...]
	local sb="$1"; shift
	OMP_EXT_DIR="$sb/omp" HERDR_CONFIG="$sb/herdr/config.toml" \
		bash "$INSTALL" "$@" 2>&1
}

test_case "install: fresh install creates extensions + config keys"
{
	sb="$(new_sandbox)"
	out="$(run_install "$sb")"
	assert_file "$sb/omp/herdr-omp-agent-state.ts" "state ext installed"
	assert_file "$sb/omp/herdr-workspace-namer.ts" "namer ext installed"
	assert_file "$sb/herdr/config.toml" "config created"
	cfg="$(cat "$sb/herdr/config.toml")"
	assert_contains "$cfg" '[ui]' "ui section created"
	assert_contains "$cfg" 'show_agent_labels_on_pane_borders = true' "label key set"
}

test_case "install: extensions are byte-identical to source"
{
	sb="$(new_sandbox)"
	run_install "$sb" >/dev/null
	if cmp -s "$BUNDLE_DIR/extensions/herdr-omp-agent-state.ts" "$sb/omp/herdr-omp-agent-state.ts"; then _ok; else _fail "state ext differs from source"; fi
	if cmp -s "$BUNDLE_DIR/extensions/herdr-workspace-namer.ts" "$sb/omp/herdr-workspace-namer.ts"; then _ok; else _fail "namer ext differs from source"; fi
}

test_case "install: preserves existing config, ensures keys, backs up"
{
	sb="$(new_sandbox)"
	printf '[theme]\nname = "tokyo-night"\n\n[ui]\nagent_panel_sort = "name"\n' \
		> "$sb/herdr/config.toml"
	out="$(run_install "$sb")"
	cfg="$(cat "$sb/herdr/config.toml")"
	assert_contains "$cfg" 'name = "tokyo-night"' "unrelated section kept"
	assert_contains "$cfg" 'agent_panel_sort = "name"' "user's sort preference left untouched"
	assert_contains "$cfg" 'show_agent_labels_on_pane_borders = true' "missing key added"
	# a backup file should exist
	if compgen -G "$sb/herdr/config.toml.bak.*" >/dev/null; then _ok; else _fail "no backup created"; fi
}

test_case "install: second run is a no-op (idempotent, no new backup)"
{
	sb="$(new_sandbox)"
	run_install "$sb" >/dev/null
	before="$(cat "$sb/herdr/config.toml")"
	bak_count_1=$(compgen -G "$sb/herdr/config.toml.bak.*" 2>/dev/null | wc -l | tr -d ' ')
	out="$(run_install "$sb")"
	after="$(cat "$sb/herdr/config.toml")"
	bak_count_2=$(compgen -G "$sb/herdr/config.toml.bak.*" 2>/dev/null | wc -l | tr -d ' ')
	assert_eq "$before" "$after" "config unchanged on re-run"
	assert_contains "$out" "up to date" "reports up to date"
	assert_eq "$bak_count_1" "$bak_count_2" "no extra backup on no-op"
}

test_case "install: --check reports drift and writes nothing (exit 1)"
{
	sb="$(new_sandbox)"
	out="$(run_install "$sb" --check)"; rc=$?
	assert_eq "1" "$rc" "--check exits 1 on drift"
	assert_contains "$out" "DRIFT" "drift reported"
	if [[ ! -f "$sb/omp/herdr-omp-agent-state.ts" ]]; then _ok; else _fail "--check wrote an extension"; fi
	if [[ ! -f "$sb/herdr/config.toml" ]]; then _ok; else _fail "--check created config"; fi
}

test_case "install: --check exits 0 when already installed"
{
	sb="$(new_sandbox)"
	run_install "$sb" >/dev/null
	out="$(run_install "$sb" --check)"; rc=$?
	assert_eq "0" "$rc" "--check exits 0 when clean"
	assert_contains "$out" "up to date" "clean state reported"
}

# ===========================================================================

printf '\n%d passed, %d failed\n' "$pass" "$fail"
(( fail == 0 ))
