const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const csv = path.join(root, 'PHASE1_ROUTE_MAPPING.csv');
const out = path.join(root, 'PHASE1_FLAGS.md');
if (!fs.existsSync(csv)) {
    console.error('CSV not found', csv);
    process.exit(1);
}
const data = fs.readFileSync(csv, 'utf8').trim().split(/\r?\n/);
const header = data.shift().split(',');
const rows = data.map(line => {
    // naive CSV split, fields contain no commas
    const parts = line.split(',');
    return {
        route: parts[0],
        uses_getTenantClient: parts[1],
        uses_global_prisma: parts[2],
        uses_raw_sql: parts[3],
        has_canAccessTenant: parts[4],
        notes: parts.slice(5).join(',')
    }
});

function isSensitiveRoute(r) {
    return /\/api\/(payments|invoices|hotspot|pppoe|radius|routers)/.test(r);
}

const flagged = rows.filter(r => r.uses_global_prisma === 'yes' || r.uses_raw_sql === 'yes' || (isSensitiveRoute(r.route) && r.has_canAccessTenant === 'no'));

const lines = [
    '# Phase 1 — Flagged High-Priority Route Violations',
    '',
    'Generated: ' + new Date().toISOString(),
    '',
    'Criteria: `uses_global_prisma=yes` OR `uses_raw_sql=yes` OR sensitive route (payments,invoices,hotspot,pppoe,radius,routers) missing `canAccessTenant` guard.',
    '',
    '| Severity | Route | uses_getTenantClient | uses_global_prisma | uses_raw_sql | has_canAccessTenant | Notes |',
    '|---|---|---:|---:|---:|---:|---|'
];

flagged.forEach(r => {
    const reasons = [];
    if (r.uses_global_prisma === 'yes') reasons.push('global_prisma');
    if (r.uses_raw_sql === 'yes') reasons.push('raw_sql');
    if (isSensitiveRoute(r.route) && r.has_canAccessTenant === 'no') reasons.push('missing_canAccessTenant');
    let severity = 'Medium';
    if (reasons.includes('global_prisma') && isSensitiveRoute(r.route)) severity = 'Critical';
    else if (reasons.includes('raw_sql') && isSensitiveRoute(r.route)) severity = 'High';

    lines.push(`| ${severity} | ${r.route} | ${r.uses_getTenantClient} | ${r.uses_global_prisma} | ${r.uses_raw_sql} | ${r.has_canAccessTenant} | ${reasons.join('; ')} |`);
});

fs.writeFileSync(out, lines.join('\n'));
console.log('Wrote', out, 'with', flagged.length, 'flagged routes');
