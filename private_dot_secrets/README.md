This directory is documentation only.

Do not store real secrets in the dotfiles repository.

Store real secrets outside git, for example:

- ~/.secrets/opencode/openai_api_key
- ~/.secrets/opencode/anthropic_api_key

Prefer OpenCode config references like:

- {file:~/.secrets/opencode/openai_api_key}
- {env:OPENAI_API_KEY}

## Shell environment secrets

Exported shell secrets (API keys, tokens) live in a local, untracked file:

- `~/.secrets/shell/env.zsh` (mode 0600)

`dot_zshrc.tmpl` sources it automatically if present:

```sh
[ -f "$HOME/.secrets/shell/env.zsh" ] && source "$HOME/.secrets/shell/env.zsh"
```

Put `export KEY=value` lines there. Never inline secrets in `~/.zshrc`.
