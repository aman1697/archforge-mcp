export const ROUNDS = [
    { id: 'product', label: 'Product & features' },
    { id: 'scale', label: 'Scale & performance' },
    { id: 'platform', label: 'Platform, team & budget' },
    { id: 'security', label: 'Security & compliance' },
];
const has = (a, id, v) => {
    const x = a[id];
    return Array.isArray(x) && x.includes(v);
};
export const QUESTIONS = [
    // ───────────────────────── PRODUCT ─────────────────────────
    {
        id: 'app_type',
        round: 'product',
        type: 'single',
        short: 'App type',
        text: 'What type of application are you building?',
        why: 'Drives client architecture, API style and the delivery pipeline.',
        options: [
            { value: 'web', label: 'Web application' },
            { value: 'mobile', label: 'Mobile app (iOS/Android)' },
            { value: 'web_mobile', label: 'Web + mobile' },
            { value: 'api', label: 'API / backend platform only' },
            { value: 'desktop', label: 'Desktop application' },
            { value: 'data_platform', label: 'Data / analytics platform' },
        ],
        default: 'web',
    },
    {
        id: 'user_base',
        round: 'product',
        type: 'single',
        short: 'Audience',
        text: 'Who are the users?',
        why: 'Determines tenancy, auth model, traffic shape and compliance exposure.',
        options: [
            { value: 'b2c', label: 'Consumers (B2C)' },
            { value: 'b2b', label: 'Businesses / SaaS (B2B)' },
            { value: 'internal', label: 'Internal company tool' },
            { value: 'marketplace', label: 'Two-sided marketplace' },
        ],
        default: 'b2c',
    },
    {
        id: 'core_features',
        round: 'product',
        type: 'text',
        short: 'Core features',
        text: 'List the 3–8 most important features (comma or line separated).',
        why: 'Used to derive functional requirements, domain model and API surface.',
        optional: true,
    },
    {
        id: 'capabilities',
        round: 'product',
        type: 'multi',
        short: 'Capabilities',
        text: 'Which of these capabilities does the app need?',
        why: 'Each capability adds components (search index, queues, object storage, …) and triggers follow-up questions.',
        options: [
            { value: 'search', label: 'Full-text search' },
            { value: 'file_uploads', label: 'File / media uploads' },
            { value: 'notifications', label: 'Notifications (email / push / SMS)' },
            { value: 'background_jobs', label: 'Background jobs & scheduling' },
            { value: 'analytics', label: 'Analytics & reporting' },
            { value: 'payments', label: 'Payments / billing' },
            { value: 'realtime', label: 'Real-time (chat, live updates, tracking)' },
            { value: 'ai_ml', label: 'AI / ML features' },
            { value: 'admin_panel', label: 'Admin / back-office panel' },
            { value: 'offline', label: 'Offline support' },
            { value: 'integrations', label: 'Third-party integrations / webhooks' },
        ],
        default: [],
    },
    {
        id: 'multi_tenant',
        round: 'product',
        type: 'single',
        short: 'Tenancy model',
        text: 'How should business customers (tenants) be isolated?',
        why: 'Tenancy is one of the hardest decisions to change later; it shapes the data model and cost.',
        options: [
            { value: 'shared_schema', label: 'Shared database & schema (tenant_id column)' },
            { value: 'schema_per_tenant', label: 'Schema per tenant' },
            { value: 'db_per_tenant', label: 'Database per tenant (strongest isolation)' },
            { value: 'single_tenant', label: 'Single-tenant deployments' },
        ],
        default: 'shared_schema',
        when: (a) => a.user_base === 'b2b',
    },
    {
        id: 'payment_scope',
        round: 'product',
        type: 'single',
        short: 'Card data handling',
        text: 'How will card payments be handled?',
        why: 'Determines PCI-DSS scope — the biggest security/compliance cost driver for payments.',
        options: [
            { value: 'hosted_checkout', label: 'Hosted checkout / redirect (card data never touches your servers)' },
            { value: 'tokenized_elements', label: 'Embedded tokenized fields (provider-hosted iframes)' },
            { value: 'direct_card_handling', label: 'Handle raw card data yourself (full PCI scope)' },
        ],
        default: 'hosted_checkout',
        when: (a) => has(a, 'capabilities', 'payments'),
    },
    {
        id: 'notification_channels',
        round: 'product',
        type: 'multi',
        short: 'Notification channels',
        text: 'Which notification channels are needed?',
        why: 'Sizes the notification pipeline and decides which providers to integrate.',
        options: [
            { value: 'email', label: 'Email' },
            { value: 'push', label: 'Mobile / web push' },
            { value: 'sms', label: 'SMS' },
            { value: 'in_app', label: 'In-app inbox' },
        ],
        default: ['email', 'push'],
        when: (a) => has(a, 'capabilities', 'notifications'),
    },
    {
        id: 'ai_usage',
        round: 'product',
        type: 'text',
        short: 'AI usage',
        text: 'What will AI/ML do, roughly how many calls per day, and hosted API or self-hosted models?',
        why: 'AI workloads change cost, latency and data-privacy design (GPU, vector store, rate limits).',
        optional: true,
        when: (a) => has(a, 'capabilities', 'ai_ml'),
    },
    // ───────────────────────── SCALE ─────────────────────────
    {
        id: 'total_users',
        round: 'scale',
        type: 'number',
        short: 'Registered users',
        text: 'How many registered users do you expect 12 months after launch?',
        why: 'Sizes storage and the user/account data tier.',
        unit: 'users',
        min: 1,
        default: 10000,
    },
    {
        id: 'concurrent_users',
        round: 'scale',
        type: 'number',
        short: 'Peak concurrent users',
        text: 'How many users will be active at the same time at peak?',
        why: 'The primary input for throughput, instance count and connection limits.',
        unit: 'users',
        min: 1,
        default: 500,
    },
    {
        id: 'actions_per_min',
        round: 'scale',
        type: 'number',
        short: 'Requests per user/min',
        text: 'At peak, about how many API requests does one active user generate per minute?',
        why: 'Converts concurrent users into requests/second. A single page view is often 3–10 API calls.',
        unit: 'requests/user/min',
        min: 0.1,
        default: 6,
    },
    {
        id: 'peak_rps_override',
        round: 'scale',
        type: 'number',
        short: 'Known peak RPS',
        text: 'Do you already know your peak throughput? Enter it to override the estimate (leave blank otherwise).',
        why: 'Real measurements beat estimates.',
        unit: 'requests/sec',
        min: 0.1,
        optional: true,
    },
    {
        id: 'read_write',
        round: 'scale',
        type: 'single',
        short: 'Read/write mix',
        text: 'What is the read/write traffic mix?',
        why: 'Decides caching, replication and database technology.',
        options: [
            { value: 'read_95_5', label: 'Very read-heavy (95% reads / 5% writes)' },
            { value: 'read_80_20', label: 'Read-heavy (80 / 20)' },
            { value: 'balanced_50_50', label: 'Balanced (50 / 50)' },
            { value: 'write_20_80', label: 'Write-heavy (20 / 80)' },
        ],
        default: 'read_80_20',
    },
    {
        id: 'avg_payload_kb',
        round: 'scale',
        type: 'number',
        short: 'Avg response size',
        text: 'Average API response size?',
        why: 'Sizes bandwidth/egress and CDN needs.',
        unit: 'KB',
        min: 0.1,
        default: 10,
    },
    {
        id: 'storage_per_user_mb',
        round: 'scale',
        type: 'number',
        short: 'Data per user',
        text: 'Average structured data stored per user over their lifetime (excluding uploaded files)?',
        why: 'Sizes the primary database.',
        unit: 'MB',
        min: 0.01,
        default: 10,
    },
    {
        id: 'upload_mb_per_user',
        round: 'scale',
        type: 'number',
        short: 'Uploads per user',
        text: 'Average uploaded files/media stored per user?',
        why: 'Sizes object storage, CDN and processing pipelines.',
        unit: 'MB',
        min: 0.1,
        default: 200,
        when: (a) => has(a, 'capabilities', 'file_uploads'),
    },
    {
        id: 'realtime_connections',
        round: 'scale',
        type: 'number',
        short: 'Realtime connections',
        text: 'Peak concurrent real-time connections (WebSocket / SSE)?',
        why: 'Long-lived connections need a different scaling model than request/response traffic.',
        unit: 'connections',
        min: 1,
        default: 1000,
        when: (a) => has(a, 'capabilities', 'realtime'),
    },
    {
        id: 'growth',
        round: 'scale',
        type: 'single',
        short: '12-month growth',
        text: 'How much growth should the design absorb beyond the numbers above in the next 12 months?',
        why: 'Sets the headroom factor so you do not re-architect after launch.',
        options: [
            { value: '1x', label: 'No growth (1×)' },
            { value: '2x', label: 'Double (2×)' },
            { value: '5x', label: '5×' },
            { value: '10x', label: '10× (aggressive growth)' },
        ],
        default: '2x',
    },
    {
        id: 'latency_p95',
        round: 'scale',
        type: 'single',
        short: 'Latency target (p95)',
        text: 'What p95 API latency do users need?',
        why: 'Drives caching, data-store choice and geographic placement.',
        options: [
            { value: '100', label: 'Under 100 ms (real-time feel)' },
            { value: '300', label: 'Under 300 ms (snappy)' },
            { value: '1000', label: 'Under 1 s (standard)' },
            { value: '3000', label: 'Under 3 s (relaxed)' },
        ],
        default: '300',
    },
    {
        id: 'availability',
        round: 'scale',
        type: 'single',
        short: 'Availability target',
        text: 'What availability (uptime) target is required?',
        why: 'Determines redundancy, multi-AZ/region design and operational cost.',
        options: [
            { value: '99', label: '99% (~3.6 days downtime/yr)' },
            { value: '99.5', label: '99.5% (~1.8 days/yr)' },
            { value: '99.9', label: '99.9% (~8.8 h/yr)' },
            { value: '99.95', label: '99.95% (~4.4 h/yr)' },
            { value: '99.99', label: '99.99% (~53 min/yr)' },
        ],
        default: '99.9',
    },
    {
        id: 'dr_level',
        round: 'scale',
        type: 'single',
        short: 'Disaster recovery',
        text: 'How much data loss / downtime is acceptable in a disaster?',
        why: 'Sets backup, replication and failover strategy (RPO/RTO).',
        options: [
            { value: 'backup_restore', label: 'Restore from backups (RPO hours, RTO hours)' },
            { value: 'warm_standby', label: 'Warm standby (RPO minutes, RTO < 1 h)' },
            { value: 'active_active', label: 'Active-active multi-region (near-zero)' },
        ],
        default: 'backup_restore',
        when: (a) => a.availability !== undefined && a.availability !== '99',
    },
    {
        id: 'geo',
        round: 'scale',
        type: 'single',
        short: 'User geography',
        text: 'Where are your users?',
        why: 'Decides regions, CDN, and whether latency targets need edge/multi-region.',
        options: [
            { value: 'single_country', label: 'One country / region' },
            { value: 'few_regions', label: 'A few regions (e.g. US + EU)' },
            { value: 'global', label: 'Global' },
        ],
        default: 'single_country',
    },
    {
        id: 'retention_years',
        round: 'scale',
        type: 'number',
        short: 'Retention (years)',
        text: 'How many years of transactional data must be kept online?',
        why: 'Drives storage growth, archival and partitioning.',
        unit: 'years',
        min: 0.1,
        default: 3,
    },
    // ───────────────────────── PLATFORM ─────────────────────────
    {
        id: 'cloud',
        round: 'platform',
        type: 'single',
        short: 'Cloud',
        text: 'Which cloud / hosting do you prefer?',
        why: 'Maps every component to concrete managed services.',
        options: [
            { value: 'aws', label: 'AWS' },
            { value: 'azure', label: 'Microsoft Azure' },
            { value: 'gcp', label: 'Google Cloud' },
            { value: 'on_prem', label: 'On-premises / private cloud' },
            { value: 'multi_cloud', label: 'Multi-cloud' },
            { value: 'agnostic', label: 'Cloud-agnostic (Kubernetes + open source)' },
            { value: 'undecided', label: 'Undecided — recommend one for me' },
        ],
        default: 'undecided',
    },
    {
        id: 'deploy_style',
        round: 'platform',
        type: 'single',
        short: 'Deployment model',
        text: 'Preferred deployment model?',
        why: 'Operational burden vs control; interacts strongly with team size.',
        options: [
            { value: 'serverless', label: 'Serverless (functions / managed everything)' },
            { value: 'managed_containers', label: 'Managed containers (ECS / Cloud Run / App Service)' },
            { value: 'kubernetes', label: 'Kubernetes' },
            { value: 'vms', label: 'Virtual machines' },
            { value: 'paas', label: 'PaaS (Heroku-style / Render / Fly)' },
        ],
        default: 'managed_containers',
    },
    {
        id: 'budget',
        round: 'platform',
        type: 'single',
        short: 'Monthly infra budget',
        text: 'Approximate monthly infrastructure budget (USD)?',
        why: 'Used to sanity-check the design against what you can afford.',
        options: [
            { value: 'under_500', label: 'Under $500' },
            { value: '500_5k', label: '$500 – $5,000' },
            { value: '5k_50k', label: '$5,000 – $50,000' },
            { value: 'over_50k', label: 'Over $50,000' },
            { value: 'unconstrained', label: 'Not a constraint' },
        ],
        default: '500_5k',
    },
    {
        id: 'team_size',
        round: 'platform',
        type: 'single',
        short: 'Team size',
        text: 'How large is the engineering team?',
        why: 'Microservices vs modular monolith, Kubernetes vs managed services, and the build plan all depend on this.',
        options: [
            { value: 'solo', label: '1–2 engineers' },
            { value: 'small', label: '3–8 engineers' },
            { value: 'medium', label: '9–25 engineers' },
            { value: 'large', label: '25+ engineers' },
        ],
        default: 'small',
    },
    {
        id: 'tech_preferences',
        round: 'platform',
        type: 'text',
        short: 'Tech preferences',
        text: 'Languages, frameworks or databases you want, already know, or must avoid? (optional)',
        why: 'Technology choices should fit the team you actually have.',
        optional: true,
    },
    {
        id: 'existing_systems',
        round: 'platform',
        type: 'text',
        short: 'Existing systems',
        text: 'Existing systems to integrate with or migrate from? (optional)',
        why: 'Integration points and migrations are a major source of risk.',
        optional: true,
    },
    // ───────────────────────── SECURITY ─────────────────────────
    {
        id: 'auth_methods',
        round: 'security',
        type: 'multi',
        short: 'Sign-in methods',
        text: 'Which sign-in methods are required?',
        why: 'Decides whether to build or buy identity, and the session/token design.',
        options: [
            { value: 'email_password', label: 'Email + password' },
            { value: 'social_login', label: 'Social login (Google, Apple, …)' },
            { value: 'passwordless', label: 'Passwordless / magic link / OTP' },
            { value: 'sso_saml', label: 'Enterprise SSO (SAML / OIDC)' },
            { value: 'mfa', label: 'Multi-factor authentication' },
            { value: 'api_keys', label: 'API keys / machine-to-machine' },
        ],
        default: ['email_password'],
    },
    {
        id: 'pii_level',
        round: 'security',
        type: 'single',
        short: 'Data sensitivity',
        text: 'What is the most sensitive data you will store?',
        why: 'Sets encryption, access-control and audit requirements.',
        options: [
            { value: 'none', label: 'No personal data' },
            { value: 'basic_pii', label: 'Basic personal data (name, email, phone)' },
            { value: 'sensitive', label: 'Sensitive (health, financial, children, government IDs)' },
        ],
        default: 'basic_pii',
    },
    {
        id: 'compliance',
        round: 'security',
        type: 'multi',
        short: 'Compliance',
        text: 'Which compliance regimes apply?',
        why: 'Each regime adds concrete controls (logging, encryption, residency, vendor requirements).',
        options: [
            { value: 'none', label: 'None / not sure yet' },
            { value: 'gdpr', label: 'GDPR / privacy law' },
            { value: 'hipaa', label: 'HIPAA' },
            { value: 'pci_dss', label: 'PCI-DSS' },
            { value: 'soc2', label: 'SOC 2' },
            { value: 'iso27001', label: 'ISO 27001' },
            { value: 'data_residency', label: 'Data residency requirements' },
        ],
        default: ['none'],
    },
    {
        id: 'data_residency_regions',
        round: 'security',
        type: 'text',
        short: 'Residency regions',
        text: 'Which countries/regions must data stay in?',
        why: 'Fixes the allowed cloud regions and constrains replication and third-party services.',
        when: (a) => has(a, 'compliance', 'data_residency'),
    },
];
export const QUESTION_BY_ID = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
/** Human-readable form of a stored answer. */
export function describeValue(q, value) {
    const label = (v) => q.options?.find((o) => o.value === v)?.label ?? v;
    if (Array.isArray(value))
        return value.length ? value.map(label).join(', ') : 'none';
    if (typeof value === 'boolean')
        return value ? 'yes' : 'no';
    if (typeof value === 'number')
        return `${value.toLocaleString('en-US')}${q.unit ? ' ' + q.unit : ''}`;
    return q.type === 'single' ? label(value) : value;
}
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9.]+/g, '');
function matchOption(q, raw) {
    const s = norm(String(raw));
    return q.options?.find((o) => norm(o.value) === s || norm(o.label) === s)?.value;
}
function parseNumber(raw) {
    if (typeof raw === 'number')
        return Number.isFinite(raw) ? raw : undefined;
    if (typeof raw !== 'string')
        return undefined;
    const m = raw.trim().toLowerCase().replace(/,/g, '').match(/^(-?\d+(?:\.\d+)?)\s*([kmb])?$/);
    if (!m)
        return undefined;
    const mult = m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : m[2] === 'b' ? 1e9 : 1;
    return Number(m[1]) * mult;
}
export function parseAnswer(q, raw) {
    const optionsHint = q.options ? ` Valid: ${q.options.map((o) => o.value).join(', ')}.` : '';
    switch (q.type) {
        case 'single': {
            const v = matchOption(q, raw);
            return v ? { ok: true, value: v } : { ok: false, error: `"${String(raw)}" is not a valid option.${optionsHint}` };
        }
        case 'multi': {
            const items = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[,;\n]/) : undefined;
            if (!items)
                return { ok: false, error: `Expected a list of options.${optionsHint}` };
            const vals = [];
            for (const it of items) {
                if (typeof it === 'string' && !it.trim())
                    continue;
                const v = matchOption(q, it);
                if (!v)
                    return { ok: false, error: `"${String(it)}" is not a valid option.${optionsHint}` };
                if (!vals.includes(v))
                    vals.push(v);
            }
            const cleaned = vals.length > 1 ? vals.filter((v) => v !== 'none') : vals;
            return { ok: true, value: cleaned };
        }
        case 'number': {
            const n = parseNumber(raw);
            if (n === undefined)
                return { ok: false, error: `"${String(raw)}" is not a number.` };
            if (q.min !== undefined && n < q.min)
                return { ok: false, error: `Must be ≥ ${q.min}.` };
            if (q.max !== undefined && n > q.max)
                return { ok: false, error: `Must be ≤ ${q.max}.` };
            return { ok: true, value: n };
        }
        case 'boolean': {
            if (typeof raw === 'boolean')
                return { ok: true, value: raw };
            const s = String(raw).trim().toLowerCase();
            if (['yes', 'y', 'true', '1'].includes(s))
                return { ok: true, value: true };
            if (['no', 'n', 'false', '0'].includes(s))
                return { ok: true, value: false };
            return { ok: false, error: 'Expected yes or no.' };
        }
        case 'text': {
            const s = typeof raw === 'string' ? raw.trim() : Array.isArray(raw) ? raw.join(', ') : String(raw ?? '').trim();
            if (!s)
                return { ok: false, error: 'Empty answer.' };
            return { ok: true, value: s.slice(0, 4000) };
        }
    }
}
