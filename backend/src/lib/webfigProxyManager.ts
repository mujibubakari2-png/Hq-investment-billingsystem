import http from 'http';
import net from 'net';
import crypto from 'crypto';
import logger from './logger';

export interface WebfigSession {
    sessionId: string;
    routerId: string;
    userId: string;
    localPort: number;
    targetHost: string;
    targetPort: number;
    server: http.Server;
    createdAt: number;
    /** Idle expiry — extended by activity, capped by maxLifetimeAt */
    expiresAt: number;
    /** Absolute hard cap — NEVER extended by activity */
    maxLifetimeAt: number;
}

const sessions = new Map<string, WebfigSession>();
/** Idle timeout: 30 minutes */
const SESSION_TTL_MS = 30 * 60 * 1000;
/** Absolute maximum session lifetime: 4 hours — never extended by activity */
const MAX_LIFETIME_MS = 4 * 60 * 60 * 1000;

function cleanupExpired() {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
        // Check BOTH idle TTL and absolute maximum lifetime
        if (now > session.expiresAt || now > session.maxLifetimeAt) {
            logger.info(`[WEBFIG-PROXY] Session expired (idle or absolute TTL): ${id}`);
            destroySession(id);
        }
    }
}
setInterval(cleanupExpired, 60000);

export async function createWebfigSession(
    routerId: string,
    userId: string,
    targetHost: string,
    targetPort: number = 80
): Promise<{ sessionId: string; port: number; expiresAt: number }> {
    return new Promise((resolve, reject) => {
        const sessionId = crypto.randomBytes(16).toString('hex');

        const server = http.createServer((req, res) => {
                    const session = sessions.get(sessionId);
            if (!session) {
                res.writeHead(403);
                res.end('Session not found or expired');
                return;
            }
            if (Date.now() > session.expiresAt) {
                res.writeHead(403);
                res.end('Session expired');
                destroySession(sessionId);
                return;
            }
            if (Date.now() > session.maxLifetimeAt) {
                res.writeHead(403);
                res.end('Session maximum lifetime reached');
                destroySession(sessionId);
                return;
            }

            // Extend idle TTL on activity — capped by the absolute lifetime
            session.expiresAt = Math.min(Date.now() + SESSION_TTL_MS, session.maxLifetimeAt);

            // ── Header policy ─────────────────────────────────────────────
            // NEVER forward platform authentication headers to MikroTik.
            // DO forward RouterOS WebFig cookies — they carry the RouterOS
            // session state and must not be stripped.
            //
            // Strip: Authorization, X-Auth-Token (platform JWT bearer)
            // Strip: hop-by-hop headers (Connection, Upgrade, Keep-Alive)
            // Strip: X-Forwarded-For, X-Real-IP (leak VPS internal topology)
            // Pass:  Cookie (RouterOS uses cookies for its own session)
            // Pass:  Content-Type, Content-Length, Accept, etc.
            const STRIP_REQUEST_HEADERS = new Set([
                'authorization',
                'x-auth-token',
                'x-forwarded-for',
                'x-forwarded-proto',
                'x-real-ip',
                'connection',
                'keep-alive',
                'te',
                'trailers',
                'transfer-encoding',
            ]);

            const forwardHeaders: Record<string, string | string[]> = {};
            for (const [k, v] of Object.entries(req.headers)) {
                if (!STRIP_REQUEST_HEADERS.has(k.toLowerCase()) && v !== undefined) {
                    forwardHeaders[k] = v as string | string[];
                }
            }
            // Override Host to match the RouterOS target (required for WebFig)
            forwardHeaders['host'] = `${targetHost}:${targetPort}`;

                        const options = {
                hostname: targetHost,
                port: targetPort,
                path: req.url,
                method: req.method,
                headers: forwardHeaders,
            };

            const proxyReq = http.request(options, (proxyRes) => {
                // Strip hop-by-hop headers from the RouterOS response before
                // forwarding to the browser.  Do NOT strip Set-Cookie — RouterOS
                // uses it to maintain the WebFig session.
                const STRIP_RESPONSE_HEADERS = new Set([
                    'connection', 'keep-alive', 'transfer-encoding', 'te', 'trailers',
                    'proxy-authenticate', 'proxy-authorization',
                ]);
                const safeHeaders: Record<string, string | string[]> = {};
                for (const [k, v] of Object.entries(proxyRes.headers)) {
                    if (!STRIP_RESPONSE_HEADERS.has(k.toLowerCase()) && v !== undefined) {
                        safeHeaders[k] = v as string | string[];
                    }
                }
                res.writeHead(proxyRes.statusCode || 200, safeHeaders);
                proxyRes.pipe(res, { end: true });
            });

            proxyReq.on('error', (err) => {
                logger.error(`[WEBFIG-PROXY] Request error for router ${routerId}:`, { message: err.message });
                if (!res.headersSent) { res.writeHead(502); }
                res.end('Bad Gateway');
            });

            req.pipe(proxyReq, { end: true });
        });

        server.on('upgrade', (req, socket, head) => {
            const session = sessions.get(sessionId);
            if (!session || Date.now() > session.expiresAt || Date.now() > session.maxLifetimeAt) {
                socket.destroy();
                return;
            }
            // For WebSocket upgrades apply the same header policy
            const STRIP_WS_HEADERS = new Set([
                'authorization', 'x-auth-token', 'x-forwarded-for', 'x-real-ip',
            ]);
            const wsHeaders: Record<string, string | string[]> = {};
            for (const [k, v] of Object.entries(req.headers)) {
                if (!STRIP_WS_HEADERS.has(k.toLowerCase()) && v !== undefined) {
                    wsHeaders[k] = v as string | string[];
                }
            }
            wsHeaders['host'] = `${targetHost}:${targetPort}`;
            const proxyReq = http.request({
                hostname: targetHost,
                port: targetPort,
                path: req.url,
                method: req.method,
                headers: wsHeaders,
            });

            proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
                socket.write(
                    `HTTP/1.1 ${proxyRes.statusCode} ${proxyRes.statusMessage}\r\n` +
                    Object.keys(proxyRes.headers).map(key => `${key}: ${proxyRes.headers[key]}`).join('\r\n') +
                    '\r\n\r\n'
                );
                if (proxyHead && proxyHead.length) {
                    socket.write(proxyHead);
                }
                proxySocket.pipe(socket);
                socket.pipe(proxySocket);
            });

            proxyReq.on('error', () => { socket.destroy(); });
            proxyReq.end();
        });

        server.on('error', (err) => {
            reject(err);
        });

        server.listen(0, '0.0.0.0', () => {
            const address = server.address() as net.AddressInfo;
            const port = address.port;

            const session: WebfigSession = {
                sessionId,
                routerId,
                userId,
                localPort: port,
                targetHost,
                targetPort,
                server,
                createdAt: Date.now(),
                expiresAt: Date.now() + SESSION_TTL_MS,
                maxLifetimeAt: Date.now() + MAX_LIFETIME_MS,
            };

            sessions.set(sessionId, session);
            logger.info(`[WEBFIG-PROXY] Created session ${sessionId} for router ${routerId} on port ${port} -> ${targetHost}:${targetPort}`);
            resolve({ sessionId, port, expiresAt: session.expiresAt });
        });
    });
}

export function destroySession(sessionId: string) {
    const session = sessions.get(sessionId);
    if (session) {
        session.server.close();
        sessions.delete(sessionId);
        logger.info(`[WEBFIG-PROXY] Destroyed session ${sessionId}`);
    }
}
