import net from 'net';
import crypto from 'crypto';
import logger from './logger';

// ── IP normalisation ──────────────────────────────────────────────────────────
// Node's net.Socket.remoteAddress can return IPv4-mapped IPv6 strings like
// "::ffff:1.2.3.4".  We normalise both sides of every comparison so that
// ::ffff:1.2.3.4  ≡  1.2.3.4  and  ::1  ≡  127.0.0.1
function normalizeIp(ip: string): string {
    if (!ip) return '';
    const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (mapped) return mapped[1];
    if (ip === '::1') return '127.0.0.1';
    return ip;
}

export interface ProxySession {
    sessionId: string;
    routerId: string;
    userId: string;
    tenantId: string | null;
    /** Normalised public IP of the authenticated admin — ONLY this IP may connect */
    allowedSourceIp: string;
    localPort: number;
    /** Server-resolved — never client-controlled */
    targetHost: string;
    targetPort: number;
    server: net.Server;
    createdAt: number;
    /** Idle expiry — extended by each new connection, capped by maxLifetimeAt */
    idleExpiresAt: number;
    /** Absolute hard cap — NEVER extended by activity */
    maxLifetimeAt: number;
    connectionCount: number;
    /** Track live sockets so destroySession can force-close them immediately */
    activeSockets: Set<net.Socket>;
}

const sessions = new Map<string, ProxySession>();
const activeServersByPort = new Map<number, ProxySession>();

const MAX_CONNECTIONS_PER_SESSION = 5;
/** Idle timeout: 15 minutes */
const IDLE_TTL_MS = 15 * 60 * 1000;
/** Absolute maximum session lifetime: 1 hour — never extended by activity */
const MAX_LIFETIME_MS = 60 * 60 * 1000;

function cleanupExpired() {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
        if (now > session.idleExpiresAt || now > session.maxLifetimeAt) {
            logger.info(`[WINBOX-PROXY] Session expired (idle or absolute TTL): ${id}`);
            destroySession(id);
        }
    }
}
setInterval(cleanupExpired, 60_000);

export async function createWinboxSession(
    routerId: string,
    userId: string,
    tenantId: string | null,
    targetHost: string,
    targetPort: number = 8291,
    allowedSourceIp: string
): Promise<{ sessionId: string; port: number; idleExpiresAt: number; maxLifetimeAt: number }> {
    return new Promise((resolve, reject) => {
        const sessionId = crypto.randomBytes(16).toString('hex');
        const normalizedAllowedIp = normalizeIp(allowedSourceIp);

        const server = net.createServer((socket) => {
            const session = sessions.get(sessionId);

            // ── Security gate 1: session must still exist ─────────────────
            if (!session) { socket.destroy(); return; }

            // ── Security gate 2: source-IP check (primary security control) ─
            const clientIp = normalizeIp(socket.remoteAddress || '');
            if (clientIp !== session.allowedSourceIp) {
                logger.warn(`[WINBOX-PROXY] Rejected connection from "${clientIp}" (expected "${session.allowedSourceIp}") for session ${sessionId}`);
                socket.destroy();
                return;
            }

            const now = Date.now();

            // ── Security gate 3: idle TTL ─────────────────────────────────
            if (now > session.idleExpiresAt) {
                logger.warn(`[WINBOX-PROXY] Idle-expired session ${sessionId} — closing`);
                socket.destroy();
                destroySession(sessionId);
                return;
            }

            // ── Security gate 4: absolute lifetime ───────────────────────
            if (now > session.maxLifetimeAt) {
                logger.warn(`[WINBOX-PROXY] Absolute-TTL-expired session ${sessionId} — closing`);
                socket.destroy();
                destroySession(sessionId);
                return;
            }

            // ── Security gate 5: connection cap ──────────────────────────
            if (session.connectionCount >= MAX_CONNECTIONS_PER_SESSION) {
                logger.warn(`[WINBOX-PROXY] Max connections reached for session ${sessionId}`);
                socket.destroy();
                return;
            }

            // Extend idle TTL on new connection — capped by the absolute limit
            session.idleExpiresAt = Math.min(now + IDLE_TTL_MS, session.maxLifetimeAt);
            session.connectionCount++;
            session.activeSockets.add(socket);

            // targetHost/targetPort are server-resolved — the client never chose them
            const client = net.connect({ host: session.targetHost, port: session.targetPort }, () => {
                socket.pipe(client);
                client.pipe(socket);
            });

            client.on('error', (err) => {
                logger.error(`[WINBOX-PROXY] Target connection error for router ${session.routerId}:`, { message: err.message });
                socket.destroy();
            });

            socket.on('error', (err) => {
                logger.error(`[WINBOX-PROXY] Client socket error:`, { message: err.message });
                client.destroy();
            });

            const cleanup = () => {
                session.connectionCount = Math.max(0, session.connectionCount - 1);
                session.activeSockets.delete(socket);
                client.destroy();
            };
            socket.on('close', cleanup);
            client.on('close', () => { socket.destroy(); });
        });

        server.on('error', (err) => { reject(err); });

        // Bind to all interfaces — the proxy port MUST be reachable from the
        // Admin PC over the public internet.  Security is provided by the
        // allowedSourceIp check above, not by binding address.
        server.listen(0, '0.0.0.0', () => {
            const address = server.address() as net.AddressInfo;
            const port = address.port;
            const now = Date.now();

            const session: ProxySession = {
                sessionId,
                routerId,
                userId,
                tenantId,
                allowedSourceIp: normalizedAllowedIp,
                localPort: port,
                targetHost,   // server-resolved, never returned to browser
                targetPort,   // server-resolved, never returned to browser
                server,
                createdAt: now,
                idleExpiresAt: now + IDLE_TTL_MS,
                maxLifetimeAt: now + MAX_LIFETIME_MS,
                connectionCount: 0,
                activeSockets: new Set(),
            };

            sessions.set(sessionId, session);
            activeServersByPort.set(port, session);

            logger.info(`[WINBOX-PROXY] Session created`, {
                sessionId,
                routerId,
                userId,
                localPort: port,
                allowedSourceIp: normalizedAllowedIp,
                // targetHost intentionally not logged to avoid leaking internal VPN IP
            });

            resolve({
                sessionId,
                port,
                idleExpiresAt: session.idleExpiresAt,
                maxLifetimeAt: session.maxLifetimeAt,
            });
        });
    });
}

export function destroySession(sessionId: string): boolean {
    const session = sessions.get(sessionId);
    if (!session) return false;

    // Force-close every active piped socket immediately
    for (const sock of session.activeSockets) {
        try { sock.destroy(); } catch { /* ignore */ }
    }
    session.activeSockets.clear();

    // Close the TCP listener
    session.server.close();

    sessions.delete(sessionId);
    activeServersByPort.delete(session.localPort);

    logger.info(`[WINBOX-PROXY] Session destroyed`, { sessionId, routerId: session.routerId });
    return true;
}

/**
 * Look up a session and verify it belongs to the given user + router.
 * Used by the DELETE route to prevent cross-user session destruction.
 */
export function getSessionByOwner(
    sessionId: string,
    userId: string,
    routerId: string
): ProxySession | null {
    const session = sessions.get(sessionId);
    if (!session) return null;
    if (session.userId !== userId) return null;
    if (session.routerId !== routerId) return null;
    return session;
}

/** Exported for unit tests only */
export function _getSessionsMap() { return sessions; }
