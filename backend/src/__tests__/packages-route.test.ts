import { POST, GET } from "@/app/api/packages/route";
import { NextRequest, NextResponse } from "next/server";

// Mock dependencies
jest.mock("@/lib/tenantPrisma");
jest.mock("@/lib/rbac");
jest.mock("@/lib/tenant");
jest.mock("@/lib/validators");
jest.mock("@/lib/mikrotik");
jest.mock("@/lib/logger");
jest.mock("@/lib/auth");

import { getTenantClient } from "@/lib/tenantPrisma";
import { requirePermission } from "@/lib/rbac";
import { getTenantFilter, getAssignTenantId } from "@/lib/tenant";
import { PackageCreateSchema } from "@/lib/validators";
import { getMikroTikService } from "@/lib/mikrotik";
import logger from "@/lib/logger";
import { jsonResponse, errorResponse } from "@/lib/auth";

// Helper to parse mocked responses
const parseResponse = (response: any) => ({
  status: response.status,
  body: response.body ? JSON.parse(response.body) : null,
});

describe("POST /api/packages", () => {
    const mockUserPayload = {
        sub: "user1",
        tenantId: "tenant1",
        tenantSlug: "tenant1-slug",
        role: "admin",
    };

    const mockTenantFilter = { tenantId: "tenant1" };

    const mockPackageData = {
        name: "Basic WiFi",
        type: "HOTSPOT",
        category: "PERSONAL",
        uploadSpeed: 10,
        uploadUnit: "MBPS",
        downloadSpeed: 20,
        downloadUnit: "MBPS",
        price: 50,
        duration: 30,
        durationUnit: "DAYS",
        status: "ACTIVE",
        burstEnabled: false,
        hotspotType: "UNLIMITED",
        devices: 1,
        paymentType: "PREPAID",
        routerId: "router1",
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock requirePermission to pass
        (requirePermission as jest.Mock).mockReturnValue({
            user: mockUserPayload,
            error: null,
        });

        // Mock getTenantFilter
        (getTenantFilter as jest.Mock).mockReturnValue({
            filter: mockTenantFilter,
        });

        // Mock getTenantClient
        const mockDb = {
            package: {
                create: jest.fn(),
                findMany: jest.fn(),
                count: jest.fn(),
            },
            router: {
                findFirst: jest.fn(),
            },
            routerLog: {
                create: jest.fn(),
            },
        };
        (getTenantClient as jest.Mock).mockReturnValue(mockDb);

        // Mock PackageCreateSchema
        (PackageCreateSchema.safeParse as jest.Mock).mockReturnValue({
            success: true,
            data: mockPackageData,
        });

        // Mock getAssignTenantId
        (getAssignTenantId as jest.Mock).mockReturnValue("tenant1");

        // Mock logger
        (logger.error as jest.Mock).mockImplementation(() => {});
        (logger.warn as jest.Mock).mockImplementation(() => {});

        // Mock auth - return real NextResponse objects
        (jsonResponse as jest.Mock).mockImplementation((data, code = 200) => 
            new NextResponse(JSON.stringify(data), { status: code })
        );
        (errorResponse as jest.Mock).mockImplementation((msg, code = 400) => 
            new NextResponse(JSON.stringify({ error: msg }), { status: code })
        );
    });

    it("should create a package for tenant-scoped admin", async () => {
        const mockDb = getTenantClient(mockUserPayload);
        const mockRouter = { id: "router1", tenantId: "tenant1", name: "Router 1" };
        const mockMikroTik = {
            createProfileFromPackage: jest.fn().mockResolvedValue(undefined),
        };

        (mockDb.router.findFirst as jest.Mock).mockResolvedValue(mockRouter);
        (mockDb.package.create as jest.Mock).mockResolvedValue({
            ...mockPackageData,
            id: "pkg1",
            tenantId: "tenant1",
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        (getMikroTikService as jest.Mock).mockResolvedValue(mockMikroTik);

        const request = new NextRequest("http://localhost/api/packages", {
            method: "POST",
            body: JSON.stringify({
                ...mockPackageData,
                type: "Hotspot",
                category: "Personal",
                paymentType: "Prepaid",
            }),
        });

        const response = await POST(request);

        expect(requirePermission).toHaveBeenCalledWith(request, "packages:write");
        expect(PackageCreateSchema.safeParse).toHaveBeenCalled();
        expect(mockDb.package.create).toHaveBeenCalled();
        expect(response.status).toBe(201);
    });

    it("should reject create if validation fails", async () => {
        (PackageCreateSchema.safeParse as jest.Mock).mockReturnValue({
            success: false,
            error: {
                issues: [{ path: ["name"], message: "Name is required" }],
            },
        });

        const request = new NextRequest("http://localhost/api/packages", {
            method: "POST",
            body: JSON.stringify({ type: "Hotspot" }),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
        expect(logger.warn).toHaveBeenCalled();
    });

    it("should reject create if permission denied", async () => {
        (requirePermission as jest.Mock).mockReturnValue({
            user: null,
            error: new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
        });

        const request = new NextRequest("http://localhost/api/packages", {
            method: "POST",
            body: JSON.stringify(mockPackageData),
        });

        const response = await POST(request);

        expect(response.status).toBe(403);
    });

    it("should reject if router not found", async () => {
        const mockDb = getTenantClient(mockUserPayload);
        (mockDb.router.findFirst as jest.Mock).mockResolvedValue(null);

        const request = new NextRequest("http://localhost/api/packages", {
            method: "POST",
            body: JSON.stringify(mockPackageData),
        });

        const response = await POST(request);

        expect(response.status).toBe(404);
    });

    it("should handle MikroTik sync failure gracefully", async () => {
        const mockDb = getTenantClient(mockUserPayload);
        const mockRouter = { id: "router1", tenantId: "tenant1", name: "Router 1" };
        const mockMikroTik = {
            createProfileFromPackage: jest.fn().mockRejectedValue(new Error("MikroTik connection failed")),
        };

        (mockDb.router.findFirst as jest.Mock).mockResolvedValue(mockRouter);
        (mockDb.package.create as jest.Mock).mockResolvedValue({
            ...mockPackageData,
            id: "pkg1",
            tenantId: "tenant1",
        });
        (getMikroTikService as jest.Mock).mockResolvedValue(mockMikroTik);

        const request = new NextRequest("http://localhost/api/packages", {
            method: "POST",
            body: JSON.stringify(mockPackageData),
        });

        const response = await POST(request);

        // Should still return 201 since package was created
        expect(response.status).toBe(201);
        expect(mockDb.routerLog.create).toHaveBeenCalled();
    });

    it("should create package without router", async () => {
        const packageDataWithoutRouter = { ...mockPackageData };
        delete (packageDataWithoutRouter as any).routerId;

        (PackageCreateSchema.safeParse as jest.Mock).mockReturnValue({
            success: true,
            data: packageDataWithoutRouter,
        });

        const mockDb = getTenantClient(mockUserPayload);
        (mockDb.package.create as jest.Mock).mockResolvedValue({
            ...packageDataWithoutRouter,
            id: "pkg2",
            routerId: null,
            tenantId: "tenant1",
        });

        const request = new NextRequest("http://localhost/api/packages", {
            method: "POST",
            body: JSON.stringify(packageDataWithoutRouter),
        });

        const response = await POST(request);

        expect(response.status).toBe(201);
        expect(getMikroTikService).not.toHaveBeenCalled();
    });
});

describe("GET /api/packages", () => {
    const mockUserPayload = {
        sub: "user1",
        tenantId: "tenant1",
        tenantSlug: "tenant1-slug",
        role: "admin",
    };

    const mockTenantFilter = { tenantId: "tenant1" };

    const mockPackages = [
        {
            id: "pkg1",
            name: "Basic WiFi",
            type: "HOTSPOT",
            category: "PERSONAL",
            uploadSpeed: 10,
            uploadUnit: "MBPS",
            downloadSpeed: 20,
            downloadUnit: "MBPS",
            price: 50,
            router: { name: "Router 1" },
            duration: 30,
            durationUnit: "DAYS",
            status: "ACTIVE",
            burstEnabled: false,
            hotspotType: "UNLIMITED",
            devices: 1,
            paymentType: "PREPAID",
            createdAt: new Date(),
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();

        (requirePermission as jest.Mock).mockReturnValue({
            user: mockUserPayload,
            error: null,
        });

        (getTenantFilter as jest.Mock).mockReturnValue({
            filter: mockTenantFilter,
        });

        const mockDb = {
            package: {
                findMany: jest.fn().mockResolvedValue(mockPackages),
                count: jest.fn().mockResolvedValue(1),
            },
        };
        (getTenantClient as jest.Mock).mockReturnValue(mockDb);

        (logger.error as jest.Mock).mockImplementation(() => {});
        (jsonResponse as jest.Mock).mockImplementation((data, code = 200) => 
            new NextResponse(JSON.stringify(data), { status: code })
        );
        (errorResponse as jest.Mock).mockImplementation((msg, code = 400) => 
            new NextResponse(JSON.stringify({ error: msg }), { status: code })
        );
    });

    it("should list packages for tenant with pagination", async () => {
        const request = new NextRequest("http://localhost/api/packages?page=1&limit=10");

        const response = await GET(request);

        expect(requirePermission).toHaveBeenCalledWith(request, "packages:read");
        expect(response.status).toBe(200);
    });

    it("should filter packages by type", async () => {
        const request = new NextRequest("http://localhost/api/packages?type=Hotspot");

        await GET(request);

        const mockDb = getTenantClient(mockUserPayload);
        expect(mockDb.package.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ type: "HOTSPOT" }),
            })
        );
    });

    it("should filter packages by router", async () => {
        const request = new NextRequest("http://localhost/api/packages?routerId=router1");

        await GET(request);

        const mockDb = getTenantClient(mockUserPayload);
        expect(mockDb.package.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ routerId: "router1" }),
            })
        );
    });

    it("should reject GET if permission denied", async () => {
        (requirePermission as jest.Mock).mockReturnValue({
            user: null,
            error: new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
        });

        const request = new NextRequest("http://localhost/api/packages");

        const response = await GET(request);

        expect(response.status).toBe(403);
    });
});
