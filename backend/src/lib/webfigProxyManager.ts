import http from 'http';
import net from 'net';
import crypto from 'crypto';
import logger from './logger';

export interface WebfigSession {
    sessionId: string;
    routerId: string;
    userId: string;
    targetHost: string;
    targetPort: number;
    activeSockets: Set<net.Socket>;
    createdAt: number;
    /** Idle expiry — extended by activity, capped by maxLifetimeAt */
    expiresAt: number;
    /** Absolute hard cap — NEVER extended by activity */
    maxLifetimeAt: number;
}

const sessions = new Map<string, WebfigSession>();
/** Idle timeout: 15 minutes */
const SESSION_TTL_MS = 15 * 60 * 1000;
/** Absolute maximum session lifetime: 4 hours — never extended by activity */
const MAX_LIFETIME_MS = 4 * 60 * 60 * 1000;

// The central, internal-only proxy port
let CENTRAL_PROXY_PORT = process.env.NODE_ENV === 'test' ? 0 : 8092;
let centralServer: http.Server | null = null;
let isStartingServer = false;
let cleanupInterval: NodeJS.Timeout | null = null;

function cleanupExpired() {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
        if (now > session.expiresAt || now > session.maxLifetimeAt) {
            logger.info(`[WEBFIG-PROXY] Session expired (idle or absolute TTL): ${id}`);
            destroySession(id);
        }
    }
}
cleanupInterval = setInterval(cleanupExpired, 60000);
cleanupInterval.unref();

export function getCentralProxyPort(): number {
    if (centralServer) {
        const address = centralServer.address();
        if (address && typeof address !== 'string') {
            return address.port;
        }
    }
    return CENTRAL_PROXY_PORT;
}

export function shutdownWebfigProxy(callback?: () => void) {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
    if (centralServer) {
        centralServer.close(callback);
        centralServer = null;
    } else if (callback) {
        callback();
    }
}

export function destroySession(sessionId: string) {
    const session = sessions.get(sessionId);
    if (session) {
        sessions.delete(sessionId);
        for (const socket of session.activeSockets) {
            socket.destroy();
        }
        session.activeSockets.clear();
        logger.info(`[WEBFIG-PROXY] Destroyed session ${sessionId} and closed active sockets`);
    }
}

function parseSessionCookie(cookieHeader: string | undefined): string | null {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/__Host-webfig_session_id=([^;]+)/);
    return match ? match[1] : null;
}

function handleProxyRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const sessionId = parseSessionCookie(req.headers.cookie);
    if (!sessionId) {
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('Missing WebFig session cookie');
        return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
        console.log(`[DEBUG-LOOKUP] Failed to find session: '${sessionId}'. Current keys: ${Array.from(sessions.keys()).join(', ')}`);
        logger.error(`[DEBUG] Session not found. sessionId='${sessionId}'. sessions size=${sessions.size}`);
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Session not found');
        return;
    }
    if (Date.now() > session.expiresAt) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Session expired (idle timeout)');
        destroySession(sessionId);
        return;
    }
    if (Date.now() > session.maxLifetimeAt) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Session maximum lifetime reached');
        destroySession(sessionId);
        return;
    }

    // Extend idle TTL on activity — capped by absolute lifetime
    session.expiresAt = Math.min(Date.now() + SESSION_TTL_MS, session.maxLifetimeAt);

    // Header policy
    const STRIP_REQUEST_HEADERS = new Set([
        'authorization', 'x-auth-token', 'x-forwarded-for', 'x-forwarded-proto',
        'x-real-ip', 'connection', 'keep-alive', 'te', 'trailers', 'transfer-encoding'
    ]);
    const forwardHeaders: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(req.headers)) {
        if (!STRIP_REQUEST_HEADERS.has(k.toLowerCase()) && v !== undefined) {
            forwardHeaders[k] = v as string | string[];
        }
    }
    forwardHeaders['host'] = `${session.targetHost}:${session.targetPort}`;

    const proxyReq = http.request({
        hostname: session.targetHost,
        port: session.targetPort,
        path: req.url,
        method: req.method,
        headers: forwardHeaders,
    }, (proxyRes) => {
        const STRIP_RESPONSE_HEADERS = new Set([
            'connection', 'keep-alive', 'transfer-encoding', 'te', 'trailers',
            'proxy-authenticate', 'proxy-authorization'
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
        logger.error(`[WEBFIG-PROXY] Request error for router ${session.routerId}:`, { message: err.message });
        if (!res.headersSent) { res.writeHead(502); }
        res.end('Bad Gateway');
    });

    req.pipe(proxyReq, { end: true });
}

function handleProxyUpgrade(req: http.IncomingMessage, socket: net.Socket, head: Buffer) {
    const sessionId = parseSessionCookie(req.headers.cookie);
    if (!sessionId) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
    }

    const session = sessions.get(sessionId);
    if (!session || Date.now() > session.expiresAt || Date.now() > session.maxLifetimeAt) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        if (session) destroySession(sessionId);
        return;
    }

    session.expiresAt = Math.min(Date.now() + SESSION_TTL_MS, session.maxLifetimeAt);
    session.activeSockets.add(socket);
    socket.on('close', () => session.activeSockets.delete(socket));

    const STRIP_WS_HEADERS = new Set([
        'authorization', 'x-auth-token', 'x-forwarded-for', 'x-real-ip'
    ]);
    const wsHeaders: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(req.headers)) {
        if (!STRIP_WS_HEADERS.has(k.toLowerCase()) && v !== undefined) {
            wsHeaders[k] = v as string | string[];
        }
    }
    wsHeaders['host'] = `${session.targetHost}:${session.targetPort}`;

    const proxyReq = http.request({
        hostname: session.targetHost,
        port: session.targetPort,
        path: req.url,
        method: req.method,
        headers: wsHeaders,
    });

    proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
        session.activeSockets.add(proxySocket);
        proxySocket.on('close', () => session.activeSockets.delete(proxySocket));

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
}

export function ensureCentralServer(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (centralServer) return resolve();
        if (isStartingServer) {
            // Very basic wait if already starting
            const interval = setInterval(() => {
                if (!isStartingServer) {
                    clearInterval(interval);
                    if (centralServer) resolve();
                    else reject(new Error('Failed to start server'));
                }
            }, 10);
            return;
        }
        isStartingServer = true;

        centralServer = http.createServer(handleProxyRequest);
        centralServer.on('upgrade', handleProxyUpgrade);

        centralServer.listen(CENTRAL_PROXY_PORT, '127.0.0.1', () => {
            logger.info(`[WEBFIG-PROXY] Central proxy listening on 127.0.0.1:${getCentralProxyPort()}`);
            isStartingServer = false;
            resolve();
        });

        centralServer.on('error', (err) => {
            logger.error(`[WEBFIG-PROXY] Central proxy server error:`, { error: err.message });
            isStartingServer = false;
            centralServer = null;
            reject(err);
        });
    });
}

export async function createWebfigSession(
    routerId: string,
    userId: string,
    targetHost: string,
    targetPort: number = 80
): Promise<{ sessionId: string; expiresAt: number }> {
    await ensureCentralServer();

    const sessionId = crypto.randomBytes(16).toString('hex');
    const session: WebfigSession = {
        sessionId,
        routerId,
        userId,
        targetHost,
        targetPort,
        activeSockets: new Set(),
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_TTL_MS,
        maxLifetimeAt: Date.now() + MAX_LIFETIME_MS,
    };

    sessions.set(sessionId, session);
    console.log(`[DEBUG-CREATE] Created session: '${sessionId}'. Current keys: ${Array.from(sessions.keys()).join(', ')}`);
    logger.info(`[WEBFIG-PROXY] Created session ${sessionId} for router ${routerId} -> ${targetHost}:${targetPort}`);
    return { sessionId, expiresAt: session.expiresAt };
}
