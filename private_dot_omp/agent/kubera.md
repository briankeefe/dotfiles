# Kubera app: personal navigation and staging invitations

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

## Invite a staging user

The user needs a staging Cognito account, the right tenant group, and a user row with the intended role in that tenant's database. The checked-in `scripts/cloudcommander/src/kbcc-user.ts` creates all three but **suppresses** the invitation and prints a temporary password. Do not create a Cognito account alone or send the printed password over chat.

From the app repo root, with Cloud Commander built (`scripts/cloudcommander/dist/index.js`) and the `kubera` AWS profile authenticated:

```bash
aws sts get-caller-identity --profile kubera --query Account --output text  # expect 637423645815
POOL=$(aws cloudformation describe-stacks --stack-name staging-kubera --region us-east-2 --profile kubera --query 'Stacks[0].Outputs[?starts_with(OutputKey, `frontendUserPoolId`)].OutputValue | [0]' --output text)
EMAIL=person@example.com
TENANT=hpmc              # confirm the intended tenant; do not infer it from the email domain
ROLE=tenant-user          # standard access; confirm before assigning an admin role
aws cognito-idp list-users --user-pool-id "$POOL" --filter "email = \"$EMAIL\"" --region us-east-2 --profile kubera --query 'Users[].{Username:Username,Status:UserStatus}'
env AWS_PROFILE=kubera node scripts/cloudcommander/dist/index.js role list --stack staging --schema-name "$TENANT"
env AWS_PROFILE=kubera node scripts/cloudcommander/dist/index.js user create --stack staging --schema-name "$TENANT" --role-name "$ROLE" --email "$EMAIL"
```

Run `user create` only if the account is absent. Keep the terminal output private; it contains the temporary password. If creation fails partway, inspect/repair the Cognito group and database row rather than rerunning it. Verify the account, membership and database role *before* sending the invitation. Cloud Commander writes a status line before its JSON, so the filter starts at the array:

```bash
env AWS_PROFILE=kubera node scripts/cloudcommander/dist/index.js user list --stack staging --schema-name "$TENANT" --format json | sed -n '/^\[$/,$p' | jq --arg email "$EMAIL" '.[] | select(.email == $email) | {email,role,status}'
aws cognito-idp admin-list-groups-for-user --user-pool-id "$POOL" --username "$EMAIL" --region us-east-2 --profile kubera --query 'Groups[].GroupName'
aws cognito-idp admin-create-user --user-pool-id "$POOL" --username "$EMAIL" --message-action RESEND --desired-delivery-mediums EMAIL --region us-east-2 --profile kubera --query 'User.{Username:Username,Status:UserStatus,Enabled:Enabled}'
```

`RESEND` sends the Cognito invitation and **replaces** the password printed by Cloud Commander. The default Cognito invitation does not contain the sign-in URL, so send it separately:

```bash
aws ses send-email --from 'Kubera Health <help@kuberahealth.com>' --destination "ToAddresses=$EMAIL" --message 'Subject={Data=Kubera Health staging access},Body={Text={Data=Sign in at https://staging.kuberahealth.com using the temporary password in the separate Kubera Health invitation email. You will be asked to set a new password on first sign-in.}}' --region us-east-2 --profile kubera --query MessageId
```

AWS acceptance is not proof of inbox delivery. On first sign-in the user must change the temporary password. For an existing account, inspect membership and role; use `RESEND` only when the user is still in `FORCE_CHANGE_PASSWORD` and needs a new invitation.
