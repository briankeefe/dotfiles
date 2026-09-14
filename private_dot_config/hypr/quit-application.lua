local function send_once(window, mods, key)
  local target = "address:" .. window.address
  hl.dispatch(hl.dsp.send_key_state({ mods = mods, key = key, state = "down", window = target }))
  -- Match the existing clipboard bindings' workaround for repeating synthetic keys.
  hl.timer(function()
    if hl.get_window(target) then
      hl.dispatch(hl.dsp.send_key_state({ mods = mods, key = key, state = "up", window = target }))
    end
  end, { timeout = 50, type = "oneshot" })
end

return function()
  local window = hl.get_active_window()
  if not window then return end

  if window.class == "google-chrome" then
    -- Chrome's normal Exit command is Alt+F, then X, not Ctrl+Q.
    send_once(window, "ALT", "f")
    hl.timer(function()
      local active = hl.get_active_window()
      if active and active.address == window.address then
        send_once(window, "", "x")
      end
    end, { timeout = 150, type = "oneshot" })
  else
    local mods = window.class == "com.mitchellh.ghostty" and "CTRL SHIFT" or "CTRL"
    send_once(window, mods, "q")
  end
end
