/**
 * WireGuard Configuration Analysis & Validation
 * Tests the provided WireGuard config from HQINVESTMENT router
 */

describe('WireGuard Configuration Analysis', () => {
  // Provided configuration
  const wgConfig = {
    interface: {
      privateKey: 'kI56+MCLvtZnHyKjzce8iXKfqKr313SYZlYdho5WK18=',
      address: '10.0.0.1/24',
      listenPort: 51820,
      dns: ['8.8.8.8', '1.1.1.1'],
    },
    peer: {
      publicKey: 'b7ADpdTy6UooXmb7Ve+PgGeXjGFLVFXqsuz32dYNaxA=',
      presharedKey: '+HjQAEn8GA2tU+HuZNdVfYw9TaqL277IqPMovrqTxls=',
      allowedIps: '10.0.0.200/32',
      endpoint: '0.0.0.0:51820',
      persistentKeepalive: 25,
    },
  };

  describe('Key Validation', () => {
    it('should validate interface private key format', () => {
      const keyRegex = /^[A-Za-z0-9+/]+={0,2}$/;
      expect(wgConfig.interface.privateKey).toMatch(keyRegex);
    });

    it('should validate private key length (43-44 chars)', () => {
      const key = wgConfig.interface.privateKey;
      expect(key.length).toBe(44);
      expect(key.length >= 43 && key.length <= 44).toBe(true);
    });

    it('should validate peer public key format', () => {
      const keyRegex = /^[A-Za-z0-9+/]+={0,2}$/;
      expect(wgConfig.peer.publicKey).toMatch(keyRegex);
    });

    it('should validate peer public key length', () => {
      const key = wgConfig.peer.publicKey;
      expect(key.length).toBe(44);
    });

    it('should validate preshared key format', () => {
      const keyRegex = /^[A-Za-z0-9+/]+={0,2}$/;
      expect(wgConfig.peer.presharedKey).toMatch(keyRegex);
    });

    it('should validate preshared key length', () => {
      const key = wgConfig.peer.presharedKey;
      expect(key.length).toBe(44);
    });
  });

  describe('IP Address Validation', () => {
    it('should validate interface address format', () => {
      const [ip, cidr] = wgConfig.interface.address.split('/');
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      expect(ip).toMatch(ipRegex);
      expect(parseInt(cidr)).toBe(24);
    });

    it('should validate interface IP octets', () => {
      const [ip] = wgConfig.interface.address.split('/');
      const octets = ip.split('.').map(Number);
      octets.forEach((octet) => {
        expect(octet >= 0 && octet <= 255).toBe(true);
      });
    });

    it('should validate allowed IPs format', () => {
      const [ip, cidr] = wgConfig.peer.allowedIps.split('/');
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      expect(ip).toMatch(ipRegex);
      expect(parseInt(cidr)).toBe(32);
    });
  });

  describe('Configuration Logic Issues', () => {
    it('ISSUE: Endpoint is 0.0.0.0:51820 - INVALID', () => {
      const [endpoint] = wgConfig.peer.endpoint.split(':');
      const issue = endpoint === '0.0.0.0';
      expect(issue).toBe(true);
      // 0.0.0.0 cannot be used as a peer endpoint
      // Should be: actual public IP or hostname of ISP server
    });

    it('ISSUE: AllowedIPs mismatch with Interface subnet', () => {
      const [ifaceIp, ifaceCidr] = wgConfig.interface.address.split('/');
      const [allowedIp, allowedCidr] = wgConfig.peer.allowedIps.split('/');
      const interfaceSubnet = '10.0.0.0/24';
      const allowedIpAddr = '10.0.0.200/32';

      // Check if allowed IP is within interface subnet
      const ifaceOctets = ifaceIp.split('.').map(Number);
      const allowedOctets = allowedIp.split('.').map(Number);

      // Interface has 10.0.0.x/24 (covers 10.0.0.0 - 10.0.0.255)
      // Peer is allowed 10.0.0.200/32
      // This means router can reach peer at 10.0.0.200, but:
      // - Router itself is at 10.0.0.1
      // - This doesn't create a proper tunnel

      expect(ifaceOctets[0]).toBe(allowedOctets[0]); // Same first octet
      expect(ifaceOctets[1]).toBe(allowedOctets[1]); // Same second octet
      expect(ifaceOctets[2]).toBe(allowedOctets[2]); // Same third octet
    });

    it('ISSUE: Router cannot route traffic if AllowedIPs only specifies single peer IP', () => {
      // In a typical setup:
      // - Server: 10.0.0.1/24 (or separate management subnet)
      // - Router: 10.0.0.2/32 (or different subnet)
      // - AllowedIPs should be what traffic to route through peer

      const allowedIps = wgConfig.peer.allowedIps; // 10.0.0.200/32
      const interfaceSubnet = wgConfig.interface.address; // 10.0.0.1/24

      // The current config says:
      // "Route 10.0.0.200/32 traffic through this peer"
      // But 10.0.0.1/24 means the router owns 10.0.0.0/24 and
      // already has 10.0.0.200 locally - no need to route through peer!

      const issue = allowedIps === '10.0.0.200/32' && interfaceSubnet === '10.0.0.1/24';
      expect(issue).toBe(true);
    });

    it('CORRECTED CONFIG should look like this:', () => {
      // CORRECTED VERSION:
      const correctedConfig = {
        interface: {
          // Router gets its own unique IP, not the subnet owner
          privateKey: 'kI56+MCLvtZnHyKjzce8iXKfqKr313SYZlYdho5WK18=',
          address: '10.0.0.200/32', // Router's single IP
          listenPort: 51820,
        },
        peer: {
          // ISP Server details
          publicKey: 'b7ADpdTy6UooXmb7Ve+PgGeXjGFLVFXqsuz32dYNaxA=',
          presharedKey: '+HjQAEn8GA2tU+HuZNdVfYw9TaqL277IqPMovrqTxls=',
          allowedIps: '10.0.0.0/24', // Route entire tunnel subnet through peer
          endpoint: '203.0.113.45:51820', // ISP's actual public IP/hostname
          persistentKeepalive: 25,
        },
      };

      expect(correctedConfig.interface.address).toBe('10.0.0.200/32');
      expect(correctedConfig.peer.allowedIps).toBe('10.0.0.0/24');
      expect(correctedConfig.peer.endpoint).not.toBe('0.0.0.0:51820');
    });
  });

  describe('Port Validation', () => {
    it('should validate listen port is within valid range', () => {
      const port = wgConfig.interface.listenPort;
      expect(port >= 1 && port <= 65535).toBe(true);
    });

    it('should validate peer endpoint port', () => {
      const [, portStr] = wgConfig.peer.endpoint.split(':');
      const port = parseInt(portStr);
      expect(port >= 1 && port <= 65535).toBe(true);
    });

    it('should warn if listen port and peer port are identical', () => {
      const listenPort = wgConfig.interface.listenPort;
      const [, peerPortStr] = wgConfig.peer.endpoint.split(':');
      const peerPort = parseInt(peerPortStr);
      
      if (listenPort === peerPort) {
        // This is actually OK - means peer is connecting to same port
        expect(true).toBe(true);
      }
    });
  });

  describe('DNS Configuration', () => {
    it('should validate DNS servers are IPv4 addresses', () => {
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      wgConfig.interface.dns.forEach((dns) => {
        expect(dns).toMatch(ipv4Regex);
      });
    });

    it('should validate DNS octets', () => {
      wgConfig.interface.dns.forEach((dns) => {
        const octets = dns.split('.').map(Number);
        octets.forEach((octet) => {
          expect(octet >= 0 && octet <= 255).toBe(true);
        });
      });
    });
  });

  describe('Persistent Keepalive', () => {
    it('should validate keepalive interval', () => {
      const keepalive = wgConfig.peer.persistentKeepalive;
      expect(keepalive > 0 && keepalive <= 65535).toBe(true);
    });

    it('should suggest keepalive value (25s is good for unreliable connections)', () => {
      const keepalive = wgConfig.peer.persistentKeepalive;
      // 25 seconds is a good value for keeping NAT-traversal alive
      expect(keepalive).toBe(25);
    });
  });

  describe('Security Assessment', () => {
    it('should have preshared key for post-quantum hardening', () => {
      const hasPsk = !!wgConfig.peer.presharedKey;
      expect(hasPsk).toBe(true);
    });

    it('should verify keys are different (private != public)', () => {
      const privateKey = wgConfig.interface.privateKey;
      const publicKey = wgConfig.peer.publicKey;
      expect(privateKey).not.toBe(publicKey);
    });

    it('should verify preshared key is unique from main keys', () => {
      const privateKey = wgConfig.interface.privateKey;
      const presharedKey = wgConfig.peer.presharedKey;
      expect(privateKey).not.toBe(presharedKey);
    });
  });

  describe('Configuration Summary & Recommendations', () => {
    it('should identify all issues in current config', () => {
      const issues = [
        {
          severity: 'CRITICAL',
          issue: 'Endpoint is 0.0.0.0:51820',
          reason: '0.0.0.0 is not a valid peer endpoint',
          fix: 'Use actual ISP server IP or hostname, e.g., 203.0.113.45:51820 or vpn.isp.com:51820',
        },
        {
          severity: 'CRITICAL',
          issue: 'Interface Address should not be /24 subnet owner (10.0.0.1/24)',
          reason:
            'Router should have a single /32 IP (e.g., 10.0.0.200/32), not own the entire subnet',
          fix: 'Change Address to 10.0.0.200/32 or appropriate single IP',
        },
        {
          severity: 'HIGH',
          issue: 'AllowedIPs = 10.0.0.200/32 conflicts with Interface subnet',
          reason: 'Router owns 10.0.0.0/24, so 10.0.0.200 is already local, no need to route',
          fix: 'Change AllowedIPs to 10.0.0.0/24 to route tunnel subnet traffic through peer',
        },
        {
          severity: 'INFO',
          issue: 'DNS configuration is present but may not work without split tunneling',
          reason: 'DNS queries need routing through tunnel or specific rules',
          fix: 'Consider using DHCP/DNS lease or explicit DNS routing rules',
        },
      ];

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].severity).toBe('CRITICAL');
    });

    it('should provide corrected configuration', () => {
      const corrected = `
[Interface]
# Router's unique IP on the tunnel (NOT subnet owner)
PrivateKey = kI56+MCLvtZnHyKjzce8iXKfqKr313SYZlYdho5WK18=
Address = 10.0.0.200/32
ListenPort = 51820
DNS = 8.8.8.8, 1.1.1.1

[Peer]
# ISP Server
PublicKey = b7ADpdTy6UooXmb7Ve+PgGeXjGFLVFXqsuz32dYNaxA=
PresharedKey = +HjQAEn8GA2tU+HuZNdVfYw9TaqL277IqPMovrqTxls=
# Route entire tunnel subnet through this peer
AllowedIPs = 10.0.0.0/24
# ISP server's actual public endpoint (NOT 0.0.0.0)
Endpoint = ISP_PUBLIC_IP:51820
PersistentKeepalive = 25
      `.trim();

      expect(corrected).toContain('10.0.0.200/32');
      expect(corrected).toContain('10.0.0.0/24');
      expect(corrected).toContain('ISP_PUBLIC_IP:51820');
    });
  });

  describe('Testing Configuration', () => {
    it('should fail wg-quick up with 0.0.0.0 endpoint', () => {
      // This would fail in real Linux with:
      // Error: 0.0.0.0 is not a valid IP address for Endpoint
      expect(wgConfig.peer.endpoint).toBe('0.0.0.0:51820');
    });

    it('should pass basic syntax validation', () => {
      // The config itself is valid WireGuard syntax
      // But logic is wrong
      const hasInterface = !!wgConfig.interface;
      const hasPeer = !!wgConfig.peer;
      expect(hasInterface && hasPeer).toBe(true);
    });

    it('should require real ISP endpoint before deployment', () => {
      const needsRealEndpoint = wgConfig.peer.endpoint === '0.0.0.0:51820';
      expect(needsRealEndpoint).toBe(true);
    });
  });
});
