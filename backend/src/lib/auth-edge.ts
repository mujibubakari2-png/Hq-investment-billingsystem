/**
 * auth-edge.ts — Edge Runtime-safe auth utilities
 *
 * This module contains ONLY the JWT decode/verify functions that are safe to
 * run inside the Next.js Edge Runtime (middleware). It intentionally has ZERO
 * imports of Node.js-only packages (ioredis, bcryptjs, crypto, etc.).
 *
 * Do NOT add cache imports here — ioredis cannot run in Edge Runtime.
 * Full auth utilities (hashing, signing, cache invalidation) remain in auth.ts.
 */

import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

export interface JwtPayload {
    userId: string;
    username: string;
    role: string;
    tenantId?: string | null;
    tenant_id?: string | null;
    tokenType?: "access" | "refresh";
    isPlatformAdmin?: boolean;
}

export class UnauthorizedError extends Error {
    constructor(message = "Unauthorized") {
        super(message);
        this.name = "UnauthorizedError";
    }
}

function getAccessSecret(): string {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
        // In Edge Runtime during startup — return empty string so middleware
        // simply treats all tokens as invalid (returns null from verifyToken)
        return "";
    }
    return secret;
}

/**
 * Verify an access token — Edge-safe (no ioredis, no bcrypt).
 * Returns null if invalid, expired, or wrong token type.
 */
export function verifyToken(token: string): JwtPayload | null {
    try {
        const secret = getAccessSecret();
        if (!secret) return null;
        const payload = jwt.verify(token, secret, {
            issuer: "hq-investment-isp",
            audience: "hq-investment-app",
        }) as JwtPayload;

        if (payload.tokenType && payload.tokenType !== "access") {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

/**
 * Extract the raw access token from cookie or Authorization header.
 */
export function getTokenFromRequest(req: NextRequest): string | null {
    const cookieToken = req.cookies.get("accessToken")?.value;
    if (cookieToken) return cookieToken;

    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);

    return null;
}

/**
 * Return the verified JWT payload for the request, or null.
 * Safe to call from Edge Runtime middleware.
 */
export function getUserFromRequest(req: NextRequest): JwtPayload | null {
    const token = getTokenFromRequest(req);
    if (!token) return null;
    return verifyToken(token);
}
