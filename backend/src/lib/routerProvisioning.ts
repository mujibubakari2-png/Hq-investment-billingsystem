/**
 * Router Provisioning Safety Layer
 *
 * SEC-ROUTER-001..004 FIX: Fixes for the /api/routers/[id]/script generator
 * (see backend/docs/ROUTER_PROVISIONING_SECURITY_FIXES.md for full writeup):
 *
 *   1. Required-field validation BEFORE script generation — previously a
 *      missing router.password produced `password=""` on the admin account
 *      instead of blocking generation with a clear error.
 *   2. Static linter on the FINAL rendered script — a safety net that
 *      catches empty placeholders and unrestricted management-port firewall
 *      rules even if validation is bypassed or the template changes later.
 *   3. Crypto-secure secret generation for admin passwords and RADIUS
 *      secrets (previously the RADIUS secret reused the admin password and
 *      fell back to a static "hqsecret" string).
 *   4. Unique per-router admin username generation (previously always
 *      hardcoded to "admin").
 */

import crypto from "crypto";

// ── Secret generation (TATIZO 3 & 4) ────────────────────────────────────────

const BASE62 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Crypto-secure random string using a base62 alphabet (safe to embed in .rsc scripts). */
export function generateSecureSecret(length = 24): string {
    if (length < 20) {
        throw new Error("Secrets must be at least 20 characters (SEC-ROUTER-003 requirement).");
    }
    const bytes = crypto.randomBytes(length * 2);
    let out = "";
    for (let i = 0; i < bytes.length && out.length < length; i++) {
        out += BASE62[bytes[i] % BASE62.length];
    }
    return out.slice(0, length);
}

/** Admin password: min 20 chars, crypto-secure, unique per router. */
export function generateRouterAdminPassword(): string {
    return generateSecureSecret(24);
}

/** RADIUS shared secret: unique per router (NOT the same value as the admin password). */
export function generateRadiusSecret(): string {
    return generateSecureSecret(32);
}

/** Unique admin username per router — never the literal "admin". */
export function generateAdminUsername(routerName: string): string {
    const suffix = crypto.randomBytes(3).toString("hex");
    const clean = (routerName || "router").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16).toLowerCase();
    return `adm_${clean || "router"}_${suffix}`;
}

// ── Validation (TATIZO 1) ────────────────────────────────────────────────────

export interface RouterForScriptGeneration {
    id: string;
    name: string;
    host?: string | null;
    username?: string | null;
    password?: string | null;
    radiusSecret?: string | null;
    wgPrivateKey?: string | null;
    wgPeerPublicKey?: string | null;
    wgTunnelIp?: string | null;
}

export interface ValidationError {
    field: string;
    reason: string;
}

export interface ValidationResult {
    ok: boolean;
    errors: ValidationError[];
}

/**
 * Validates that a router has everything required to safely generate a
 * provisioning script. Called BEFORE any template rendering happens.
 *
 * Deliberately returns ALL missing/invalid fields at once (not just the
 * first one found) so the error is actionable for an admin and reusable by
 * a "pre-flight" UI check.
 */
export function validateRouterForScriptGeneration(router: RouterForScriptGeneration): ValidationResult {
    const errors: ValidationError[] = [];

    if (!router.name || router.name.trim().length === 0) {
        errors.push({ field: "name", reason: "Router name haipo." });
    }

    if (!router.username || router.username.trim().length === 0) {
        errors.push({ field: "username", reason: "Admin username haipo kwa router hii." });
    }

    if (!router.password) {
        errors.push({
            field: "password",
            reason:
                "Admin password haijawekwa kwa router hii. Weka au zalisha password kabla ya " +
                "kuzalisha script (bila hii, script ingeweka password=\"\" kwenye router — hatari kubwa).",
        });
    }

    if (!router.radiusSecret) {
        errors.push({
            field: "radiusSecret",
            reason:
                "RADIUS secret haijawekwa kwa router hii. Endesha rotateRouterSecrets.ts au zalisha " +
                "secret mpya kabla ya kuzalisha script (bila hii, RADIUS ingetumia default isiyo salama).",
        });
    }

    // WireGuard fields are optional as a group, but if ANY is set, ALL must be
    // set — a partially-configured VPN produces a broken tunnel block in the
    // script.
    const wgFields = [router.wgPrivateKey, router.wgPeerPublicKey, router.wgTunnelIp];
    const wgFieldsPresent = wgFields.filter(Boolean).length;
    if (wgFieldsPresent > 0 && wgFieldsPresent < wgFields.length) {
        errors.push({
            field: "wireguard",
            reason:
                "WireGuard imeanzishwa kwa nusu tu (baadhi ya fields za wgPrivateKey/wgPeerPublicKey/" +
                "wgTunnelIp hazipo). Kamilisha VPN setup au ondoa fields zote kabla ya kuzalisha script.",
        });
    }

    return { ok: errors.length === 0, errors };
}

/** Convenience for a "pre-flight" admin UI listing which routers aren't ready yet. */
export function preflightCheckRouters(routers: RouterForScriptGeneration[]) {
    return routers.map((router) => {
        const result = validateRouterForScriptGeneration(router);
        return { routerId: router.id, routerName: router.name, ready: result.ok, errors: result.errors };
    });
}

// ── VPN management subnet helper (TATIZO 2) ─────────────────────────────────

/**
 * Derives the /24 VPN management subnet from a router's WireGuard tunnel IP
 * (e.g. "10.200.0.5" -> "10.200.0.0/24"). Used to scope Winbox/Web/API
 * firewall rules to VPN-only access instead of the whole WAN.
 */
export function deriveVpnManagementSubnet(wgTunnelIp: string | null | undefined): string | null {
    if (!wgTunnelIp) return null;
    const parts = wgTunnelIp.split(".");
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(Number(p)))) return null;
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}

// ── Output linter (TATIZO 1 & 2 safety net) ─────────────────────────────────

export interface LintIssue {
    line: number;
    type: string;
    content: string;
    reason?: string;
}

export interface LintResult {
    ok: boolean;
    issues: LintIssue[];
}

const MANAGEMENT_PORTS = ["8291", "80", "443", "8728", "8729"];

/**
 * RouterOS scripts can use "\" line-continuation. Join those lines before
 * running single-line regex checks so a src-address on the following line
 * isn't missed.
 */
function joinContinuationLines(script: string): string[] {
    const rawLines = script.split("\n");
    const joined: string[] = [];
    let buffer: string | null = null;

    for (const line of rawLines) {
        const trimmedEnd = line.replace(/\s+$/, "");
        const continues = trimmedEnd.endsWith("\\");
        const content = continues ? trimmedEnd.slice(0, -1) : trimmedEnd;

        buffer = buffer === null ? content : buffer + " " + content.trim();

        if (!continues) {
            joined.push(buffer);
            buffer = null;
        }
    }
    if (buffer !== null) joined.push(buffer);
    return joined;
}

/**
 * Final safety net: statically analyzes the RENDERED script (not the input
 * data) right before it's returned/sent, catching:
 *   - empty admin password (password="")
 *   - management-port (Winbox/Web/API) firewall rules with no src-address
 *     restriction, or src-address=0.0.0.0/0
 *   - unrendered template placeholders
 */
export function lintGeneratedScript(script: string): LintResult {
    const issues: LintIssue[] = [];
    const lines = joinContinuationLines(script);

    lines.forEach((line, idx) => {
        const lineNo = idx + 1;

        if (/password=""/.test(line) && /name="admin"/.test(line)) {
            issues.push({ line: lineNo, type: "empty_admin_password", content: line.trim() });
        }

        if (/\$\{.*?\}/.test(line) || /\{\{\s*\w+\s*\}\}/.test(line)) {
            issues.push({ line: lineNo, type: "unrendered_template_var", content: line.trim() });
        }

        const isFirewallAccept = /add\s+.*action=accept/i.test(line) && /chain=input/i.test(line);
        if (isFirewallAccept) {
            const portMatch = line.match(/dst-port=([\d,]+)/);
            if (portMatch) {
                const ports = portMatch[1].split(",");
                const touchesMgmt = ports.some((p) => MANAGEMENT_PORTS.includes(p));
                if (touchesMgmt) {
                    const srcMatch = line.match(/src-address=(\S+)/);
                    const restricted = !!srcMatch && srcMatch[1] !== "0.0.0.0/0" && srcMatch[1].trim() !== "";
                    if (!restricted) {
                        issues.push({
                            line: lineNo,
                            type: "unrestricted_management_access",
                            content: line.trim(),
                            reason:
                                "Firewall rule ya management port (Winbox/Web/API) haina src-address " +
                                "restriction — inafikika kutoka WAN yoyote.",
                        });
                    }
                }
            }
        }
    });

    return { ok: issues.length === 0, issues };
}
