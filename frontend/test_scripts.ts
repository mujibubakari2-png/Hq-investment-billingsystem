import { generateMikrotikScript } from './src/utils/mikrotikScriptGenerator';
import { buildRouterSetupWizardScript } from './src/utils/routerSetupWizardScript';

console.log('--- TESTING GENERATOR 1: mikrotikScriptGenerator.ts ---');
const script1 = generateMikrotikScript({
    routerName: 'MikroTik-Test-01',
    routerId: 'rt-12345',
    apiHost: '192.168.88.1',
    publicApiBase: 'https://api.hqinvestment.com',
    isWireGuard: true,
    listenPort: 13231,
    routerPrivateKey: 'abc123PrivateKey===',
    serverPubKey: 'def456PubKey===',
    serverEndpoint: 'vpn.hqinvestment.com',
    serverPort: 51820,
    routerTunnelIp: '10.200.0.5',
    serverTunnelIp: '10.200.0.1',
    lanIp: '192.168.88.1/24',
    lanGateway: '192.168.88.1',
    hotspotPoolRange: '192.168.88.10-192.168.88.200',
    pppoePoolRange: '192.168.88.201-192.168.88.254',
    dns: '8.8.8.8,1.1.1.1',
    radiusSecret: 'MySecret2026'
});
console.log(script1);

console.log('\n\n--- TESTING GENERATOR 2: routerSetupWizardScript.ts ---');
const script2 = buildRouterSetupWizardScript({
    routerName: 'MikroTik-Test-02',
    routerId: 'rt-67890',
    publicApiBase: 'https://api.hqinvestment.com',
    apiHost: '10.200.0.1',
    serviceType: 'both',
    selectedInterfaces: ['ether2', 'ether3'],
    vpnEnabled: true,
    vpnProtocol: 'WireGuard',
    vpnPoolStart: '10.200.0.10',
    vpnPoolEnd: '10.200.0.250',
    vpnSecrets: [],
    hotspotLocalAddress: '172.16.0.1',
    hotspotPoolStart: '172.16.0.10',
    hotspotPoolEnd: '172.16.0.254',
    pppoeLocalAddress: '172.16.1.1',
    pppoePoolStart: '172.16.1.10',
    pppoePoolEnd: '172.16.1.254',
    radiusAddress: '10.200.0.1',
    radiusSecret: 'MySecret2026',
    wgConfig: { routerTunnelIp: '10.200.0.5' },
    vpnManagementSubnet: '10.200.0.0/24'
});
console.log(script2);
