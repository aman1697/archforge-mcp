# Generated document sections

> Generated from `src/design/sections.ts` by `npm run docs`. Do not edit by hand.

Archforge writes **23 sections**: 12 for the High-Level Design (HLD) and 11 for the Low-Level Design (LLD).
"Computed" sections are produced by code; all others are written by a language model and then validated.
"Builds on" lists the earlier sections whose text is passed to the model so the document stays consistent.

## High-Level Design (hld.md)

| # | Section id | Title | Required diagrams | Builds on | Written by |
|---|---|---|---|---|---|
| 1 | `hld.overview` | Overview, Goals & Scope | — | — | LLM |
| 2 | `hld.requirements` | Requirements | — | `hld.overview` | LLM |
| 3 | `hld.capacity` | Capacity Estimation | — | — | code (computed) |
| 4 | `hld.architecture` | Architecture Overview & Style | flowchart ×2 | `hld.requirements`, `hld.capacity` | LLM |
| 5 | `hld.components` | Components & Responsibilities | — | `hld.architecture` | LLM |
| 6 | `hld.data` | Data Architecture | flowchart | `hld.architecture`, `hld.capacity` | LLM |
| 7 | `hld.flows` | Key End-to-End Flows | sequenceDiagram ×3 | `hld.architecture`, `hld.components` | LLM |
| 8 | `hld.cloud` | Cloud & Infrastructure | flowchart | `hld.components`, `hld.capacity` | LLM |
| 9 | `hld.scale_resilience` | Scalability, Availability & Disaster Recovery | — | `hld.architecture`, `hld.capacity`, `hld.cloud` | LLM |
| 10 | `hld.security` | Security & Compliance | — | `hld.architecture`, `hld.data` | LLM |
| 11 | `hld.ops` | Observability, CI/CD & Operations | flowchart | `hld.architecture`, `hld.cloud` | LLM |
| 12 | `hld.decisions` | Key Decisions, Risks & Open Questions | — | `hld.architecture`, `hld.data`, `hld.cloud`, `hld.security` | LLM |

## Low-Level Design (lld.md)

| # | Section id | Title | Required diagrams | Builds on | Written by |
|---|---|---|---|---|---|
| 1 | `lld.structure` | Project Structure & Modules | — | `hld.architecture`, `hld.components` | LLM |
| 2 | `lld.data_model` | Data Model | erDiagram | `hld.data`, `lld.structure` | LLM |
| 3 | `lld.api` | API Design | — | `hld.components`, `lld.data_model` | LLM |
| 4 | `lld.classes` | Domain Model & Class Design | classDiagram | `lld.data_model`, `lld.structure` | LLM |
| 5 | `lld.sequences` | Detailed Sequence Diagrams | sequenceDiagram ×3 | `hld.flows`, `lld.api`, `lld.data_model` | LLM |
| 6 | `lld.state` | State Machines & Workflows | stateDiagram-v2 | `lld.data_model`, `lld.classes` | LLM |
| 7 | `lld.async` | Async Processing & Events | — | `hld.architecture`, `lld.state` | LLM |
| 8 | `lld.consistency` | Caching, Concurrency & Consistency | — | `hld.data`, `lld.data_model`, `lld.api` | LLM |
| 9 | `lld.security_errors` | Validation, Errors & Security Details | — | `hld.security`, `lld.api` | LLM |
| 10 | `lld.delivery` | Testing, Environments & Deployment Details | — | `hld.ops`, `lld.structure` | LLM |
| 11 | `lld.build_plan` | Build Plan | — | `hld.architecture`, `lld.structure`, `hld.decisions` | LLM |

## What each section is asked to contain

### `hld.overview` — Overview, Goals & Scope

Write: (1) a crisp problem statement and product vision; (2) goals and explicit non-goals; (3) actors/personas and what each does; (4) scope for the first release vs later; (5) the key constraints taken from the requirements (scale, budget, team, compliance, cloud); (6) a short glossary of domain terms. Keep it under ~600 words.

### `hld.requirements` — Requirements

Derive functional requirements grouped by capability, each with an ID (FR-1, FR-2, …) and a one-line testable statement; infer sensible requirements from the stated features and capabilities, marking inferred ones as "(inferred)". Then a non-functional requirements table (NFR-1…) with a MEASURABLE target for each: latency (p95), throughput, availability, durability, scalability, security, compliance, maintainability, observability — pull numbers from the requirements and capacity data. End with an out-of-scope list.

### `hld.architecture` — Architecture Overview & Style

Decide and justify the architectural style (modular monolith vs microservices vs serverless vs hybrid) using team size, scale, budget and operational maturity — do not default to microservices without justification. Provide: (1) a system-context diagram (users, the system as one box, external systems/providers) as a flowchart; (2) a container/component diagram as a flowchart with subgraphs for client tier, edge, application tier, async/messaging tier, data tier and external services; (3) the layering and trust boundaries; (4) a one-paragraph walk-through of a typical request through the diagram.

### `hld.components` — Components & Responsibilities

A catalog table of every component in the architecture: name, responsibility, owned data, technology, stateless/stateful, scaling unit/trigger, and critical dependencies. Then describe inter-component communication (sync REST/gRPC vs async events) and why per interaction, the bounded contexts/module boundaries, and which components are build vs buy (managed service / SaaS) with reasons.

### `hld.data` — Data Architecture

Select a datastore per data type (transactional, cache, search, object/blob, queue/stream, analytics) with the decision rationale tied to the capacity numbers. Cover partitioning/sharding keys, replication topology, consistency model per data domain (strong vs eventual), retention/archival/deletion (incl. privacy requests), backup strategy and data ownership across components. Include a data-flow diagram (flowchart) showing how data moves between stores, including async pipelines and analytics.

### `hld.flows` — Key End-to-End Flows

Pick the 3–5 most important user journeys for this application (e.g. sign-up/login, the core transaction, an async/notification flow) and give each a sequence diagram at component level, followed by 3–6 lines of narration covering failure paths and what is synchronous vs asynchronous.

### `hld.cloud` — Cloud & Infrastructure

Map every component to concrete managed services of the chosen cloud. If the cloud is "undecided", briefly compare AWS, Azure and GCP for THIS workload and recommend one with reasons, then map to it. Cover network topology (VPC/VNet, subnets, AZs, ingress, WAF, CDN, private connectivity), compute sizing using the capacity numbers, environment strategy (dev/stage/prod), IaC tooling and account/project structure. Include a deployment diagram (flowchart with subgraphs for region, AZs, subnets). End with the main cost drivers, levers to reduce cost, and a sanity check against the stated budget — label any cost figures as rough estimates.

### `hld.scale_resilience` — Scalability, Availability & Disaster Recovery

Cover: scaling strategy per tier with autoscaling triggers and limits; caching layers and invalidation overview; back-pressure, rate limiting and load shedding; a failure-mode table (component fails → user impact → mitigation → detection); SLOs and error budgets derived from the availability target; backup/DR design meeting the stated RPO/RTO (or a stated assumption); a 12-month capacity growth plan with the points at which the architecture must change; and a load/chaos testing plan.

### `hld.security` — Security & Compliance

Cover authentication and authorization model (consistent with the sign-in methods requested), secrets and key management, encryption in transit/at rest, network security, tenant isolation if applicable, data classification and PII handling, audit logging, and secure SDLC/supply-chain controls. Provide a lightweight threat model (STRIDE-style table: threat → affected component → mitigation) and a control mapping for each selected compliance regime (what controls are needed and where in the architecture they live). If payments are involved, state the PCI scope explicitly.

### `hld.ops` — Observability, CI/CD & Operations

Cover logging, metrics and tracing stack; the dashboards and alerts that map to the SLOs; a CI/CD pipeline diagram (flowchart from commit to production incl. tests, security scans, migrations, approvals); release strategy (blue/green, canary, feature flags); environments and config management; runbooks and on-call model appropriate to the team size; and cost monitoring.

### `hld.decisions` — Key Decisions, Risks & Open Questions

Produce: (1) an ADR-style decision table (decision, options considered, choice, rationale, consequences, revisit trigger) for the 6–10 most consequential decisions; (2) the top risks with likelihood, impact and mitigation; (3) open questions for stakeholders, each with a recommended default; (4) the list of assumptions that came from defaulted or inferred answers and what changes if they are wrong.

### `lld.structure` — Project Structure & Modules

Recommend the language(s) and framework(s) per component, consistent with the team skills and preferences given (justify any deviation). Provide the repository layout (mono-repo vs multi-repo) with a folder tree in a ```text block, module/package boundaries and the dependency rules between them (what may import what), layering conventions (controller → service → repository / ports & adapters), configuration management, shared libraries, naming conventions and code-quality tooling (lint, format, type-check).

### `lld.data_model` — Data Model

Design the full relational (or document) model for the core domain. Provide an ER diagram, then for each core table: purpose, columns with types and constraints, primary/foreign keys, indexes with the query each serves, and partition/shard key if relevant. Include sample DDL for the 3–5 most important tables. Cover multi-tenancy mechanics (if applicable), audit/soft-delete fields, ID strategy (UUIDv7/ULID/bigserial) with rationale, migration tooling and strategy, and data lifecycle/archival.

### `lld.api` — API Design

Define API conventions (REST/GraphQL/gRPC choice and why), versioning, authentication headers, pagination, filtering/sorting, idempotency keys, rate-limit headers and a standard error format (e.g. RFC 7807). Then endpoint tables per resource: method, path, auth/role, request body or params, success and error status codes. Give 2–3 complete request/response JSON examples for the core flows. Cover webhooks/events exposed to clients if any, and outline the OpenAPI spec organisation.

### `lld.classes` — Domain Model & Class Design

Describe the core domain entities/aggregates, domain services, repositories and ports/adapters. Provide a class diagram for the 2–3 most important modules (include key attributes and method signatures). Name the design patterns used and why (e.g. strategy, factory, saga, outbox, circuit breaker). Give pseudo-code (≤ 40 lines each) for the 1–2 most complex business algorithms in this application.

### `lld.sequences` — Detailed Sequence Diagrams

For the 3–5 most critical operations, provide detailed service-level sequence diagrams that show real endpoint calls, cache lookups, database transactions, queue publishes, timeouts, retries and error branches (use alt/opt/loop blocks, each closed with "end"). Follow each diagram with a short table of timeout/retry/idempotency settings used.

### `lld.state` — State Machines & Workflows

For each entity with a meaningful lifecycle (e.g. order, payment, subscription, booking, job) provide a state diagram and a transition table (from → to, trigger, guard, side effects). Describe multi-step workflows/sagas with their compensation steps and where the state is persisted. If the application has no stateful lifecycle, model the closest relevant one (e.g. user account or background job).

### `lld.async` — Async Processing & Events

List queues/topics and the event catalog (event name, producer, consumers, payload fields, ordering key). Specify delivery guarantees, idempotent consumer design, retry/backoff and dead-letter policy, the outbox pattern where needed, scheduled jobs (cron) and the notification pipeline for the selected channels. If the application genuinely needs little async work, say so and explain what stays synchronous and why.

### `lld.consistency` — Caching, Concurrency & Consistency

Specify cache keys and namespaces, TTLs, invalidation rules and stampede protection; optimistic vs pessimistic locking per hot entity; transaction boundaries; the approach to distributed consistency (saga/outbox/two-phase avoidance); idempotency-key implementation; and the rate-limiter algorithm with concrete parameters (limits per user/IP/tenant) chosen from the capacity numbers.

### `lld.security_errors` — Validation, Errors & Security Details

Provide: input-validation rules and where they are enforced; an error taxonomy table (code, HTTP status, meaning, retryable?); token/session design (type, lifetimes, refresh rotation, revocation); an RBAC matrix (roles × actions) as a table; secrets handling in code and CI; which fields are encrypted/hashed/tokenised and how; and the audit-log record schema.

### `lld.delivery` — Testing, Environments & Deployment Details

Cover: the test pyramid with concrete targets, contract/integration test approach and test-data strategy; load-test scenarios using the design RPS and read/write mix; environment configuration matrix; CI pipeline stages with a skeleton config snippet; IaC module layout; database migration and rollback procedure; feature-flag usage; and definition of done for a production release.

### `lld.build_plan` — Build Plan

Turn the design into an ordered build plan for the stated team size: milestones starting with a walking skeleton (CI/CD + one end-to-end slice + observability), then risk-first ordering. For each milestone: scope, deliverables, dependencies, acceptance criteria and rough effort in person-weeks. Identify the critical path, what to defer, and the first 10 concrete tickets to create on day one.

