const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const routesDir = path.join(root, 'backend', 'src', 'app');
const outFile = path.join(root, 'PHASE1_ROUTE_MAPPING.csv');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('route.ts')) results.push(file);
        }
    });
    return results;
}

const files = walk(routesDir).sort();
const rows = ['route,uses_getTenantClient,uses_global_prisma,uses_raw_sql,has_canAccessTenant,notes'];

files.forEach(f => {
    const content = fs.readFileSync(f, 'utf8');
    const uses_getTenantClient = /getTenantClient\(/.test(content) ? 'yes' : 'no';
    const uses_global_prisma = (/getTenantClient\(\s*null\s*\)|new PrismaClient\(/).test(content) ? 'yes' : 'no';
    const uses_raw_sql = (/\$queryRaw|\$executeRaw/).test(content) ? 'yes' : 'no';
    const has_canAccessTenant = /canAccessTenant\(/.test(content) ? 'yes' : 'no';
    const rel = path.relative(root, f).replace(/\\/g, '/');
    rows.push([rel, uses_getTenantClient, uses_global_prisma, uses_raw_sql, has_canAccessTenant, ''].join(','));
});

fs.writeFileSync(outFile, rows.join('\n'));
console.log('Wrote', outFile, 'with', files.length, 'routes');
