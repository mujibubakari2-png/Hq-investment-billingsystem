import { describe, it, expect } from 'vitest';
import { generateMikrotikScript } from '../utils/mikrotikScriptGenerator';

describe('generateMikrotikScript', () => {
    it('uses a /24 tunnel address for the router interface (creates subnet route) and the server subnet for allowed-address', () => {
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

        // Interface address must be /24 so RouterOS creates a connected subnet route via wg-hq.
        // Without /24, return traffic exits via the WAN gateway and the server cannot reach the router.
        expect(script).toContain('/ip address add address=10.0.0.200/24 interface="wg-hq"');
        expect(script).toContain('allowed-address=10.0.0.0/24');
        expect(script).toContain('/interface wireless security-profiles add name="hq-wlan-router-1"');
        expect(script).toContain('authentication-types=wpa2-psk');
        expect(script).toContain('wpa2-pre-shared-key="HQ-router-1-router-1"');
        expect(script).toContain('/ip hotspot walled-garden ip add dst-address="192.168.88.1" action=accept comment="Hotspot Gateway"');
        expect(script).toContain('/ip dhcp-server network add address=192.168.88.0/24 gateway=192.168.88.1 dns-server=8.8.8.8');
    });
});
