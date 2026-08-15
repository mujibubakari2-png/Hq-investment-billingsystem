import http from 'http';
import net from 'net';
import { createWebfigSession, destroySession, shutdownWebfigProxy, getCentralProxyPort } from '@/lib/webfigProxyManager';
import logger from '@/lib/logger';

jest.mock('@/lib/logger', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

describe('WebFig Proxy Manager', () => {
    let mockTargetServer: http.Server;
    let targetPort: number;

    beforeAll((done) => {
        // Start a mock MikroTik server to proxy to
        mockTargetServer = http.createServer((req, res) => {
            if (req.url === '/webfig/') {
                res.writeHead(200, { 'Content-Type': 'text/plain', 'Set-Cookie': 'mikrotik=test' });
                res.end('WebFig OK');
            } else if (req.url === '/secret') {
                res.writeHead(200);
                res.end('Secret Data');
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });
        mockTargetServer.listen(0, '127.0.0.1', () => {
            targetPort = (mockTargetServer.address() as net.AddressInfo).port;
            done();
        });
    });

    afterAll((done) => {
        shutdownWebfigProxy(() => {
            mockTargetServer.close(done);
        });
    });

    it('creates a central proxy and routes correctly with a valid session cookie', async () => {
        const { sessionId } = await createWebfigSession('router-1', 'user-1', '127.0.0.1', targetPort);

        const res = await new Promise<http.IncomingMessage>((resolve) => {
            http.get({
                hostname: '127.0.0.1',
                port: getCentralProxyPort(),
                path: '/webfig/',
                headers: {
                    Cookie: `__Host-webfig_session_id=${sessionId}`
                }
            }, resolve);
        });

        expect(res.statusCode).toBe(200);
        let data = '';
        res.on('data', chunk => data += chunk);
        await new Promise(r => res.on('end', r));
        expect(data).toBe('WebFig OK');

        destroySession(sessionId);
    });

    it('returns 401 when session cookie is missing', async () => {
        const res = await new Promise<http.IncomingMessage>((resolve) => {
            http.get({
                hostname: '127.0.0.1',
                port: getCentralProxyPort(),
                path: '/webfig/',
            }, resolve);
        });

        expect(res.statusCode).toBe(401);
    });

    it('returns 403 when session cookie is unknown', async () => {
        const res = await new Promise<http.IncomingMessage>((resolve) => {
            http.get({
                hostname: '127.0.0.1',
                port: getCentralProxyPort(),
                path: '/webfig/',
                headers: {
                    Cookie: `__Host-webfig_session_id=fake-session`
                }
            }, resolve);
        });

        expect(res.statusCode).toBe(403);
    });

    it('denies connection if session is destroyed (DELETE)', async () => {
        const { sessionId } = await createWebfigSession('router-2', 'user-1', '127.0.0.1', targetPort);
        destroySession(sessionId);

        const res = await new Promise<http.IncomingMessage>((resolve) => {
            http.get({
                hostname: '127.0.0.1',
                port: getCentralProxyPort(),
                path: '/webfig/',
                headers: {
                    Cookie: `__Host-webfig_session_id=${sessionId}`
                }
            }, resolve);
        });

        expect(res.statusCode).toBe(403);
    });
});
