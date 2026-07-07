export function normalizeApiList<T>(response: unknown): T[] {
    if (Array.isArray(response)) {
        return response as T[];
    }

    if (response && typeof response === 'object' && 'data' in response) {
        const maybeData = (response as { data: unknown }).data;
        return Array.isArray(maybeData) ? maybeData as T[] : [];
    }

    return [];
}
