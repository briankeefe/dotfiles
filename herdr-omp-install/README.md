# herdr x omp: the "stop lying about being idle" pack

You run [herdr](https://herdr.dev). You run a swarm of Oh My Pi agents inside it.
Two problems show up fast:

1. The sidebar swears every agent is **idle** while they're clearly grinding.
2. You have 8 panes across 3 repos and no idea which one is doing what.

This fixes both. Two OMP extensions and a one-shot installer that doesn't touch
anything it wasn't invited to.

## The two extensions

**`herdr-omp-agent-state.ts`** teaches OMP to tell herdr the truth. Working,
blocked, idle. The stock integration flaps to "idle" the second a provider
hiccups (overloaded, 429, socket hang up) and herdr's auto-retry kicks in. This
one holds the pane in **Working** through the retry and ignores the duplicate
`agent_end` events that caused the false idle in the first place. So the dot
stays green while the agent is actually alive.

**`herdr-workspace-namer.ts`** reads your first prompt and renames the workspace
so future-you knows what past-you started:

- ticket in the prompt -> `DRI-1234`
- reviewing a PR -> `[review: PR-1773]`
- everything else -> a short kebab slug like `fix-checkout-regression`

Ticket and review names stick. Ad-hoc names keep tracking as the task drifts.
Hate the guess? `/herdr-name whatever-you-want` and it's yours. Want it gone?
`HERDR_NAMER_DISABLE=1`.

## Install (the whole thing is one command)

```sh
git clone https://github.com/briankeefe/dotfiles.git
cd dotfiles/herdr-omp-install
./install.sh
```

Restart your OMP panes so they pick up the extensions. That's it.

Nervous? Look before you leap. This changes nothing and just tells you what's
out of date:

```sh
./install.sh --check
```

Weird setup? Point it wherever you keep things:

```sh
OMP_EXT_DIR=~/.omp/agent/extensions \
HERDR_CONFIG=~/.config/herdr/config.toml \
  ./install.sh
```

The installer is a good houseguest. It copies the two extensions, flips exactly
**one** herdr config key (`show_agent_labels_on_pane_borders`), backs up your
config before it writes, and is fully idempotent. Run it a hundred times, same
result. It will **not** mess with your sort order, your theme, or your vibe.

## Three things that will bite you

**"It still says idle."** The extension can only report if herdr launched OMP
through its integration, which sets `HERDR_ENV=1`, `HERDR_SOCKET_PATH`, and
`HERDR_PANE_ID`. Run `echo $HERDR_ENV` in a pane. If it's empty, there's no
socket to talk to and no extension on earth can help. Fix the launch path first.

**herdr eats the state file.** Its own header says herdr manages it and
reinstalling the integration overwrites it. The retry-hold and duplicate-event
guard are handrolled on top. If you update the herdr integration and the idle
lies come back, just re-run `./install.sh`. Takes a second.

**It won't touch your sort order.** On purpose. An earlier draft did and it got
caught red-handed stomping a real config during testing. Now it only sets the
one key that makes labels show up. You're welcome.

## Tests, because this isn't script slop

```sh
./test/run-tests.sh        # 37 assertions
./test/run-tests.sh -v     # show captured output on failure
```

No bats, no framework, no `npm install`. Just bash and awk in a throwaway
sandbox HOME. It covers the scary part (a section-aware TOML editor:
`lib/upsert-toml.awk`) across append, replace, idempotency, leaving other
sections alone, ignoring commented-out keys, and keys with regex metacharacters.
Then it runs the real installer end to end: fresh install, byte-exact
extensions, existing config preserved, no-op on re-run, and `--check` catching
drift vs. reporting all clear.

If a test fails, the pack is broken. If they pass, it does what this README says.
