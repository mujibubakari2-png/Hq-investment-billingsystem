/**
 * WireGuard Manager — Secure System Call Wrapper
 *
 * CRIT-001 FIX: All system calls now use execFile() instead of exec().
 *   - execFile() does NOT invoke a shell — metacharacters (;, |, $, `, etc.)
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

// ── Input Validation ──────────────────────────────────────────────────────────

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

// ── CIDR Helpers ──────────────────────────────────────────────────────────────

/**
 * Convert a dotted-quad IPv4 string to a 32-bit unsigned integer.
 * Used for bitwise CIDR containment checks — not for cryptography.
 */
function ipToUint32(ip: string): number {
    const parts = ip.split('.').map(Number);
    return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}

/**
 * Returns true if `ip` falls within the address range described by `cidr`.
 *
 * Handles:
 *   exact host CIDR  ("10.0.0.200/32")  — matches only that one IP
 *   subnet CIDR      ("10.0.0.200/24" or "10.0.0.0/24")  — whole subnet
 *   catch-all        ("0.0.0.0/0")  — matches everything
 *   bare IP (no /)   — treated as /32 exact match
 */
function cidrContainsIp(cidr: string, ip: string): boolean {
    const slashIdx = cidr.indexOf('/');
    if (slashIdx === -1) return cidr.trim() === ip; // bare IP → exact match
    const network = cidr.slice(0, slashIdx).trim();
    const prefix  = parseInt(cidr.slice(slashIdx + 1), 10);
    if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;
    if (prefix === 0) return true; // 0.0.0.0/0 — catch-all
    const mask       = (~0 << (32 - prefix)) >>> 0;
    const networkNum = ipToUint32(network) & mask;
    const ipNum      = ipToUint32(ip)      & mask;
    return networkNum === ipNum;
}

// ── Manager ───────────────────────────────────────────────────────────────────

export const wireguardManager = {
    /**
     * Get the server's WireGuard interface IP address.
     */
    getServerIp: async (): Promise<string> => {
        try {
            // CRIT-001 FIX: execFile — no shell, args are literal
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
            // CRIT-001 FIX: execFile with sudo — no shell
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
        // CRIT-001 FIX: execFile — 'wg genkey' takes no args, no shell needed
        const { stdout } = await execFileAsync('wg', ['genkey']);
        return stdout.trim();
    },

    /**
     * Derive a WireGuard public key from a private key.
     *
     * CRIT-001 FIX: Previously used exec(`printf '%s' "${privateKey}" | wg pubkey`)
     * which was injectable. Now uses execFile with stdin pipe — the private key
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

            // Pass private key via stdin — never touches a shell
            child.stdin?.write(privateKey + '\n');
            child.stdin?.end();
        });
    },

    /**
     * WG-PEER-ID-001: Determine whether a tunnel IP is already owned by a
     * DIFFERENT peer on wg0. WireGuard enforces one peer per allowed-ip at
     * the kernel level — assigning it to a second peer silently steals it
     * from the first, breaking that peer's tunnel with zero error output.
     *
     * Detection uses CIDR containment (not string equality) so it catches:
     *   - exact /32 ownership  ("10.0.0.200/32" — new canonical format)
     *   - legacy /24 ownership ("10.0.0.200/24" — old format, same IP in prefix)
     *   - subnet ownership     ("10.0.0.0/24"   — broader subnet containing IP)
     *
     * A match against the SAME publicKey is NOT a collision — that is an
     * idempotent re-add / peer update and must be allowed through.
     *
     * @param allowedIp         Bare IPv4 (no CIDR) to check ownership of.
     * @param expectedPublicKey Skip this key — it owns the IP legitimately.
     * @returns conflicting peer publicKey, or null if the IP is free.
     */
    findPeerHoldingIp: async (allowedIp: string, expectedPublicKey?: string): Promise<string | null> => {
        try {
            const { stdout } = await execFileAsync('sudo', ['wg', 'show', 'wg0', 'dump']);
            // wg show dump columns: pubkey  preshared  endpoint  allowed-ips  handshake  rx  tx
            // First line is the interface row — skip it.
            const lines = stdout.trim().split('\n').slice(1);
            for (const line of lines) {
                if (!line.trim()) continue;
                const parts          = line.split('\t');
                const peerKey        = parts[0]?.trim() ?? '';
                const peerAllowedIps = parts[3]?.trim() ?? '';
                if (!peerKey || !peerAllowedIps || peerAllowedIps === '(none)') continue;

                // CIDR containment check — catches /32, legacy /24, and any subnet overlap
                const cidrs   = peerAllowedIps.split(',').map(c => c.trim()).filter(Boolean);
                const holdsIp = cidrs.some(cidr => cidrContainsIp(cidr, allowedIp));

                if (holdsIp && peerKey !== expectedPublicKey) {
                    return peerKey; // a DIFFERENT peer already owns this IP
                }
            }
            return null;
        } catch (error) {
            logger.error('[WireGuard Error] Failed to check IP ownership:', { error: error instanceof Error ? error.message : String(error) });
            return null; // fail-open — DB unique constraint is the primary safety net
        }
    },

    /**
     * Add or update a peer on the WireGuard interface (wg0).
     *
     * CRIT-001 FIX: All arguments passed as array to execFile.
     * Preshared key written to a temp file to avoid any shell exposure,
     * then securely deleted after use.
     *
     * WG-PEER-ID-001 FIX: Before assigning allowedIp to publicKey, verify no
     * OTHER peer already holds that IP. Without this check, `wg set` would
     * silently strip the IP from whichever peer had it, breaking that
     * router's tunnel with zero error output — the exact "peer breaks peer"
     * failure mode this fix closes.
     *
     * WG-PEER-/32-FIX: Each router is registered with a /32 host route
     * (ROUTER_IP/32), never a /24 subnet route. Using /24 breaks multi-router
     * deployments because WireGuard silently steals the entire /24 from the
     * first peer when a second peer claims overlapping allowed-ips.
     *
     * NOTE on MikroTik side: the router-side peer MUST still use
     * allowed-address=10.0.0.0/24 (the whole VPN subnet) so RouterOS routes
     * all VPN-destined traffic through the tunnel. That is a separate
     * configuration field on the opposite side of the tunnel — do not change it.
     *
     * @param publicKey    - Router's WireGuard public key (44-char Base64)
     * @param allowedIp    - Router's assigned tunnel IP (bare dotted-quad, no CIDR)
     * @param presharedKey - Optional preshared key for post-quantum hardening
     */
    addPeer: async (publicKey: string, allowedIp: string, presharedKey?: string) => {
        validateWgKey(publicKey, 'publicKey');
        validateAllowedIp(allowedIp);
        if (presharedKey) {
            validateWgKey(presharedKey, 'presharedKey');
        }

        // WG-PEER-ID-001: refuse to steal an IP that already belongs to a
        // different peer instead of silently breaking that peer's tunnel.
        const conflictingPeer = await wireguardManager.findPeerHoldingIp(allowedIp, publicKey);
        if (conflictingPeer) {
            throw new Error(
                `WireGuard IP ${allowedIp} is already assigned to a different peer ` +
                `(publicKey ending in ...${conflictingPeer.slice(-8)}). Refusing to add peer ` +
                `...${publicKey.slice(-8)} with the same IP — this would silently disconnect the ` +
                `other router. Free the IP first or assign a different tunnel IP.`
            );
        }

        // /32 host route: each peer owns exactly its own IP, no subnet overlap possible.
        const hostCidr = `${allowedIp}/32`;
        let tmpFile: string | null = null;

        try {
            if (presharedKey) {
                // Write preshared key to a secure temp file — never touches shell
                tmpFile = path.join(os.tmpdir(), `wg-psk-${Date.now()}.tmp`);
                await fs.writeFile(tmpFile, presharedKey, { mode: 0o600 });

                await execFileAsync('sudo', [
                    'wg', 'set', 'wg0',
                    'peer', publicKey,
                    'allowed-ips', hostCidr,
                    'preshared-key', tmpFile,
                ]);
            } else {
                await execFileAsync('sudo', [
                    'wg', 'set', 'wg0',
                    'peer', publicKey,
                    'allowed-ips', hostCidr,
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
     * Safely migrate a legacy server-side WireGuard peer from any CIDR
     * (typically ROUTER_IP/24 from the old model) to the canonical host
     * route ROUTER_IP/32 required by the new model.
     *
     * Safety guarantees:
     *   - Never removes the peer; only replaces allowed-ips.
     *   - Idempotent: calling on an already-/32 peer returns { migrated: false }.
     *   - Only modifies the peer identified by publicKey — no other peer touched.
     *   - Persists change to wg0.conf with wg-quick save.
     *
     * Intended for one-time migration after deploying the /32 addPeer() fix.
     * Run once per router using router.wgPublicKey and router.wgTunnelIp from DB.
     *
     * @param publicKey  Router peer's WireGuard public key (44-char Base64).
     * @param allowedIp  Router's bare tunnel IP (no CIDR suffix).
     * @returns { migrated: boolean; reason: string }
     */
    migratePeerToHostRoute: async (
        publicKey: string,
        allowedIp: string,
    ): Promise<{ migrated: boolean; reason: string }> => {
        validateWgKey(publicKey, 'publicKey');
        validateAllowedIp(allowedIp);

        try {
            const { stdout } = await execFileAsync('sudo', ['wg', 'show', 'wg0', 'dump']);
            const lines = stdout.trim().split('\n').slice(1);

            let currentCidrs: string[] = [];
            let found = false;
            for (const line of lines) {
                if (!line.trim()) continue;
                const parts   = line.split('\t');
                const peerKey = parts[0]?.trim() ?? '';
                if (peerKey !== publicKey) continue;
                found = true;
                const rawIps = parts[3]?.trim() ?? '';
                currentCidrs = rawIps.split(',').map(c => c.trim()).filter(Boolean);
                break;
            }

            if (!found) {
                return { migrated: false, reason: `Peer ...${publicKey.slice(-8)} not found on wg0` };
            }

            const targetCidr = `${allowedIp}/32`;
            if (currentCidrs.length === 1 && currentCidrs[0] === targetCidr) {
                return { migrated: false, reason: `Already ${targetCidr} — no migration needed` };
            }

            // Replace all existing CIDRs with the single host route
            await execFileAsync('sudo', [
                'wg', 'set', 'wg0',
                'peer', publicKey,
                'allowed-ips', targetCidr,
            ]);
            await execFileAsync('sudo', ['wg-quick', 'save', 'wg0']);

            logger.info(
                `[WireGuard] migratePeerToHostRoute: peer ...${publicKey.slice(-8)}: ` +
                `[${currentCidrs.join(', ')}] → ${targetCidr}`,
            );
            return {
                migrated: true,
                reason: `Migrated from [${currentCidrs.join(', ')}] to ${targetCidr}`,
            };
        } catch (error) {
            logger.error('[WireGuard Error] migratePeerToHostRoute failed:', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
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
