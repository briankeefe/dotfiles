#!/bin/sh
# Preserve credential helpers, signing configuration and repository-local overrides.
set -eu
case "${1:-}" in
  --help) printf '%s\n' 'Usage: sh macos/configure-git.sh' 'Prompts for author identity and confirms five global Git settings.'; exit 0 ;;
  '') ;;
  *) printf '%s\n' 'Unexpected argument; use --help.' >&2; exit 2 ;;
esac
command -v git >/dev/null 2>&1 || { echo 'Install Git first.' >&2; exit 1; }
name=$(git config --global --get user.name || true)
email=$(git config --global --get user.email || true)
name=${name:-briankeefe}
email=${email:-brian.c.keefe@gmail.com}
printf 'Git author name [%s]: ' "$name"
IFS= read -r answer || { echo 'Interactive input required.' >&2; exit 1; }
name=${answer:-$name}
printf 'Git author email [%s]: ' "$email"
IFS= read -r answer || { echo 'Interactive input required.' >&2; exit 1; }
email=${answer:-$email}
case "$email" in
  *@*) ;;
  *) echo 'Enter an email address.' >&2; exit 1 ;;
esac
printf '\nProposed global Git settings:\n  user.name = %s\n  user.email = %s\n  init.defaultBranch = main\n  fetch.prune = true\n  pull.ff = only\n' "$name" "$email"
printf 'Apply these settings? [y/N] '
IFS= read -r answer || exit 1
case "$answer" in
  y|Y|yes|YES) ;;
  *) echo 'Git settings unchanged.'; exit 0 ;;
esac
git config --global user.name "$name"
git config --global user.email "$email"
git config --global init.defaultBranch main
git config --global fetch.prune true
git config --global pull.ff only
printf '%s\n' 'Git defaults saved. Existing branches, credential helpers and signing settings are unchanged.'
