import { describe, it, expect } from 'vitest';
import { buildWireGuardConfigText } from '../utils/wireguardConfigText';

describe('buildWireGuardConfigText', () => {
    it('uses RouterOS-native commands for the server-side config', () => {
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

        expect(config).toContain('/interface wireguard');
        expect(config).toContain('add name="wg-hq"');
        expect(config).toContain('private-key="router-private"');
        expect(config).toContain('allowed-address=10.0.0.0/24');
        expect(config).toContain('add address=10.0.0.200/24 interface="wg-hq"');
        expect(config).not.toContain('[Interface]');
        expect(config).not.toContain('PrivateKey =');
    });

    it('uses RouterOS-native commands for the client-side config', () => {
        const config = buildWireGuardConfigText({
            mode: 'client',
            routerName: 'HQ Router',
            routerId: 'router-1',
            routerPublicKey: 'router-public',
            presharedKey: 'preshared',
            routerTunnelIp: '10.0.0.200',
            serverTunnelIp: '10.0.0.1',
            listenPort: 51820,
            serverEndpoint: 'vpn.example.com',
            serverPort: 51820,
            serverPrivateKey: 'server-private',
        });

        expect(config).toContain('/interface wireguard');
        expect(config).toContain('private-key="server-private"');
        expect(config).toContain('allowed-address=10.0.0.200/32');
        expect(config).toContain('add address=10.0.0.1/24 interface="wg-hq"');
        expect(config).not.toContain('[Peer]');
    });
});
