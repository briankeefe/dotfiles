# Ops Facts (observability + deploy)

Durable Dripos operational knowledge that recurs as one-off questions. Read the relevant section before answering or acting; verify against the repo rather than reciting if the user implies it may have changed.

---

## PostHog & logging

### Two distinct keys — do not confuse them
- **Project ingestion key** `phc_...` — used by the app to *send* events. The client reads it from `process.env.POSTHOG_API_KEY` (e.g. `src/util/PostHogClient.ts`). Belongs in app env config.
- **Personal API key** `phx_...` — authenticates the *read/query* API (HogQL) **as you**. It is not app config — treat it like an SSH key.
  - Store in shell profile: `export POSTHOG_PERSONAL_API_KEY=phx_...` in `~/.zshrc` (or macOS Keychain via `security add-generic-password` if plaintext is unwanted). **Never commit either key to a repo.**
  - Use it as `Authorization: Bearer $POSTHOG_PERSONAL_API_KEY` against the query API.
  - If a key gets pasted into a chat/transcript, recommend rotating it (PostHog → Settings → Personal API keys).

### Where logging lives (check before adding new logs)
- **Server (Dripos)** emits PostHog events directly inside helpers — e.g. `item_added_to_cart` in `insertLineItems`. Ticket helpers live in the **`frostbyte-tickets`** package, not the app repo.
- **RN apps** route logs by severity through a helper: `src/helpers/logging-helper.ts` (Dripos-React-Native), POS uses `src/utils/logging-helper.js` + `src/utils/posthog-helper.ts`.
- **Sentry is being removed from POS in favor of PostHog-by-severity** (DRI-3089 / DRI-2888). New client logging should go through the PostHog helper, not Sentry.

### Parity rule
Before adding a client-side log for an action, **check whether the server already emits the equivalent PostHog event.** The server fires on the actual mutation (e.g. add-to-cart, ticket fire via `sendTicket` → `POST tickets/:ticket`). Adding a duplicate client event double-counts. If the server lacks it for the specific action (e.g. the *fire* action vs *add-to-cart*), the client instrument is justified — say which gap it fills.

---

## POS staging deploy (OTA / CodePush)

### Do I need to bump the version when redeploying POS to staging?
**Usually no.** Staging deploy is **OTA/CodePush, not a store build.**
- Pushing to the `staging` branch triggers `deploy-ota-staging.yaml`, which calls the reusable `deploy-codepush.yaml@master` with `configuration: STAGING`. It can also be run via `workflow_dispatch`.
- CodePush ships a JS bundle to the existing native binary and auto-increments its own release label. Nothing to bump manually.
- **Bump only for native changes**: a new/updated native module, a pod/gradle dependency, or an `app.json` / `Info.plist` / manifest change. Pure-JS diffs (`src/**` `.js`/`.ts`) ride OTA untouched. `__tests__/` files don't ship.

### `staging` is not `master`
OTA fires on push to the **`staging`** branch. A PR merged to `master` is **not** on staging until staging is updated. To confirm what is actually live:
```bash
# is the merge commit on staging?
gh api repos/Frostbyte-Technologies/Dripos-POS-React-Native/compare/staging...<sha> \
  --jq '{status,ahead_by,behind_by}'
# recent staging OTA runs + the SHA each shipped:
gh run list --repo Frostbyte-Technologies/Dripos-POS-React-Native \
  --workflow deploy-ota-staging.yaml --limit 8 \
  --json databaseId,displayTitle,headBranch,headSha,status,conclusion,createdAt,event
gh run watch <databaseId> --repo Frostbyte-Technologies/Dripos-POS-React-Native --exit-status
```
The live staging bundle is the SHA of the **last successful** run, not the latest merge. A PR that merged after the last green deploy is not live until the next run finishes.
