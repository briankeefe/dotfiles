#!/bin/sh
# Run on the destination Mac. Existing repos and conflicting files need review.
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SOURCE_DIR=$(dirname "$SCRIPT_DIR")
CODE_DIR="$HOME/code"
export HOMEBREW_NO_AUTO_UPDATE=1
export PATH="$HOME/.local/bin:$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
case "${1:-}" in
  --help|-h)
    printf '%s\n' 'Usage: sh macos/bootstrap.sh [--check [doctor options] | --help]' \
      'Interactive install: packages, selected repos, dotfiles, skills, optional shell/Git/preferences.' \
      'Requires macOS and Xcode Command Line Tools. Work repos default to ~/code.' \
      '--check runs the read-only doctor; supports --offline and --code-dir PATH.'
    exit 0 ;;
  --check)
    shift
    command -v bun >/dev/null 2>&1 || { echo 'Missing Bun; install it before running the doctor.' >&2; exit 1; }
    exec bun "$SCRIPT_DIR/doctor.ts" "$@" ;;
  '') ;;
  *) echo 'Unknown argument; use --help.' >&2; exit 2 ;;
esac
[ "$#" -eq 0 ] || { echo 'Unexpected arguments.' >&2; exit 2; }
[ "$(uname -s)" = Darwin ] || { echo 'macOS only.' >&2; exit 1; }
xcode-select -p >/dev/null 2>&1 || { echo 'Run xcode-select --install, finish installation, then retry.' >&2; exit 1; }
# Keep prompts separate from the repo manifest read loop. EOF never means yes.
exec 3<&0
ask() {
  printf '%s [y/N] ' "$1"
  IFS= read -r answer <&3 || { echo 'Interactive input required.' >&2; exit 1; }
  case "$answer" in y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}

if ! command -v brew >/dev/null 2>&1; then
  ask 'Run the official Homebrew installer (may request administrator access)?' || exit 1
  installer=$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)
  /bin/bash -c "$installer"
fi
ask 'Install the curated Brewfile without upgrading installed packages?' || exit 1
brew bundle install --no-upgrade --file "$SCRIPT_DIR/Brewfile"
if ! gh auth status >/dev/null 2>&1; then
  ask 'Sign in to GitHub to access private work repos?' || exit 1
  gh auth login --git-protocol https --web
fi
if ask 'Configure GitHub HTTPS authentication through gh?'; then
  gh auth setup-git
fi

mkdir -p "$CODE_DIR"
while IFS= read -r entry || [ -n "$entry" ]; do
  case "$entry" in ''|\#*) continue ;; esac
  name=${entry##*/}
  target="$CODE_DIR/$name"
  if [ -e "$target" ] || [ -L "$target" ]; then
    actual=$(git -C "$target" remote get-url origin 2>/dev/null || true)
    case "$actual" in
      "https://github.com/$entry"|"https://github.com/$entry.git"|"git@github.com:$entry.git")
        printf 'Keeping existing %s (no pull/reset).\n' "$target" ;;
      *) printf 'SKIP %s: existing path or origin differs; resolve manually.\n' "$target" ;;
    esac
  elif ask "Clone $entry to $target?"; then
    gh repo clone "$entry" "$target"
  fi
done < "$SCRIPT_DIR/repos.txt"

if ! command -v omp >/dev/null 2>&1; then
  ask 'Install Oh My Pi with Bun?' || exit 1
  bun install -g @oh-my-pi/pi-coding-agent
fi
fresh_herdr=false
if ! command -v herdr >/dev/null 2>&1; then
  if pgrep -x herdr >/dev/null 2>&1; then
    echo 'Herdr is running but missing from PATH. Resolve PATH and retry; not replacing it.' >&2
    exit 1
  fi
  ask 'Install Herdr using its official direct installer?' || exit 1
  installer=$(curl -fsSL https://herdr.dev/install.sh)
  sh -c "$installer"
  fresh_herdr=true
fi

# Initialize only a missing config; never relink or replace another source tree.
config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/chezmoi"
configured=false
for extension in toml yaml yml json jsonc; do
  if [ -e "$config_dir/chezmoi.$extension" ] || [ -L "$config_dir/chezmoi.$extension" ]; then configured=true; fi
done
if [ "$configured" = false ]; then
  chezmoi --source "$SOURCE_DIR" init
fi
set -- "$HOME/.aerospace.toml" "$HOME/.config/ghostty" "$HOME/.config/herdr" \
  "$HOME/.config/borders" "$HOME/.config/aerospace" "$HOME/.omp" "$HOME/.local/bin/foreman"
chezmoi --source "$SOURCE_DIR" diff --recursive "$@"
if ask 'Apply these core configs? ChezMoi will ask about conflicting files.'; then
  chezmoi --source "$SOURCE_DIR" apply --interactive --parent-dirs --exclude scripts "$@"
  bun install --cwd "$HOME/.omp/plugins" --frozen-lockfile --ignore-scripts
  if [ "$fresh_herdr" = true ]; then herdr channel set preview; fi
fi

if ask 'Install shell dependencies and review the Mac Zsh/Powerlevel10k config?'; then
  if [ ! -e "$HOME/.oh-my-zsh" ] && [ ! -L "$HOME/.oh-my-zsh" ]; then
    git clone --depth=1 https://github.com/ohmyzsh/ohmyzsh.git "$HOME/.oh-my-zsh"
  fi
  theme="$HOME/.oh-my-zsh/custom/themes/powerlevel10k"
  if [ ! -e "$theme" ] && [ ! -L "$theme" ]; then
    git clone --depth=1 https://github.com/romkatv/powerlevel10k.git "$theme"
  fi
  mkdir -p "$HOME/.nvm"
  chezmoi --source "$SOURCE_DIR" diff "$HOME/.zshrc" "$HOME/.p10k.zsh"
  if ask 'Apply the reviewed shell config?'; then
    chezmoi --source "$SOURCE_DIR" apply --interactive --exclude scripts "$HOME/.zshrc" "$HOME/.p10k.zsh"
  fi
fi
if ask 'Review Git author identity and conservative defaults?'; then
  sh "$SCRIPT_DIR/configure-git.sh" <&3
fi
if ask 'Apply the documented Finder, screenshot, Dock and trackpad preferences?'; then
  sh "$SCRIPT_DIR/defaults.sh"
fi
if ask 'Start AeroSpace and the Borders login service?'; then
  brew services start borders
  open -a AeroSpace
fi

# Use the canonical team installer, but prevent its ln -sfn from replacing links.
skills="$CODE_DIR/agent-skills"
actual=$(git -C "$skills" remote get-url origin 2>/dev/null || true)
case "$actual" in
  https://github.com/Frostbyte-Technologies/agent-skills|https://github.com/Frostbyte-Technologies/agent-skills.git|git@github.com:Frostbyte-Technologies/agent-skills.git)
    if [ -f "$skills/install.sh" ] && ask 'Install shared agent skills using the team installer?'; then
      blocked=false
      for target in "$HOME/.agents/skills" "$HOME/.claude/skills" "$HOME/code/.opencode/skill"; do
        for skill in "$skills"/skills/*/; do
          [ -d "$skill" ] || continue
          name=$(basename "$skill")
          [ "$name" = _template ] && continue
          link="$target/$name"
          if [ -e "$link" ] || [ -L "$link" ]; then
            if [ ! -L "$link" ] || [ "$(readlink "$link")" != "${skill%/}" ]; then
              printf 'SKIP skills: conflicting path %s; resolve manually.\n' "$link"
              blocked=true
            fi
          fi
        done
      done
      if [ "$blocked" = false ]; then bash "$skills/install.sh"; fi
    fi ;;
  *) echo 'Shared skills not installed: clone/verify the agent-skills repo first.' ;;
esac
printf '%s\n' 'Run the doctor again from your new shell after logging in to providers.' \
  'Install Node/Python/Java versions from each repo declaration, not a global latest default.' \
  'Keep Homebrew shellenv in ~/.zprofile; existing files were not changed automatically.'
exec bun "$SCRIPT_DIR/doctor.ts"
