describe('Payment registry isolation', () => {
  beforeAll(() => {
    process.env.PALMPESA_API_KEY = 'test-api-key';
    process.env.PALMPESA_WEBHOOK_SECRET = 'test-webhook-secret';
  });

  afterAll(() => {
    delete process.env.PALMPESA_API_KEY;
    delete process.env.PALMPESA_WEBHOOK_SECRET;
  });

  beforeEach(() => {
    jest.resetModules();
  });

  it('throws when no channel provided and env fallback is disabled', async () => {
    const { getPaymentProvider } = await import('@/lib/payments/registry');
    expect(() => getPaymentProvider('PALMPESA', null, { allowEnvFallback: false })).toThrow(/No payment channel provided/);
  });

  it('returns a provider instance when env fallback enabled', async () => {
    const { getPaymentProvider } = await import('@/lib/payments/registry');
    const provider = getPaymentProvider('PALMPESA', null);
    expect(provider).toBeDefined();
    expect(typeof provider.initiatePayment).toBe('function');
  });
});
