// Suppress console.error and console.warn in tests to keep CI logs clean.
// Many tests intentionally trigger error paths (e.g. simulating network timeouts)
// which print scary red errors to the console even though the test PASSES.
beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
    jest.restoreAllMocks();
});
