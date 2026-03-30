import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getTenantFilter } from "@/lib/tenant";

// GET /api/radius/sessions – list RADIUS accounting sessions (tenant-isolated)
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { filter } = getTenantFilter(userPayload);

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status") || "active"; // active | closed | all
        const search = searchParams.get("search")?.toLowerCase() || "";
        const page = parseInt(searchParams.get("page") || "1");
        const limitParam = searchParams.get("limit") || "50";
        const limit = limitParam === "All" ? 999999 : parseInt(limitParam);

        // Build where clause
        const where: any = { ...filter };
        if (status === "active") {
            where.acctstoptime = null; // Session still open = online
        } else if (status === "closed") {
            where.acctstoptime = { not: null };
        }

        if (search) {
            where.OR = [
                { username: { contains: search, mode: "insensitive" } },
                { framedipaddress: { contains: search } },
                { callingstationid: { contains: search, mode: "insensitive" } },
                { nasipaddress: { contains: search } },
            ];
        }

        // Get total count for pagination
        const total = await prisma.radAcct.count({ where });

        // Get sessions with pagination
        const sessions = await prisma.radAcct.findMany({
            where,
            orderBy: { acctstarttime: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        });

        // Format bytes helper
        const formatBytes = (bytes: number): string => {
            if (bytes === 0) return "0 B";
            const k = 1024;
            const sizes = ["B", "KB", "MB", "GB", "TB"];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
        };

        // Format duration helper
        const formatDuration = (seconds: number): string => {
            if (!seconds || seconds <= 0) return "0s";
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            const parts = [];
            if (h > 0) parts.push(`${h}h`);
            if (m > 0) parts.push(`${m}m`);
            if (s > 0 || parts.length === 0) parts.push(`${s}s`);
            return parts.join(" ");
        };

        const mapped = sessions.map(s => {
            const dataIn = Number(s.acctinputoctets || 0);
            const dataOut = Number(s.acctoutputoctets || 0);
            return {
                id: s.radacctid.toString(),
                sessionId: s.acctsessionid,
                username: s.username,
                nasIp: s.nasipaddress,
                nasPort: s.nasportid || "N/A",
                framedIp: s.framedipaddress || "N/A",
                macAddress: s.callingstationid || "N/A",
                protocol: s.framedprotocol === "PPP" ? "PPPoE" : "Hotspot",
                startTime: s.acctstarttime
                    ? s.acctstarttime.toLocaleString("en-US", { timeZone: "Africa/Dar_es_Salaam", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "N/A",
                stopTime: s.acctstoptime
                    ? s.acctstoptime.toLocaleString("en-US", { timeZone: "Africa/Dar_es_Salaam", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
                    : null,
                duration: formatDuration(s.acctsessiontime || 0),
                durationSeconds: s.acctsessiontime || 0,
                dataIn,
                dataOut,
                dataInFormatted: formatBytes(dataIn),
                dataOutFormatted: formatBytes(dataOut),
                totalData: formatBytes(dataIn + dataOut),
                terminateCause: s.acctterminatecause || null,
                isOnline: !s.acctstoptime,
            };
        });

        // Compute summary stats (from ALL matching records, not just current page)
        const allActiveSessions = await prisma.radAcct.findMany({
            where: { acctstoptime: null, ...filter },
            select: {
                framedprotocol: true,
                acctinputoctets: true,
                acctoutputoctets: true,
            },
        });

        const summary = {
            totalOnline: allActiveSessions.length,
            hotspotOnline: allActiveSessions.filter(s => s.framedprotocol !== "PPP").length,
            pppoeOnline: allActiveSessions.filter(s => s.framedprotocol === "PPP").length,
            totalDataIn: formatBytes(allActiveSessions.reduce((acc, s) => acc + Number(s.acctinputoctets || 0), 0)),
            totalDataOut: formatBytes(allActiveSessions.reduce((acc, s) => acc + Number(s.acctoutputoctets || 0), 0)),
            totalDataInBytes: allActiveSessions.reduce((acc, s) => acc + Number(s.acctinputoctets || 0), 0),
            totalDataOutBytes: allActiveSessions.reduce((acc, s) => acc + Number(s.acctoutputoctets || 0), 0),
        };

        return jsonResponse({
            data: mapped,
            total,
            page,
            limit,
            summary,
        });
    } catch (e) {
        console.error("RADIUS sessions error:", e);
        return errorResponse("Internal server error", 500);
    }
}
