/**
 * Hotspot Asset Templating + Signed Delivery
 *
 * TATIZO-A FIX: `pushHotspotSettings()` in mikrotik.ts used to be a placeholder
 * that returned "success" without ever touching the router — meaning the
 * branded login page (rlogin.html/login.html/etc.) never actually reached the
 * router, and customers always saw MikroTik's default hotspot page instead.
 *
 * Design: MikroTik routers can pull files themselves via `/tool fetch`
 * (RouterOS console + REST API). Instead of pushing files to the router over
 * FTP (which would require opening a new port/service on every router), we
 * let the router PULL each hotspot file from this server. This:
 *   - requires no new inbound port/service on the router,
 *   - reuses the same reachability the router already needs for RADIUS/API,
 *   - and lets us template each file per-tenant (company name, colors, etc.)
 *     server-side before the router ever sees it.
 *
 * Access to the asset endpoint is gated by a short-lived HMAC token scoped to
 * one specific routerId + file path (see signHotspotAssetToken/verify below),
 * since the router cannot present a JWT/session like a normal API client.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, resolve, sep } from "path";
import crypto from "crypto";
import { env } from "@/lib/env";

export interface HotspotAssetFile {
    relPath: string;
    encoding: "utf8" | "base64";
}

const TEMPLATED_EXTENSIONS = [".html", ".xml", ".css"];
const BINARY_EXTENSION_RE = /\.(ico|png|jpg|jpeg|gif|woff|woff2|ttf)$/i;
const SKIP_FILES = new Set(["readme"]);

/**
 * Locate the hotspot template directory across the various layouts this app
 * gets deployed under (local dev, Next.js standalone build, Droplet).
 */
export function resolveHotspotDir(): string {
    const candidates = [
        join(process.cwd(), "public", "hotspot"),
        join(process.cwd(), "backend", "public", "hotspot"),
        join(process.cwd(), "..", "public", "hotspot"),
        "/var/www/Hq-investment-billingsystem/backend/public/hotspot",
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate)) return candidate;
    }
    throw new Error(
        `Hotspot template directory not found. Checked: ${candidates.join(", ")}`
    );
}

/** Recursively list every file under the hotspot template directory. */
export function listHotspotFiles(): HotspotAssetFile[] {
    const dir = resolveHotspotDir();
    const files: HotspotAssetFile[] = [];

    function walk(current: string, base: string) {
        for (const entry of readdirSync(current)) {
            if (SKIP_FILES.has(entry)) continue;
            const fullPath = join(current, entry);
            const relPath = base ? `${base}/${entry}` : entry;
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
                walk(fullPath, relPath);
            } else {
                files.push({
                    relPath,
                    encoding: BINARY_EXTENSION_RE.test(entry) ? "base64" : "utf8",
                });
            }
        }
    }
    walk(dir, "");
    return files;
}

export interface HotspotTemplateVars {
    apiUrl: string;
    routerId: string;
    companyName?: string | null;
    customerCareNumber?: string | null;
    primaryColor?: string | null;
    accentColor?: string | null;
}

/**
 * Render a single hotspot template file with per-tenant variables applied.
 * Returns raw bytes — caller decides how to serve/write them.
 *
 * SECURITY: relPath is validated to stay inside the hotspot directory to
 * prevent path traversal (e.g. "../../.env") from ever reaching readFileSync.
 */
export function renderHotspotFile(relPath: string, vars: HotspotTemplateVars): Buffer {
    const dir = resolveHotspotDir();
    const fullPath = join(dir, relPath);

    const resolvedDir = resolve(dir);
    const resolvedFull = resolve(fullPath);
    if (resolvedFull !== resolvedDir && !resolvedFull.startsWith(resolvedDir + sep)) {
        throw new Error(`Rejected path traversal attempt for hotspot asset: ${relPath}`);
    }
    if (!existsSync(resolvedFull)) {
        throw new Error(`Hotspot asset not found: ${relPath}`);
    }

    if (BINARY_EXTENSION_RE.test(relPath)) {
        return readFileSync(resolvedFull);
    }

    let content = readFileSync(resolvedFull, "utf8");
    const isTemplated = TEMPLATED_EXTENSIONS.some((ext) => relPath.endsWith(ext));
    if (isTemplated) {
        const companyName = vars.companyName || "HQINVESTMENT";
        const supportPhone = vars.customerCareNumber || "+255 000 000 000";
        const primary = vars.primaryColor || "#1a1a2e";
        const accent = vars.accentColor || "#6366f1";

        content = content
            .replaceAll("BILLING_API_URL", vars.apiUrl)
            .replaceAll("BILLING_ROUTER_ID", vars.routerId)
            .replaceAll("BILLING_COMPANY_NAME", companyName)
            .replaceAll("BILLING_SUPPORT_PHONE", supportPhone)
            // Longer/more-specific tokens first so we don't corrupt them by
            // matching the shorter BILLING_PRIMARY_COLOR/BILLING_ACCENT_COLOR first.
            .replaceAll("BILLING_PRIMARY_COLOR22", primary + "22")
            .replaceAll("BILLING_ACCENT_COLOR22", accent + "22")
            .replaceAll("BILLING_ACCENT_COLOR18", accent + "18")
            .replaceAll("BILLING_ACCENT_COLOR30", accent + "30")
            .replaceAll("BILLING_ACCENT_COLOR40", accent + "40")
            .replaceAll("BILLING_ACCENT_COLOR08", accent + "08")
            .replaceAll("BILLING_ACCENT_COLOR15", accent + "15")
            .replaceAll("BILLING_ACCENT_COLOR25", accent + "25")
            .replaceAll("BILLING_PRIMARY_COLOR", primary)
            .replaceAll("BILLING_ACCENT_COLOR", accent);
    }
    return Buffer.from(content, "utf8");
}

// ── Signed, short-lived asset tokens ────────────────────────────────────────

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes — enough for a full push batch

function getSigningKey(): Buffer {
    const hex = env.FIELD_ENCRYPTION_KEY;
    if (!hex) {
        throw new Error("FIELD_ENCRYPTION_KEY is required to sign hotspot asset URLs");
    }
    return Buffer.from(hex, "hex");
}

/** HMAC-sign a (routerId, relPath, expiry) tuple. Never trust an unsigned request. */
export function signHotspotAssetToken(routerId: string, relPath: string, expiresAtMs: number): string {
    const key = getSigningKey();
    const payload = `hotspot-asset:v1:${routerId}:${relPath}:${expiresAtMs}`;
    const sig = crypto.createHmac("sha256", key).update(payload).digest("hex");
    return `${expiresAtMs}.${sig}`;
}

/** Verify a token for this exact router + file, rejecting expired or tampered tokens. */
export function verifyHotspotAssetToken(routerId: string, relPath: string, token: string): boolean {
    const dotIndex = token.indexOf(".");
    if (dotIndex === -1) return false;

    const expPart = token.slice(0, dotIndex);
    const sig = token.slice(dotIndex + 1);
    const expiresAtMs = Number(expPart);
    if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) return false;

    const expectedToken = signHotspotAssetToken(routerId, relPath, expiresAtMs);
    const expectedSig = expectedToken.slice(expectedToken.indexOf(".") + 1);

    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expectedSig, "hex");
    if (a.length !== b.length || a.length === 0) return false;
    return crypto.timingSafeEqual(a, b);
}

/** Build the full signed URL the router will `/tool fetch` for one file. */
export function buildSignedAssetUrl(baseUrl: string, routerId: string, relPath: string): string {
    const expiresAtMs = Date.now() + TOKEN_TTL_MS;
    const token = signHotspotAssetToken(routerId, relPath, expiresAtMs);
    const encodedPath = relPath.split("/").map(encodeURIComponent).join("/");
    return `${baseUrl.replace(/\/$/, "")}/api/hotspot/assets/${encodeURIComponent(routerId)}/${encodedPath}?token=${token}`;
}

export function contentTypeForAsset(relPath: string): string {
    if (relPath.endsWith(".html")) return "text/html; charset=utf-8";
    if (relPath.endsWith(".css")) return "text/css; charset=utf-8";
    if (relPath.endsWith(".js")) return "application/javascript; charset=utf-8";
    if (relPath.endsWith(".xml")) return "application/xml; charset=utf-8";
    if (relPath.endsWith(".png")) return "image/png";
    if (relPath.endsWith(".jpg") || relPath.endsWith(".jpeg")) return "image/jpeg";
    if (relPath.endsWith(".gif")) return "image/gif";
    if (relPath.endsWith(".ico")) return "image/x-icon";
    if (relPath.endsWith(".woff")) return "font/woff";
    if (relPath.endsWith(".woff2")) return "font/woff2";
    if (relPath.endsWith(".ttf")) return "font/ttf";
    return "application/octet-stream";
}
