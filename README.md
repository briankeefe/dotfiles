# dotfiles

Portable terminal, shell, and OpenCode setup for Linux machines.

![dotfiles banner](docs/banner.svg)

![managed with chezmoi](https://img.shields.io/badge/managed%20with-chezmoi-8aadf4?style=flat-square)
![legacy stow](https://img.shields.io/badge/legacy-stow-a6da95?style=flat-square)
![shell-zsh](https://img.shields.io/badge/shell-zsh-c6a0f6?style=flat-square)
![terminal-ghostty](https://img.shields.io/badge/terminal-ghostty-f5a97f?style=flat-square)

One repo. New machine in minutes. No rebuilding terminal + AI tooling from memory.

## ✦ Active stack

- **Terminal:** Ghostty
- **Shell:** Zsh + Powerlevel10k
- **System info:** Fastfetch
- **AI tooling:** Oh My Pi (omp) + OpenCode + Context7 MCP
- **Dotfiles manager:** chezmoi

## ⚡ Bootstrap

Fresh machine:

```sh
sh -c "$(curl -fsLS https://get.chezmoi.io)" -- init --apply briankeefe
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
private_dot_omp/agent/extensions/         # event extensions (ding.ts)
private_dot_omp/agent/skills/             # custom skills (execute toolkit)
private_dot_omp/plugins/                  # plugin manifest
```

Only durable, hand-authored config is tracked. Runtime state stays local and is
never committed: `*.db*`, `blobs/`, `sessions/`, `terminal-sessions/`,
`memories/` (mnemopi), `cache/`, `logs/`, and `plugins/node_modules/`.

### Plugins

No plugins are installed by default. Manage them with the CLI:

```sh
omp plugin list
omp plugin install <package>
omp plugin uninstall <package>
```

The tracked `plugins/package.json` + `plugins/omp-plugins.lock.json` capture
which plugins are enabled; run `omp plugin install` after cloning to restore any
listed there.

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
chezmoi edit ~/.config/ghostty/theme.conf
chezmoi edit ~/.config/opencode/opencode.json
```

## 🧱 Migration note

This repo still contains older **stow-based** directories from the previous setup.

They are being kept during transition so older configs/history are not lost immediately. The active path forward is **chezmoi** for user-level config that should sync cleanly across machines.

## Why this repo exists

Because rebuilding terminal, prompt, AI tooling, and shell behavior by hand every year is nonsense.
