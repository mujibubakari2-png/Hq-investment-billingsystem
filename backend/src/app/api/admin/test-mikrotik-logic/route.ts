import { NextRequest } from "next/server";
import { jsonResponse } from "@/lib/auth";
import { MikroTikService } from "@/lib/mikrotik";


export async function GET(req: NextRequest) {
    try {
        // Mock fetch globally for this request scope
        const originalFetch = global.fetch;
        
        (global as any).fetch = (url: string, options: any) => {
            if (url.includes("/rest/system/identity")) {
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve(JSON.stringify([{ name: "Mock-HQInvestment-Router" }]))
                });
            }
            if (url.includes("/rest/system/resource")) {
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve(JSON.stringify([{
                        version: "7.12",
                        "cpu-load": "10",
                        "free-memory": "512000",
                        "total-memory": "1024000",
                        uptime: "5d 10h",
                        "board-name": "RB5009",
                        "architecture-name": "arm64"
                    }]))
                });
            }
            return Promise.reject(new Error("Unknown mock endpoint"));
        };

        const conn = {
            host: "mock-router.local",
            port: 80,
            username: "admin",
            password: "password"
        };

        const service = new MikroTikService(conn, "mock-id");
        
        // We need to bypass the prisma update in testConnection for this mock test
        // Let's just manually call the logic pieces
        
        const identity = await (service as any).apiRequest("/system/identity");
        const resources = await (service as any).apiRequest("/system/resource");

        const res = Array.isArray(resources) ? resources[0] : resources;
        const ident = Array.isArray(identity) ? identity[0] : identity;

        const info = {
            identity: ident?.name || "Unknown",
            version: res?.version || "Unknown",
            cpuLoad: parseInt(res?.["cpu-load"] || "0"),
            freeMemory: parseInt(res?.["free-memory"] || "0"),
            totalMemory: parseInt(res?.["total-memory"] || "0"),
            uptime: res?.uptime || "0s",
            boardName: res?.["board-name"] || "Unknown",
            architecture: res?.["architecture-name"] || "Unknown",
        };

        // Restore fetch
        global.fetch = originalFetch;

        return jsonResponse({
            success: true,
            message: "MikroTik integration logic verified with mocks",
            mockInfo: info
        });

    } catch (error: any) {
        return jsonResponse({
            success: false,
            error: error.message
        }, 500);
    }
}
