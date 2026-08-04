import { buildRouterWizardScript, normalizeWizardScriptInputs } from '../lib/routerWizardScriptBuilder';

describe('router wizard script builder', () => {
  it('deduplicates selected interfaces while preserving order', () => {
    const normalized = normalizeWizardScriptInputs({
      selectedInterfaces: ['ether2', 'ether2', 'ether3', 'ether4', 'ether3'],
      serviceType: 'both',
      hotspotLocalAddress: '10.10.0.1',
      pppoeLocalAddress: '10.10.0.1',
      hotspotPoolStart: '10.10.0.10',
      hotspotPoolEnd: '10.10.0.100',
      pppoePoolStart: '10.10.0.101',
      pppoePoolEnd: '10.10.0.200',
      radiusAddress: '10.0.0.1',
      radiusSecret: 's3cr3t',
      dnsServers: '8.8.8.8,8.8.4.4',
      vpnManagementSubnet: '10.200.0.0/24',
      publicApiBase: 'https://api.example.com',
      apiHost: 'api.example.com',
      routerName: 'Test Router',
      routerId: 'router-1',
    });

    expect(normalized.selectedInterfaces).toEqual(['ether2', 'ether3', 'ether4']);
  });

  it('renders a script with the expected bridge and firewall sections', () => {
    const script = buildRouterWizardScript({
      routerName: 'Router A',
      routerId: 'router-1',
      publicApiBase: 'https://api.example.com',
      apiHost: 'api.example.com',
      serviceType: 'both',
      selectedInterfaces: ['ether2', 'ether3'],
      vpnEnabled: true,
      hotspotLocalAddress: '10.10.0.1',
      hotspotPoolStart: '10.10.0.10',
      hotspotPoolEnd: '10.10.0.100',
      pppoeLocalAddress: '10.10.0.1',
      pppoePoolStart: '10.10.0.101',
      pppoePoolEnd: '10.10.0.200',
      radiusAddress: '10.0.0.1',
      radiusSecret: 's3cr3t',
      dnsServers: '8.8.8.8,8.8.4.4',
      vpnManagementSubnet: '10.200.0.0/24',
    });

    expect(script).toContain('# HQ INVESTMENT Router Setup Wizard');
    expect(script).toContain('/interface bridge add');
    expect(script).toContain('Allow PPPoE to Internet');
    expect(script).toContain('Drop unauthenticated LAN forward');
  });
});
