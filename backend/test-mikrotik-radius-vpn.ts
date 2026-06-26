/**
 * ============================================================
 *  MikroTik · RADIUS · VPN Integration Test Suite
 * ============================================================
 *
 * Run with:
 *   npx ts-node --project tsconfig.json test-mikrotik-radius-vpn.ts
 *
 * What it tests:
 *   1.  DB connectivity  - all relevant tables (radcheck, radreply,
 *       radAcct, radiusUser, radiusNas, radPostAuth, vpnUser, Router)
 *   2.  RADIUS sync      - syncRadiusUser, suspendRadiusUser, deleteRadiusUser
 *   3.  RADIUS NAS       - create / read NAS client records
 *   4.  VPN users        - create / read VpnUser records (DB layer only)
 *   5.  MikroTik reach   - ping the first ONLINE router REST API
 *   6.  Cleanup          - removes all test rows so it is safe to re-run
 */

import prisma from './src/lib/prisma';
import { syncRadiusUser, suspendRadiusUser, deleteRadiusUser } from './src/lib/radius';

const PASS = 'PASS';
const FAIL = 'FAIL';
const SKIP = 'SKIP';
const INFO = 'INFO';

let passed = 0;
let failed = 0;

function header(title: string) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(` ${title}`);
    console.log('─'.repeat(60));
}

function ok(msg: string) { console.log(`  [${PASS}]  ${msg}`); passed++; }
function fail(msg: string, err?: any) {
    console.error(`  [${FAIL}]  ${msg}`);
    if (err) console.error('      ', err?.message ?? String(err));
    failed++;
}
function skip(msg: string) { console.log(`  [${SKIP}]  ${msg}`); }
function info(msg: string) { console.log(`  [${INFO}]  ${msg}`); }

const TEST_TAG         = 'test_' + Date.now();
const TEST_RADIUS_USER = `radius_${TEST_TAG}`;
const TEST_NAS_NAME    = `nas_${TEST_TAG}`;
const TEST_VPN_USER    = `vpn_${TEST_TAG}`;
const TEST_PASSWORD    = 'TestPass123';

// ─── 1. DB CONNECTIVITY ──────────────────────────────────────────────────────

async function testDbConnectivity() {
    header('1 · Database Connectivity');

    const checks: Array<{ label: string; fn: () => Promise<number> }> = [
        { label: 'radcheck',    fn: () => prisma.radCheck.count()    },
        { label: 'radreply',    fn: () => prisma.radReply.count()    },
        { label: 'radAcct',     fn: () => prisma.radAcct.count()     },
        { label: 'radPostAuth', fn: () => prisma.radPostAuth.count() },
        { label: 'radiusUser',  fn: () => prisma.radiusUser.count()  },
        { label: 'radiusNas',   fn: () => prisma.radiusNas.count()   },
        { label: 'vpnUser',     fn: () => prisma.vpnUser.count()     },
        { label: 'Router',      fn: () => prisma.router.count()      },
    ];

    for (const { label, fn } of checks) {
        try {
            const n = await fn();
            ok(`${label.padEnd(14)} -> ${n} row(s)`);
        } catch (e: any) {
            fail(`${label} count failed`, e);
        }
    }
}

// ─── 2. RADIUS SYNC ──────────────────────────────────────────────────────────

async function testRadiusSync() {
    header('2 · RADIUS Sync (syncRadiusUser / suspendRadiusUser / deleteRadiusUser)');

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    try {
        const user = await syncRadiusUser({
            username: TEST_RADIUS_USER,
            password: TEST_PASSWORD,
            tenantId: null,
            fullName: 'Test RADIUS User',
            expiresAt,
            status: 'Active',
            rateLimit: '10M/20M',
            profileName: 'default',
            simultaneousUse: 1,
        });
        ok(`syncRadiusUser CREATE -> id=${user.id}`);
    } catch (e: any) {
        fail('syncRadiusUser CREATE', e);
        return;
    }

    try {
        const checks = await prisma.radCheck.findMany({
            where: { username: TEST_RADIUS_USER, tenantId: null },
        });
        const attrs = checks.map(c => c.attribute);
        ok(`radcheck attributes: ${attrs.join(', ')}`);
        if (attrs.includes('MD5-Password'))     ok('MD5-Password attribute present');
        else                                    fail('MD5-Password MISSING from radcheck');
        if (attrs.includes('Simultaneous-Use')) ok('Simultaneous-Use attribute present');
        else                                    fail('Simultaneous-Use MISSING from radcheck');
        if (attrs.includes('Expiration'))       ok('Expiration attribute present');
        else                                    fail('Expiration MISSING from radcheck');
    } catch (e: any) {
        fail('Read radcheck rows', e);
    }

    try {
        const replies = await prisma.radReply.findMany({
            where: { username: TEST_RADIUS_USER, tenantId: null },
        });
        const attrs = replies.map(r => r.attribute);
        ok(`radreply attributes: ${attrs.join(', ')}`);
        if (attrs.includes('Session-Timeout'))      ok('Session-Timeout attribute present');
        else                                        fail('Session-Timeout MISSING from radreply');
        if (attrs.includes('Mikrotik-Rate-Limit'))  ok('Mikrotik-Rate-Limit attribute present');
        else                                        fail('Mikrotik-Rate-Limit MISSING from radreply');
        if (attrs.includes('Mikrotik-Group'))       ok('Mikrotik-Group attribute present');
        else                                        fail('Mikrotik-Group MISSING from radreply');
    } catch (e: any) {
        fail('Read radreply rows', e);
    }

    try {
        await syncRadiusUser({
            username: TEST_RADIUS_USER,
            password: TEST_PASSWORD + '_new',
            tenantId: null,
            rateLimit: '5M/10M',
        });
        ok('syncRadiusUser UPDATE (password + rate limit) OK');
    } catch (e: any) {
        fail('syncRadiusUser UPDATE', e);
    }

    try {
        await suspendRadiusUser(TEST_RADIUS_USER, null);
        const expRow = await prisma.radCheck.findFirst({
            where: { username: TEST_RADIUS_USER, attribute: 'Expiration', tenantId: null },
        });
        if (expRow) ok(`suspendRadiusUser -> Expiration set: ${expRow.value}`);
        else        fail('Expiration row not found after suspend');

        const sessionRow = await prisma.radReply.findFirst({
            where: { username: TEST_RADIUS_USER, attribute: 'Session-Timeout', tenantId: null },
        });
        if (!sessionRow) ok('suspendRadiusUser -> Session-Timeout removed from radreply');
        else             fail('Session-Timeout still present after suspend');
    } catch (e: any) {
        fail('suspendRadiusUser', e);
    }

    try {
        await deleteRadiusUser(TEST_RADIUS_USER, null);
        const ru = await prisma.radiusUser.count({ where: { username: TEST_RADIUS_USER, tenantId: null } });
        const rc = await prisma.radCheck.count({ where: { username: TEST_RADIUS_USER, tenantId: null } });
        const rr = await prisma.radReply.count({ where: { username: TEST_RADIUS_USER, tenantId: null } });
        if (ru === 0 && rc === 0 && rr === 0)
            ok('deleteRadiusUser -> all rows cleaned up');
        else
            fail(`deleteRadiusUser: residual rows radiusUser=${ru} radcheck=${rc} radreply=${rr}`);
    } catch (e: any) {
        fail('deleteRadiusUser', e);
    }
}

// ─── 3. RADIUS NAS ────────────────────────────────────────────────────────────

async function testRadiusNas() {
    header('3 · RADIUS NAS Records');
    let nasId: string | null = null;

    try {
        const nas = await prisma.radiusNas.create({
            data: {
                nasName: TEST_NAS_NAME,
                shortName: 'test-nas',
                type: 'other',
                ports: 1812,
                secret: 'testing123',
                server: '127.0.0.1',
                description: 'Automated test NAS',
                tenantId: null,
            },
        });
        nasId = nas.id;
        ok(`Created NAS id=${nas.id}  name=${nas.nasName}`);
    } catch (e: any) {
        fail('Create NAS', e);
        return;
    }

    try {
        const nas = await prisma.radiusNas.findUnique({ where: { id: nasId! } });
        if (nas?.nasName === TEST_NAS_NAME)
            ok(`Read NAS -> name=${nas.nasName}  masked_secret=****${nas.secret.slice(-4)}`);
        else
            fail('NAS read-back name mismatch');
    } catch (e: any) {
        fail('Read NAS', e);
    }

    try {
        await prisma.radiusNas.delete({ where: { id: nasId! } });
        ok('NAS deleted (cleanup)');
    } catch (e: any) {
        fail('Delete NAS', e);
    }
}

// ─── 4. VPN USERS (DB layer) ─────────────────────────────────────────────────

async function testVpnUsers() {
    header('4 · VPN Users (DB Layer)');

    const router = await prisma.router.findFirst({ where: { deletedAt: null } });
    if (!router) {
        skip('No Router found in DB — skipping VPN user DB test');
        return;
    }
    info(`Using router: ${router.name}  (${router.host})  status=${router.status}`);

    let vpnId: string | null = null;

    try {
        const vpn = await prisma.vpnUser.create({
            data: {
                username: TEST_VPN_USER,
                password: 'encrypted-test-pass',
                fullName: 'Test VPN User',
                protocol: 'L2TP',
                profile: 'default',
                service: 'l2tp',
                localAddress: '10.0.0.1',
                remoteAddress: '10.0.0.100',
                status: 'Active',
                routerId: router.id,
                tenantId: router.tenantId ?? null,
            },
        });
        vpnId = vpn.id;
        ok(`Created VpnUser id=${vpn.id}  user=${vpn.username}  protocol=${vpn.protocol}`);
    } catch (e: any) {
        fail('Create VpnUser', e);
        return;
    }

    try {
        const vpn = await prisma.vpnUser.findUnique({ where: { id: vpnId! } });
        if (vpn?.username === TEST_VPN_USER)
            ok(`Read VpnUser -> status=${vpn.status}  profile=${vpn.profile}`);
        else
            fail('VpnUser read-back mismatch');
    } catch (e: any) {
        fail('Read VpnUser', e);
    }

    try {
        await prisma.vpnUser.delete({ where: { id: vpnId! } });
        ok('VpnUser deleted (cleanup)');
    } catch (e: any) {
        fail('Delete VpnUser', e);
    }
}

// ─── 5. MIKROTIK CONNECTIVITY ────────────────────────────────────────────────

async function testMikroTikConnectivity() {
    header('5 · MikroTik Router Connectivity');

    const routers = await prisma.router.findMany({
        where: { status: 'ONLINE', deletedAt: null },
        take: 3,
    });

    if (routers.length === 0) {
        const any = await prisma.router.findFirst({ where: { deletedAt: null } });
        if (!any) {
            skip('No routers in DB — skipping connectivity test');
        } else {
            skip(`No ONLINE routers. Found "${any.name}" (${any.host}) status=${any.status}. Update router status to ONLINE to test.`);
        }
        return;
    }

    for (const router of routers) {
        info(`Testing router: ${router.name}  (${router.host}:${router.port ?? 8728})`);
        try {
            const { getMikroTikService } = await import('./src/lib/mikrotik');
            const mt = await getMikroTikService(router.id, router.tenantId ?? null);
            const sysInfo = await (mt as any).getSystemInfo();
            ok(`${router.name} -> identity="${sysInfo.identity}"  version=${sysInfo.version}  cpu=${sysInfo.cpuLoad}%  uptime=${sysInfo.uptime}`);
        } catch (e: any) {
            fail(`${router.name} (${router.host}) -> connection FAILED`, e);
        }
    }
}

// ─── 6. RADIUS ACCOUNTING (read-only) ────────────────────────────────────────

async function testRadiusAccounting() {
    header('6 · RADIUS Accounting (radacct — read-only)');

    try {
        const total  = await prisma.radAcct.count();
        ok(`Total radAcct sessions in DB: ${total}`);

        if (total > 0) {
            const active  = await prisma.radAcct.count({ where: { acctstoptime: null } });
            info(`  Active sessions  (no stoptime): ${active}`);
            info(`  Stopped sessions (has stoptime): ${total - active}`);

            const sample = await prisma.radAcct.findFirst({
                where: { acctstoptime: null },
                orderBy: { acctstarttime: 'desc' },
            });
            if (sample) {
                info(`  Latest active -> user=${sample.username}  NAS=${sample.nasipaddress}  IP=${sample.framedipaddress ?? 'N/A'}`);
            }
        }

        const postAuths = await prisma.radPostAuth.count();
        ok(`Total radPostAuth records: ${postAuths}`);
        if (postAuths > 0) {
            const accepts = await prisma.radPostAuth.count({ where: { reply: 'Access-Accept' } });
            const rejects = await prisma.radPostAuth.count({ where: { reply: 'Access-Reject' } });
            info(`  Access-Accept: ${accepts}  |  Access-Reject: ${rejects}`);
        }
    } catch (e: any) {
        fail('RADIUS accounting read', e);
    }
}

// ─── SUMMARY ─────────────────────────────────────────────────────────────────

function printSummary() {
    const total = passed + failed;
    console.log('\n' + '='.repeat(60));
    console.log(' TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`  Total  : ${total}`);
    console.log(`  Passed : ${passed}`);
    console.log(`  Failed : ${failed}`);
    if (failed === 0) {
        console.log('\n  All checks passed!\n');
    } else {
        console.log(`\n  ${failed} check(s) need attention.\n`);
    }
    console.log('='.repeat(60) + '\n');
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n========================================================');
    console.log('  MikroTik / RADIUS / VPN  Integration Test Suite');
    console.log('========================================================');
    console.log(`  Run at: ${new Date().toISOString()}`);

    try {
        await testDbConnectivity();
        await testRadiusSync();
        await testRadiusNas();
        await testVpnUsers();
        await testMikroTikConnectivity();
        await testRadiusAccounting();
    } catch (fatalErr: any) {
        console.error('\nFATAL error during test run:', fatalErr?.message ?? fatalErr);
    } finally {
        printSummary();
        await prisma.$disconnect();
    }
}

main().catch((e) => {
    console.error('Unhandled error:', e);
    process.exit(1);
});
