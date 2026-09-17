# Project Operations

Use for `execute ops [question]` or project-specific logging, telemetry, deployment and version
questions. Apply `skill://execute`; this is a discovery workflow, not a universal deployment policy.

1. Identify the repository and environment from the question and current context. Read its
   operational docs, CI/deployment workflows, runtime configuration and logging helpers.
   Organization-specific architecture, provider keys, branch names, rollout rules and version-bump
   policies belong in project-local docs, not this shared toolkit. If absent, state what is unknown.
2. For logging, trace the actual client/server mutation and existing instrumentation before adding
   events. Avoid duplicate event counts. Distinguish public ingestion identifiers from privileged
   query/admin credentials using the provider's current documentation; never print or commit keys.
   Use the approved secret store. Recommend rotation for exposed credentials.
3. For deployment/version questions, determine the real artifact type (native build, bundle,
   container, etc.), compatibility requirements, target environment and release workflow. Do not
   infer deployment from branch membership or apply another project's version rules.
4. Inspect read-only deployment status with the configured provider tooling after checking its
   installed capabilities. Correlate the successful deployment's artifact/commit with the actual
   environment; a green build alone is not proof of rollout or current live state.
5. Answer with source paths and observed artifact/commit/status. An operations question does not
   authorize a push, workflow dispatch, release, secret change or production mutation. Present any
   proposed action and its target/risk for explicit approval before acting.
