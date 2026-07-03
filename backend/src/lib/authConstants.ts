/**
 * Authentication Constants — MEDIUM-SEC-007 FIX
 *
 * Centralises all JWT/cookie lifetime values in one place.
 * Previously, `login/route.ts` and `register/route.ts` had different
 * `Max-Age` values (7200 vs 1800) that did not match the JWT expiry,
 * causing 401 redirect loops when the cookie expired before the JWT
 * or vice-versa.
 *
 * Rule: cookie Max-Age MUST equal JWT expiry so both expire together.
 *
 * Import these constants everywhere tokens or cookies are set:
 *   import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL, ACCESS_COOKIE_MAX_AGE, REFRESH_COOKIE_MAX_AGE } from '@/lib/authConstants';
 */

// ── Access token (short-lived) ────────────────────────────────────────────────

/** JWT `expiresIn` string for the access token. */
export const ACCESS_TOKEN_TTL = '2h';

/** Cookie `Max-Age` in seconds for the access token cookie.
 *  MUST match ACCESS_TOKEN_TTL (2h = 7200s). */
export const ACCESS_COOKIE_MAX_AGE = 7200; // 2 hours

// ── Refresh token (long-lived) ────────────────────────────────────────────────

/** JWT `expiresIn` string for the refresh token. */
export const REFRESH_TOKEN_TTL = '7d';

/** Cookie `Max-Age` in seconds for the refresh token cookie.
 *  MUST match REFRESH_TOKEN_TTL (7d = 604800s). */
export const REFRESH_COOKIE_MAX_AGE = 604800; // 7 days

// ── MFA intermediate token (very short-lived) ─────────────────────────────────

/** TTL in seconds for the MFA pending token (before TOTP is verified). */
export const MFA_PENDING_TOKEN_TTL_SEC = 300; // 5 minutes

// ── Cookie base options ───────────────────────────────────────────────────────

/** Shared cookie options for the access token cookie. */
export const ACCESS_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: ACCESS_COOKIE_MAX_AGE,
};

/** Shared cookie options for the refresh token cookie. */
export const REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/auth/refresh',
    maxAge: REFRESH_COOKIE_MAX_AGE,
};
