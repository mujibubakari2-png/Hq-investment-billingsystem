import * as dotenv from "dotenv";
dotenv.config();

const API_BASE_URL = "http://localhost:3001/api";
const AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZG1pbl91c2VyX2lkIiwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJTVVBFUl9BRE1JTiIsInRlbmFudElkIjoidGVuYW50X2FkbWluIiwiaWF0IjoxNzc1NjcxNzk5LCJleHAiOjE3NzU2NzUzOTl9.dzM6vPU1vtNVYrToDu4MmeGF0NPqmwLZZ6geebQ77Os";

// All payment methods to test
const paymentMethods = [
    "ZenoPay",
    "Haraka Pay",
    "Bank Deposit",
    "Mpesa Buy Goods Till",
    "M-Pesa Paybill",
    "PalmPesa"
];

async function testHotspotSTKPush() {
    console.log("🚀 Starting Hotspot STK Push Test for All Gateways...");

    const headers = {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        "Content-Type": "application/json"
    };

    try {
        // Setup: Get an active package ID
        const packagesRes = await fetch(`${API_BASE_URL}/packages`, { headers });
        const allPackages = await packagesRes.json();
        
        if (!Array.isArray(allPackages)) {
            console.error("Error: Expected an array of packages, but got:", allPackages);
            return;
        }

        const hotspotPackages = allPackages.filter((p: any) => p.type === "Hotspot" && p.status === "Active");
        
        if (hotspotPackages.length === 0) {
            console.error("Error: No active Hotspot packages found in the system.");
            return;
        }

        const testPackage = hotspotPackages[0];
        console.log(`Using Package: ${testPackage.name} (Price: ${testPackage.price})`);

        const testPhone = "255788111222";
        const testMac = "AA:BB:CC:DD:EE:FF";

        for (const method of paymentMethods) {
            console.log(`\n--- Testing [${method}] ---`);
            
            try {
                const purchaseRes = await fetch(`${API_BASE_URL}/hotspot/purchase`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        packageId: testPackage.id,
                        phone: testPhone,
                        macAddress: testMac,
                        method: method
                    })
                });

                const data = await purchaseRes.json();

                if (purchaseRes.ok && data.success) {
                    console.log(`✅ ${method} STK Push Triggered:`);
                    console.log(`   Message: ${data.message}`);
                    console.log(`   Reference: ${data.reference}`);
                    console.log(`   CheckoutRequestID: ${data.checkoutRequestId}`);
                    console.log(`   Status: ${data.status}`);
                } else {
                    console.log(`❌ ${method} Failed: ${data.message || data.error}`);
                }
            } catch (error: any) {
                console.error(`❌ Error testing ${method}:`, error.message);
            }
        }

        console.log("\n✨ Hotspot STK Push tests completed!");
    } catch (err: any) {
        console.error("❌ Fatal Error:", err.message);
    }
}

testHotspotSTKPush();
