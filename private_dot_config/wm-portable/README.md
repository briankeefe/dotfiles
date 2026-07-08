# Portable KDE/GNOME window-management draft

Goal: mirror the AeroSpace/Hyprland muscle memory in full desktop environments.

## Shared model

- `Alt+1..5`: switch workspaces/desktops
- `Alt+Shift+1..5`: move focused window to workspace/desktop
- `Ctrl+Super+G/S/D/C`: summon/banish Ghostty, Slack, DataGrip, Chrome
- `Ctrl+Super+R`: reset known apps home, sweep unknowns to workspace 5
- `Ctrl+Super+Shift+X`: lock screen, leaving `Ctrl+Super+Shift+L` free for move-right

## Important limitation

The summon/reset helpers use `wmctrl`, so they are practical on **KDE X11 / GNOME X11**.
On Wayland, KDE/GNOME intentionally do not expose a generic, cross-desktop API for moving/focusing arbitrary app windows the way Hyprland and AeroSpace do. Keybindings can still launch commands, but the window movement part is not expected to work reliably.

## Apply

GNOME:

```sh
~/.config/wm-portable/scripts/apply-gnome-keybindings
```

KDE:

```sh
~/.config/wm-portable/scripts/apply-kde-keybindings
```

The KDE script stages native workspace shortcuts with `kwriteconfig6/5` and writes a `~/.config/khotkeysrc.wm-portable-example` command-shortcut draft. Plasma 6 may require manually adding/importing the command shortcuts in System Settings because KHotKeys support varies.

## Test plan

Static check:

```sh
bash -n ~/.config/wm-portable/scripts/*
```

Runtime X11 check:

```sh
wmctrl -m        # should show your WM/session
wmctrl -d        # should show 5 desktops/workspaces
wmctrl -lx       # confirm app classes match the regexes
~/.config/wm-portable/scripts/wm-summon-app '^(google-chrome|Google-chrome|chromium|Chromium)$' 4
~/.config/wm-portable/scripts/wm-reset-apps-home
```

If class names differ on the target machine, update the regexes after checking `wmctrl -lx`.
