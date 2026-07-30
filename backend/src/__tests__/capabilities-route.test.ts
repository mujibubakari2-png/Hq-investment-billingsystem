import { GET, POST } from "@/app/api/routers/[id]/capabilities/route";
import { NextRequest, NextResponse } from "next/server";

jest.mock("@/lib/rbac");
jest.mock("@/lib/tenantPrisma");
jest.mock("@/lib/routerAdapters");
jest.mock("@/lib/logger");
jest.mock("@/lib/auth");

import { requirePermission } from "@/lib/rbac";
import { getTenantClient } from "@/lib/tenantPrisma";
import { getRouterAdapter } from "@/lib/routerAdapters";
import logger from "@/lib/logger";
import { errorResponse } from "@/lib/auth";

describe("GET /api/routers/[id]/capabilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (logger.error as jest.Mock).mockImplementation(() => {});
  });

  it("returns stored capabilities from database", async () => {
    const mockUserPayload = { sub: "user1", tenantId: "tenant1", role: "admin" };
    (requirePermission as jest.Mock).mockResolvedValue({ user: mockUserPayload, error: null });

    const mockRouter = {
      id: "router1",
      tenantId: "tenant1",
      vendor: "mikrotik",
      firmwareVersion: "7.1",
      architecture: "x86",
      apiType: "REST",
      supportedFeatures: "PPPoE,Hotspot,RADIUS",
      capabilities: JSON.stringify({ pppoe: true, hotspot: true, radius: true }),
      lastDiscovery: new Date(),
      healthStatus: "HEALTHY",
      provisioningStatus: "PROVISIONED",
    };

    const mockDb = {
      router: { findUnique: jest.fn().mockResolvedValue(mockRouter) },
    };
    (getTenantClient as jest.Mock).mockReturnValue(mockDb);

    const req = new NextRequest("http://localhost:3000/api/routers/router1/capabilities");
    const res = await GET(req, { params: { id: "router1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.vendor).toBe("mikrotik");
    expect(json.firmwareVersion).toBe("7.1");
    expect(json.capabilities.pppoe).toBe(true);
  });

  it("returns 404 if router not found", async () => {
    (requirePermission as jest.Mock).mockResolvedValue({ user: { tenantId: "tenant1" }, error: null });
    const mockDb = { router: { findUnique: jest.fn().mockResolvedValue(null) } };
    (getTenantClient as jest.Mock).mockReturnValue(mockDb);
    (errorResponse as jest.Mock).mockReturnValue(new NextResponse(JSON.stringify({ error: "Router not found" }), { status: 404 }));

    const req = new NextRequest("http://localhost:3000/api/routers/router1/capabilities");
    const res = await GET(req, { params: { id: "router1" } });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/routers/[id]/capabilities/refresh", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (logger.info as jest.Mock).mockImplementation(() => {});
    (logger.error as jest.Mock).mockImplementation(() => {});
  });

  it("discovers live capabilities and returns result", async () => {
    const mockUserPayload = { sub: "user1", tenantId: "tenant1", role: "admin" };
    (requirePermission as jest.Mock).mockResolvedValue({ user: mockUserPayload, error: null });

    const mockRouter = { id: "router1", tenantId: "tenant1" };
    const mockDb = { router: { findUnique: jest.fn().mockResolvedValue(mockRouter) } };
    (getTenantClient as jest.Mock).mockReturnValue(mockDb);

    const mockCapabilities = {
      vendor: "mikrotik",
      firmwareVersion: "7.1",
      architecture: "x86",
      apiType: "REST",
      supportedFeatures: ["PPPoE", "Hotspot", "RADIUS"],
      capabilities: { pppoe: true, hotspot: true, radius: true },
    };
    const mockAdapter = { discoverCapabilities: jest.fn().mockResolvedValue(mockCapabilities) };
    (getRouterAdapter as jest.Mock).mockResolvedValue(mockAdapter);

    const req = new NextRequest("http://localhost:3000/api/routers/router1/capabilities/refresh", { method: "POST" });
    const res = await POST(req, { params: { id: "router1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.capabilities.vendor).toBe("mikrotik");
    expect(mockAdapter.discoverCapabilities).toHaveBeenCalled();
  });

  it("returns error if discovery fails", async () => {
    (requirePermission as jest.Mock).mockResolvedValue({ user: { tenantId: "tenant1" }, error: null });
    const mockDb = { router: { findUnique: jest.fn().mockResolvedValue({ id: "router1", tenantId: "tenant1" }) } };
    (getTenantClient as jest.Mock).mockReturnValue(mockDb);

    const mockAdapter = {
      discoverCapabilities: jest.fn().mockRejectedValue(new Error("Connection timeout")),
    };
    (getRouterAdapter as jest.Mock).mockResolvedValue(mockAdapter);
    (errorResponse as jest.Mock).mockReturnValue(
      new NextResponse(JSON.stringify({ error: "Failed to discover capabilities" }), { status: 500 })
    );

    const req = new NextRequest("http://localhost:3000/api/routers/router1/capabilities/refresh", { method: "POST" });
    const res = await POST(req, { params: { id: "router1" } });

    expect(res.status).toBe(500);
  });
});
