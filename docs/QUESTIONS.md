# Interview question catalog

> Generated from `src/questions/bank.ts` by `npm run docs`. Do not edit by hand.

Archforge asks **33 questions** in 4 rounds: **25 are always asked** and **8 are follow-ups** that only appear when an earlier answer makes them relevant (marked *follow-up* below).
Every question has a default; anything you leave on its default is recorded as an **assumption** and listed in the exported README.

## Round 1 — Product & features

### `app_type` — What type of application are you building?

- **Type:** single
- **Why it is asked:** Drives client architecture, API style and the delivery pipeline.
- **Default:** Web application
- **Options:**
  - `web` — Web application
  - `mobile` — Mobile app (iOS/Android)
  - `web_mobile` — Web + mobile
  - `api` — API / backend platform only
  - `desktop` — Desktop application
  - `data_platform` — Data / analytics platform

### `user_base` — Who are the users?

- **Type:** single
- **Why it is asked:** Determines tenancy, auth model, traffic shape and compliance exposure.
- **Default:** Consumers (B2C)
- **Options:**
  - `b2c` — Consumers (B2C)
  - `b2b` — Businesses / SaaS (B2B)
  - `internal` — Internal company tool
  - `marketplace` — Two-sided marketplace

### `core_features` — List the 3–8 most important features (comma or line separated).

- **Type:** text, optional
- **Why it is asked:** Used to derive functional requirements, domain model and API surface.
- **Default:** — (optional, may be left blank)

### `capabilities` — Which of these capabilities does the app need?

- **Type:** multi
- **Why it is asked:** Each capability adds components (search index, queues, object storage, …) and triggers follow-up questions.
- **Default:** none
- **Options:**
  - `search` — Full-text search
  - `file_uploads` — File / media uploads
  - `notifications` — Notifications (email / push / SMS)
  - `background_jobs` — Background jobs & scheduling
  - `analytics` — Analytics & reporting
  - `payments` — Payments / billing
  - `realtime` — Real-time (chat, live updates, tracking)
  - `ai_ml` — AI / ML features
  - `admin_panel` — Admin / back-office panel
  - `offline` — Offline support
  - `integrations` — Third-party integrations / webhooks

### `multi_tenant` — How should business customers (tenants) be isolated?  *(follow-up)*

- **Type:** single
- **Why it is asked:** Tenancy is one of the hardest decisions to change later; it shapes the data model and cost.
- **Default:** Shared database & schema (tenant_id column)
- **Options:**
  - `shared_schema` — Shared database & schema (tenant_id column)
  - `schema_per_tenant` — Schema per tenant
  - `db_per_tenant` — Database per tenant (strongest isolation)
  - `single_tenant` — Single-tenant deployments

### `payment_scope` — How will card payments be handled?  *(follow-up)*

- **Type:** single
- **Why it is asked:** Determines PCI-DSS scope — the biggest security/compliance cost driver for payments.
- **Default:** Hosted checkout / redirect (card data never touches your servers)
- **Options:**
  - `hosted_checkout` — Hosted checkout / redirect (card data never touches your servers)
  - `tokenized_elements` — Embedded tokenized fields (provider-hosted iframes)
  - `direct_card_handling` — Handle raw card data yourself (full PCI scope)

### `notification_channels` — Which notification channels are needed?  *(follow-up)*

- **Type:** multi
- **Why it is asked:** Sizes the notification pipeline and decides which providers to integrate.
- **Default:** Email, Mobile / web push
- **Options:**
  - `email` — Email
  - `push` — Mobile / web push
  - `sms` — SMS
  - `in_app` — In-app inbox

### `ai_usage` — What will AI/ML do, roughly how many calls per day, and hosted API or self-hosted models?  *(follow-up)*

- **Type:** text, optional
- **Why it is asked:** AI workloads change cost, latency and data-privacy design (GPU, vector store, rate limits).
- **Default:** — (optional, may be left blank)

## Round 2 — Scale & performance

### `total_users` — How many registered users do you expect 12 months after launch?

- **Type:** number (users)
- **Why it is asked:** Sizes storage and the user/account data tier.
- **Default:** 10000 users

### `concurrent_users` — How many users will be active at the same time at peak?

- **Type:** number (users)
- **Why it is asked:** The primary input for throughput, instance count and connection limits.
- **Default:** 500 users

### `actions_per_min` — At peak, about how many API requests does one active user generate per minute?

- **Type:** number (requests/user/min)
- **Why it is asked:** Converts concurrent users into requests/second. A single page view is often 3–10 API calls.
- **Default:** 6 requests/user/min

### `peak_rps_override` — Do you already know your peak throughput? Enter it to override the estimate (leave blank otherwise).

- **Type:** number (requests/sec), optional
- **Why it is asked:** Real measurements beat estimates.
- **Default:** — (optional, may be left blank)

### `read_write` — What is the read/write traffic mix?

- **Type:** single
- **Why it is asked:** Decides caching, replication and database technology.
- **Default:** Read-heavy (80 / 20)
- **Options:**
  - `read_95_5` — Very read-heavy (95% reads / 5% writes)
  - `read_80_20` — Read-heavy (80 / 20)
  - `balanced_50_50` — Balanced (50 / 50)
  - `write_20_80` — Write-heavy (20 / 80)

### `avg_payload_kb` — Average API response size?

- **Type:** number (KB)
- **Why it is asked:** Sizes bandwidth/egress and CDN needs.
- **Default:** 10 KB

### `storage_per_user_mb` — Average structured data stored per user over their lifetime (excluding uploaded files)?

- **Type:** number (MB)
- **Why it is asked:** Sizes the primary database.
- **Default:** 10 MB

### `upload_mb_per_user` — Average uploaded files/media stored per user?  *(follow-up)*

- **Type:** number (MB)
- **Why it is asked:** Sizes object storage, CDN and processing pipelines.
- **Default:** 200 MB

### `realtime_connections` — Peak concurrent real-time connections (WebSocket / SSE)?  *(follow-up)*

- **Type:** number (connections)
- **Why it is asked:** Long-lived connections need a different scaling model than request/response traffic.
- **Default:** 1000 connections

### `growth` — How much growth should the design absorb beyond the numbers above in the next 12 months?

- **Type:** single
- **Why it is asked:** Sets the headroom factor so you do not re-architect after launch.
- **Default:** Double (2×)
- **Options:**
  - `1x` — No growth (1×)
  - `2x` — Double (2×)
  - `5x` — 5×
  - `10x` — 10× (aggressive growth)

### `latency_p95` — What p95 API latency do users need?

- **Type:** single
- **Why it is asked:** Drives caching, data-store choice and geographic placement.
- **Default:** Under 300 ms (snappy)
- **Options:**
  - `100` — Under 100 ms (real-time feel)
  - `300` — Under 300 ms (snappy)
  - `1000` — Under 1 s (standard)
  - `3000` — Under 3 s (relaxed)

### `availability` — What availability (uptime) target is required?

- **Type:** single
- **Why it is asked:** Determines redundancy, multi-AZ/region design and operational cost.
- **Default:** 99.9% (~8.8 h/yr)
- **Options:**
  - `99` — 99% (~3.6 days downtime/yr)
  - `99.5` — 99.5% (~1.8 days/yr)
  - `99.9` — 99.9% (~8.8 h/yr)
  - `99.95` — 99.95% (~4.4 h/yr)
  - `99.99` — 99.99% (~53 min/yr)

### `dr_level` — How much data loss / downtime is acceptable in a disaster?  *(follow-up)*

- **Type:** single
- **Why it is asked:** Sets backup, replication and failover strategy (RPO/RTO).
- **Default:** Restore from backups (RPO hours, RTO hours)
- **Options:**
  - `backup_restore` — Restore from backups (RPO hours, RTO hours)
  - `warm_standby` — Warm standby (RPO minutes, RTO < 1 h)
  - `active_active` — Active-active multi-region (near-zero)

### `geo` — Where are your users?

- **Type:** single
- **Why it is asked:** Decides regions, CDN, and whether latency targets need edge/multi-region.
- **Default:** One country / region
- **Options:**
  - `single_country` — One country / region
  - `few_regions` — A few regions (e.g. US + EU)
  - `global` — Global

### `retention_years` — How many years of transactional data must be kept online?

- **Type:** number (years)
- **Why it is asked:** Drives storage growth, archival and partitioning.
- **Default:** 3 years

## Round 3 — Platform, team & budget

### `cloud` — Which cloud / hosting do you prefer?

- **Type:** single
- **Why it is asked:** Maps every component to concrete managed services.
- **Default:** Undecided — recommend one for me
- **Options:**
  - `aws` — AWS
  - `azure` — Microsoft Azure
  - `gcp` — Google Cloud
  - `on_prem` — On-premises / private cloud
  - `multi_cloud` — Multi-cloud
  - `agnostic` — Cloud-agnostic (Kubernetes + open source)
  - `undecided` — Undecided — recommend one for me

### `deploy_style` — Preferred deployment model?

- **Type:** single
- **Why it is asked:** Operational burden vs control; interacts strongly with team size.
- **Default:** Managed containers (ECS / Cloud Run / App Service)
- **Options:**
  - `serverless` — Serverless (functions / managed everything)
  - `managed_containers` — Managed containers (ECS / Cloud Run / App Service)
  - `kubernetes` — Kubernetes
  - `vms` — Virtual machines
  - `paas` — PaaS (Heroku-style / Render / Fly)

### `budget` — Approximate monthly infrastructure budget (USD)?

- **Type:** single
- **Why it is asked:** Used to sanity-check the design against what you can afford.
- **Default:** $500 – $5,000
- **Options:**
  - `under_500` — Under $500
  - `500_5k` — $500 – $5,000
  - `5k_50k` — $5,000 – $50,000
  - `over_50k` — Over $50,000
  - `unconstrained` — Not a constraint

### `team_size` — How large is the engineering team?

- **Type:** single
- **Why it is asked:** Microservices vs modular monolith, Kubernetes vs managed services, and the build plan all depend on this.
- **Default:** 3–8 engineers
- **Options:**
  - `solo` — 1–2 engineers
  - `small` — 3–8 engineers
  - `medium` — 9–25 engineers
  - `large` — 25+ engineers

### `tech_preferences` — Languages, frameworks or databases you want, already know, or must avoid? (optional)

- **Type:** text, optional
- **Why it is asked:** Technology choices should fit the team you actually have.
- **Default:** — (optional, may be left blank)

### `existing_systems` — Existing systems to integrate with or migrate from? (optional)

- **Type:** text, optional
- **Why it is asked:** Integration points and migrations are a major source of risk.
- **Default:** — (optional, may be left blank)

## Round 4 — Security & compliance

### `auth_methods` — Which sign-in methods are required?

- **Type:** multi
- **Why it is asked:** Decides whether to build or buy identity, and the session/token design.
- **Default:** Email + password
- **Options:**
  - `email_password` — Email + password
  - `social_login` — Social login (Google, Apple, …)
  - `passwordless` — Passwordless / magic link / OTP
  - `sso_saml` — Enterprise SSO (SAML / OIDC)
  - `mfa` — Multi-factor authentication
  - `api_keys` — API keys / machine-to-machine

### `pii_level` — What is the most sensitive data you will store?

- **Type:** single
- **Why it is asked:** Sets encryption, access-control and audit requirements.
- **Default:** Basic personal data (name, email, phone)
- **Options:**
  - `none` — No personal data
  - `basic_pii` — Basic personal data (name, email, phone)
  - `sensitive` — Sensitive (health, financial, children, government IDs)

### `compliance` — Which compliance regimes apply?

- **Type:** multi
- **Why it is asked:** Each regime adds concrete controls (logging, encryption, residency, vendor requirements).
- **Default:** None / not sure yet
- **Options:**
  - `none` — None / not sure yet
  - `gdpr` — GDPR / privacy law
  - `hipaa` — HIPAA
  - `pci_dss` — PCI-DSS
  - `soc2` — SOC 2
  - `iso27001` — ISO 27001
  - `data_residency` — Data residency requirements

### `data_residency_regions` — Which countries/regions must data stay in?  *(follow-up)*

- **Type:** text
- **Why it is asked:** Fixes the allowed cloud regions and constrains replication and third-party services.
- **Default:** — (required)

