# dotfiles

Linux desktop dotfiles for a fast, minimal setup.

![managed with stow](https://img.shields.io/badge/managed%20with-stow-8aadf4?style=flat-square)
![shell-zsh](https://img.shields.io/badge/shell-zsh-a6da95?style=flat-square)
![editor-neovim](https://img.shields.io/badge/editor-neovim-c6a0f6?style=flat-square)
![platform-linux](https://img.shields.io/badge/platform-linux-f5a97f?style=flat-square)

This repo holds the configs I actually use day to day: shell, editor, terminal, compositor, bar, launcher, and desktop theming.

## ✦ Stack

- **Shell:** zsh, fish, bash
- **Editor:** neovim
- **Terminal:** kitty, alacritty
- **WM / Desktop:** hyprland, waybar, wofi, wlogout
- **Extras:** tmux, picom, gtk, xorg, spicetify

## ⚡ Bootstrap

Clone repo:

```sh
git clone git@github.com:briankeefe/dotfiles.git ~/dotfiles
cd ~/dotfiles
```

Install GNU Stow:

```sh
# Arch
sudo pacman -S stow

# Gentoo
doas emerge -av app-admin/stow
```

Then symlink whichever configs you want:

```sh
stow alacritty fish kitty nvim picom tmux vscode xorg zsh
```

You can stow multiple packages in one command.

## ✦ Layout

```text
dotfiles/
├── alacritty/
├── bash/
├── fish/
├── git/
├── gtk-3.0/
├── hypr/
├── kitty/
├── nvim/
├── picom/
├── spicetify/
├── tmux/
├── vscode/
├── waybar/
├── wlogout/
├── wofi/
├── xorg/
└── zsh/
```

## 🛠 Usage

Stow single package:

```sh
stow nvim
```

Restow after changing files:

```sh
stow -R nvim zsh kitty
```

Remove package symlinks:

```sh
stow -D tmux
```

## ⚠ Notes

Some configs are more machine-specific than others.

I would **not** blindly stow everything on every machine. In particular:

- `git` may contain personal machine/account assumptions
- `xorg` may depend on monitor layout
- `hypr` / `waybar` may assume local display hardware and paths

Pick packages intentionally.

## 📦 Packages

Stow only manages symlinks. You still need the underlying applications installed.

Install the tools you actually use first, then stow only the matching config directories.

## 🖼 Wallpapers

Wallpapers are intentionally not tracked here.

## ✦ Why this repo exists

Because rebuilding a terminal + editor + desktop setup from memory is garbage.

This repo keeps the moving parts in one place and makes it easy to re-link the pieces I actually want on a machine.
