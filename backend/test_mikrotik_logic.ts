import { MikroTikService } from "./src/lib/mikrotik";

// Mock implementation of fetch
const mockFetch = (url: string, options: any) => {
    console.log(`Mock Fetch: ${options.method} ${url}`);
    
    if (url.endsWith("/rest/system/identity")) {
        return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(JSON.stringify([{ name: "Kenge-Router" }]))
        });
    }
    
    if (url.endsWith("/rest/system/resource")) {
        return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(JSON.stringify([{
                version: "6.7.12",
                "cpu-load": "5",
                "free-memory": "1000000",
                "total-memory": "2000000",
                uptime: "1d 2h 3m",
                "board-name": "RB4011iGS+",
                "architecture-name": "arm"
            }]))
        });
    }
    
    return Promise.reject(new Error(`Unknown mock endpoint: ${url}`));
};

// Replace global fetch with mock
(global as any).fetch = mockFetch;

// Mock prisma
const mockPrisma = {
    router: {
        update: () => Promise.resolve({}),
    },
    routerLog: {
        create: () => Promise.resolve({}),
    }
};

// We need to inject the mock prisma into the module
// Since it's a default export, this is tricky with ts-node.
// I'll modify the script to bypass the prisma calls if possible, 
// or just mock the entire module if I could.
// For now, let's just try to run it and see.

async function testMikroTikLogic() {
    console.log("Testing MikroTik Service Logic...");
    
    const conn = {
        host: "1.2.3.4",
        port: 80,
        username: "admin",
        password: "password"
    };
    
    const service = new MikroTikService(conn, "test-router-id");
    
    try {
        const result = await service.testConnection();
        console.log("Test Result:", JSON.stringify(result, null, 2));
        
        if (result.success && result.info?.identity === "Kenge-Router") {
            console.log("\n✅ MikroTik logic test PASSED");
        } else {
            console.log("\n❌ MikroTik logic test FAILED");
        }
    } catch (error) {
        console.error("Test Error:", error);
    }
}

// Note: This script might fail due to Prisma dependencies in MikroTikService constructor
// Let's see if we can run it.
testMikroTikLogic();
