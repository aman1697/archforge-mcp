const num = (a, id, d) => (typeof a[id] === 'number' ? a[id] : d);
const str = (a, id, d) => (typeof a[id] === 'string' ? a[id] : d);
const list = (a, id) => (Array.isArray(a[id]) ? a[id] : []);
const GROWTH = { '1x': 1, '2x': 2, '5x': 5, '10x': 10 };
const READ_FRACTION = { read_95_5: 0.95, read_80_20: 0.8, balanced_50_50: 0.5, write_20_80: 0.2 };
// Tunable assumptions (all echoed into the report so they can be challenged).
const PEAK_TO_AVG = 3;
const HEADROOM = 1.3;
const INSTANCE_RPS = 250;
const TARGET_UTILISATION = 0.6;
const WRITE_RECORD_KB = 2;
const STORAGE_OVERHEAD = 3;
const REALTIME_PER_NODE = 20000;
export function fmt(n) {
    if (!Number.isFinite(n))
        return 'n/a';
    if (n >= 100)
        return Math.round(n).toLocaleString('en-US');
    if (n >= 10)
        return n.toFixed(1);
    return n.toFixed(2);
}
function downtime(availPct) {
    const mins = (1 - availPct / 100) * 365 * 24 * 60;
    if (mins >= 120)
        return `${(mins / 60).toFixed(1)} hours`;
    return `${mins.toFixed(0)} minutes`;
}
export function estimateCapacity(a) {
    const totalUsers = num(a, 'total_users', 10000);
    const concurrent = num(a, 'concurrent_users', 500);
    const apm = num(a, 'actions_per_min', 6);
    const override = typeof a.peak_rps_override === 'number' ? a.peak_rps_override : undefined;
    const growth = GROWTH[str(a, 'growth', '2x')] ?? 2;
    const readFrac = READ_FRACTION[str(a, 'read_write', 'read_80_20')] ?? 0.8;
    const payloadKb = num(a, 'avg_payload_kb', 10);
    const storagePerUser = num(a, 'storage_per_user_mb', 10);
    const caps = list(a, 'capabilities');
    const uploadsMb = caps.includes('file_uploads') ? num(a, 'upload_mb_per_user', 200) : 0;
    const retention = num(a, 'retention_years', 3);
    const availability = str(a, 'availability', '99.9');
    const availNum = Number(availability) || 99.9;
    const latencyMs = Number(str(a, 'latency_p95', '300')) || 300;
    const deploy = str(a, 'deploy_style', 'managed_containers');
    const estimatedPeak = (concurrent * apm) / 60;
    const peakRps = override ?? estimatedPeak;
    const designRps = Math.ceil(peakRps * growth * HEADROOM);
    const readRps = designRps * readFrac;
    const writeRps = designRps - readRps;
    const avgRps = peakRps / PEAK_TO_AVG;
    const requestsPerDay = avgRps * 86400;
    const writesPerDay = requestsPerDay * (1 - readFrac);
    const egressMbps = (designRps * payloadKb * 8) / 1000;
    const futureUsers = totalUsers * growth;
    const structuredGb = (futureUsers * storagePerUser) / 1024;
    const uploadsGb = (futureUsers * uploadsMb) / 1024;
    const transactionalGb = (writesPerDay * 365 * retention * WRITE_RECORD_KB) / 1024 / 1024;
    const totalGb = structuredGb + uploadsGb + transactionalGb;
    const provisionedGb = totalGb * STORAGE_OVERHEAD;
    const minInstances = availNum >= 99.9 ? 3 : 2;
    const appInstances = Math.max(minInstances, Math.ceil(designRps / (INSTANCE_RPS * TARGET_UTILISATION)));
    const compute = { appInstances, minInstances };
    if (deploy === 'serverless') {
        compute.serverlessConcurrency = Math.max(1, Math.ceil(designRps * (latencyMs / 2 / 1000)));
    }
    const rtConn = typeof a.realtime_connections === 'number' ? a.realtime_connections : undefined;
    if (caps.includes('realtime') && rtConn) {
        compute.realtimeNodes = Math.max(2, Math.ceil((rtConn * growth) / REALTIME_PER_NODE));
    }
    const guidance = [];
    if (writeRps < 300 && totalGb < 1024) {
        guidance.push('Database: one managed relational primary (with 1–2 read replicas for failover/reporting) comfortably covers the write rate and data volume.');
    }
    else if (writeRps < 3000) {
        guidance.push('Database: relational primary plus read replicas and a cache layer; choose partition keys now and plan for table partitioning. Evaluate distributed SQL if growth exceeds the design target.');
    }
    else {
        guidance.push('Database: a single primary will not sustain this write rate — use sharding/partitioning or a horizontally scalable store (e.g. DynamoDB, Cassandra, Spanner, CockroachDB) for the hot write path.');
    }
    if (readRps > 500) {
        guidance.push(`Caching: ~${fmt(readRps)} reads/sec at design load justifies an in-memory cache (e.g. Redis) targeting a ≥ 90% hit ratio on hot reads.`);
    }
    else {
        guidance.push('Caching: read volume is modest; start with HTTP/CDN caching and add a distributed cache only if profiling shows a need.');
    }
    if (str(a, 'geo', 'single_country') !== 'single_country' || uploadsGb > 50 || egressMbps > 100) {
        guidance.push('Edge: put a CDN in front of static assets and media; global/multi-region users or high egress make this a requirement, not an optimisation.');
    }
    if (availNum >= 99.99) {
        guidance.push('Availability: 99.99% generally requires multi-AZ at minimum and usually multi-region failover, with automated health-based routing.');
    }
    else if (availNum >= 99.9) {
        guidance.push('Availability: deploy across at least 2–3 availability zones with automated failover for stateful tiers.');
    }
    const warnings = [];
    const budget = str(a, 'budget', '500_5k');
    const team = str(a, 'team_size', 'small');
    const compliance = list(a, 'compliance');
    if (budget === 'under_500' && (appInstances > 6 || availNum >= 99.95)) {
        warnings.push('Budget under $500/month is unlikely to cover this compute footprint / availability target. Revisit the budget, the availability target, or the growth assumption.');
    }
    if (availNum >= 99.99 && ['under_500', '500_5k'].includes(budget)) {
        warnings.push('A 99.99% target typically needs multi-region redundancy, which usually costs more than the stated budget.');
    }
    if (deploy === 'kubernetes' && (team === 'solo' || team === 'small')) {
        warnings.push('Self-managed Kubernetes with a team this small carries significant operational overhead; consider managed containers or serverless.');
    }
    if ((compliance.includes('hipaa') || compliance.includes('pci_dss')) && budget === 'under_500') {
        warnings.push('HIPAA/PCI-DSS controls (audit logging, encryption, isolated environments, BAAs) are hard to achieve within a sub-$500 budget.');
    }
    if (override !== undefined && override < estimatedPeak / 5) {
        warnings.push(`Your known peak (${fmt(override)} RPS) is far below the estimate from concurrent users (${fmt(estimatedPeak)} RPS); double-check the inputs.`);
    }
    if (concurrent > totalUsers) {
        warnings.push('Peak concurrent users exceeds total registered users — check these two numbers.');
    }
    const assumptions = [
        `Peak-to-average traffic ratio = ${PEAK_TO_AVG}× (average RPS = peak ÷ ${PEAK_TO_AVG}).`,
        `Design load = peak × ${growth}× growth × ${HEADROOM}× safety headroom.`,
        `One stateless app instance (≈2 vCPU) sustains ~${INSTANCE_RPS} RPS of mixed CRUD traffic; target utilisation ${TARGET_UTILISATION * 100}%.`,
        `Each write persists ≈${WRITE_RECORD_KB} KB including indexes; provisioned storage = ${STORAGE_OVERHEAD}× raw (replicas, indexes, backups).`,
        'Egress assumes every request returns one average-sized response.',
    ];
    if (compute.realtimeNodes)
        assumptions.push(`One realtime gateway node holds ~${REALTIME_PER_NODE.toLocaleString('en-US')} concurrent connections.`);
    if (compute.serverlessConcurrency)
        assumptions.push('Serverless concurrency ≈ design RPS × (p95 latency target ÷ 2).');
    return {
        inputs: {
            'Registered users (12 mo)': totalUsers,
            'Peak concurrent users': concurrent,
            'Requests / user / min': apm,
            'Peak RPS source': override !== undefined ? 'measured (override)' : 'estimated (concurrent × rate)',
            'Growth factor': `${growth}×`,
            'Read share': `${Math.round(readFrac * 100)}%`,
            'Avg response size': `${payloadKb} KB`,
            'Retention': `${retention} years`,
        },
        load: { peakRps, designRps, readRps, writeRps, avgRps, requestsPerDay, writesPerDay, egressMbps },
        storage: { structuredGb, uploadsGb, transactionalGb, totalGb, provisionedGb },
        compute,
        guidance,
        availability: { target: `${availability}%`, downtimePerYear: downtime(availNum) },
        assumptions,
        warnings,
    };
}
export function capacityMarkdown(r) {
    const gb = (n) => (n >= 1024 ? `${(n / 1024).toFixed(2)} TB` : `${fmt(n)} GB`);
    const lines = [];
    lines.push('### Inputs');
    lines.push('| Parameter | Value |', '|---|---|');
    for (const [k, v] of Object.entries(r.inputs))
        lines.push(`| ${k} | ${typeof v === 'number' ? v.toLocaleString('en-US') : v} |`);
    lines.push('', '### Throughput');
    lines.push('| Metric | Value |', '|---|---|');
    lines.push(`| Peak RPS (today) | ${fmt(r.load.peakRps)} |`);
    lines.push(`| **Design RPS** (growth + headroom) | **${fmt(r.load.designRps)}** |`);
    lines.push(`| Design read RPS / write RPS | ${fmt(r.load.readRps)} / ${fmt(r.load.writeRps)} |`);
    lines.push(`| Average RPS | ${fmt(r.load.avgRps)} |`);
    lines.push(`| Requests per day (average) | ${fmt(r.load.requestsPerDay)} |`);
    lines.push(`| Writes per day | ${fmt(r.load.writesPerDay)} |`);
    lines.push(`| Peak egress | ${fmt(r.load.egressMbps)} Mbps |`);
    lines.push('', '### Storage (at 12-month growth target)');
    lines.push('| Component | Size |', '|---|---|');
    lines.push(`| Structured user data | ${gb(r.storage.structuredGb)} |`);
    if (r.storage.uploadsGb > 0)
        lines.push(`| Uploaded files / media | ${gb(r.storage.uploadsGb)} |`);
    lines.push(`| Transactional history (retained) | ${gb(r.storage.transactionalGb)} |`);
    lines.push(`| **Total raw** | **${gb(r.storage.totalGb)}** |`);
    lines.push(`| Provisioned (with replicas, indexes, backups) | ${gb(r.storage.provisionedGb)} |`);
    lines.push('', '### Compute');
    lines.push('| Tier | Estimate |', '|---|---|');
    lines.push(`| Stateless app instances (minimum ${r.compute.minInstances} for redundancy) | **${r.compute.appInstances}** |`);
    if (r.compute.serverlessConcurrency)
        lines.push(`| Serverless concurrent executions | ${r.compute.serverlessConcurrency} |`);
    if (r.compute.realtimeNodes)
        lines.push(`| Realtime gateway nodes | ${r.compute.realtimeNodes} |`);
    lines.push('', '### Availability');
    lines.push(`Target **${r.availability.target}** → allowed downtime ≈ **${r.availability.downtimePerYear} per year**.`);
    lines.push('', '### Sizing guidance');
    for (const g of r.guidance)
        lines.push(`- ${g}`);
    if (r.warnings.length) {
        lines.push('', '### ⚠️ Consistency warnings');
        for (const w of r.warnings)
            lines.push(`- ${w}`);
    }
    lines.push('', '### Estimation assumptions');
    for (const s of r.assumptions)
        lines.push(`- ${s}`);
    return lines.join('\n');
}
