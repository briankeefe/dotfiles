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

