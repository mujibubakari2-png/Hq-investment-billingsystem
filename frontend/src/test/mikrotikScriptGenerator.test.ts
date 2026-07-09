import { describe, it, expect } from 'vitest';
import { generateMikrotikScript } from '../utils/mikrotikScriptGenerator';

describe('generateMikrotikScript', () => {
    it('uses a /32 tunnel address for the router and the server subnet for allowed-address', () => {
        const script = generateMikrotikScript({
            routerName: 'Router 1',
            routerId: 'router-1',
            apiHost: 'api.example.com',
            publicApiBase: 'https://api.example.com',
            isWireGuard: true,
            listenPort: 51820,
            routerPrivateKey: 'router-private',
            serverPubKey: 'server-public',
            presharedKey: 'preshared',
            serverEndpoint: 'vpn.example.com',
            serverPort: 51820,
            routerTunnelIp: '10.0.0.200',
            serverTunnelIp: '10.0.0.1',
            lanIp: '192.168.88.1/24',
            lanGateway: '192.168.88.1',
            hotspotPoolRange: '192.168.88.10-192.168.88.100',
            pppoePoolRange: '192.168.88.200-192.168.88.250',
            dns: '8.8.8.8',
            radiusSecret: 'secret',
        });

        expect(script).toContain('/ip address add address=10.0.0.200/32 interface="wg-hq"');
        expect(script).toContain('allowed-address=10.0.0.0/24');
    });
});
