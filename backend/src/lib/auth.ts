import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

let jwtSecret: string | null = null;

function isNextBuild(): boolean {
    return (
        process.env.NEXT_PHASE?.includes("phase-production-build") ||
        process.env.NEXT_BUILD_WORKER === "1" ||
        process.argv.includes("build")
    );
}

function getJwtSecret(): string {
    if (!jwtSecret) {
        const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
        if (!secret) {
            // Use fallback for build time or CI environments
            if (isNextBuild() || process.env.RAILWAY_PROJECT_ID || process.env.CI || process.env.VERCEL || process.env.NETLIFY) {
                jwtSecret = "build-time-fallback-secret-please-set-JWT_SECRET";
                console.warn("WARNING: Using fallback JWT_SECRET/NEXTAUTH_SECRET for build/CI environment. Ensure JWT_SECRET is set in production!");
                return jwtSecret;
            }
            throw new Error("FATAL: JWT_SECRET or NEXTAUTH_SECRET environment variable is required. Add it to your .env file.");
        }
        if (secret.length < 32) {
            throw new Error("FATAL: JWT_SECRET or NEXTAUTH_SECRET must be at least 32 characters long for security.");
        }
        jwtSecret = secret;
    }
    return jwtSecret;
}

export interface JwtPayload {
    userId: string;
    username: string;
    role: string;
    tenantId?: string | null;
    tenant_id?: string | null; // Alias for tests
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

export function signToken(payload: JwtPayload): string {
    return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload | null {
    try {
        return jwt.verify(token, getJwtSecret()) as JwtPayload;
    } catch {
        return null;
    }
}

export function getTokenFromRequest(req: NextRequest): string | null {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.slice(7);
    }
    return null;
}

function isAutomationEnv(): boolean {
    return process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
}

function isAutomationBypassEnabled(): boolean {
    return process.env.ALLOW_AUTOMATION_BYPASS === "true";
}

export function isAutomationRequest(req: NextRequest): boolean {
    const automationKey = process.env.AUTOMATION_KEY;
    if (!isAutomationEnv() || !isAutomationBypassEnabled() || !automationKey) return false;

    const explicitKey = req.headers.get("x-automation-key") ?? req.headers.get("x-api-key");
    const bearerToken = getTokenFromRequest(req);
    return explicitKey === automationKey || bearerToken === automationKey;
}

export function getUserFromRequest(req: NextRequest): JwtPayload | null {
    const token = getTokenFromRequest(req);
    if (!token) return null;

    // Automation key bypass for CI/test tooling only when explicitly enabled.
    if (isAutomationRequest(req)) {
        return {
            userId: "automation-id",
            username: "automation",
            role: "ADMIN",
            tenantId: "test-tenant-id-123",
            tenant_id: "test-tenant-id-123"
        };
    }

    return verifyToken(token);
}

/**
 * Enforce authentication for API routes.
 *
 * Throws an Error when the request does not contain a valid JWT.
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

export function errorResponse(message: string, status = 400) {
    if (status >= 400) {
        console.warn(`[API ERROR] Status ${status}: ${message}`);
    }
    return jsonResponse({
        error: message,
        message: message, // Alias for tests that expect 'message'
        status: "error"
    }, status);
}
