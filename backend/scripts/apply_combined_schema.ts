import 'dotenv/config';
import { readFileSync } from 'fs';
import prisma from '../src/lib/prisma';
import { join } from 'path';

(async function main() {
    try {
        const sqlPath = join(__dirname, '..', 'prisma', 'migrations', 'combined_schema.sql');
        console.log('Reading combined schema from', sqlPath);
        const sql = readFileSync(sqlPath, 'utf8');

        console.log('Executing combined schema SQL as a single statement (this may take a while)...');
        try {
            await prisma.$executeRawUnsafe(sql);
            console.log('Combined schema applied successfully.');
        } catch (e: any) {
            console.error('Applying combined schema failed (single-statement):', e && e.message ? e.message : e);
            // Fall back to naive split-on-semicolon and continue
            const statements = sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
            for (const stmt of statements) {
                try {
                    await prisma.$executeRawUnsafe(stmt);
                } catch (err: any) {
                    console.debug('Statement failed (continuing):', (err && err.message) ? err.message : err);
                }
            }
            console.log('Combined schema applied with fallback (best-effort).');
        }
    } catch (err: any) {
        console.error('Applying combined schema failed:', err && err.message ? err.message : err);
        process.exit(1);
    } finally {
        try { await prisma.$disconnect(); } catch { }
    }
})();
