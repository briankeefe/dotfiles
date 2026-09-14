#!/bin/sh
# Run explicitly on the destination Mac. No Dock app lists or device identifiers.
set -eu
[ "$(uname -s)" = Darwin ] || { echo 'macOS only' >&2; exit 1; }

defaults write NSGlobalDomain AppleInterfaceStyle -string Dark
defaults write NSGlobalDomain com.apple.swipescrolldirection -bool true

defaults write com.apple.dock autohide -bool true
defaults write com.apple.dock tilesize -int 60
defaults write com.apple.dock wvous-tl-corner -int 3
defaults write com.apple.dock wvous-tl-modifier -int 0
defaults write com.apple.dock wvous-tr-corner -int 4
defaults write com.apple.dock wvous-tr-modifier -int 0
defaults write com.apple.dock wvous-br-corner -int 2
defaults write com.apple.dock wvous-br-modifier -int 0

# Built-in trackpad: no tap-to-click or three-finger dragging; right-click enabled.
defaults write com.apple.AppleMultitouchTrackpad Clicking -bool false
defaults write com.apple.AppleMultitouchTrackpad TrackpadRightClick -bool true
defaults write com.apple.AppleMultitouchTrackpad TrackpadThreeFingerDrag -bool false
defaults write com.apple.AppleMultitouchTrackpad TrackpadPinch -bool true
defaults write com.apple.AppleMultitouchTrackpad TrackpadRotate -bool true
defaults write com.apple.AppleMultitouchTrackpad TrackpadTwoFingerDoubleTapGesture -int 1
defaults write com.apple.AppleMultitouchTrackpad TrackpadTwoFingerFromRightEdgeSwipeGesture -int 3

# Free Cmd-Ctrl-D for AeroSpace's DataGrip summon without replacing other shortcuts.
defaults write com.apple.symbolichotkeys AppleSymbolicHotKeys -dict-add 70 '<dict><key>enabled</key><false/></dict>'
printf '%s\n' 'Preferences saved. Log out and back in to activate all changes.'
