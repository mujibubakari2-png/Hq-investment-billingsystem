import { createRouterAdapter, detectRouterCapabilities, normalizeRouterVendor } from '@/lib/routerAdapters';

describe('Router adapter architecture', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('normalizes vendor names consistently', () => {
    expect(normalizeRouterVendor('MikroTik')).toBe('mikrotik');
    expect(normalizeRouterVendor('mikrotik')).toBe('mikrotik');
    expect(normalizeRouterVendor('Omada')).toBe('omada');
    expect(normalizeRouterVendor('UniFi')).toBe('unifi');
    expect(normalizeRouterVendor('TP-Link')).toBe('tplink');
  });

  it('detects MikroTik RouterOS capabilities for v6 and v7', () => {
    const v6 = detectRouterCapabilities('mikrotik' as any, '6.49.10');
    const v7 = detectRouterCapabilities('mikrotik' as any, '7.15');

    expect(v6.supportedFeatures).toEqual(expect.arrayContaining(['PPPoE', 'Hotspot', 'RADIUS', 'DHCP', 'DNS', 'Firewall']));
    expect(v7.supportedFeatures).toEqual(expect.arrayContaining(['PPPoE', 'Hotspot', 'RADIUS', 'DHCP', 'DNS', 'WireGuard', 'Firewall']));
    expect(v7.apiType).toBe('REST');
  });

  it('creates adapter instances for non-MikroTik vendors without hardcoded RouterOS logic', () => {
    const omada = createRouterAdapter({ vendor: 'Omada', model: 'OC200', firmwareVersion: '1.32.0' } as any);
    const unifi = createRouterAdapter({ vendor: 'UniFi', model: 'U6 Lite', firmwareVersion: '4.0.0' } as any);
    const tplink = createRouterAdapter({ vendor: 'TP-Link', model: 'TL-R605', firmwareVersion: '1.0.0' } as any);

    expect(omada.name).toBe('OmadaAdapter');
    expect(unifi.name).toBe('UniFiAdapter');
    expect(tplink.name).toBe('TPLinkAdapter');
  });

  it('forwards raw API requests through the MikroTik adapter', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ name: 'test' }]),
    });
    
    const adapter = createRouterAdapter({ vendor: 'MikroTik', id: 'router-1', tenantId: 'tenant-a', host: '8.8.8.8' } as any);

    const result = await adapter.apiRequestPublic('/ip/address');

    expect(global.fetch).toHaveBeenCalledWith('http://8.8.8.8:80/rest/ip/address', expect.anything());
    expect(result).toEqual([{ name: 'test' }]);
  });
});
