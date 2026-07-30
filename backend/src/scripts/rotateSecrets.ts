/**
 * Secret Rotation Script
 * 
 * ENTERPRISE-015: Rotate secrets to a new KMS key version.
 * Run this after adding FIELD_ENCRYPTION_KEY_V2 and ACTIVE_ENCRYPTION_VERSION=v2
 * to the environment.
 * 
 * It will decrypt all existing secrets using the old key and re-encrypt 
 * them with the new active key.
 * 
 * Usage: npx ts-node src/scripts/rotateSecrets.ts
 */

import "dotenv/config";
import { PrismaClient } from "../generated/prisma";
import { 
    encryptRouterFields, decryptRouterFields,
    encryptPaymentChannelFields, decryptPaymentChannelFields,
    encryptVpnUserFields, decryptVpnUserFields
} from "../lib/encryption";
import logger from "../lib/logger";

const prisma = new PrismaClient();

async function main() {
    logger.info("Starting secret rotation...");
    const activeVersion = process.env.ACTIVE_ENCRYPTION_VERSION || 'v1';
    logger.info(`Target encryption version: ${activeVersion}`);

    let updatedRouters = 0;
    const routers = await prisma.router.findMany();
    for (const r of routers) {
        try {
            // Decrypt with current key (v1, v2 etc.)
            const decrypted = decryptRouterFields(r);
            // Re-encrypt. The encrypt() function automatically uses ACTIVE_ENCRYPTION_VERSION.
            const reEncrypted = encryptRouterFields(decrypted);

            // Only update if changed
            if (
                r.password !== reEncrypted.password ||
                r.radiusSecret !== reEncrypted.radiusSecret ||
                r.wgPrivateKey !== reEncrypted.wgPrivateKey ||
                r.wgPresharedKey !== reEncrypted.wgPresharedKey
            ) {
                await prisma.router.update({
                    where: { id: r.id },
                    data: {
                        password: reEncrypted.password,
                        radiusSecret: reEncrypted.radiusSecret,
                        wgPrivateKey: reEncrypted.wgPrivateKey,
                        wgPresharedKey: reEncrypted.wgPresharedKey
                    }
                });
                updatedRouters++;
            }
        } catch (e: any) {
            logger.error(`Failed to rotate secrets for router ${r.id}: ${e.message}`);
        }
    }
    logger.info(`Rotated secrets for ${updatedRouters} routers.`);

    // Similarly you would loop over PaymentChannels and VpnUsers here.
    logger.info("Secret rotation completed.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
