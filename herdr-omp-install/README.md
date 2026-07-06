# herdr + omp integration

Two OMP extensions that make [herdr](https://herdr.dev) usable with Oh My Pi,
plus a one-shot installer.

## What's here

| File | Purpose |
|------|---------|
| `extensions/herdr-omp-agent-state.ts` | Reports working/blocked/idle state to the herdr pane. Fixes the "always says idle" bug: guards duplicate/late `agent_end` events and holds the pane in Working through provider auto-retries instead of flapping to idle. |
| `extensions/herdr-workspace-namer.ts` | Auto-renames the herdr workspace after the task in your first prompt (`DRI-1234`, `[review: PR-1773]`, or a kebab slug). Override with `/herdr-name <label>`. So you stop forgetting which pane does what. |
| `install.sh` | Copies both extensions into your OMP extensions dir and ensures the one herdr config key that surfaces pane labels. Idempotent, backs up config before changes. |
| `lib/upsert-toml.awk` | Section-aware TOML key upsert used by the installer. |
| `test/run-tests.sh` | Self-contained test suite (bash + awk, no deps). |

## Install

```sh
./install.sh
```

Then restart your OMP panes so the extensions load (OMP auto-loads everything
in `~/.omp/agent/extensions/`).

Dry run, changes nothing, exits non-zero if anything is out of date:

```sh
./install.sh --check
```

Paths are overridable (used by the tests, handy if your layout differs):

```sh
OMP_EXT_DIR=~/.omp/agent/extensions \
HERDR_CONFIG=~/.config/herdr/config.toml \
  ./install.sh
```

## Gotchas

- **Env vars.** The state extension only reports if herdr launched OMP through
  its integration, which sets `HERDR_ENV=1`, `HERDR_SOCKET_PATH`,
  `HERDR_PANE_ID`. If it still shows idle, run `echo $HERDR_ENV` in a pane.
  Empty means the socket isn't wired up and no extension can help. Fix that first.
- **herdr overwrites the state file.** Its header says herdr manages it and
  reinstalling the integration overwrites it. The retry-hold logic and the
  duplicate-`agent_end` guard are local hardening. Re-run `./install.sh` after
  any herdr integration update or it reverts to the flappy stock version.
- **Sort order is yours.** The installer only touches
  `show_agent_labels_on_pane_borders`. It will not change `agent_panel_sort`,
  theme, or anything else.

## Tests

```sh
./test/run-tests.sh        # 37 assertions across upsert + install
./test/run-tests.sh -v     # echo captured output on failure
```

Covers: TOML upsert (append/replace/idempotent/other-section isolation/commented
lines/regex-meta keys) and the installer (fresh install, byte-exact extensions,
preserve existing config, idempotent re-run, `--check` drift vs clean).
