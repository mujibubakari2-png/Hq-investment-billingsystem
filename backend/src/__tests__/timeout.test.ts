import { withTimeout } from '../lib/timeout';

describe('withTimeout', () => {
  it('returns a timeout error when an operation exceeds the allowed duration', async () => {
    const result = await withTimeout(
      new Promise<string>((resolve) => setTimeout(() => resolve('ok'), 20)),
      5,
      'timed out'
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('timed out');
  });

  it('returns the underlying value when the operation completes in time', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 50, 'timed out');

    expect(result.ok).toBe(true);
    expect(result.data).toBe('ok');
  });
});
