import { checkWireGuardReachability } from '@/lib/wireguardConnectivity';

describe('checkWireGuardReachability', () => {
  it('tries multiple candidate targets for multitenant router reachability', async () => {
    const runner = jest
      .fn()
      .mockRejectedValueOnce({ code: 1, stdout: '', stderr: 'Request timed out', message: 'Request timed out' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' });

    const tcpProbe = jest.fn().mockResolvedValue({ ok: false, output: 'TCP connect timed out' });

    const result = await checkWireGuardReachability(['10.0.0.200', '10.0.0.201'], runner as any, tcpProbe as any);

    expect(result.ok).toBe(true);
    expect(runner).toHaveBeenCalledTimes(2);
    expect(result.output).toContain('10.0.0.201');
  });
});
