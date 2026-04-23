import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const wireguardManager = {
    getServerIp: async (): Promise<string> => {
        try {
            const { stdout } = await execAsync("ip -4 addr show wg0");
            const match = stdout.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
            if (match && match[1]) {
                return match[1];
            }
            return "10.0.0.1";
        } catch (error) {
            return "10.0.0.1";
        }
    },

    getServerPublicKey: async (): Promise<string | null> => {
        try {
            const { stdout } = await execAsync('sudo wg show wg0 public-key');
            return stdout.trim();
        } catch (error) {
            console.error("[WireGuard Error] Failed to get server public key:", error);
            return null;
        }
    },

    /**
     * Add a new peer to the WireGuard interface (wg0)
     */
    addPeer: async (publicKey: string, allowedIp: string) => {
        try {
            // Validate input
            if (!publicKey || !allowedIp) {
                throw new Error("Public key and Allowed IP are required");
            }

            // Use 'wg set' for runtime update and 'wg-quick save' for persistence
            const addCmd = `sudo wg set wg0 peer "${publicKey}" allowed-ips ${allowedIp}/32`;
            const saveCmd = `sudo wg-quick save wg0`;

            console.log(`[WireGuard] Adding peer: ${publicKey} with IP ${allowedIp}`);
            
            await execAsync(addCmd);
            await execAsync(saveCmd);

            return { success: true, message: `Peer ${allowedIp} added successfully` };
        } catch (error: any) {
            console.error("[WireGuard Error] Failed to add peer:", error);
            throw error;
        }
    },

    /**
     * Remove a peer from the WireGuard interface
     */
    removePeer: async (publicKey: string) => {
        try {
            const removeCmd = `sudo wg set wg0 peer "${publicKey}" remove`;
            const saveCmd = `sudo wg-quick save wg0`;

            await execAsync(removeCmd);
            await execAsync(saveCmd);

            return { success: true, message: `Peer removed successfully` };
        } catch (error: any) {
            console.error("[WireGuard Error] Failed to remove peer:", error);
            throw error;
        }
    },

    /**
     * List all current peers
     */
    listPeers: async () => {
        try {
            const { stdout } = await execAsync('sudo wg show wg0 dump');
            const lines = stdout.trim().split('\n').slice(1); // Skip the interface line
            
            return lines.map(line => {
                const parts = line.split('\t');
                return {
                    publicKey: parts[0],
                    endpoint: parts[2],
                    allowedIps: parts[3],
                    latestHandshake: parts[4],
                    transferRx: parts[5],
                    transferTx: parts[6]
                };
            });
        } catch (error) {
            console.error("[WireGuard Error] Failed to list peers:", error);
            return [];
        }
    }
};
