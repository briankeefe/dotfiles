# dotfiles

Personal Mac and Linux configuration, managed with chezmoi. This repository is private.

![dotfiles banner](docs/banner.svg)

![managed with chezmoi](https://img.shields.io/badge/managed%20with-chezmoi-8aadf4?style=flat-square)
![legacy stow](https://img.shields.io/badge/legacy-stow-a6da95?style=flat-square)
![shell-zsh](https://img.shields.io/badge/shell-zsh-c6a0f6?style=flat-square)
![terminal-ghostty](https://img.shields.io/badge/terminal-ghostty-f5a97f?style=flat-square)

One repo. New machine in minutes. No rebuilding terminal + AI tooling from memory.

## ✦ Active stack

- **Terminal:** Ghostty
- **Terminal workspaces:** Herdr, with OMP state reporting and workspace naming extensions
- **Mac desktop:** AeroSpace + JankyBorders
- **Shell:** Zsh + Powerlevel10k
- **System info:** Fastfetch
- **AI tooling:** Oh My Pi (omp) + OpenCode + Context7 MCP
- **Dotfiles manager:** chezmoi

## ⚡ Bootstrap

### Mac: first-run setup

Install Apple's Command Line Tools (`xcode-select --install`) and authenticate
GitHub to clone this private repo. If `gh` is not installed yet, install Homebrew
from https://brew.sh and run `brew install gh`.

```sh
gh auth login
gh auth setup-git
mkdir -p ~/code
gh repo clone briankeefe/dotfiles ~/code/dotfiles
sh ~/code/dotfiles/macos/bootstrap.sh
```

After cloning, the final command is the entry point for repeat runs. It installs
the package list and OMP/Herdr, offers work-repo cloning and shared agent skills,
reviews configuration changes, and offers Git, shell and desktop preferences.
Existing work repos are not pulled or reset. It does not install project
dependencies, run migrations, or start application servers.

Run the readiness checks separately:

```sh
sh ~/code/dotfiles/macos/bootstrap.sh --check
bun ~/code/dotfiles/macos/doctor.ts --offline
```

The doctor reports missing tools, authentication, skills and per-project runtime
requirements. Exit status `1` means missing or unverified prerequisites, not that
the bootstrap rolled back. `--offline` skips network authentication checks and
does not claim those credentials work. `--code-dir PATH` checks another project
root without changing the default `~/code` layout.

`macos/repos.txt` is the explicit clone list. Review it before running bootstrap;
each non-comment line is a GitHub `owner/repo`. Shared skills come from
`Frostbyte-Technologies/agent-skills`, not a second copy of that repo's content.

### Git defaults

```sh
sh ~/code/dotfiles/macos/configure-git.sh
```

This asks for author identity, then confirms `init.defaultBranch=main`,
`fetch.prune=true`, and `pull.ff=only`. Existing names/emails are offered first;
Brian's identity is the fallback for a fresh machine. It does not rename existing
branches, change repository-local settings, replace credential helpers, or force
commit signing.

### Mac: restore the terminal and desktop setup

Install [Homebrew](https://brew.sh/) first, then:

```sh
brew install chezmoi gh
gh auth login
gh auth setup-git
chezmoi init https://github.com/briankeefe/dotfiles.git
brew bundle install --no-upgrade --file "$(chezmoi source-path)/macos/Brewfile"
curl -fsSL https://herdr.dev/install.sh | sh
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
bun install -g @oh-my-pi/pi-coding-agent
```

The Brewfile covers daily apps, terminal tools, and the tracked shell's Homebrew
dependencies, including the four **MesloLGS NF** font faces via
`font-meslo-for-powerlevel10k`. It intentionally omits database servers, ML stacks,
alternate browsers, and overlapping menu-bar utilities. Herdr stays on its direct
installer because Homebrew installs do not support preview-channel updates.
Review the Brewfile before installing; already-installed apps outside Homebrew
may need to be omitted locally if Homebrew reports an existing application.
This is a package list, not a version lock. `--no-upgrade` avoids upgrading
already-installed packages.

Keep `~/.local/bin` and `~/.bun/bin` on your shell's PATH. The repo's Zsh
template already includes them, but restoring your shell is optional.

Preview and apply only the Mac desktop and OMP config. This leaves your shell,
other tools, existing sessions, and credentials alone:

```sh
chezmoi diff --recursive ~/.aerospace.toml ~/.config/ghostty ~/.config/herdr ~/.config/borders ~/.config/aerospace ~/.omp
chezmoi apply --parent-dirs --exclude scripts ~/.aerospace.toml ~/.config/ghostty ~/.config/herdr ~/.config/borders ~/.config/aerospace ~/.omp
bun install --cwd ~/.omp/plugins --frozen-lockfile --ignore-scripts
herdr channel set preview
brew services start borders
open -a AeroSpace
```

Grant AeroSpace Accessibility permission when prompted. macOS preferences are
separate and opt-in:

```sh
sh "$(chezmoi source-path)/macos/defaults.sh"
```

This restores dark mode, Dock auto-hide and size, the three configured hot corners,
natural scrolling, selected built-in trackpad gestures, and frees Cmd-Ctrl-D for
DBeaver. It also shows filename extensions and Finder's path bar, searches the
current Finder folder by default, and saves screenshots to `~/Pictures/Screenshots`.
Log out and back in afterward. It does not replace Dock app lists,
other keyboard shortcuts, or device-specific preferences, and does not run during
`chezmoi apply`.

Open Ghostty, run `herdr`, then run `omp` inside a Herdr pane. Authenticate OMP
providers and MCP services on the new machine; credentials are not stored here.
The Herdr installer and preview channel install current releases, not a pinned
copy of the old binary. See [Herdr installation](https://herdr.dev/docs/install/).

Captured setup:

| Component | Settings |
| --- | --- |
| Ghostty | TokyoNight Night, `08080f` background, 16pt font, native tab shortcuts disabled |
| Herdr | Tokyo Night, spaces ordering, pane labels, Kitty graphics, preview updates |
| Agent cycling | PageUp/PageDown in Ghostty sends Herdr's Ctrl-Alt-`[` / `]` |
| AeroSpace | 8px gaps; Ghostty=1, Slack=2, DBeaver=3, Zen=4, strays=5 |
| Window controls | Cmd-arrow focus; Cmd-Ctrl-G/S/D/Z summon; Cmd-Ctrl-R reset |
| OMP | Current model roles, Titanium theme, compact status line, Mnemopi preferences, Herdr extensions |

This restores configuration, not a disk image: app logins, API keys, databases,
OMP memories/history, Herdr sessions, and local project checkouts stay outside git.

### Mac: optional shell restoration

The Mac shell template targets Apple Silicon Homebrew (`/opt/homebrew`), matching
the source machine. After installing the Brewfile, install Oh My Zsh and its
Powerlevel10k theme if those directories don't already exist:

```sh
test -d ~/.oh-my-zsh || git clone --depth=1 https://github.com/ohmyzsh/ohmyzsh.git ~/.oh-my-zsh
test -d ~/.oh-my-zsh/custom/themes/powerlevel10k || git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ~/.oh-my-zsh/custom/themes/powerlevel10k
mkdir -p ~/.nvm
chezmoi diff ~/.zshrc ~/.p10k.zsh
chezmoi apply --exclude scripts ~/.zshrc ~/.p10k.zsh
exec zsh
```

Keep the Homebrew installer's `brew shellenv` initialization in `~/.zprofile`.
The tracked shell preserves Powerlevel10k, autosuggestions, syntax highlighting,
autojump, nvm, pyenv, Java 17, local binary paths, and the OpenCode wrapper.
It also matches the live Mac's `omp` alias: update first, launch only if the
update succeeds. Use `command omp` to skip that update when offline.
Node/Python versions and project dependencies are still installed per project.

The Meslo fonts are installed, not forced into Ghostty: its current config leaves
the font family at the terminal default. Local shell secrets belong in
`~/.secrets/shell/env.zsh`, never in the tracked template.

### First-run authentication and runtime checklist

Credentials stay in each tool's normal local credential store or your password
manager. Never copy OAuth databases, API tokens, AWS credential files, or browser
profiles into this repository.

| Service | First-run action |
| --- | --- |
| GitHub | `gh auth login`, then `gh auth setup-git`; confirm access to the private work repos |
| Linear | Configure `LINEAR_API_KEY` through your local secret environment, run `linear config` in a work repo, then `linear team list` |
| OMP | Start `command omp`, use `/login` for the configured providers, and send a harmless prompt to confirm model access |
| Notion | Authorize the configured Notion MCP connection in OMP, then read a page you have permission to access |
| Tailscale | Open Tailscale, sign in to the work tailnet, and confirm it is connected |
| AWS | Configure your team's SSO profile, select it with `AWS_PROFILE`, run `aws sso login`, then `aws sts get-caller-identity` |
| AeroSpace | Open AeroSpace and grant it Accessibility permission in System Settings; confirm it can focus a window |
| Docker | Open Docker Desktop and finish its first-run setup before working on a repo that needs Compose |

The doctor distinguishes verified checks from manual steps. A configured model
or MCP URL is not proof of authentication; Notion authorization and model access
may still require the interactive checks above. No readiness check queries an
application database, deploys anything, or starts a project.

Runtime versions belong to each repo. The doctor reads version files and package
metadata, reports conflicts or missing declarations, and gives targeted next
steps. In a Node repo with `.nvmrc`, use `nvm install` and `nvm use` from that repo.
Honor its `packageManager` declaration rather than installing the latest Yarn
globally. Python and Java requirements likewise come from project declarations;
missing or unsupported declarations need review, not an invented version.
Docker requirements are checked for repos with Compose files. Follow each
project's local development instructions before installing dependencies or
starting services.

### Linux / full configuration

Authenticate GitHub before cloning this private repo:

```sh
gh auth login
gh auth setup-git
chezmoi init https://github.com/briankeefe/dotfiles.git
chezmoi diff
chezmoi apply
```

Default Arch-safe machine data is included so first apply does not stop on
missing template values. Override it when needed:

Minimal example:

```toml
[data]
machine = "personal-laptop"
email = "you@example.com"
work = false
uses_ghostty = true
terminal_font = "FantasqueSansM Nerd Font Mono"
opencode_model = "openai/gpt-5.4"
```

Then restart shell:

```sh
exec zsh
```

## 🖥 Preview

Current focus is clean local-dev ergonomics:

- muted Ghostty palette
- palette-sensitive p10k config
- readable completion + directory colors
- OpenCode global defaults in one place

## 🧠 OpenCode

Global defaults live here:

```text
private_dot_config/opencode/opencode.json.tmpl
private_dot_config/opencode/tui.json
```

Project-specific behavior should stay with each project:

```text
opencode.json
.opencode/agents/
.opencode/commands/
```

## 🤖 Oh My Pi

Oh My Pi (`omp`) is the coding agent. It installs via Bun and stores global
config in `~/.omp`.

### Install

On Arch Linux, bootstrap prepends `~/bin`, `~/.local/bin`, `~/.bun/bin`, and
`~/.opencode/bin` to shell `PATH`, installs Bun when missing, then installs OMP:

```sh
bun install -g @oh-my-pi/pi-coding-agent
```

This puts the `omp` binary on your PATH (`~/.bun/bin/omp`). Verify:

```sh
omp --version
```

Upgrade later with `omp update`.

### Apply configs

`chezmoi apply` (or the bootstrap above) lays the tracked config into `~/.omp`:

```text
private_dot_omp/agent/config.yml          # model roles, theme, memory backend
private_dot_omp/agent/mcp.json            # MCP server toggles
private_dot_omp/agent/commands/           # custom slash commands
private_dot_omp/agent/rules/              # always-apply rules
private_dot_omp/agent/extensions/         # Herdr state reporting and workspace naming
private_dot_omp/agent/skills/             # custom skills (execute toolkit)
private_dot_omp/plugins/                  # plugin manifest
```

Only durable, hand-authored config is tracked. Runtime state stays local and is
never committed: `*.db*`, `blobs/`, `sessions/`, `terminal-sessions/`,
`memories/` (mnemopi), `cache/`, `logs/`, and `plugins/node_modules/`.

### Foreman

Launch or attach with `foreman ~/code` from a terminal outside Herdr. Foreman
coordinates explicitly assigned tasks through independent OMP workers and Git
worktrees, with draft-only PR publication and review-bot feedback.

See the [Foreman cheat sheet](docs/foreman.md) for first use, session names,
reviewer setup, a non-publishing worker trial, daily controls, and recovery.

### Plugins

Enabled: `@baylarsadigov/omp-undo-redo`, `@dietrichgebert/ponytail`, and
`pi-committer`. `pi-rewind` is installed but disabled. Restore their pinned
dependencies after applying the configs:

```sh
bun install --cwd ~/.omp/plugins --frozen-lockfile --ignore-scripts
```

Manage plugins with the CLI:

```sh
omp plugin list
omp plugin install <package>
omp plugin uninstall <package>
```

`package.json` and `bun.lock` capture installed packages;
`omp-plugins.lock.json` preserves enable/disable state. `pi-committer` was active
on the source Mac but missing from its manifest, so it is explicitly included
here at the installed version, `0.12.8`.

The Herdr state extension uses `HERDR_SOCKET_PATH` from its parent pane.
Run OMP inside Herdr for sidebar state and workspace naming. Ticket workspaces
use `ENG-2629-inline-payment-editing`-style labels; a workspace ID is appended
only when that label is already taken. Names stay fixed through compaction and
resume, and `/herdr-name <label>` sets a persistent manual override. Foreman
workers manage their own workspace names. Herdr may regenerate its managed
state extension during upgrades; refresh the snapshot after upgrading.
The completion sound extension is kept as `ding.ts.disabled`. If restoring over
an older dotfiles install, disable or remove its existing `ding.ts` manually;
chezmoi does not delete untracked destination files.

## 🔐 Secrets

Secrets never live in git.

Use local files such as:

```text
~/.secrets/opencode/openai_api_key
```

OpenCode config can reference them with:

```json
"{file:~/.secrets/opencode/openai_api_key}"
```

## ✦ Layout

```text
dotfiles/
├── .chezmoi.toml.tmpl
├── .chezmoiignore
├── dot_zshrc.tmpl
├── dot_p10k.zsh
├── private_dot_config/
│   ├── fastfetch/
│   ├── ghostty/
│   ├── herdr/
│   └── opencode/
├── private_dot_omp/
│   ├── agent/
│   └── plugins/
├── private_dot_secrets/
├── docs/
└── run_once_install-packages.sh.tmpl
```

## 🔄 Daily workflow

Update repo + apply changes:

```sh
chezmoi update
```

Review changes:

```sh
chezmoi diff
```

Edit a managed file:

```sh
chezmoi edit ~/.zshrc
chezmoi edit ~/.config/ghostty/config
chezmoi edit ~/.config/opencode/opencode.json
```

## 🧱 Migration note

This repo still contains older **stow-based** directories from the previous setup.

They are being kept during transition so older configs/history are not lost immediately. The active path forward is **chezmoi** for user-level config that should sync cleanly across machines.

## Why this repo exists

Because rebuilding terminal, prompt, AI tooling, and shell behavior by hand every year is nonsense.
