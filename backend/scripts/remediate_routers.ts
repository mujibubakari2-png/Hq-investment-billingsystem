import { PrismaClient } from '../src/generated/prisma/index.js';
import { MikroTikService } from '../src/lib/mikrotik.js';
import { wireguardManager } from '../src/lib/wireguard.js';
import { decryptRouterFields } from '../src/lib/encryption.js';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting deployed routers remediation script...");
    const routers = await prisma.router.findMany();
    let fixedPeers = 0;
    let securedRouters = 0;
    let failedConnections = 0;

    const serverWgPublicKey = await wireguardManager.getServerPublicKey() || process.env.WG_SERVER_PUBLIC_KEY;
    if (!serverWgPublicKey) {
        throw new Error("Cannot remediate: Server WireGuard public key is unavailable.");
    }

    const wgServerIp = await wireguardManager.getServerIp();
    const subnetPrefix = wgServerIp.split(".").slice(0, 3).join(".");

    for (const rawRouter of routers) {
        const router = decryptRouterFields(rawRouter) as typeof rawRouter;
        console.log(`\n--- Remediating Router: ${router.name} (ID: ${router.id}) ---`);
        
        try {
            const service = new MikroTikService({
                host: router.host,
                port: router.apiPort || router.port || 8728,
                username: router.username || 'admin',
                password: router.password || ''
            }, router.id, router.tenantId || "");

            // 1. Check and fix wg-hq peer
            const peersResponse = await service.apiRequestPublic("/interface/wireguard/peers").catch(() => null);
            let peerFixed = false;
            if (Array.isArray(peersResponse)) {
                const peer = peersResponse.find((p: any) => p.interface === "wg-hq" && p["public-key"] === serverWgPublicKey);
                if (!peer || !peer["allowed-address"]?.includes(`${subnetPrefix}.0/24`)) {
                    console.log("  [!] Peer missing or misconfigured. Fixing...");
                    // Delete old peers
                    for (const p of peersResponse) {
                        if (p.interface === "wg-hq" || p.comment?.includes("HQ INVESTMENT")) {
                            await service.apiRequestPublic(`/interface/wireguard/peers/${p[".id"]}`, "DELETE").catch(() => {});
                        }
                    }
                    
                    const serverEndpoint = router.wgServerEndpoint || process.env.WG_SERVER_ENDPOINT || process.env.SERVER_PUBLIC_IP || "vpn.billing-system.local";
                    const serverPort = parseInt(process.env.WG_SERVER_PORT || "51820");

                    await service.apiRequestPublic("/interface/wireguard/peers", "PUT", {
                        interface: "wg-hq",
                        "public-key": serverWgPublicKey,
                        ...(router.wgPresharedKey ? { "preshared-key": router.wgPresharedKey } : {}),
                        "allowed-address": `${subnetPrefix}.0/24`,
                        "endpoint-address": serverEndpoint,
                        "endpoint-port": String(serverPort),
                        "persistent-keepalive": "25s",
                        comment: "HQ INVESTMENT ISP Server"
                    });
                    
                    peerFixed = true;
                    fixedPeers++;
                    console.log("  [+] WireGuard peer fixed.");
                } else {
                    console.log("  [+] WireGuard peer is OK.");
                }
            }

            // Give the tunnel a few seconds to establish if we just fixed it
            if (peerFixed) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            // 2. Verify VPN connectivity
            console.log("  [*] Verifying VPN connectivity...");
            let isVpnUp = false;
            try {
                // If the router.host is already the tunnel IP, the connection itself proves VPN is up.
                // Otherwise, try connecting to the tunnel IP explicitly.
                if (router.wgTunnelIp) {
                    const vpnService = new MikroTikService({
                        host: router.wgTunnelIp,
                        port: router.apiPort || router.port || 8728,
                        username: router.username || 'admin',
                        password: router.password || ''
                    }, router.id, router.tenantId || "");
                    await vpnService.apiRequestPublic("/system/identity");
                    isVpnUp = true;
                }
            } catch (err) {
                console.log(`  [!] VPN connectivity check failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            // 3. Remove LAN bridge from hq-mgmt SAFELY
            if (isVpnUp) {
                console.log("  [+] VPN is UP. Safe to secure management interfaces.");
                const hqMgmtMembers = await service.apiRequestPublic("/interface/list/member").catch(() => null);
                if (Array.isArray(hqMgmtMembers)) {
                    const lanBridgeName = "bridge-lan"; // Standard name used in provisioning
                    const lanMember = hqMgmtMembers.find((m: any) => m.list === "hq-mgmt" && m.interface === lanBridgeName);
                    if (lanMember) {
                        await service.apiRequestPublic(`/interface/list/member/${lanMember[".id"]}`, "DELETE");
                        console.log(`  [+] Removed ${lanBridgeName} from hq-mgmt list.`);
                        securedRouters++;
                    } else {
                         console.log(`  [+] ${lanBridgeName} is not in hq-mgmt list. Already secure.`);
                    }
                }
            } else {
                console.log("  [-] VPN is DOWN or unreachable. SKIPPING removal of LAN bridge from hq-mgmt to prevent lockout.");
            }

            // 4. Update NAT Rules (ensure WAN list exists first)
            console.log("  [*] Fixing NAT rules...");
            const routes = await service.apiRequestPublic("/ip/route").catch(() => []);
            let wanInterface = "ether1";
            if (Array.isArray(routes)) {
                const dflt = routes.find((r: any) => r["dst-address"] === "0.0.0.0/0" && !r.disabled && r.active !== "false");
                if (dflt?.interface) wanInterface = dflt.interface;
            }

            await service.apiRequestPublic("/interface/list", "PUT", { name: "WAN", comment: "HQ INVESTMENT WAN" }).catch(()=>null);
            const listMembers = await service.apiRequestPublic("/interface/list/member").catch(()=>[]);
            const wanMember = Array.isArray(listMembers) ? listMembers.find((m: any) => m.list === "WAN" && m.interface === wanInterface) : null;
            if (!wanMember) {
                await service.apiRequestPublic("/interface/list/member", "PUT", { list: "WAN", interface: wanInterface, comment: "HQ INVESTMENT WAN port" }).catch(()=>null);
            }

            const natRules = await service.apiRequestPublic("/ip/firewall/nat").catch(() => null);
            if (Array.isArray(natRules)) {
                const hqNat = natRules.find((n: any) => n.comment?.includes("HQ INVESTMENT") && n.action === "masquerade" && !n["out-interface-list"]);
                if (hqNat) {
                    await service.apiRequestPublic(`/ip/firewall/nat/${hqNat[".id"]}`, "PATCH", { "out-interface-list": "WAN" });
                    console.log("  [+] Fixed NAT masquerade rule (added out-interface-list=WAN).");
                }
            }

        } catch (err) {
            console.error(`  [!] Failed to remediate router ${router.name}:`, err instanceof Error ? err.message : String(err));
            failedConnections++;
        }
    }

    console.log("\n--- Remediation Summary ---");
    console.log(`Routers checked: ${routers.length}`);
    console.log(`Peers fixed: ${fixedPeers}`);
    console.log(`Routers secured (LAN mgmt removed): ${securedRouters}`);
    console.log(`Failed connections: ${failedConnections}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
