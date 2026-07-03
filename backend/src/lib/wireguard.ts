/**
 * WireGuard Manager â€” Secure System Call Wrapper
 *
 * CRIT-001 FIX: All system calls now use execFile() instead of exec().
 *   - execFile() does NOT invoke a shell â€” metacharacters (;, |, $, `, etc.)
 *     in arguments are passed literally to the binary, not interpreted by sh.
 *   - Previously, `exec(\`printf '%s' "${privateKey}" | wg pubkey\`)` allowed
 *     a malicious key string to execute arbitrary OS commands as the Node.js user.
 *   - All inputs are validated against strict regex before any system call.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import logger from "@/lib/logger";

const execFileAsync = promisify(execFile);

// â”€â”€ Input Validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** WireGuard keys are 32-byte values encoded as Base64 (44 chars with trailing =) */
const WG_KEY_REGEX = /^[A-Za-z0-9+/]{43}=$/;

/** Tunnel IP: simple IPv4 dotted-quad */
const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

function validateWgKey(key: string, fieldName: string): void {
    if (!key || typeof key !== 'string') {
        throw new Error(`WireGuard ${fieldName} is required`);
    }
    if (!WG_KEY_REGEX.test(key)) {
        throw new Error(
            `WireGuard ${fieldName} is invalid. Expected a 44-character Base64 WireGuard key.`
        );
    }
}

function validateAllowedIp(ip: string): void {
    if (!ip || !IPV4_REGEX.test(ip)) {
        throw new Error(`Invalid WireGuard allowed IP: "${ip}"`);
    }
    const octets = ip.split('.').map(Number);
    if (octets.some((o) => o > 255)) {
        throw new Error(`Invalid WireGuard allowed IP: "${ip}"`);
    }
}

// â”€â”€ Manager â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const wireguardManager = {
    /**
     * Get the server's WireGuard interface IP address.
     */
    getServerIp: async (): Promise<string> => {
        try {
            // CRIT-001 FIX: execFile â€” no shell, args are literal
            const { stdout } = await execFileAsync('ip', ['-4', 'addr', 'show', 'wg0']);
            const match = stdout.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
            if (match && match[1]) {
                return match[1];
            }
            return '10.0.0.1';
        } catch {
            return '10.0.0.1';
        }
    },

    /**
     * Get the server's WireGuard public key.
     */
    getServerPublicKey: async (): Promise<string | null> => {
        try {
            // CRIT-001 FIX: execFile with sudo â€” no shell
            const { stdout } = await execFileAsync('sudo', ['wg', 'show', 'wg0', 'public-key']);
            return stdout.trim();
        } catch (error) {
            logger.error('[WireGuard Error] Failed to get server public key:', { error: error instanceof Error ? error.message : String(error) });
            return null;
        }
    },

    /**
     * Generate a new WireGuard private key.
     */
    generatePrivateKey: async (): Promise<string> => {
        // CRIT-001 FIX: execFile â€” 'wg genkey' takes no args, no shell needed
        const { stdout } = await execFileAsync('wg', ['genkey']);
        return stdout.trim();
    },

    /**
     * Derive a WireGuard public key from a private key.
     *
     * CRIT-001 FIX: Previously used exec(`printf '%s' "${privateKey}" | wg pubkey`)
     * which was injectable. Now uses execFile with stdin pipe â€” the private key
     * is passed as process input, NEVER interpolated into a shell string.
     */
    derivePublicKey: async (privateKey: string): Promise<string> => {
        validateWgKey(privateKey, 'privateKey');

        return new Promise((resolve, reject) => {
            const child = execFile('wg', ['pubkey'], (error, stdout) => {
                if (error) {
                    reject(new Error(`[WireGuard] derivePublicKey failed: ${error.message}`));
                    return;
                }
                resolve(stdout.trim());
            });

            // Pass private key via stdin â€” never touches a shell
            child.stdin?.write(privateKey + '\n');
            child.stdin?.end();
        });
    },

    /**
     * Add a new peer to the WireGuard interface (wg0).
     *
     * CRIT-001 FIX: All arguments passed as array to execFile.
     * Preshared key written to a temp file to avoid any shell exposure,
     * then securely deleted after use.
     *
     * @param publicKey    - Router's WireGuard public key (44-char Base64)
     * @param allowedIp    - Router's assigned tunnel IP (without /32)
     * @param presharedKey - Optional preshared key for post-quantum hardening
     */
    addPeer: async (publicKey: string, allowedIp: string, presharedKey?: string) => {
        validateWgKey(publicKey, 'publicKey');
        validateAllowedIp(allowedIp);
        if (presharedKey) {
            validateWgKey(presharedKey, 'presharedKey');
        }

        let tmpFile: string | null = null;

        try {
            if (presharedKey) {
                // Write preshared key to a secure temp file â€” never touches shell
                tmpFile = path.join(os.tmpdir(), `wg-psk-${Date.now()}.tmp`);
                await fs.writeFile(tmpFile, presharedKey, { mode: 0o600 });

                await execFileAsync('sudo', [
                    'wg', 'set', 'wg0',
                    'peer', publicKey,
                    'allowed-ips', `${allowedIp}/32`,
                    'preshared-key', tmpFile,
                ]);
            } else {
                await execFileAsync('sudo', [
                    'wg', 'set', 'wg0',
                    'peer', publicKey,
                    'allowed-ips', `${allowedIp}/32`,
                ]);
            }

            // Persist the change to wg0.conf
            await execFileAsync('sudo', ['wg-quick', 'save', 'wg0']);

            return { success: true, message: `Peer ${allowedIp} added successfully` };
        } catch (error: any) {
            logger.error('[WireGuard Error] Failed to add peer:', error);
            throw error;
        } finally {
            // Always delete the temp file, even on error
            if (tmpFile) {
                await fs.unlink(tmpFile).catch(() => {});
            }
        }
    },

    /**
     * Remove a peer from the WireGuard interface.
     *
     * CRIT-001 FIX: publicKey validated and passed as execFile arg, not shell string.
     */
    removePeer: async (publicKey: string) => {
        validateWgKey(publicKey, 'publicKey');

        try {
            await execFileAsync('sudo', ['wg', 'set', 'wg0', 'peer', publicKey, 'remove']);
            await execFileAsync('sudo', ['wg-quick', 'save', 'wg0']);

            return { success: true, message: 'Peer removed successfully' };
        } catch (error: any) {
            logger.error('[WireGuard Error] Failed to remove peer:', error);
            throw error;
        }
    },

    /**
     * List all current WireGuard peers.
     */
    listPeers: async () => {
        try {
            const { stdout } = await execFileAsync('sudo', ['wg', 'show', 'wg0', 'dump']);
            const lines = stdout.trim().split('\n').slice(1); // Skip the interface line

            return lines.filter(Boolean).map((line) => {
                const parts = line.split('\t');
                return {
                    publicKey:       parts[0] ?? '',
                    endpoint:        parts[2] ?? '',
                    allowedIps:      parts[3] ?? '',
                    latestHandshake: parts[4] ?? '0',
                    transferRx:      parts[5] ?? '0',
                    transferTx:      parts[6] ?? '0',
                };
            });
        } catch (error) {
            logger.error('[WireGuard Error] Failed to list peers:', { error: error instanceof Error ? error.message : String(error) });
            return [];
        }
    },

    /**
     * Check if a WireGuard peer has completed a handshake within the last 3 minutes.
     * Returns true only if the tunnel is actually established.
     */
    checkPeerHandshake: async (publicKey: string): Promise<boolean> => {
        validateWgKey(publicKey, 'publicKey');

        try {
            const { stdout } = await execFileAsync('sudo', ['wg', 'show', 'wg0', 'latest-handshakes']);
            const lines = stdout.trim().split('\n').filter(Boolean);

            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts[0] === publicKey) {
                    const handshakeTimestamp = parseInt(parts[1] ?? '0', 10);
                    if (handshakeTimestamp === 0) return false;
                    const ageSeconds = Math.floor(Date.now() / 1000) - handshakeTimestamp;
                    // Connected if handshake was within last 3 minutes (180s)
                    return ageSeconds < 180;
                }
            }
            return false;
        } catch (error) {
            logger.error('[WireGuard Error] Failed to check peer handshake:', { error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    },
};

