import { NextRequest } from "next/server";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";
import { getTenantClient } from "@/lib/tenantPrisma";
import { sanitizeMikroTikName } from "@/lib/mikrotik";
import logger from "@/lib/logger";

/**
 * GET /api/hotspot/download
 * 
 * Returns the complete hotspot login portal as a ZIP-like package.
 * The files are base64 encoded in a JSON manifest for the frontend
 * to reconstruct into a downloadable zip via JSZip.
 * 
 * Query params:
 *   ?apiUrl=https://api.yourdomain.com  (optional — embeds API URL into login.html)
 *   ?routerId=xxx                       (optional — embeds router ID)
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const apiUrl = searchParams.get("apiUrl") || process.env.APP_URL || "https://your-droplet.digitalocean.com";
        const routerId = searchParams.get("routerId") || "";

        let hotspotDir = join(process.cwd(), "public", "hotspot");

        // Comprehensive path discovery
        const pathsToTry = [
            join(process.cwd(), "public", "hotspot"),
            join(process.cwd(), "backend", "public", "hotspot"),
            join(process.cwd(), "..", "public", "hotspot"), // if running from backend/src/...
            "/var/www/Hq-investment-billingsystem/backend/public/hotspot", // Hardcoded absolute path for Droplet fallback
        ];

        let found = false;
        for (const p of pathsToTry) {
            if (existsSync(p)) {
                hotspotDir = p;
                found = true;
                break;
            }
        }

        if (!found) {
            logger.error("[HOTSPOT DOWNLOAD] Directory not found in any of:", { error: pathsToTry instanceof Error ? pathsToTry.message : String(pathsToTry) });
            return Response.json({
                error: "Template directory not found on server",
                checkedPaths: pathsToTry
            }, { status: 500 });
        }

        // Fetch router details if ID is provided
        // Default secret from env — never hardcode a value like 'hqsecret'
        // Default secret from env — never hardcode a value like 'hqsecret'
        // Do not embed the shared secret into the generated setup.rsc for non-super-admins.
        let routerSecret = null as string | null;
        let routerName = "Generic";
        let hotspotSettings: any = null;

        if (routerId) {
            const globalDb = getTenantClient(null);
            const router = await globalDb.router.findUnique({
                where: { id: routerId },
                select: {
                    name: true,
                    tenantId: true,
                }
            });

            if (router?.tenantId) {
                const db = getTenantClient(router.tenantId);
                const tenantRouter = await db.router.findUnique({
                    where: { id: routerId },
                    select: { name: true, hotspotSettings: true }
                });

                if (tenantRouter) {
                    routerName = sanitizeMikroTikName(tenantRouter.name);
                    hotspotSettings = tenantRouter.hotspotSettings;
                }
            }

            if (!hotspotSettings && router) {
                hotspotSettings = {
                    companyName: "HQINVESTMENT",
                    customerCareNumber: "+255 000 000 000",
                    primaryColor: "#1a1a2e",
                    accentColor: "#6366f1"
                };
            }

            // Only populate the secret for Super Admins. Otherwise keep it null to avoid leakage.
            // The route does not perform auth itself; if callers need the secret, they must
            // request it via a protected admin-only endpoint.
            routerSecret = null;
        }

        // Collect all files recursively
        const files: { path: string; content: string; encoding: "utf8" | "base64" }[] = [];

        function collectFiles(dir: string, base: string = "") {
            const entries = readdirSync(dir);
            for (const entry of entries) {
                const fullPath = join(dir, entry);
                const relPath = base ? `${base}/${entry}` : entry;
                const stat = statSync(fullPath);
                if (stat.isDirectory()) {
                    collectFiles(fullPath, relPath);
                } else {
                    const isBinary = /\.(ico|png|jpg|jpeg|gif|woff|woff2|ttf)$/i.test(entry);
                    let content: string;
                    if (isBinary) {
                        content = readFileSync(fullPath).toString("base64");
                        files.push({ path: relPath, content, encoding: "base64" });
                    } else {
                        content = readFileSync(fullPath, "utf8");
                        // Inject dynamic settings into all HTML, XML and CSS files
                        if (entry.endsWith(".html") || entry.endsWith(".xml") || entry.endsWith(".css")) {
                            content = content.replaceAll("BILLING_API_URL", apiUrl);
                            content = content.replaceAll("BILLING_ROUTER_ID", routerId);

                            if (hotspotSettings) {
                                content = content.replaceAll("BILLING_COMPANY_NAME", hotspotSettings.companyName || "HQINVESTMENT");
                                content = content.replaceAll("BILLING_SUPPORT_PHONE", hotspotSettings.customerCareNumber || "+255 000 000 000");
                                content = content.replaceAll("BILLING_PRIMARY_COLOR", hotspotSettings.primaryColor || "#1a1a2e");
                                content = content.replaceAll("BILLING_ACCENT_COLOR", hotspotSettings.accentColor || "#6366f1");
                                // Support for transparency versions in CSS
                                content = content.replaceAll("BILLING_PRIMARY_COLOR22", (hotspotSettings.primaryColor || "#1a1a2e") + "22");
                                content = content.replaceAll("BILLING_ACCENT_COLOR22", (hotspotSettings.accentColor || "#6366f1") + "22");
                                content = content.replaceAll("BILLING_ACCENT_COLOR18", (hotspotSettings.accentColor || "#6366f1") + "18");
                                content = content.replaceAll("BILLING_ACCENT_COLOR30", (hotspotSettings.accentColor || "#6366f1") + "30");
                                content = content.replaceAll("BILLING_ACCENT_COLOR40", (hotspotSettings.accentColor || "#6366f1") + "40");
                                content = content.replaceAll("BILLING_ACCENT_COLOR08", (hotspotSettings.accentColor || "#6366f1") + "08");
                                content = content.replaceAll("BILLING_ACCENT_COLOR15", (hotspotSettings.accentColor || "#6366f1") + "15");
                                content = content.replaceAll("BILLING_ACCENT_COLOR25", (hotspotSettings.accentColor || "#6366f1") + "25");
                            }
                        }
                        files.push({ path: relPath, content, encoding: "utf8" });
                    }
                }
            }
        }

        collectFiles(hotspotDir);

        // Generate a clean DNS name
        const domain = new URL(apiUrl).hostname;
        const dnsName = hotspotSettings?.companyName
            ? sanitizeMikroTikName(hotspotSettings.companyName) + ".net"
            : "hotspot.net";

        const setupScript = `# MikroTik Hotspot Configuration Script
# Generated by HQINVESTMENT ISP Billing System
# For Router: ${routerName}

/ip hotspot profile
set [find default=yes] html-directory=hotspot login-by=http-chap,http-pap,cookie,mac-cookie
add name=hq_hotspot html-directory=hotspot login-by=http-chap,http-pap,cookie,mac-cookie use-radius=yes dns-name=${dnsName}

/radius
            add address=${domain} ${routerSecret ? `secret="${routerSecret}"` : "# secret redacted: contact Super Admin to obtain shared secret"} service=hotspot,ppp authentication-port=1812 accounting-port=1813 timeout=3s comment="HQInvestment RADIUS"

/ip hotspot walled-garden
add dst-host=${domain} action=allow
add dst-host=*.mpesa.co.tz action=allow
add dst-host=*.vodacom.co.tz action=allow

/ip hotspot
add name=hs-hq interface=bridge-local profile=hq_hotspot disabled=no
`;

        files.push({ path: "setup.rsc", content: setupScript, encoding: "utf8" });

        return Response.json({
            success: true,
            apiUrl,
            routerId,
            files,
            instructions: [
                "1. Extract these files to your MikroTik flash: /flash/hotspot/",
                "2. Upload the 'hotspot' folder to Winbox > Files",
                "3. IMPORTANT: Open Winbox > New Terminal and run: /import hotspot/setup.rsc",
                "4. This script automatically configures your Hotspot Profile, RADIUS, and Walled Garden.",
                "5. Connect a client device and test the portal.",
            ],
        });

    } catch (e: any) {
        logger.error("Hotspot download error:", { error: e instanceof Error ? e.message : String(e) });
        return Response.json({
            error: "Failed to package hotspot files",
            details: e.message || String(e)
        }, { status: 500 });
    }
}
