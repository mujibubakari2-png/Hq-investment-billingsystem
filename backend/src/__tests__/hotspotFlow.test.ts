import { buildHotspotPortalFeedback } from '../lib/hotspotFlow';

describe('buildHotspotPortalFeedback', () => {
  it('returns a success message for voucher activation', () => {
    const feedback = buildHotspotPortalFeedback({ kind: 'voucher', state: 'success' });

    expect(feedback.title).toBe('Successfully activated');
    expect(feedback.message).toContain('Connecting you now');
    expect(feedback.autoConnect).toBe(true);
  });

  it('returns a reconnect message when the package is already active', () => {
    const feedback = buildHotspotPortalFeedback({ kind: 'reconnect', state: 'active' });

    expect(feedback.title).toBe('Your package is still active');
    expect(feedback.message).toContain('Reconnecting now');
    expect(feedback.autoConnect).toBe(true);
  });

  it('returns a payment-pending message while the user completes STK push', () => {
    const feedback = buildHotspotPortalFeedback({ kind: 'payment', state: 'pending' });

    expect(feedback.title).toBe('Waiting for payment');
    expect(feedback.message).toContain('complete the payment prompt');
    expect(feedback.autoConnect).toBe(false);
  });

  it('returns a failure message when activation could not be completed', () => {
    const feedback = buildHotspotPortalFeedback({ kind: 'payment', state: 'failed' });

    expect(feedback.title).toBe('Connection failed');
    expect(feedback.message).toContain('Please try again');
    expect(feedback.autoConnect).toBe(false);
  });

  it('returns a generic fallback for unsupported states', () => {
    const feedback = buildHotspotPortalFeedback({ kind: 'voucher', state: 'pending' as any });

    expect(feedback.title).toBe('Connection status');
    expect(feedback.message).toContain('Please try again');
    expect(feedback.autoConnect).toBe(false);
  });
});
