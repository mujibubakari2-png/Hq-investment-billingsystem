import { executePushConfig } from '../../../src/lib/pushConfigExecutor';
import { getTenantClient } from '../../../src/lib/tenantPrisma';
import { getMikroTikService } from '../../../src/lib/mikrotik';
import { wireguardManager } from '../../../src/lib/wireguard';

jest.mock('../../../src/lib/tenantPrisma');
jest.mock('../../../src/lib/mikrotik');
jest.mock('../../../src/lib/wireguard');

describe('pushConfigExecutor', () => {
    let mockDb: any;
    let mockService: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockDb = {
            router: {
                findFirst: jest.fn().mockResolvedValue({
                    id: '1', name: 'Test', host: '10.0.0.2', tenantId: 't1',
                    wgPrivateKey: 'priv', wgPublicKey: 'pub', wgPresharedKey: 'psk',
                    radiusSecret: 'test-secret',
                    username: 'admin', password: 'secret',
                    lanIp: '192.168.1.1/24', lanGateway: '192.168.1.1',
                    wgTunnelIp: '10.0.0.201'
                }),
                update: jest.fn(),
            },
            routerLog: {
                create: jest.fn()
            }
        };
        (getTenantClient as jest.Mock).mockReturnValue(mockDb);

        mockService = {
            apiRequestPublic: jest.fn()
        };
        (getMikroTikService as jest.Mock).mockResolvedValue(mockService);
        (wireguardManager.getServerIp as jest.Mock).mockResolvedValue('10.0.0.1');
        (wireguardManager.addPeer as jest.Mock).mockResolvedValue(undefined);
        (wireguardManager.checkPeerHandshake as jest.Mock).mockResolvedValue(true);
    });

    test('Test 1: Fail if Server WG public key cannot be resolved', async () => {
        (wireguardManager.getServerPublicKey as jest.Mock).mockResolvedValue(null);
        process.env.WG_SERVER_PUBLIC_KEY = '';

        await expect(executePushConfig('1', 't1', {})).rejects.toThrow('Server WireGuard public key is unavailable; refusing configuration push');
        
        // Ensure no WireGuard peers were modified on the router before failure
        expect(mockService.apiRequestPublic).not.toHaveBeenCalledWith(
            '/interface/wireguard/peers', 'PUT', expect.any(Object)
        );
    });

    test('Test 2: Peer verification fails when API does not return expected peer', async () => {
        (wireguardManager.getServerPublicKey as jest.Mock).mockResolvedValue('canonical-server-key');
        
        mockService.apiRequestPublic.mockImplementation(async (ep: string, method: string, data: any) => {
            if (ep === '/interface/wireguard/peers' && method === 'PUT') {
                return {};
            }
            if (ep === '/interface/wireguard/peers' && (!method || method === 'GET')) {
                // Return empty peers list to simulate creation failure
                return [];
            }
            return [];
        });

        await expect(executePushConfig('1', 't1', {})).rejects.toThrow('Critical phase failed [WireGuard Peer]: WireGuard peer was not created on the router.');
    });

    test('Test 3: NAT rule correctly includes out-interface-list=WAN', async () => {
        (wireguardManager.getServerPublicKey as jest.Mock).mockResolvedValue('canonical-server-key');
        
        mockService.apiRequestPublic.mockImplementation(async (ep: string, method: string, data: any) => {
            if (ep === '/interface/wireguard/peers' && (!method || method === 'GET')) {
                return [{ "public-key": "canonical-server-key", interface: "wg-hq", "allowed-address": "10.0.0.0/24" }];
            }
            if (ep === '/ip/route' && (!method || method === 'GET')) {
                return [{ "dst-address": "0.0.0.0/0", interface: "ether1", active: "true" }];
            }
            return [];
        });

        await executePushConfig('1', 't1', {});

        expect(mockService.apiRequestPublic).toHaveBeenCalledWith(
            '/ip/firewall/nat', 'PUT', 
            expect.objectContaining({ 
                chain: "srcnat", 
                action: "masquerade", 
                "out-interface-list": "WAN" 
            })
        );
    });
});
