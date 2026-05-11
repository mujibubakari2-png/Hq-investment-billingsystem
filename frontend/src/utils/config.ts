// ─── PUBLIC API BASE ──────────────────────────────────────────────────────────
// This is the URL that the MikroTik router will call to reach the billing server.
// Priority order:
//   1. VITE_PUBLIC_API_URL from .env (recommended for production)
//   2. window.location.origin — the browser's current address (always the real
//      droplet IP/domain since the admin opens the dashboard from there)
//
// ⚠️  NEVER fall back to 'http://127.0.0.1' — that is the router's own loopback
//     address, not the billing server. Using it makes the sync URL unreachable.
//
// To set permanently: add to frontend/.env:
//   VITE_PUBLIC_API_URL=http://YOUR_DROPLET_IP

/** Returns the billing server base URL that the MikroTik router should call. */
export function getPublicApiBase(): string {
    // 1. Explicit env override (set VITE_PUBLIC_API_URL in frontend/.env)
    const envUrl = import.meta.env.VITE_PUBLIC_API_URL as string | undefined;
    if (envUrl && envUrl.trim()) return envUrl.trim().replace(/\/$/, '');

    // 2. Browser origin — always correct when admin is viewing the dashboard.
    //    e.g. http://165.22.33.44  or  https://billing.myisp.co.tz
    if (typeof window !== 'undefined' && window.location?.origin) {
        return window.location.origin;
    }

    // 3. Last resort (should never reach here in a browser context)
    return '';
}

/** @deprecated Use getPublicApiBase() instead. Kept for legacy imports. */
export const PUBLIC_API_BASE = import.meta.env.VITE_PUBLIC_API_URL || '';
