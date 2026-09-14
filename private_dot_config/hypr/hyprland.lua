-- Omarchy-derived Hyprland session. KDE/Plasma configuration remains separate.
local home = os.getenv("HOME")
local omarchy_path = home .. "/.local/share/omarchy-derived/upstream"
package.path = home .. "/.local/state/?.lua;" .. home .. "/.config/?.lua;" .. omarchy_path .. "/?.lua;" .. package.path

require("default.hypr.helpers")
require("default.hypr.envs")
require("default.hypr.looknfeel")
require("default.hypr.input")
require("default.hypr.windows")
require("default.hypr.require_optional").module("omarchy.current.theme.hyprland")

hl.config({
  input = {
    kb_options = "",
  },
  general = {
    border_size = 3,
  },
  decoration = {
    rounding = 6,
  },
  group = {
    groupbar = {
      gradient_rounding = 4,
    },
  },
})
hl.animation({ leaf = "layersIn", enabled = false })
hl.animation({ leaf = "layersOut", enabled = false })
o.window({ class = "^org[.]telegram[.]desktop.*$" }, { focus_on_activate = false })
o.window({ class = "^steam$", title = "^Steam$" }, { tile = true })

hl.monitor({ output = "", mode = "preferred", position = "auto", scale = 1 })
hl.monitor({ output = "DP-2", mode = "preferred", position = "0x0", scale = 1 })
hl.monitor({ output = "DP-3", mode = "2560x1440@170", position = "1920x0", scale = 1.25 })
hl.monitor({ output = "HDMI-A-1", mode = "preferred", position = "3968x-498", scale = 1.25, transform = 3 })
hl.env("OMARCHY_PATH", omarchy_path)
hl.env("XDG_CURRENT_DESKTOP", "Hyprland")
hl.env("XDG_SESSION_DESKTOP", "Hyprland")

hl.on("hyprland.start", function()
  hl.exec_cmd("systemctl --user import-environment WAYLAND_DISPLAY XDG_CURRENT_DESKTOP XDG_SESSION_DESKTOP")
  hl.exec_cmd("dbus-update-activation-environment --systemd WAYLAND_DISPLAY XDG_CURRENT_DESKTOP XDG_SESSION_DESKTOP")
  hl.exec_cmd("env OMARCHY_PATH=" .. o.shell_quote(omarchy_path) .. " PATH=" .. o.shell_quote(omarchy_path .. "/bin:" .. (os.getenv("PATH") or "/usr/bin")) .. " quickshell -p " .. o.shell_quote(omarchy_path .. "/shell"))
  hl.exec_cmd("hypridle")
  hl.exec_cmd("udiskie --automount --no-notify --no-tray")
end)

-- Applications and desktop surfaces.
o.bind("SUPER + RETURN", "Terminal", "uwsm app -- ghostty")
o.bind("SUPER + SPACE", "Applications", "fuzzel")
o.bind("SUPER + ALT + SPACE", "Applications", "fuzzel")
o.bind("SUPER + T", "Theme switcher", "export OMARCHY_PATH=" .. o.shell_quote(omarchy_path) .. " PATH=" .. o.shell_quote(omarchy_path .. "/bin") .. ":\"$PATH\"; theme=$(omarchy-theme-switcher); [[ -n $theme ]] && omarchy-theme-set \"$theme\"")
o.bind("SUPER + E", "Files", "uwsm app -- dolphin")
o.bind("SUPER + B", "Browser", "uwsm app -- google-chrome-stable")
o.bind("SUPER + D", "Discord", "uwsm app -- discord")
o.bind("SUPER + ESCAPE", "System menu", home .. "/.local/bin/omarchy-derived-system-menu")
o.bind("SUPER + PRINT", "Screenshot display", home .. "/.local/bin/omarchy-derived-screenshot --display")
o.bind("SUPER + CTRL + E", "Emojis", "quickshell ipc -p " .. o.shell_quote(omarchy_path .. "/shell") .. " call shell toggle omarchy.emojis '{}'")
o.bind("SUPER + CTRL + A", "Audio panel", "quickshell ipc -p " .. o.shell_quote(omarchy_path .. "/shell") .. " call shell toggle omarchy.audio '{}'")
o.bind("SUPER + CTRL + B", "Bluetooth panel", "quickshell ipc -p " .. o.shell_quote(omarchy_path .. "/shell") .. " call shell toggle omarchy.bluetooth '{}'")
o.bind("SUPER + CTRL + W", "Network panel", "quickshell ipc -p " .. o.shell_quote(omarchy_path .. "/shell") .. " call shell toggle omarchy.network '{}'")
o.bind("SUPER + CTRL + P", "Power panel", "quickshell ipc -p " .. o.shell_quote(omarchy_path .. "/shell") .. " call shell toggle omarchy.power '{}'")
o.bind("SUPER + SLASH", "Keybindings", home .. "/.local/bin/omarchy-derived-keybindings")
o.bind("SUPER + L", "Lock", "hyprlock")

-- Window management.
o.bind("SUPER + Q", "Quit application", require("hypr.quit-application"), { release = true })
o.bind("SUPER + W", "Close window", hl.dsp.window.close())
o.bind("SUPER + F", "Fullscreen", hl.dsp.window.fullscreen({ mode = "fullscreen" }))
o.bind("SUPER + LEFT", "Focus left", hl.dsp.focus({ direction = "l" }))
o.bind("SUPER + RIGHT", "Focus right", hl.dsp.focus({ direction = "r" }))
o.bind("SUPER + UP", "Focus up", hl.dsp.focus({ direction = "u" }))
o.bind("SUPER + DOWN", "Focus down", hl.dsp.focus({ direction = "d" }))
local function has_tiled_window(window, direction)
  local center = window.at.x + window.size.x / 2
  for _, other in ipairs(hl.get_workspace_windows(window.workspace)) do
    if other.address ~= window.address and not other.floating then
      local other_center = other.at.x + other.size.x / 2
      if (direction == "l" and other_center < center) or (direction == "r" and other_center > center) then
        return true
      end
    end
  end

  return false
end

local function move_window_horizontally(targets, direction)
  return function()
    local window = hl.get_active_window()
    if not window then
      return
    end

    if has_tiled_window(window, direction) then
      hl.dispatch(hl.dsp.window.move({ direction = direction }))
      return
    end

    local target = targets[window.monitor.name]
    if target then
      hl.dispatch(hl.dsp.window.move({ monitor = target, follow = true }))
      local arrival_direction = direction == "r" and "l" or "r"
      if has_tiled_window(window, arrival_direction) then
        hl.dispatch(hl.dsp.window.move({ direction = arrival_direction }))
      end
    end
  end
end

o.bind("SUPER + SHIFT + LEFT", "Move window left", move_window_horizontally({ ["DP-3"] = "DP-2", ["HDMI-A-1"] = "DP-3" }, "l"))
o.bind("SUPER + SHIFT + RIGHT", "Move window right", move_window_horizontally({ ["DP-2"] = "DP-3", ["DP-3"] = "HDMI-A-1" }, "r"))
o.bind("SUPER + SHIFT + UP", "Move window up", hl.dsp.window.move({ direction = "u" }))
o.bind("SUPER + SHIFT + DOWN", "Move window down", hl.dsp.window.move({ direction = "d" }))
o.bind("SUPER + ALT + S", "Toggle split orientation", hl.dsp.layout("togglesplit"))
o.bind("ALT + TAB", "Next window", hl.dsp.window.cycle_next())
o.bind("SUPER + mouse:272", "Move window", hl.dsp.window.drag(), { mouse = true })
o.bind("SUPER + mouse:273", "Resize window", hl.dsp.window.resize(), { mouse = true })

for workspace = 1, 10 do
  local key = "code:" .. tostring(workspace + 9)
  o.bind("SUPER + " .. key, "Workspace " .. workspace, hl.dsp.focus({ workspace = tostring(workspace) }))
  o.bind("SUPER + SHIFT + " .. key, "Move to workspace " .. workspace, hl.dsp.window.move({ workspace = tostring(workspace) }))
end

o.bind("SUPER + TAB", "Next workspace", hl.dsp.focus({ workspace = "e+1" }))
o.bind("SUPER + SHIFT + TAB", "Previous workspace", hl.dsp.focus({ workspace = "e-1" }))
o.bind("SUPER + S", "Toggle scratchpad", hl.dsp.workspace.toggle_special("scratchpad"))
o.bind("SUPER + SHIFT + S", "Screenshot region", home .. "/.local/bin/omarchy-derived-screenshot")

-- Media and hardware keys.
o.bind("XF86AudioRaiseVolume", "Volume up", "wpctl set-volume -l 1.5 @DEFAULT_AUDIO_SINK@ 5%+", { repeating = true, locked = true })
o.bind("XF86AudioLowerVolume", "Volume down", "wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%-", { repeating = true, locked = true })
o.bind("XF86AudioMute", "Mute audio", "wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle", { locked = true })
o.bind("XF86AudioMicMute", "Mute microphone", "wpctl set-mute @DEFAULT_AUDIO_SOURCE@ toggle", { locked = true })
o.bind("XF86AudioPlay", "Play or pause", "playerctl play-pause", { locked = true })
o.bind("XF86AudioNext", "Next track", "playerctl next", { locked = true })
o.bind("XF86AudioPrev", "Previous track", "playerctl previous", { locked = true })
o.bind("XF86MonBrightnessUp", "Brightness up", "brightnessctl set 5%+", { repeating = true, locked = true })
o.bind("XF86MonBrightnessDown", "Brightness down", "brightnessctl set 5%-", { repeating = true, locked = true })
