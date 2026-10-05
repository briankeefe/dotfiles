return function(selector)
  local workspace = hl.get_workspace(selector)
  hl.dispatch(hl.dsp.focus({
    workspace = selector,
    on_current_monitor = workspace == nil or not workspace.visible,
  }))
end
