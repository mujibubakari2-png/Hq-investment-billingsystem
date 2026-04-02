import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

const JWT_SECRET = (() => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("FATAL: JWT_SECRET environment variable is required in production!");
        }
        console.warn("⚠️  WARNING: JWT_SECRET not set — using insecure default. Set JWT_SECRET in .env for production.");
        return "kenge-isp-default-secret-DO-NOT-USE-IN-PRODUCTION";
    }
    return secret;
})();

export interface JwtPayload {
    userId: string;
    username: string;
    role: string;
    tenantId?: string | null;
}

export function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

export function signToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as JwtPayload;
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

export function getUserFromRequest(req: NextRequest): JwtPayload | null {
    const token = getTokenFromRequest(req);
    if (!token) return null;
    return verifyToken(token);
}

export function jsonResponse(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
    });
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
