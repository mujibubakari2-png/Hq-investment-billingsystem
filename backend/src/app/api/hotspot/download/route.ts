import { NextRequest } from "next/server";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

/**
 * GET /api/hotspot/download
 * 
 * Returns the complete hotspot login portal as a ZIP-like package.
 * The files are base64 encoded in a JSON manifest for the frontend
 * to reconstruct into a downloadable zip via JSZip.
 * 
 * Query params:
 *   ?apiUrl=https://your-droplet.com  (optional — embeds API URL into login.html)
 *   ?routerId=xxx                       (optional — embeds router ID)
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const apiUrl = searchParams.get("apiUrl") || process.env.APP_URL || "https://your-droplet.digitalocean.com";
        const routerId = searchParams.get("routerId") || "";

        let hotspotDir = join(process.cwd(), "public", "hotspot");
        // Fallback for monorepo root process.cwd()
        if (!existsSync(hotspotDir)) {
            hotspotDir = join(process.cwd(), "backend", "public", "hotspot");
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
                        // Inject API URL into login.html
                        if (entry === "login.html" || entry === "rlogin.html") {
                            content = content.replace("BILLING_API_URL", apiUrl);
                        }
                        files.push({ path: relPath, content, encoding: "utf8" });
                    }
                }
            }
        }

        collectFiles(hotspotDir);

        return Response.json({
            success: true,
            apiUrl,
            routerId,
            files,
            instructions: [
                "1. Extract these files to your MikroTik flash: /flash/hotspot/",
                "2. In Winbox > Files, upload the 'hotspot' folder",
                "3. Run: /ip hotspot profile set [find] html-directory=hotspot",
                "4. Add walled-garden: /ip hotspot walled-garden add dst-host=\"" + new URL(apiUrl).hostname + "\" action=allow",
                "5. Connect a client device and test the portal",
            ],
        });

    } catch (e: any) {
        console.error("Hotspot download error:", e);
        return Response.json({ error: "Failed to package hotspot files" }, { status: 500 });
    }
}
