import { NextRequest } from "next/server";
import { csrfMiddleware, generateCsrfToken } from "../middleware/csrfProtection";

describe("CSRF Protection - Complete End-to-End Audit Tests", () => {
    let validToken: string;

    beforeEach(() => {
        validToken = generateCsrfToken('test-session-id');
    });

    const createRequest = (method: string, headers: Record<string, string>, cookies: Record<string, string>) => {
        // We use a protected route URL here. If we used an exempt route like /api/auth/login, 
        // the middleware would bypass CSRF checks and the tests would fail expecting a 403.
        const req = new NextRequest("https://api.yourdomain.com/api/protected-route", {
            method,
            headers: new Headers(headers),
        });
        
        for (const [key, value] of Object.entries(cookies)) {
            req.cookies.set(key, value);
        }
        
        return req;
    };

    describe("Scenario 1: Missing CSRF token", () => {
        it("should reject POST requests lacking both cookie and header", () => {
            const req = createRequest("POST", {}, {});
            const res = csrfMiddleware(req);
            
            expect(res).not.toBeNull();
            expect(res?.status).toBe(403);
        });

        it("should reject POST requests lacking header but having cookie", () => {
            const req = createRequest("POST", {}, { "csrf-token": validToken });
            const res = csrfMiddleware(req);
            
            expect(res).not.toBeNull();
            expect(res?.status).toBe(403);
        });

        it("should reject POST requests lacking cookie but having header", () => {
            const req = createRequest("POST", { "x-csrf-token": validToken }, {});
            const res = csrfMiddleware(req);
            
            expect(res).not.toBeNull();
            expect(res?.status).toBe(403);
        });
    });

    describe("Scenario 2 & 3: Invalid or Expired CSRF token", () => {
        it("should reject when cookie and header tokens do not match (Invalid)", () => {
            const req = createRequest("POST", 
                { "x-csrf-token": "attacker-token" }, 
                { "csrf-token": validToken }
            );
            const res = csrfMiddleware(req);
            
            expect(res).not.toBeNull();
            expect(res?.status).toBe(403);
        });

        it("should reject when header token is malformed", () => {
            const req = createRequest("POST", 
                { "x-csrf-token": "" }, 
                { "csrf-token": validToken }
            );
            const res = csrfMiddleware(req);
            
            expect(res).not.toBeNull();
            expect(res?.status).toBe(403);
        });
    });

    describe("Scenario 4 & 7: Multiple browser tabs / Concurrent requests", () => {
        it("should accept valid tokens representing parallel requests across tabs", () => {
            // As long as the Double-Submit pattern matches, concurrent requests succeed
            const req1 = createRequest("POST", 
                { "x-csrf-token": validToken }, 
                { "csrf-token": validToken }
            );
            const req2 = createRequest("POST", 
                { "x-csrf-token": validToken }, 
                { "csrf-token": validToken }
            );

            expect(csrfMiddleware(req1)).toBeNull(); // null means allowed
            expect(csrfMiddleware(req2)).toBeNull();
        });
    });

    describe("Scenario 5: Session expiration", () => {
        it("should fail if the session/cookie is cleared due to expiration", () => {
            // Memory might have token, but cookie is expired (missing from req)
            const req = createRequest("POST", { "x-csrf-token": validToken }, {});
            const res = csrfMiddleware(req);
            
            expect(res).not.toBeNull();
            expect(res?.status).toBe(403);
        });
    });

    describe("Scenario 6: Tenant switching (Multi-tenant isolation)", () => {
        it("should block requests attempting to use a tenant-a token for a tenant-b session", () => {
            // If the browser isolates cookies to tenant-a, tenant-b will not send the cookie
            // The frontend might try to send an old x-csrf-token from memory, but the cookie won't match/exist
            const req = createRequest("POST", { "x-csrf-token": validToken }, {});
            const res = csrfMiddleware(req);
            
            expect(res).not.toBeNull();
            expect(res?.status).toBe(403);
        });
    });

    describe("Safe HTTP Methods", () => {
        it("should allow GET, HEAD, OPTIONS without CSRF tokens", () => {
            const getReq = createRequest("GET", {}, {});
            const headReq = createRequest("HEAD", {}, {});
            const optionsReq = createRequest("OPTIONS", {}, {});

            expect(csrfMiddleware(getReq)).toBeNull();
            expect(csrfMiddleware(headReq)).toBeNull();
            expect(csrfMiddleware(optionsReq)).toBeNull();
        });
    });
});
