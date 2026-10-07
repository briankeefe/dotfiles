local focused = "middle"
local workspaces = {
  ["1"] = { monitor = "left", visible = false },
  ["2"] = { monitor = "left", visible = true },
}
hl = {
  get_workspace = function(selector) return workspaces[selector] end,
  dsp = { focus = function(options)
    return function()
      local workspace = workspaces[options.workspace]
      if not workspace then
        workspace = { monitor = focused, visible = false }
        workspaces[options.workspace] = workspace
      end
      if options.on_current_monitor then workspace.monitor = focused end
      focused = workspace.monitor
      workspace.visible = true
    end
  end },
  dispatch = function(action) action() end,
}
local focus = dofile("private_dot_config/hypr/focus-workspace.lua")
focus("1")
assert(focused == "middle" and workspaces["1"].monitor == "middle", "Hidden workspace did not follow focus")
focus("2")
assert(focused == "left" and workspaces["2"].monitor == "left", "Visible workspace was pulled off its monitor")
focused = "middle"
focus("3")
assert(focused == "middle" and workspaces["3"].monitor == "middle", "New workspace opened on the wrong monitor")
print("PASS: hidden and new workspaces follow focus; visible workspaces stay put")
