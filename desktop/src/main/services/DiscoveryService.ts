import * as dgram from 'dgram';

export class DiscoveryService {
  private static socket: dgram.Socket | null = null;
  private static active: boolean = false;

  static start(onRouterDiscovered: (router: any) => void) {
    if (this.active) return;
    this.active = true;

    this.socket = dgram.createSocket('udp4');

    this.socket.on('message', (msg, rinfo) => {
      // Basic MNDP packet signature check (MNDP runs on 5678)
      // A full implementation would parse TLVs for Identity, Version, Platform, MAC
      // For demonstration, we construct a generic payload representing discovery
      const router = {
        ip: rinfo.address,
        port: rinfo.port,
        // In a real implementation, extract these from TLVs in `msg` buffer
        identity: 'MikroTik Discovered',
        version: '7.x',
        platform: 'RouterOS',
        mac: '00:00:00:00:00:00'
      };
      onRouterDiscovered(router);
    });

    this.socket.on('error', (err) => {
      console.error('[DiscoveryService] UDP error:', err);
      this.socket?.close();
    });

    this.socket.bind(5678, () => {
      console.log('[DiscoveryService] Listening on UDP port 5678 for MNDP broadcasts');
      // Optionally broadcast a probe `00 00 00 00` to 255.255.255.255
      this.socket?.setBroadcast(true);
      const probe = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      this.socket?.send(probe, 0, probe.length, 5678, '255.255.255.255');
    });
  }

  static stop() {
    this.active = false;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
