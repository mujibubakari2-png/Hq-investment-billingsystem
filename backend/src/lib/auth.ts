import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import crypto from "crypto";
import { cacheGet, cacheSet } from "@/lib/cache";


function isNextBuild(): boolean {
    return (
        process.env.NEXT_PHASE?.includes("phase-production-build") ||
        process.env.NEXT_BUILD_WORKER === "1" ||
        process.argv.includes("build")
    );
}

// ── CRIT-006 FIX: Separate secrets for access and refresh tokens ──────────────
//
// Previously both signToken() and signRefreshToken() used the same JWT_SECRET.
// This meant a stolen 7-day refresh token could be submitted as a 2h access
// token (since the signature was valid for both). An attacker only needed to
// change the `expiresIn` claim or strip it entirely to bypass the short window.
//
// Fix: Two distinct env vars — one per token type. Each secret is validated
// independently. Both must be set and must be different from each other.
// Adding `aud` (audience) + `iss` (issuer) claims ensures tokens can't be
// reused across endpoints even if one secret is leaked.

function getAccessSecret(): string {
    if (isNextBuild()) return "build-placeholder";
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
        throw new Error(
            "FATAL: JWT_ACCESS_SECRET environment variable is required. " +
            "Generate with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
        );
    }
    if (secret.length < 32) {
        throw new Error("FATAL: JWT_ACCESS_SECRET must be at least 32 characters long.");
    }
    return secret;
}

function getRefreshSecret(): string {
    if (isNextBuild()) return "build-placeholder-refresh";
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
        throw new Error(
            "FATAL: JWT_REFRESH_SECRET environment variable is required. " +
            "Generate with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
        );
    }
    if (secret.length < 32) {
        throw new Error("FATAL: JWT_REFRESH_SECRET must be at least 32 characters long.");
    }
    // Prevent accidental reuse of the same secret for both token types
    if (secret === process.env.JWT_ACCESS_SECRET) {
        throw new Error(
            "FATAL: JWT_REFRESH_SECRET must be different from JWT_ACCESS_SECRET. " +
            "Using the same secret defeats the purpose of having separate token types."
        );
    }
    return secret;
}

export interface JwtPayload {
    userId: string;
    username: string;
    role: string;
    tenantId?: string | null;
    tenant_id?: string | null; // Alias for tests
    // CRIT-006: Token type discriminator — prevents access tokens being used as refresh tokens
    tokenType?: "access" | "refresh";
}

export class UnauthorizedError extends Error {
    constructor(message = "Unauthorized") {
        super(message);
        this.name = "UnauthorizedError";
    }
}

export function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

/**
 * Sign a short-lived access token (2h).
 * Uses JWT_ACCESS_SECRET. Embeds tokenType: "access" claim.
 */
export function signToken(payload: JwtPayload): string {
    return jwt.sign(
        { ...payload, tokenType: "access" },
        getAccessSecret(),
        {
            expiresIn: "2h",
            issuer: "hq-investment-isp",
            audience: "hq-investment-app",
        }
    );
}

/**
 * Sign a long-lived refresh token (7d).
 * Uses JWT_REFRESH_SECRET. Embeds tokenType: "refresh" claim.
 */
export function signRefreshToken(payload: JwtPayload): string {
    // Embed a unique token identifier (jti) for rotation & revocation support
    const jti = (crypto as any).randomUUID ? (crypto as any).randomUUID() : crypto.randomBytes(16).toString("hex");
    return jwt.sign(
        { ...payload, tokenType: "refresh", jti },
        getRefreshSecret(),
        {
            expiresIn: "7d",
            issuer: "hq-investment-isp",
            audience: "hq-investment-refresh",
        }
    );
}

/**
 * Verify an access token.
 * CRIT-006 FIX: Uses JWT_ACCESS_SECRET; rejects refresh tokens submitted here.
 */
export function verifyToken(token: string): JwtPayload | null {
    try {
        const payload = jwt.verify(token, getAccessSecret(), {
            issuer: "hq-investment-isp",
            audience: "hq-investment-app",
        }) as JwtPayload;

        // Reject if someone submits a refresh token to an access-token endpoint
        if (payload.tokenType && payload.tokenType !== "access") {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

/**
 * Verify a refresh token.
 * Uses JWT_REFRESH_SECRET; rejects access tokens submitted here.
 */
export async function verifyRefreshToken(token: string): Promise<JwtPayload | null> {
    try {
        const payload = jwt.verify(token, getRefreshSecret(), {
            issuer: "hq-investment-isp",
            audience: "hq-investment-refresh",
        }) as JwtPayload & { jti?: string };

        if (payload.tokenType && payload.tokenType !== "refresh") {
            return null;
        }

        // If token has a jti, ensure it is not revoked
        if (payload.jti) {
            try {
                const key = `revoked_refresh:${payload.jti}`;
                const revoked = await cacheGet<boolean>(key);
                if (revoked) return null;
            } catch (err) {
                // Cache errors should not block verification; log upstream when needed
            }
        }

        return payload;
    } catch {
        return null;
    }
}

export function getTokenFromRequest(req: NextRequest): string | null {
    // 1. Try to get it from the HttpOnly cookie
    const cookieToken = req.cookies.get("accessToken")?.value;
    if (cookieToken) {
        return cookieToken;
    }

    // 2. Fallback to Authorization header
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.slice(7);
    }

    return null;
}

export function getUserFromRequest(req: NextRequest): JwtPayload | null {
    const token = getTokenFromRequest(req);
    if (!token) return null;
    return verifyToken(token);
}

/**
 * Enforce authentication for API routes.
 *
 * Throws an UnauthorizedError when the request does not contain a valid JWT.
 * Routes should wrap calls in a try/catch and return `errorResponse`
 * with status 401 on failure.
 */
export function requireAuth(req: NextRequest): JwtPayload {
    const payload = getUserFromRequest(req);
    if (!payload) {
        throw new UnauthorizedError();
    }
    return payload;
}

export function jsonResponse(data: any, status = 200) {
    return new Response(
        JSON.stringify(data, (key, value) =>
            typeof value === "bigint" ? value.toString() : value
        ),
        {
            status,
            headers: { "Content-Type": "application/json" },
        }
    );
}

export function errorResponse(
    message: string,
    status = 400,
    code?: string,
    details?: string
) {
    if (status >= 400) {
        console.warn(`[API ERROR] Status ${status} (${code ?? 'NO_CODE'}): ${message}`);
    }
    return jsonResponse({
        success: false,
        error: message,
        message: message, // Alias for tests that expect 'message'
        status: "error",
        ...(code    ? { code }    : {}),
        ...(details ? { details } : {}),
    }, status);
}
