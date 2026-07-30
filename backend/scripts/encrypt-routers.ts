#!/usr/bin/env node
/*
  One-time migration: encrypt plaintext router secret fields using
  `encryptRouterFields()` and update the database. Safe to run multiple times.

  Usage:
    node ./scripts/encrypt-routers.ts --dry-run
*/

import { getTenantClient } from '@/lib/tenantPrisma';
import { encryptRouterFields, isEncrypted } from '@/lib/encryption';
import logger from '@/lib/logger';

async function run(dryRun = true) {
  const db = getTenantClient(null);
  const routers = await db.router.findMany();
  logger.info(`Found ${routers.length} routers`);
  let updated = 0;
  for (const r of routers) {
    const toEncrypt: any = {};
    if (r.password && !isEncrypted(r.password)) toEncrypt.password = r.password;
    if (r.radiusSecret && !isEncrypted(r.radiusSecret)) toEncrypt.radiusSecret = r.radiusSecret;
    if (r.wgPrivateKey && !isEncrypted(r.wgPrivateKey)) toEncrypt.wgPrivateKey = r.wgPrivateKey;
    if (r.wgPresharedKey && !isEncrypted(r.wgPresharedKey)) toEncrypt.wgPresharedKey = r.wgPresharedKey;

    if (Object.keys(toEncrypt).length === 0) continue;

    const encrypted = encryptRouterFields(toEncrypt as any);
    if (dryRun) {
      logger.info(`DRY-RUN: would update router ${r.id} fields: ${Object.keys(encrypted).join(',')}`);
      updated++;
      continue;
    }

    await db.router.update({ where: { id: r.id }, data: encrypted });
    logger.info(`Updated router ${r.id} encrypted fields: ${Object.keys(encrypted).join(',')}`);
    updated++;
  }
  logger.info(`Completed. Routers affected: ${updated}`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--no-dry-run') ? false : true;
  run(dryRun).catch(err => {
    logger.error('encrypt-routers failed', { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  });
}
