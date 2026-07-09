import { describe, it, expect } from 'vitest';
import { buildWireGuardConfigText } from '../utils/wireguardConfigText';

describe('buildWireGuardConfigText', () => {
    it('uses the backend tunnel IPs and server endpoint for the downloaded config', () => {
        const config = buildWireGuardConfigText({
            mode: 'server',
            routerName: 'HQ Router',
            routerId: 'router-1',
            routerPrivateKey: 'router-private',
            routerPublicKey: 'router-public',
            serverPublicKey: 'server-public',
            presharedKey: 'preshared',
            routerTunnelIp: '10.0.0.200',
            serverTunnelIp: '10.0.0.1',
            listenPort: 51820,
            serverEndpoint: 'vpn.example.com',
            serverPort: 51820,
            serverPrivateKey: 'server-private',
        });

        expect(config).toContain('Address = 10.0.0.200/32');
        expect(config).toContain('AllowedIPs = 10.0.0.0/24');
        expect(config).toContain('Endpoint = vpn.example.com:51820');
        expect(config).not.toContain('Endpoint = 10.0.0.1:51820');
    });
});
