# Kubera app: personal navigation and internal test invitations

Before local startup or verification, read [`kubera-runtime.md`](kubera-runtime.md) for the isolated worktree/tenant recipe and deployment-verification guidance; do not retrace the source unless that contract changed.

This is a personal supplement, not a replacement for the app repo's `AGENTS.md` (symlink to its tracked `CLAUDE.md`). From the app repo root, read the relevant project subdoc before work in that area:

| Task | Project subdoc |
| --- | --- |
| Frontend pages/components | `src/assets/frontend/CLAUDE.md`; `docs/engineering/frontend-ui-components.md` for shared UI |
| tRPC routes or capabilities | `src/assets/api/src/routers/CLAUDE.md`; `docs/engineering/rbac-middleware.md` |
| Contract scenario modeler | `src/assets/api/src/procedures/contract-scenario-model/CLAUDE.md` (also applies to its UI/entities) |
| Kirby or CSI | `src/assets/agent-app/CLAUDE.md` or `src/assets/csi-app/CLAUDE.md`; `docs/engineering/internal-apps-aws.md` for runtime/deployment |
| Policy crawler | `src/assets/policy-crawler/CLAUDE.md`; `docs/engineering/policy-crawler.md` |
| Tests | `TESTING.md` |
| Local environment, tenant DB, migrations | `docs/engineering/environment-setup.md`, `docs/engineering/dev-databases.md`, `docs/engineering/migrations-and-typeorm.md` as applicable |
| AWS resources or tenant architecture | `docs/engineering/aws-infrastructure.md`; `docs/engineering/multi-tenancy.md` |
| Deployments, pipelines, email delivery | `docs/engineering/deploy-pipelines.md`; `docs/engineering/email-infrastructure.md` |
| Prompts, tracing, Kai | `docs/engineering/langfuse.md`; `docs/engineering/kai-observability-and-evals.md`; `docs/engineering/ai-chatbot.md` |
| Policy intelligence or document ingestion | `docs/engineering/policies.md`; `docs/engineering/global-policy-payors.md`; `docs/engineering/ingestion-pipeline.md` |
| Claims imports and operational backfills | `docs/engineering/guides/README.md` (index of runbooks) |

## Automatic acceptance verification

Use `skill://execute` for publication/revision/staging timing and
`skill://execute/reference/sanity-check.md` for standalone isolation, bounded assessment,
evidence reuse, repair limits and PR-readiness versus rollout scope. These are canonical policy,
not another local pipeline. The steps below integrate Kubera's acceptance helper with those gates.

1. Keep the original ticket, named cases, attachments and later decisions in a private source snapshot under `~/.omp/agent/acceptance/<ID>/`. Map every sourced criterion and named case to an independent expected outcome in `cases.md`; material derived cases need their evidence and impact. Use the canonical baseline rules, not new policy in this runbook.
2. Create `cases.md` using `~/.omp/agent/bin/kubera-accept --help-record`, the executable's canonical format. Start with its fenced `acceptance` JSON header, followed by the eleven-column table. Fixture/input cells name saved artifact paths; exact input values live in those files. Check selectors are exact native reporter names. Declare expectations before implementation/execution; never rebaseline them from observed output.
3. Independently challenge the case list and oracle before implementation for pricing/money, persistence, auth/tenant, jobs, seeds and clinical/LLM changes. The reviewer reads original sources rather than inheriting the implementation verdict. Ordinary required gaps are the agent's work, not questions for Brian. Trivial nonbehavioral changes may skip independent review, not applicable runtime verification.
4. Select the relevant domain recipes below and complete the target preflight in `kubera-runtime.md`. Use `source/asserted` for domain/unit checks only. Stubs, diagnostic output and mocked provider responses cannot satisfy a real API/database/UI or live-generation criterion.
   Follow `execute`'s final evidence-binding order before the helper calls below. The helper binds
   source/index/revision identity: staging, formatting or a mutating commit hook can stale a receipt.
   Do not prepare final bindings against a state you are about to change.
5. Run named automated checks with `kubera-accept run <ID> <case> -- <executable> <args>`. It exports fresh `KUBERA_ACCEPT_REPORT` and `KUBERA_ACCEPT_RUNTIME` paths. Use installed Vitest/Playwright JSON reporters or the pricer's named checks report; unknown output is execution-only. Actual runtime assertions need the documented fresh per-check request/database/browser captures, not merely green unit tests plus a healthy server.
6. For direct browser/semantic inspection, declare `/attested`, call `prepare-attestation <ID> <case>` **before** the walkthrough, then use `attest <ID> <case> --observation <private-json>`. Record the actual observer/provenance, explicit `PASS`/`FAIL`/`BLOCKED` verdict, concrete observed behavior, prepared binding ID and fresh screenshots/traces; negative verdicts need a concrete reason. This is explicit attestation, not automated assertion.
   Check each helper exit status. On preparation/capture/attestation failure, stop that batch,
   diagnose the exact command and repair only the affected binding/capture; never print a success
   summary or continue submitting the same invalid attachments. A successfully recorded FAIL is
   evidence, not a transport failure; preserve it and continue independent feasible cases.
7. Before initial PR publication, before publishing a revision/fix reply, and before readiness, reconcile the full list and run `kubera-accept check <ID> --gate pr` (or `revision`). Re-exercise affected cases after changes. A failed/blocked/unrun case or stale/misclassified evidence keeps work local or the existing PR draft. Explanation/approval alone never converts missing proof to PASS.
8. Use one evidence-to-claim review before readiness for risky work; reuse it when evidence and claims remain applicable. Record its findings, consumed repair rounds and any explicit extension in `cases.md` Closeout under the canonical bounded-closeout policy. This does not replace required Cursor approvals.
9. After confirmed staging deployment during the active workflow, capture actual deployment provenance, exercise staging criteria and run the `staging` gate. Do not claim staging proof from branch membership/build success or start an unauthorized deployment/watcher.
10. Export the handoff from the same record: `handoff <ID> --gate <gate> --private <absolute-private-file>`. Inspect it for secrets/PHI, then use it as the source for `skill://brew-test` and `execute`'s concise chat handoff. Default public output has only safe IDs/status/counts/hashes; it is not the complete testing guide.

After the case table, keep two prose fields in the same `cases.md`:
- **Non-goals:** behavior, tenants and unrelated cleanup explicitly excluded by the request.
- **Blast radius:** affected tenants, consumers/shared paths and permitted verification or mutation boundaries.

Derive these from the request and actual callers, not guesses. Preserve approved behavior decisions and their source alongside them or in existing PR replies. Reconcile proposed changes against these bounds; a shared root-cause fix can be in scope, but new behavior outside them needs a material-scope decision. No second artifact or extra validator columns.

Keep **Closeout** prose in this same record: baseline/head, relevant input identities, findings,
consumed acceptance repair rounds and sourced approvals. Recover prior rounds from task history
under the canonical policy. No new helper schema, budget file or validator columns are needed.
Every required row still blocks `kubera-accept`; optional observations stay outside the table.

One ticket can require separate target records such as `ENG-2677-ernest` and `ENG-2677-kpc`, each with its own worktree/tenant/preflight. Maintain a complete original-ticket coverage mapping and check **all** applicable target records before a whole-ticket readiness claim; a passing subgroup is not complete-ticket acceptance.

For the next approximately ten suitable tickets, save `measurement.json` beside `cases.md`: ticket/domain/start and handoff times, explicit/derived case counts, early-review gaps, acceptance-specific user prompt message references, separately classified discovered failures, and the completed observation window. Apply the counted rules and fields in `acceptance/baseline.md`; use unknown/not-reached rather than zero for unobserved stages. Historical pilots are not prospective outcomes; do not claim improvement before the new cohort is observed.

### Domain recipes

| Changed behavior | Required relevant probes |
| --- | --- |
| Stateful UI/modeler edits | Same-record edit → visible values → save → reload → reopen/cancel; negative/invalid inputs; dependent method inputs; one row with six selected and unchanged peers; wizard sync; row/category/step totals; relevant broad-edit + inline-edit combination. |
| Tenant/auth/capabilities | Intended allowed role succeeds, denied role fails, tenant/record isolation; operation-specific permissions. Local Cognito bypass is not authenticated staging identity proof. |
| Pricing | Named methodology plus explicit/relevant siblings (APR-DRG, CMG, LTC, ordinary MS-DRG control); baseline/outlier, fee-sheet basis, age adjustor once, transfer/interim/low-side/state thresholds where affected. Preserve raw fractional outcomes versus rounded display expectations. Check current fixture metadata against the independent reference. |
| Jobs/modeler | Actual trigger → successful terminal state → refreshed rendered result → reload; stale-results/order/overlap cases where affected. Enqueue/start/HTTP success is not completion. |
| Seeds/demo data | Intended Sales-role navigation; actual dependent consumer, not counts; defaults/presets reopen; DOFR/vendor/documents/Pipeline/Benchmarking where named; no customer-identifiable data. Environment/location-specific fixtures cannot inherit another target's evidence. |
| Policy/Kai/LLM | Correct version/document/clause/link and semantically supporting quote, not substring existence alone; history/latest, status visibility, comparison scope, date uncertainty, grouping/negation/initial-vs-renewal where affected. Recorded replies prove sequencing; live generation tests detection. |

Resolve repository-provided setup and ordinary missing checks autonomously within the bounded evidence pass and persisted closeout limit. Ask only for genuine scope/product ambiguity, unavailable oracle, clinical rubric/error severity or sensitive authorization. Keep genuinely rubric-dependent clinical criteria BLOCKED, without propagating that prerequisite to deterministic rows. Within a documented bounded paid trial, declare cases and pass thresholds before execution, run/checkpoint authorized cases without repeated prompting, and retain valid outputs rather than resampling until green; never add spend, models or stages beyond that authorization. Production writes/elevation remain separate.

Receipts establish execution and input/artifact identity, not semantic truth or hard CI enforcement. Source/fixture/runtime changes invalidate evidence; retain applicable paid outputs only with unchanged model, runtime-resolved prompt, source/context and relevant code/data identities. The helper does not watch remote data changes; recapture/re-exercise when target records, roles, fixtures or data versions change. Do not treat a fixed observation-age limit as proof those inputs stayed unchanged.

## Invite an internal test user (staging or prod)

For explicitly requested internal testing accounts, default to `super-admin` in the requested tenant so testers can exercise all features. Do not apply this default to customer accounts or elevate an existing account by inference; confirm the intended tenant and use a separate `+tenant` address when an existing identity belongs to another tenant. The user needs a Cognito account, the tenant group, and a user row with that role in the tenant database. The checked-in `scripts/cloudcommander/src/kbcc-user.ts` creates all three but **suppresses** the invitation and prints a temporary password. Do not create a Cognito account alone or send the printed password over chat.

From the app repo root, with Cloud Commander built (`scripts/cloudcommander/dist/index.js`) and the `kubera` AWS profile authenticated:

```bash
aws sts get-caller-identity --profile kubera --query Account --output text  # expect 637423645815
STACK=staging           # use prod for production
POOL=$(aws cloudformation describe-stacks --stack-name "$STACK-kubera" --region us-east-2 --profile kubera --query 'Stacks[0].Outputs[?starts_with(OutputKey, `frontendUserPoolId`)].OutputValue | [0]' --output text)
EMAIL=person@example.com
TENANT=hpmc             # confirm the intended tenant; do not infer it from the email domain
ROLE=super-admin        # internal testing only; choose the intended role for other users
SIGN_IN_URL=https://staging.kuberahealth.com  # for prod: https://<tenant>.kuberahealth.com
aws cognito-idp list-users --user-pool-id "$POOL" --filter "email = \"$EMAIL\"" --region us-east-2 --profile kubera --query 'Users[].{Username:Username,Status:UserStatus}'
env AWS_PROFILE=kubera node scripts/cloudcommander/dist/index.js role list --stack "$STACK" --schema-name "$TENANT"
env AWS_PROFILE=kubera node scripts/cloudcommander/dist/index.js user create --stack "$STACK" --schema-name "$TENANT" --role-name "$ROLE" --email "$EMAIL"
```

Run `user create` only if the account is absent. Keep the terminal output private; it contains the temporary password. If creation fails partway, inspect/repair the Cognito group and database row rather than rerunning it. Verify the account, membership and database role *before* sending the invitation. Cloud Commander writes a status line before its JSON, so the filter starts at the array:

```bash
env AWS_PROFILE=kubera node scripts/cloudcommander/dist/index.js user list --stack "$STACK" --schema-name "$TENANT" --format json | sed -n '/^\[$/,$p' | jq --arg email "$EMAIL" '.[] | select(.email == $email) | {email,role,status}'
aws cognito-idp admin-list-groups-for-user --user-pool-id "$POOL" --username "$EMAIL" --region us-east-2 --profile kubera --query 'Groups[].GroupName'
aws cognito-idp admin-create-user --user-pool-id "$POOL" --username "$EMAIL" --message-action RESEND --desired-delivery-mediums EMAIL --region us-east-2 --profile kubera --query 'User.{Username:Username,Status:UserStatus,Enabled:Enabled}'
```

`RESEND` sends the Cognito invitation and **replaces** the password printed by Cloud Commander. The default Cognito invitation does not contain the sign-in URL, so send it separately:

```bash
aws ses send-email --from 'Kubera Health <help@kuberahealth.com>' --destination "ToAddresses=$EMAIL" --message "Subject={Data=Kubera Health $TENANT access},Body={Text={Data=Sign in at $SIGN_IN_URL using the temporary password in the separate Kubera Health invitation email. You will be asked to set a new password on first sign-in.}}" --region us-east-2 --profile kubera --query MessageId
```

AWS acceptance is not proof of inbox delivery. On first sign-in the user must change the temporary password. For an existing account, inspect membership and role; use `RESEND` only when the user is still in `FORCE_CHANGE_PASSWORD` and needs a new invitation.

## Point estimation

Use `skill://pointing` for ticket estimates and the one-at-a-time guessing exercise. Brian's convention is **1 point = half an engineer workday**, with agent-assisted implementation, human review and required acceptance verification included. This is an effort convention, not a calendar-delivery promise. Zero is a valid small operational-task estimate, not a skipped answer.

Calibrate against the two most recently completed **ENG** cycles in Linear workspace `kuberahealth` before a new exercise. Fetch fresh cycle membership and point values; the historical snapshot below is a starting anchor, not a substitute for current history. Do not use manual-coding estimates plus generic QA/uncertainty surcharges.

### Historical scope anchors

Reviewed October 12, 2026: cycles 65 (September 22–29) and 66 (September 29–October 6), 36 Done tickets, 28 with positive estimates and eight zero-valued records excluded from the positive-estimate distribution. Median positive estimate was 2; 23 of 28 were 1–3. These are assigned scope estimates, not measured hours.

| Points | Recorded scope |
| --- | --- |
| 1 | ENG-2632: active-rate-sheet plan filtering, selection updates and empty states |
| 2 | ENG-2659: chat-first report responses, refinement and explicit Excel export |
| 3 | ENG-2624: per-diem stop-loss pricing, UI/modeler propagation and targeted backfill |
| 3 | ENG-2589: large-import validation timeouts, query cancellation and ingest concurrency |
| 3 | ENG-2635: EDI/EMR source selection and latest non-void 837 handling |
| 3 | ENG-2599: per-source crawler scheduling, cadence investigation and visibility |
| 4 | ENG-2595: PVQ technical design and phase-1 fields |
| 6–7 | ENG-2647: multi-area Kai reliability fixes; ENG-2547: hospital-rate benchmarking expansion |

### Estimation decisions from Brian

- Estimate existing matcher/selection reuse, not rebuilding it. Verify material frontend/backend and reuse assumptions before defending a large estimate gap.
- Count real testing and production coordination when downtime/data integrity are at stake, not a blanket risk premium. ENG-2695 settled at 2 for careful network testing and a coordinated production rollout; ENG-2699 settled at 2 to capture testing of a frontend transport change with existing backend support.
- A single claim can have multiple independent issues, each with its own recovery route/status; reordering means display order, not a forced recovery sequence. ENG-2709 was selected at 4.
- Selected estimates are Brian's planning choices, not evidence that independent guesses matched. Preserve revisions and do not post points to Linear without authorization.
- Save new sessions durably under `~/.omp/agent/pointing/kuberahealth/`; use the source session's saved ledger when resuming an existing exercise.

