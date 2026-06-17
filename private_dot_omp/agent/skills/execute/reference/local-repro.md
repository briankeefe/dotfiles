# Local Repro Instructions

When the user says **"they're asking me to test this locally"**, **"how can I test DRI-XXX / this PR locally?"**, or needs to reproduce a bug against a running stack, follow this. Triggered by `execute local-repro <ticket-or-PR>` or recognized in free text.

This stands up the right stack and authenticates so you can drive the actual flow. It is **not** `execute e2e test` (that records a Playwright test from an already-working flow); this is bring-up + auth to reproduce/verify a change.

**Test against local or QE only — NEVER production URLs** (per `AGENTS.md`).

## Step 1: Identify which layer the change touches

Read the PR/ticket diff first and classify, because it decides what you must run:
- **Server (Dripos)** — route/handler/helper changes. Needs the backend.
- **Web FE (Dripos-React-Partner, Dripos-React-Order)** — needs the FE dev server + a backend it points at.
- **Mobile (Dripos-Dashboard-React-Native = Hub App, Dripos-POS-React-Native, Dripos-React-Native)** — needs Metro + a simulator + a backend.

A single ticket is often split across repos (e.g. DRI-2994 had a server read-side, a Hub App write-side, and a dashboard piece). Reproduce only the layer the PR under test owns, and say which one it is.

## Step 2: Stand up the backend (Dripos)

```bash
cd Dripos
docker compose up            # or `docker compose up -d` then tail logs
# health probe (backend listens on 6969):
curl -s -m3 -o /dev/null -w '%{http_code}\n' http://localhost:6969/api
```
- Config mode lives in `configuration.json` / `local.env` / `qe.env`. `LOCAL` = local docker DB; `QE` = shared QE backend (then you log in with the OTP flow, Step 4).
- A 200/302 from `:6969/api` means it's up. If `docker ps` shows the containers but the port is dead, the app is still booting — wait and re-probe.

## Step 3: Stand up a frontend

### Web FE (React-Partner / React-Order)
Run from the worktree, pick a free port (3000 is often taken; 3005–3007 seen in practice):
```bash
cd <repo>-dri-XXX
PORT=3006 BROWSER=none nohup yarn start > /tmp/dri-XXX-fe.log 2>&1 &
sleep 30
grep -E 'Compiled|compiled successfully|Failed to compile' /tmp/dri-XXX-fe.log | head
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3006
```
`BROWSER=none` stops CRA from opening a tab. Confirm "Compiled successfully" before driving it.

### Mobile (Hub App / POS / Customer RN)
```bash
cd <repo>-dri-XXX
nohup yarn start > /tmp/metro-XXX.log 2>&1 &   # Metro on 8081
sleep 12; lsof -iTCP:8081 -sTCP:LISTEN
yarn ios                                        # builds + boots the simulator
```
For host-level taps the RN dev menu can't reach, `idb` / `cliclick` are available. The app's backend target is in `src/utils`/`src/settings` (`baseURL` / `CONFIG_OPTIONS` / `getBaseUrl`) — confirm it points where you expect (LOCAL `:6969` vs QE) before reproducing.

## Step 4: Authenticate

- **LOCAL backend** — use local seeded credentials.
- **QE backend** — OTP login. The code is in the DB; fetch it via the MySQL MCP if configured. If no DB tool is available this session, surface it as a blocker rather than guessing the code.
- **Reach text-to-start / SMS agent flows** — require a test tenant with a provisioned agent (the `feature/DRI-3029/reach-text-to-start` work). Coordinate to get a test tenant/number; you cannot fabricate inbound SMS.

## Step 5: Drive the flow

- `playwright-cli` is the host-Chrome driver. `-s=dripos` selects the saved Dripos auth/session profile so you skip re-login:
  ```bash
  playwright-cli -s=dripos open --browser=chrome --persistent http://localhost:3006
  ```
  If missing, `npx --no-install playwright-cli ...`.
- Or use the Oh My Pi `browser` tool (`open`, then `run` with `tab.observe`/`tab.click`/`tab.fill`/`tab.screenshot`).
- Walk the **specific** path the change affects (e.g. write path = create/save and inspect the stored value; read path = render and inspect display). State up front what observable result confirms the fix.

## Step 6: Report

State: which layer you ran, against which backend (LOCAL/QE), the exact steps walked, and the observed result vs expected. Tear down dev servers you backgrounded (`kill` the pids / `docker compose down`) if the user wants the machine clean.
