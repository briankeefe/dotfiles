This directory is documentation only.

Do not store real secrets in the dotfiles repository.

Store real secrets outside git, for example:

- ~/.secrets/opencode/openai_api_key
- ~/.secrets/opencode/anthropic_api_key

Prefer OpenCode config references like:

- {file:~/.secrets/opencode/openai_api_key}
- {env:OPENAI_API_KEY}
