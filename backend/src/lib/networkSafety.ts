/**
 * Network Safety — SSRF Protection
 *
 * SEC-005 FIX: Prevents Server-Side Request Forgery (SSRF) attacks by
 * validating router host addresses before making outbound HTTP connections.
 *
 * Attack scenario: A SUPER_ADMIN could enter the host field as:
 *   - "169.254.169.254" → AWS/DigitalOcean instance metadata (leaks cloud secrets)
 *   - "127.0.0.1"       → Loopback (reaches internal services)
 *   - "100.64.0.0/10"   → Shared address space / carrier NAT
 *   - "0.0.0.0"         → Wildcard bind address
 *
 * Fix: Only allow IPs in RFC 1918 private ranges, which is where real
 * MikroTik routers live (10.x.x.x, 172.16–31.x.x, 192.168.x.x).
 * Block all cloud metadata, loopback, link-local, and broadcast addresses.
 */

import { isIP } from 'net';

// ── Blocked / Disallowed Ranges ───────────────────────────────────────────────

interface CidrRange {
  start: number;
  end: number;
  label: string;
}

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function cidr(base: string, bits: number, label: string): CidrRange {
  const mask = (0xFFFFFFFF << (32 - bits)) >>> 0;
  const start = ipToInt(base) & mask;
  const end = start | (~mask >>> 0);
  return { start, end, label };
}

// Blocked ranges — these must NEVER be reachable from the MikroTik HTTP client
const BLOCKED_RANGES: CidrRange[] = [
  cidr('0.0.0.0',         8,  'This network (RFC 1122)'),
  cidr('10.0.0.0',        8,  'RFC 1918 private'),          // These are ALSO allowed — handled below
  cidr('100.64.0.0',      10, 'Shared address space (RFC 6598)'),
  cidr('127.0.0.0',       8,  'Loopback (RFC 1122)'),
  cidr('169.254.0.0',     16, 'Link-local / Cloud metadata (RFC 3927)'),
  cidr('172.16.0.0',      12, 'RFC 1918 private'),          // Also allowed
  cidr('192.0.0.0',       24, 'IETF Protocol Assignments'),
  cidr('192.0.2.0',       24, 'Documentation (TEST-NET-1)'),
  cidr('192.168.0.0',     16, 'RFC 1918 private'),          // Also allowed
  cidr('198.18.0.0',      15, 'Network interconnect testing'),
  cidr('198.51.100.0',    24, 'Documentation (TEST-NET-2)'),
  cidr('203.0.113.0',     24, 'Documentation (TEST-NET-3)'),
  cidr('224.0.0.0',       4,  'Multicast (RFC 3171)'),
  cidr('240.0.0.0',       4,  'Reserved (RFC 1112)'),
  cidr('255.255.255.255', 32, 'Broadcast'),
];

// Allowed private ranges for MikroTik routers
const ALLOWED_PRIVATE_RANGES: CidrRange[] = [
  cidr('10.0.0.0',    8,  'RFC 1918 Class A'),
  cidr('172.16.0.0',  12, 'RFC 1918 Class B'),
  cidr('192.168.0.0', 16, 'RFC 1918 Class C'),
];

// ── Validation Functions ──────────────────────────────────────────────────────

/**
 * Check if an IP address is in a private RFC 1918 range.
 */
export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) !== 4) return false;
  const int = ipToInt(ip);
  return ALLOWED_PRIVATE_RANGES.some((r) => int >= r.start && int <= r.end);
}

/**
 * Check if an IP address is explicitly blocked (cloud metadata, loopback, etc.).
 * Private RFC 1918 ranges are NOT blocked by this check (they are allowed for routers).
 */
export function isBlockedIp(ip: string): { blocked: boolean; reason?: string } {
  if (isIP(ip) !== 4) {
    return { blocked: true, reason: 'Only IPv4 addresses are supported for router hosts' };
  }
  const int = ipToInt(ip);

  // Allow private ranges first — MikroTik routers always live here
  if (ALLOWED_PRIVATE_RANGES.some((r) => int >= r.start && int <= r.end)) {
    return { blocked: false };
  }

  // Block all remaining special-purpose ranges
  for (const range of BLOCKED_RANGES) {
    if (int >= range.start && int <= range.end) {
      return { blocked: true, reason: `Address is in a blocked range: ${range.label}` };
    }
  }

  // Block public IPs — MikroTik routers should never be on public internet
  // (they should be accessed through WireGuard VPN tunnel)
  return {
    blocked: true,
    reason:
      'Public IP addresses are not allowed as router hosts. ' +
      'Use the private IP (e.g., 10.x.x.x, 192.168.x.x) or connect via WireGuard VPN.',
  };
}

/**
 * Validate a router host field before making any outbound HTTP request.
 * Throws an error if the host is unsafe to connect to.
 *
 * Usage:
 *   assertSafeRouterHost(router.host);  // throws if unsafe
 *   const response = await fetch(`http://${router.host}/...`);
 *
 * @param host - The IP address or hostname from the Router.host DB field
 * @throws Error if the host is not safe to connect to
 */
export function assertSafeRouterHost(host: string): void {
  if (!host || typeof host !== 'string') {
    throw new Error('SSRF: Router host is required');
  }

  const trimmed = host.trim().toLowerCase();

  // Block hostnames pointing to cloud metadata services
  const blockedHostnames = [
    'metadata.google.internal',
    'metadata.internal',
    'metadata',
    'instance-data',
  ];
  if (blockedHostnames.includes(trimmed)) {
    throw new Error(`SSRF: Blocked hostname "${host}" — cloud metadata service`);
  }

  // Validate it's a valid IPv4 address
  if (isIP(trimmed) !== 4) {
    throw new Error(
      `SSRF: Router host "${host}" is not a valid IPv4 address. ` +
      'Use the router\'s local IP address (e.g., 192.168.1.1).'
    );
  }

  const { blocked, reason } = isBlockedIp(trimmed);
  if (blocked) {
    throw new Error(`SSRF: Router host "${host}" is not allowed. ${reason}`);
  }
}

/**
 * Safe version of assertSafeRouterHost that returns a result instead of throwing.
 * Use in validation contexts where you want to return a 422 error to the client.
 */
export function isSafeRouterHost(host: string): { safe: boolean; error?: string } {
  try {
    assertSafeRouterHost(host);
    return { safe: true };
  } catch (err: any) {
    return { safe: false, error: err.message };
  }
}
