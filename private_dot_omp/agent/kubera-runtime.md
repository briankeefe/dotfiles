# Kubera: local runtime and deployment facts

Read before local startup or verification; reuse this recipe instead of rediscovering the setup/env/task graph. These facts were inspected in `/Users/brian/code/app`; if the assigned worktree changes these contracts, inspect only the affected source listed below.

## Isolated local runtime

- Work only in the task-owned feature worktree. Reuse `/Users/brian/code/app/.neonrc` by sourcing it privately with exported variables; do not copy another checkout's `.env`, connection URI, DB host or runtime DB target. Never print `.neonrc` or commit credentials. `setup-env.sh dev` itself prints connection URIs: invoke sourcing and setup in the same Eval `subprocess.run(..., capture_output=True, text=True)` call and report only its exit code/sanitized status, never raw stdout/stderr.
- First setup: `./scripts/setup-env.sh dev "$TENANT"` creates/reuses both the App and Claims Import Scratchpad branches named from the current git branch (non-alphanumeric characters except `_`/`-` replaced by `-`, truncated to 63). All tenant schemas come from the snapshot; the tenant argument selects `LOCAL_DEV_TENANT`. Resume with `dev:env "$TENANT"` only for existing branches: the script checks both projects, and afterward privately confirm generated `ENV_NAME` equals this sanitized branch, `LOCAL_DEV=true`, and `LOCAL_DEV_TENANT` equals the requested tenant. Also check effective `.env.local` values; a successful rewrite alone is not a postcheck.
- Build API dependency closure from the worktree root: `pnpm exec turbo run build --filter='trpc-api...'`. `turbo.json` uses `dependsOn: ["^build"]`; API workspace dependencies are in `src/assets/api/package.json`. For other scopes, use the actual package name/dependency graph and its package-specific `turbo.json`, not a remembered list of four layers. Keep the checked-in TypeScript/build gates; do not bypass failed typechecks or substitute esbuild-only commands.
- API `src/env.ts` loads `.env` then `.env.local` with `override: true`: both override shell values and `.env.local` wins. Preserve existing files; merge only task-owned settings into API `.env.local`: `PORT`, `APP_BASE_URL`, `LOCAL_DEV_USER_SUB`, and for modeler work `CSM_REBUILD_IN_PROCESS=true`. Do not assume `PORT=... pnpm dev` or a shell user override survives. Restart after `.env.local` changes; nodemon watches `src`/`.env`, not `.env.local`.
- Reserve two currently free dedicated ports (`lsof -nP -iTCP:<port> -sTCP:LISTEN`); occupied means choose another, never kill someone else's runtime. Pair frontend `VITE_AWS_API_GATEWAY_URL=http://localhost:<api-port>` and `VITE_CHAT_STREAM_URL=http://localhost:<api-port>` with that API; merge them into frontend `.env.local` without replacing setup's other values. Chat uses its stream override if present, otherwise the API URL, and appends `/chat/stream`. Use Vite `--strictPort` so a collision cannot silently send you elsewhere.
- `LOCAL_DEV` bypasses Cognito, not database-backed capabilities. Choose a real user `sub_id` and existing intended role from the selected tenant snapshot using the repo's entity/tooling conventions; use that sub as `LOCAL_DEV_USER_SUB`. Capability lookup joins users → roles → capabilities; the generated imaginary `local-dev-user` is not proof of super-admin access. Test intended allowed/denied roles without altering production users or role grants.
- Before browser tests, `/health` must return `status=ok`, `environment=<sanitized task branch>`, `database=connected`. This probes the Kubera DB, not tenant/user correctness; verify those separately. In the browser, confirm actual origin/served worktree and Network requests target your paired API (including chat stream); a configured URL or an open stale tab is not evidence.
- For isolated contract scenario modeler work, set effective `CSM_REBUILD_IN_PROCESS=true` **before API boot**. Trigger the rebuild on branch data, then wait for the job's successful terminal status/completion timestamp and rendered refreshed results (including reload). `started=true`, an enqueue response, or a green HTTP mutation is not a completed rebuild. Inspect failed jobs rather than retrying blindly.

Minimal sequence, after choosing the assigned worktree, tenant, real snapshot user and free ports (replace values; do not run against main or cloud DBs):

```bash
WORKTREE=/absolute/path/to/task-worktree
TENANT=hpmc
API_PORT=3101
UI_PORT=5174
USER_SUB='existing-snapshot-user-sub'
cd "$WORKTREE"
# Export config only; no DB targets copied from main. Capture sourcing + setup together in Eval.
set -a; source /Users/brian/code/app/.neonrc; set +a
./scripts/setup-env.sh dev "$TENANT"  # captured output only; resume: dev:env with postchecks above
pnpm exec turbo run build --filter='trpc-api...'
# Merge API .env.local: PORT=$API_PORT, LOCAL_DEV_USER_SUB=$USER_SUB,
# APP_BASE_URL=http://localhost:$UI_PORT, CSM_REBUILD_IN_PROCESS=true (modeler).
# Merge frontend .env.local: both VITE URL settings=http://localhost:$API_PORT.
# Terminal 1, from this worktree:
pnpm --dir src/assets/api dev
# Terminal 2, same worktree and chosen UI_PORT:
pnpm --dir src/assets/frontend dev --host 127.0.0.1 --port "$UI_PORT" --strictPort
# Terminal 3, same API_PORT:
curl --fail --silent "http://localhost:$API_PORT/health" | jq '{status,environment,database}'
```

Do not run `dev:refresh`/`dev:down`, remove env files, stop unrelated services, or write production data as incidental cleanup. Preserve existing settings and use only the task's isolated DB for authorized mutations.

## Deployment verification

Keep AWS account IDs, profiles, regions, and deployment resource names in machine-local notes, not this public repository. Verify the intended identity with `aws sts get-caller-identity` before reading deployment state; never fall back silently to another profile or account.

Use `skill://execute/reference/ops-facts.md` for execution-specific **read-only** monitoring and revision/stage evidence; project source is `docs/engineering/deploy-pipelines.md`, `src/stacks/pipeline-stack.ts`, and `src/constructs/deploy-pipeline.ts`. Reading deployment state does not authorize starting/retrying a pipeline, deploying, migrating, tagging or mutating production.

## Private standup defaults

For Brian's Kubera standup, invoke the installed collector with `--root /Users/brian/code --timezone America/New_York --linear-assignee brian --linear-workspace kuberahealth`. These are local selections, not public skill defaults. Use the collector's exact window and source/limit disclosures; independently support work claims with dated personal activity.

## Source anchors

`./scripts/setup-env.sh` (usage, `.neonrc`, branch naming, `cmd_dev_up`, `cmd_dev_env`, generated env); `src/assets/api/src/env.ts`; `src/assets/api/.env.example`; API/frontend `package.json`; root `package.json`, `pnpm-workspace.yaml`, `turbo.json`; `src/assets/frontend/src/environment.ts`, `src/assets/frontend/src/features/chat/Chat.tsx`; `src/assets/api/src/middlewares/authMiddleware.ts`, `src/assets/api/src/util/getUserCapability.ts`, `src/assets/api/src/routes/healthCheckRouter.ts`; `src/assets/api/src/procedures/contract-scenario-model/{scenarioModelRebuild.ts,csm/enqueueScenarioRebuild.ts,getContractScenarioModelRebuildJob.ts}`. The frontend environment file is directly under `src`, not `src/util`.
