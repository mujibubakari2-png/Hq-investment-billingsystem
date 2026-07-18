import { describe, it, expect } from 'vitest';
import { buildRouterSetupWizardScript, validateRouterSetupWizardServiceInputs } from '../utils/routerSetupWizardScript.ts';

describe('buildRouterSetupWizardScript', () => {
    it('allows PPPoE-only setup without requiring hotspot values', () => {
        const validation = validateRouterSetupWizardServiceInputs({
            serviceType: 'pppoe',
            hotspotLocalAddress: '',
            pppoeLocalAddress: '192.168.88.1',
            hotspotPoolStart: '',
            hotspotPoolEnd: '',
            pppoePoolStart: '192.168.88.10',
            pppoePoolEnd: '192.168.88.254',
        });

        expect(validation.ok).toBe(true);
        expect(validation.missingFields).toEqual([]);
    });

    it('requires both PPPoE and hotspot values when both services are selected', () => {
        const validation = validateRouterSetupWizardServiceInputs({
            serviceType: 'both',
            hotspotLocalAddress: '192.168.88.1',
            pppoeLocalAddress: '192.168.89.1',
            hotspotPoolStart: '192.168.88.10',
            hotspotPoolEnd: '192.168.88.254',
            pppoePoolStart: '192.168.89.10',
            pppoePoolEnd: '192.168.89.254',
        });

        expect(validation.ok).toBe(true);
        expect(validation.missingFields).toEqual([]);
    });

    it('generates hotspot-only config without PPPoE sections', () => {
        const script = buildRouterSetupWizardScript({
            routerName: 'Router 1',
            routerId: 'router-1',
            publicApiBase: 'https://api.example.com',
            apiHost: 'api.example.com',
            serviceType: 'hotspot',
            selectedInterfaces: ['ether2'],
            vpnEnabled: false,
            vpnProtocol: 'L2TP',
            vpnPoolStart: '10.0.0.2',
            vpnPoolEnd: '10.0.0.100',
            vpnSecrets: [],
            hotspotLocalAddress: '192.168.88.1',
            hotspotPoolStart: '192.168.88.10',
            hotspotPoolEnd: '192.168.88.254',
            pppoeLocalAddress: '192.168.89.1',
            pppoePoolStart: '192.168.89.10',
            pppoePoolEnd: '192.168.89.254',
            radiusAddress: '10.0.0.1',
            radiusSecret: 'secret123',
        });

        expect(script).toContain('# ===== Hotspot Server =====');
        expect(script).not.toContain('# ===== PPPoE Server =====');
        expect(script).toContain('/ip service set www-ssl disabled=no certificate=auto');
        expect(script).toContain('ssl-certificate=auto');
    });

    it('generates both-services config with PPPoE and hotspot sections', () => {
        const script = buildRouterSetupWizardScript({
            routerName: 'Router 1',
            routerId: 'router-1',
            publicApiBase: 'https://api.example.com',
            apiHost: 'api.example.com',
            serviceType: 'both',
            selectedInterfaces: ['ether2'],
            vpnEnabled: false,
            vpnProtocol: 'L2TP',
            vpnPoolStart: '10.0.0.2',
            vpnPoolEnd: '10.0.0.100',
            vpnSecrets: [],
            hotspotLocalAddress: '192.168.88.1',
            hotspotPoolStart: '192.168.88.10',
            hotspotPoolEnd: '192.168.88.254',
            pppoeLocalAddress: '192.168.89.1',
            pppoePoolStart: '192.168.89.10',
            pppoePoolEnd: '192.168.89.254',
            radiusAddress: '10.0.0.1',
            radiusSecret: 'secret123',
        });

        expect(script).toContain('# ===== PPPoE Server =====');
        expect(script).toContain('# ===== Hotspot Server =====');
    });

    it('places the unauthenticated LAN drop rule after the walled-garden setup', () => {
        const script = buildRouterSetupWizardScript({
            routerName: 'Router 1',
            routerId: 'router-1',
            publicApiBase: 'https://api.example.com',
            apiHost: 'api.example.com',
            serviceType: 'hotspot',
            selectedInterfaces: ['ether2', 'ether3'],
            vpnEnabled: true,
            vpnProtocol: 'L2TP',
            vpnPoolStart: '10.0.0.2',
            vpnPoolEnd: '10.0.0.100',
            vpnSecrets: [{ username: 'vpnuser', password: 'password123' }],
            hotspotLocalAddress: '192.168.88.1',
            hotspotPoolStart: '192.168.88.10',
            hotspotPoolEnd: '192.168.88.254',
            pppoeLocalAddress: '192.168.88.1',
            pppoePoolStart: '192.168.88.10',
            pppoePoolEnd: '192.168.88.254',
            radiusAddress: '10.0.0.1',
            radiusSecret: 'secret123',
            wgConfig: { routerTunnelIp: '10.0.0.200' },
        });

        const walledGardenIndex = script.indexOf('/ip hotspot walled-garden add');
        const dropRuleIndex = script.indexOf('Drop unauthenticated LAN forward - HQ INVESTMENT');

        expect(walledGardenIndex).toBeGreaterThan(-1);
        expect(dropRuleIndex).toBeGreaterThan(-1);
        expect(dropRuleIndex).toBeGreaterThan(walledGardenIndex);
    });
});
