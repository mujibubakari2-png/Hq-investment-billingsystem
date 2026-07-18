import {
    validateRouterForScriptGeneration,
    preflightCheckRouters,
    lintGeneratedScript,
    deriveVpnManagementSubnet,
    generateSecureSecret,
    generateRouterAdminPassword,
    generateRadiusSecret,
    generateAdminUsername,
    type RouterForScriptGeneration,
} from '../../lib/routerProvisioning';

function baseRouter(overrides: Partial<RouterForScriptGeneration> = {}): RouterForScriptGeneration {
    return {
        id: 'router-1',
        name: 'Test Router',
        host: '41.1.2.3',
        username: 'adm_testrouter_ab12',
        password: 'AbCdEfGhIjKlMnOpQrSt12',
        radiusSecret: 'ZyXwVuTsRqPoNmLkJiHgFeDcBa987654',
        lanIp: '192.168.88.1/24',
        lanGateway: '192.168.88.1',
        hotspotPoolRange: '192.168.88.10-192.168.88.100',
        pppoePoolRange: '192.168.88.200-192.168.88.250',
        dns: '8.8.8.8,1.1.1.1',
        wgPrivateKey: null,
        wgPeerPublicKey: null,
        wgTunnelIp: null,
        ...overrides,
    };
}

describe('generateSecureSecret / generateRouterAdminPassword / generateRadiusSecret', () => {
    it('rejects lengths under 20 characters', () => {
        expect(() => generateSecureSecret(10)).toThrow(/at least 20 characters/);
    });

    it('produces a base62 string of the requested length', () => {
        const secret = generateSecureSecret(24);
        expect(secret).toHaveLength(24);
        expect(secret).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('generates a 24-char admin password and a 32-char RADIUS secret that differ', () => {
        const password = generateRouterAdminPassword();
        const radiusSecret = generateRadiusSecret();
        expect(password).toHaveLength(24);
        expect(radiusSecret).toHaveLength(32);
        expect(password).not.toEqual(radiusSecret);
    });

    it('generates unique values on every call (crypto-random, not deterministic)', () => {
        const values = new Set(Array.from({ length: 20 }, () => generateSecureSecret(24)));
        expect(values.size).toBe(20);
    });
});

describe('generateAdminUsername', () => {
    it('never returns the literal "admin"', () => {
        expect(generateAdminUsername('admin')).not.toBe('admin');
        expect(generateAdminUsername('')).not.toBe('admin');
    });

    it('is unique per call for the same router name (TATIZO 4 dead-code fix)', () => {
        const a = generateAdminUsername('Mikoroshoni-Router');
        const b = generateAdminUsername('Mikoroshoni-Router');
        expect(a).not.toEqual(b);
        expect(a).toMatch(/^adm_mikoroshoni-rout_[0-9a-f]{6}$/);
    });

    it('falls back to "router" when the name is empty or fully invalid', () => {
        expect(generateAdminUsername('')).toMatch(/^adm_router_[0-9a-f]{6}$/);
        expect(generateAdminUsername('!!!')).toMatch(/^adm_router_[0-9a-f]{6}$/);
    });
});

describe('validateRouterForScriptGeneration (TATIZO 1)', () => {
    it('passes when all required fields are present', () => {
        const result = validateRouterForScriptGeneration(baseRouter());
        expect(result.ok).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('fails generation when the admin password is missing', () => {
        const result = validateRouterForScriptGeneration(baseRouter({ password: null }));
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.field === 'password')).toBe(true);
    });

    it('fails generation when the RADIUS secret is missing', () => {
        const result = validateRouterForScriptGeneration(baseRouter({ radiusSecret: null }));
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.field === 'radiusSecret')).toBe(true);
    });

    it('fails generation when the admin username is missing', () => {
        const result = validateRouterForScriptGeneration(baseRouter({ username: '' }));
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.field === 'username')).toBe(true);
    });

    it('returns ALL missing fields at once, not just the first one', () => {
        const result = validateRouterForScriptGeneration(
            baseRouter({ password: null, radiusSecret: null, username: '' })
        );
        expect(result.ok).toBe(false);
        expect(result.errors.map((e) => e.field).sort()).toEqual(['password', 'radiusSecret', 'username']);
    });

    it('fails when WireGuard fields are only partially set', () => {
        const result = validateRouterForScriptGeneration(
            baseRouter({ wgPrivateKey: 'priv-key-only' })
        );
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.field === 'wireguard')).toBe(true);
    });

    it('passes when WireGuard fields are all set together', () => {
        const result = validateRouterForScriptGeneration(
            baseRouter({
                wgPrivateKey: 'priv',
                wgPeerPublicKey: 'pub',
                wgTunnelIp: '10.200.0.5',
            })
        );
        expect(result.ok).toBe(true);
    });

    it('passes when WireGuard fields are all absent (VPN optional as a group)', () => {
        const result = validateRouterForScriptGeneration(baseRouter());
        expect(result.ok).toBe(true);
    });

    it('fails when LAN IP is malformed', () => {
        const result = validateRouterForScriptGeneration(baseRouter({ lanIp: 'not-an-ip' }));
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.field === 'lanIp')).toBe(true);
    });

    it('fails when a pool range is malformed or reversed', () => {
        const malformed = validateRouterForScriptGeneration(baseRouter({ hotspotPoolRange: '192.168.88.100-192.168.88.10' }));
        const missing = validateRouterForScriptGeneration(baseRouter({ pppoePoolRange: 'not-a-range' }));
        expect(malformed.ok).toBe(false);
        expect(malformed.errors.some((e) => e.field === 'hotspotPoolRange')).toBe(true);
        expect(missing.ok).toBe(false);
        expect(missing.errors.some((e) => e.field === 'pppoePoolRange')).toBe(true);
    });
});

describe('preflightCheckRouters', () => {
    it('lists readiness for every router, keeping unready ones flagged with their errors', () => {
        const routers = [
            baseRouter({ id: 'r1', name: 'Ready Router' }),
            baseRouter({ id: 'r2', name: 'Broken Router', password: null }),
        ];
        const result = preflightCheckRouters(routers);
        expect(result).toEqual([
            { routerId: 'r1', routerName: 'Ready Router', ready: true, errors: [] },
            expect.objectContaining({ routerId: 'r2', routerName: 'Broken Router', ready: false }),
        ]);
        expect(result[1].errors.some((e) => e.field === 'password')).toBe(true);
    });
});

describe('deriveVpnManagementSubnet (TATIZO 2)', () => {
    it('derives a /24 from a WireGuard tunnel IP', () => {
        expect(deriveVpnManagementSubnet('10.200.0.5')).toBe('10.200.0.0/24');
    });

    it('returns null when there is no tunnel IP yet', () => {
        expect(deriveVpnManagementSubnet(null)).toBeNull();
        expect(deriveVpnManagementSubnet(undefined)).toBeNull();
        expect(deriveVpnManagementSubnet('')).toBeNull();
    });

    it('returns null for a malformed IP', () => {
        expect(deriveVpnManagementSubnet('not-an-ip')).toBeNull();
        expect(deriveVpnManagementSubnet('10.200.0')).toBeNull();
    });
});

describe('lintGeneratedScript (TATIZO 1 & 2 safety net)', () => {
    it('passes a clean, fully-restricted script', () => {
        const script = [
            '/user set [find name="admin"] disabled=yes',
            '/ip firewall filter add chain=input action=accept protocol=tcp dst-port=80,443,8291 src-address=10.200.0.0/24 comment="Allow HQ INVESTMENT API Access (VPN only)"',
            '/ip firewall filter add chain=input action=drop protocol=tcp dst-port=80,443,8291 comment="Block HQ INVESTMENT Management Ports (non-VPN)"',
        ].join('\n');
        expect(lintGeneratedScript(script).ok).toBe(true);
    });

    it('flags an empty admin password on the "admin" account', () => {
        const script = '/user set [find name="admin"] password=""';
        const result = lintGeneratedScript(script);
        expect(result.ok).toBe(false);
        expect(result.issues[0].type).toBe('empty_admin_password');
    });

    it('flags unrendered template placeholders (${...} and {{ }})', () => {
        const script1 = '/system identity set name="${cleanName}"';
        const script2 = '/system identity set name="{{ cleanName }}"';
        expect(lintGeneratedScript(script1).issues[0].type).toBe('unrendered_template_var');
        expect(lintGeneratedScript(script2).issues[0].type).toBe('unrendered_template_var');
    });

    it('flags a management-port accept rule with no src-address restriction', () => {
        const script =
            '/ip firewall filter add chain=input action=accept protocol=tcp dst-port=80,443,8291 comment="Allow HQ INVESTMENT API Access"';
        const result = lintGeneratedScript(script);
        expect(result.ok).toBe(false);
        expect(result.issues[0].type).toBe('unrestricted_management_access');
    });

    it('flags a management-port accept rule with src-address=0.0.0.0/0', () => {
        const script =
            '/ip firewall filter add chain=input action=accept protocol=tcp dst-port=8291 src-address=0.0.0.0/0 comment="Allow Winbox"';
        const result = lintGeneratedScript(script);
        expect(result.ok).toBe(false);
        expect(result.issues[0].type).toBe('unrestricted_management_access');
    });

    it('does not flag a non-management port accept rule (e.g. RADIUS CoA on 3799)', () => {
        const script =
            '/ip firewall filter add chain=input action=accept protocol=udp dst-port=3799 src-address=10.0.0.1 comment="Allow RADIUS CoA"';
        expect(lintGeneratedScript(script).ok).toBe(true);
    });

    it('joins RouterOS line-continuations before checking, so a src-address on the next line is still seen', () => {
        const script = [
            '/ip firewall filter add chain=input action=accept protocol=tcp \\',
            '    dst-port=80,443,8291 src-address=10.200.0.0/24 comment="Allow HQ INVESTMENT API Access (VPN only)"',
        ].join('\n');
        expect(lintGeneratedScript(script).ok).toBe(true);
    });
});
