import jwt from "jsonwebtoken";
import * as dotenv from "dotenv";
dotenv.config();

const API_BASE_URL = "http://localhost:3001/api";
const ROUTER_ID = "cmnola88o00091ora4a0sixjy"; // Router "tandika"
const AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZG1pbl91c2VyX2lkIiwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJTVVBFUl9BRE1JTiIsInRlbmFudElkIjoidGVuYW50X2FkbWluIiwiaWF0IjoxNzc1NjcxNzk5LCJleHAiOjE3NzU2NzUzOTl9.dzM6vPU1vtNVYrToDu4MmeGF0NPqmwLZZ6geebQ77Os";

async function testWireGuardRemoteAccess() {
    console.log(`--- Testing Remote Access for Router: ${ROUTER_ID} ---`);

    const headers = {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        "Content-Type": "application/json"
    };

    try {
        // Step 1: Get WireGuard Config
        console.log("1. Fetching WireGuard Configuration...");
        const configRes = await fetch(`${API_BASE_URL}/routers/${ROUTER_ID}/wireguard`, { headers });
        
        if (!configRes.ok) {
            const errData = await configRes.json();
            throw new Error(`Failed to fetch config: ${JSON.stringify(errData)}`);
        }

        const config = await configRes.json();
        
        console.log("   ✅ Configuration Received:");
        console.log(`      Router Name: ${config.routerName}`);
        console.log(`      Tunnel IP: ${config.routerTunnelIp}`);
        console.log(`      Listen Port: ${config.listenPort}`);
        console.log(`      Public Key: ${config.routerPublicKey}`);
        console.log(`      Server Endpoint: ${config.serverEndpoint}`);

        // Step 2: Validating Script Parameters
        console.log("\n2. Validating Script Parameters...");
        const requiredFields = [
            "routerPrivateKey", "routerPublicKey", "serverPublicKey", 
            "presharedKey", "routerTunnelIp", "serverEndpoint"
        ];
        const missing = requiredFields.filter(field => !config[field]);
        
        if (missing.length > 0) {
            console.log(`   ❌ Missing Fields: ${missing.join(", ")}`);
        } else {
            console.log("   ✅ All required parameters for MikroTik script are present.");
        }

        // Step 3: Simulation
        console.log("\n3. Testing Backend Configuration Push (Dry Run Simulation)...");
        const pushRes = await fetch(`${API_BASE_URL}/routers/${ROUTER_ID}/wireguard`, {
            method: "POST",
            headers,
            body: JSON.stringify({ action: "push-config" })
        });

        const pushData = await pushRes.json();
        console.log(`   ℹ️  Push Result: ${pushData.message || pushData.error || "Done"}`);

    } catch (error: any) {
        console.error("❌ Test Failed:", error.message);
    }
}

testWireGuardRemoteAccess();
