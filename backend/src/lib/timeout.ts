export interface TimeoutResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Operation timed out'
): Promise<TimeoutResult<T>> {
  if (timeoutMs <= 0) {
    return { ok: false, error: timeoutMessage };
  }

  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation.then((data) => ({ ok: true as const, data })),
      new Promise<TimeoutResult<T>>((resolve) => {
        timer = setTimeout(() => resolve({ ok: false, error: timeoutMessage }), timeoutMs);
      }),
    ]);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
