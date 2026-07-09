#!/usr/bin/env node
/**
 * WireGuard Configuration Model - Visual Analysis
 * 
 * This script generates a comprehensive visual breakdown of:
 * 1. Configuration generation flow
 * 2. State transitions
 * 3. Data transformations
 * 4. Security checkpoints
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(color, text) {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

function section(title) {
  console.log(`\n${colors.bright}${colors.cyan}${'═'.repeat(80)}${colors.reset}`);
  log('bright', `${title}`);
  console.log(`${colors.cyan}${'═'.repeat(80)}${colors.reset}\n`);
}

console.clear();
log('bright', 'WireGuard Configuration Model - Deep Analysis');
console.log('Generated: 2026-07-09\n');

// ═══════════════════════════════════════════════════════════════════════════════
section('1. CONFIGURATION REQUEST FLOW');
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`
${colors.cyan}Client (Router Device)${colors.reset}
  ${colors.yellow}│${colors.reset}
  ${colors.yellow}├─→ GET /api/routers/[id]/wireguard${colors.reset}
  ${colors.yellow}│${colors.reset}
  ${colors.yellow}▼${colors.reset}

${colors.blue}Next.js API Handler${colors.reset}
  ${colors.yellow}│${colors.reset}
  ${colors.yellow}├─→ requirePermission(req, "routers:read")${colors.reset}
  ${colors.yellow}│   ${colors.red}✓ Check JWT token${colors.reset}
  ${colors.yellow}│   ${colors.red}✓ Verify role/permissions${colors.reset}
  ${colors.yellow}│${colors.reset}
  ${colors.yellow}├─→ getTenantClient(userPayload)${colors.reset}
  ${colors.yellow}│   ${colors.red}✓ Isolate database per tenant${colors.reset}
  ${colors.yellow}│   ${colors.red}✓ Tenant filter on all queries${colors.reset}
  ${colors.yellow}│${colors.reset}
  ${colors.yellow}├─→ canAccessTenant(user, router.tenantId)${colors.reset}
  ${colors.yellow}│   ${colors.red}✓ Double-check tenant match${colors.reset}
  ${colors.yellow}│${colors.reset}
  ${colors.yellow}▼${colors.reset}

${colors.green}Router Data (Decrypted)${colors.reset}
  ${colors.yellow}│${colors.reset}
  ${colors.yellow}├─ wgPrivateKey: "${colors.magenta}enc:v1:...${colors.reset}" → decrypted via AES-256-GCM
  ${colors.yellow}├─ wgPublicKey: "${colors.magenta}b7AD...${colors.reset}"
  ${colors.yellow}├─ wgTunnelIp: "${colors.magenta}10.200.0.200${colors.reset}"
  ${colors.yellow}├─ wgEnabled: ${colors.magenta}false${colors.reset}
  ${colors.yellow}└─ wgConfiguredAt: ${colors.magenta}null${colors.reset}
  ${colors.yellow}│${colors.reset}
  ${colors.yellow}▼${colors.reset}

${colors.green}Decision: Keys Exist?${colors.reset}
  ${colors.yellow}│${colors.reset}
  ${colors.yellow}├─→ YES: Skip generation, verify server pubkey
  ${colors.yellow}│${colors.reset}
  ${colors.yellow}└─→ NO: Generate new keys${colors.reset}
       ${colors.yellow}│${colors.reset}
       ${colors.yellow}├─→ wg genkey${colors.reset}
       ${colors.yellow}│   Output: "${colors.magenta}kI56+MCLvtZnHyKjzce8iXKfqKr313SYZlYdho5WK18=${colors.reset}"
       ${colors.yellow}│${colors.reset}
       ${colors.yellow}├─→ echo | wg pubkey${colors.reset}
       ${colors.yellow}│   Output: "${colors.magenta}b7ADpdTy6UooXmb7Ve+PgGeXjGFLVFXqsuz32dYNaxA=${colors.reset}"
       ${colors.yellow}│${colors.reset}
       ${colors.yellow}├─→ wg show wg0 public-key${colors.reset}
       ${colors.yellow}│   Output: "${colors.magenta}ISP_SERVER_PUBKEY${colors.reset}"
       ${colors.yellow}│${colors.reset}
       ${colors.yellow}└─→ ${colors.cyan}ENCRYPT & SAVE${colors.reset}
`);

// ═══════════════════════════════════════════════════════════════════════════════
section('2. TUNNEL IP ASSIGNMENT ALGORITHM');
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`
${colors.cyan}INPUT:${colors.reset}
  Server WireGuard IP: 10.200.0.1
  Subnet Prefix: 10.200.0

${colors.yellow}STEP 1: Extract Subnet${colors.reset}
  wgServerIp = await wireguardManager.getServerIp()
  // Command: ip -4 addr show wg0
  // Output: inet 10.200.0.1/24
  subnetPrefix = "10.200.0"

${colors.yellow}STEP 2: Query Used IPs${colors.reset}
  SELECT wgTunnelIp FROM routers 
  WHERE id != current_router 
  AND wgTunnelIp IS NOT NULL
  
  Result: ["10.200.0.200", "10.200.0.201", "10.200.0.203"]

${colors.yellow}STEP 3: Find First Free${colors.reset}
  for (let i = 200; i < 250; i++) {
    if (!usedIps.includes(\`10.200.0.\${i}\`)) {
      tunnelIp = \`10.200.0.\${i}\`;
      break;
    }
  }
  
  Result: 10.200.0.202 (first gap)

${colors.yellow}STEP 4: Persist to DB${colors.reset}
  db.router.update({
    where: { id: routerId },
    data: { wgTunnelIp: "10.200.0.202" }
  })
  
  ${colors.green}✓ Auto-assigned!${colors.reset}

${colors.cyan}OUTPUT:${colors.reset}
  routerTunnelIp: 10.200.0.202
  serverTunnelIp: 10.200.0.1
  Available: .203 to .250 (47 more routers)
`);

// ═══════════════════════════════════════════════════════════════════════════════
section('3. ENCRYPTION & DECRYPTION CYCLE');
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`
${colors.cyan}PLAINTEXT (In Memory)${colors.reset}
  ┌─────────────────────────────────────┐
  │ wgPrivateKey: "kI56+MCLvtZn...=    │
  │ wgPresharedKey: "+HjQAEn8GA2t...=  │
  │ password: "MySecretPassword"       │
  │ radiusSecret: "shared-secret-xyz"  │
  └─────────────────────────────────────┘
           │
           ▼
${colors.blue}encryptRouterFields()${colors.reset}
  For each sensitive field:
    1. Generate random 96-bit IV
    2. Create AES-256-GCM cipher
    3. Encrypt plaintext with IV + key
    4. Get authentication tag
    5. Format: "enc:v1:<IV>:<TAG>:<CIPHERTEXT>"
       
           │
           ▼
${colors.cyan}ENCRYPTED (Database)${colors.reset}
  ┌────────────────────────────────────────────────┐
  │ wgPrivateKey: enc:v1:a1b2c3:d4e5f6:ghij...   │
  │ wgPresharedKey: enc:v1:x7y8z9:k1l2m3:nopq... │
  │ password: enc:v1:s4t5u6:v7w8x9:yz01...      │
  │ radiusSecret: enc:v1:a2b3c4:d5e6f7:gh08...   │
  └────────────────────────────────────────────────┘
           │
           ▼
${colors.blue}decryptRouterFields()${colors.reset}
  For each encrypted field:
    1. Extract IV, auth tag, ciphertext from format
    2. Create AES-256-GCM decipher
    3. Set authentication tag
    4. Decrypt ciphertext with IV + key
    5. Verify authentication (detects tampering)
       
           │
           ▼
${colors.cyan}PLAINTEXT (In Memory)${colors.reset}
  ┌─────────────────────────────────────┐
  │ wgPrivateKey: "kI56+MCLvtZn...=    │
  │ wgPresharedKey: "+HjQAEn8GA2t...=  │
  │ password: "MySecretPassword"       │
  │ radiusSecret: "shared-secret-xyz"  │
  └─────────────────────────────────────┘
  
  ${colors.green}✓ Authenticated Encryption (AEAD)${colors.reset}
  ${colors.green}✓ Detects any tampering${colors.reset}
  ${colors.green}✓ Key from FIELD_ENCRYPTION_KEY env${colors.reset}
`);

// ═══════════════════════════════════════════════════════════════════════════════
section('4. STATE MACHINE');
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`
${colors.cyan}┌─── INITIAL ───┐${colors.reset}
│                │
│  wgEnabled: false      
│  wgPrivateKey: null
│  wgTunnelIp: null
│  wgConfiguredAt: null
│
└────────────────────┐
                     │ GET /wireguard
                     ▼
${colors.cyan}┌─── GENERATED ───┐${colors.reset}
│                 │
│  wgPrivateKey: "kI56+..."
│  wgPublicKey: "b7AD+..."
│  wgTunnelIp: "10.200.0.200"
│  wgPresharedKey: "+HjQ+..."
│  wgEnabled: false
│
└────────────────────┐
                     │ POST /wireguard
                     │ action="activate"
                     ▼
${colors.cyan}┌─── ACTIVATED ───┐${colors.reset}
│                │
│  wgEnabled: true
│  wgConfiguredAt: "2026-07-09T..."
│
│  Actions:
│  1. Add peer to server: wg set wg0 peer ...
│  2. Push to MikroTik: script deploy
│  3. Persist config: wg-quick save wg0
│
└────────────────────┐
                     │ (Router connects)
                     ▼
${colors.cyan}┌─── CONNECTED ───┐${colors.reset}
│                 │
│  tunnelActive: true
│  lastHandshakeSeconds: 5
│
│  Monitored by:
│  - wg show wg0 dump
│  - Check handshake age
│  - Alert if stale (> 180s)
│
└────────────────────┐
                     │ POST /wireguard
                     │ action="deactivate"
                     ▼
${colors.cyan}┌─ DEACTIVATED ──┐${colors.reset}
│               │
│  wgEnabled: false
│  Actions:
│  1. Remove peer: wg set wg0 peer ... remove
│  2. Persist: wg-quick save wg0
│  3. Clear MikroTik config
│
└────────────────────┘
`);

// ═══════════════════════════════════════════════════════════════════════════════
section('5. SECURITY CHECKPOINTS');
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`
${colors.bright}API REQUEST${colors.reset}
  ${colors.green}✓${colors.reset} Check: requirePermission("routers:read")
     └─ JWT validation
     └─ Role/permission check
     
  ${colors.green}✓${colors.reset} Check: getTenantClient(user)
     └─ Database query isolation
     └─ All subsequent queries filtered by tenant
     
  ${colors.green}✓${colors.reset} Check: canAccessTenant(user, router.tenantId)
     └─ Double-check user's tenant matches router's tenant

${colors.bright}SYSTEM CALLS${colors.reset}
  ${colors.green}✓${colors.reset} Use execFile() not exec()
     └─ No shell invocation
     └─ Arguments NOT interpolated
     └─ Protection against command injection
     
  ${colors.green}✓${colors.reset} Validate keys before ANY command
     └─ Regex: /^[A-Za-z0-9+/]+={0,2}$/
     └─ Length: 43-44 characters
     └─ Throw error if invalid
     
  ${colors.green}✓${colors.reset} Validate IPs before ANY command
     └─ Regex: /^(\d{1,3}\.){3}\d{1,3}$/
     └─ Octet range: 0-255
     └─ Throw error if invalid

${colors.bright}SENSITIVE DATA${colors.reset}
  ${colors.green}✓${colors.reset} Encrypt wgPrivateKey at rest
     └─ Algorithm: AES-256-GCM
     └─ Format: enc:v1:<IV>:<TAG>:<CIPHERTEXT>
     └─ Automatic on save, automatic on load
     
  ${colors.green}✓${colors.reset} Encrypt wgPresharedKey at rest
     └─ Same encryption as private key
     
  ${colors.green}✓${colors.reset} Temp file for PSK during system calls
     └─ Write to /tmp/wg-psk-<timestamp>.tmp
     └─ Set mode 0o600 (owner read/write only)
     └─ Delete after use (even on error: finally block)
     
  ${colors.green}✓${colors.reset} Never log secrets
     └─ Log errors without key content
     └─ Redact keys in API responses (unless SUPER_ADMIN)

${colors.bright}TUNNEL HEALTH${colors.reset}
  ${colors.green}✓${colors.reset} Monitor handshake age
     └─ Command: wg show wg0 latest-handshakes
     └─ Alert if no handshake in 180 seconds (3 minutes)
     └─ Detect dead tunnels
     
  ${colors.green}✓${colors.reset} List all peers
     └─ Command: wg show wg0 dump
     └─ Check endpoint connectivity
     └─ Monitor data transfer

${colors.bright}FALLBACK RISKS${colors.reset}
  ${colors.yellow}⚠️${colors.reset} Server endpoint can fall back to "0.0.0.0"
     └─ Invalid endpoint (not a real host)
     └─ Should enforce WG_SERVER_ENDPOINT env var
     └─ Or require router.wgServerEndpoint explicitly
     
  ${colors.yellow}⚠️${colors.reset} No PSK rotation policy
     └─ PSK generated once, never changed
     └─ Risk: Long-lived PSK compromise
     └─ Recommendation: Rotate every 90 days
`);

// ═══════════════════════════════════════════════════════════════════════════════
section('6. CONFIGURATION RESPONSE STRUCTURE');
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`
${colors.cyan}GET /api/routers/[id]/wireguard Response:${colors.reset}

{
  // Router Identity
  "routerId": "router-123",
  "routerName": "Router A",
  "routerHost": "192.168.1.1",
  
  // Keys (sensitive)
  "routerPrivateKey": "kI56+MCLvtZnHyKjzce8iXKfqKr313SYZlYdho5WK18=",
  "routerPublicKey": "b7ADpdTy6UooXmb7Ve+PgGeXjGFLVFXqsuz32dYNaxA=",
  "serverPublicKey": "ISP_SERVER_PUBLIC_KEY",
  "presharedKey": "+HjQAEn8GA2tU+HuZNdVfYw9TaqL277IqPMovrqTxls=",
  
  // Tunnel Configuration
  "routerTunnelIp": "10.200.0.200",        // Router's single IP
  "serverTunnelIp": "10.200.0.1",          // Server's tunnel IP
  "listenPort": 51820,
  "serverEndpoint": "vpn.isp.com:51820",   // Where router connects
  "serverPort": 51820,
  
  // Status
  "enabled": false,
  "tunnelActive": false,
  "lastHandshakeSeconds": null,
  "configuredAt": null,
  "tunnelStatusMessage": "WireGuard not yet activated",
}

${colors.cyan}POST /api/routers/[id]/wireguard Request:${colors.reset}

{
  "action": "activate"   // or "deactivate", "push-config", "reset-host"
}

${colors.cyan}POST Response:${colors.reset}

{
  "success": true,
  "message": "WireGuard activated"
}
`);

// ═══════════════════════════════════════════════════════════════════════════════
section('7. DATABASE MODEL');
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`
${colors.cyan}Prisma Schema (Router Model):${colors.reset}

model Router {
  // Standard Fields
  id               String           @id @default(cuid())
  name             String
  host             String
  tenantId         String?
  createdAt        DateTime         @default(now())
  
  // WireGuard Fields
  ┌─────────────────────────────────────────────────────┐
  │ CONFIGURATION                                       │
  ├─────────────────────────────────────────────────────┤
  │ wgEnabled        Boolean    @default(false)        │
  │   → Is VPN active?                                 │
  │                                                    │
  │ wgListenPort     Int?       @default(51820)       │
  │   → UDP port for WireGuard                        │
  │                                                    │
  │ wgServerEndpoint String?                           │
  │   → ISP's public IP:port (e.g., 203.0.113.45:51820)
  │                                                    │
  │ wgConfiguredAt   DateTime?                         │
  │   → When was VPN last activated?                  │
  └─────────────────────────────────────────────────────┘
  
  ┌─────────────────────────────────────────────────────┐
  │ SECRETS (Encrypted at Rest)                        │
  ├─────────────────────────────────────────────────────┤
  │ wgPrivateKey     String?    @encrypted             │
  │   → Router's secret key (32 bytes, Base64)        │
  │   → Stored: "enc:v1:<IV>:<TAG>:<CIPHERTEXT>"     │
  │                                                    │
  │ wgPresharedKey   String?    @encrypted             │
  │   → Post-quantum hardening (32 bytes, Base64)     │
  │   → Stored: "enc:v1:<IV>:<TAG>:<CIPHERTEXT>"     │
  └─────────────────────────────────────────────────────┘
  
  ┌─────────────────────────────────────────────────────┐
  │ DERIVED/PUBLIC DATA                                │
  ├─────────────────────────────────────────────────────┤
  │ wgPublicKey      String?                           │
  │   → Derived from wgPrivateKey                     │
  │   → Shared with ISP server                        │
  │   → Stored plaintext (it's public)                │
  │                                                    │
  │ wgPeerPublicKey  String?                           │
  │   → ISP server's public key                       │
  │   → Used to verify tunnel                         │
  │   → Stored plaintext                              │
  │                                                    │
  │ wgTunnelIp       String?    @default("10.200.0.1")
  │   → Router's unique IP on tunnel (e.g., .200)    │
  │   → Auto-assigned from available pool            │
  └─────────────────────────────────────────────────────┘
}

${colors.cyan}Encryption Strategy:${colors.reset}

At Rest: AES-256-GCM
  ├─ Algorithm: Galois/Counter Mode (AEAD)
  ├─ Key Size: 256 bits (32 bytes)
  ├─ IV: 96 bits (12 bytes random per encryption)
  ├─ Auth Tag: 128 bits (16 bytes, detects tampering)
  └─ Format: "enc:v1:<IV_hex>:<TAG_hex>:<CIPHERTEXT_hex>"
  
In Transit: HTTPS/TLS
  └─ All API calls must use HTTPS
  
In Memory: Plaintext
  └─ Automatically decrypted on load
  └─ Automatically encrypted on save
  └─ Never persisted to logs/disk as plaintext
`);

// ═══════════════════════════════════════════════════════════════════════════════
section('8. SYSTEM COMMANDS EXECUTED');
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`
${colors.cyan}Key Generation${colors.reset}

1. Generate Private Key
   Command: wg genkey
   Output:  Base64-encoded 32-byte random key
   Example: kI56+MCLvtZnHyKjzce8iXKfqKr313SYZlYdho5WK18=

2. Derive Public Key from Private
   Command: echo "PRIVATE_KEY" | wg pubkey
   Output:  Corresponding public key
   Example: b7ADpdTy6UooXmb7Ve+PgGeXjGFLVFXqsuz32dYNaxA=

${colors.cyan}Server Queries${colors.reset}

1. Get Server's WireGuard IP
   Command: ip -4 addr show wg0
   Output:  inet 10.200.0.1/24 scope global wg0
   Parsed:  10.200.0.1

2. Get Server's Public Key
   Command: sudo wg show wg0 public-key
   Output:  Server's public key (Base64)

3. List All Peers
   Command: sudo wg show wg0 dump
   Output:  Tab-separated: pubkey | endpoint | allowed-ips | handshake | rx | tx

4. Get Latest Handshakes
   Command: sudo wg show wg0 latest-handshakes
   Output:  Tab-separated: pubkey | timestamp

${colors.cyan}Peer Management${colors.reset}

1. Add Router as Peer
   Command: sudo wg set wg0 peer PUBLIC_KEY \\
               allowed-ips TUNNEL_IP/32 \\
               preshared-key /tmp/wg-psk-XXXX.tmp
   Effect:  Router can now connect to server

2. Save Configuration
   Command: sudo wg-quick save wg0
   Effect:  Writes to /etc/wireguard/wg0.conf

3. Remove Peer
   Command: sudo wg set wg0 peer PUBLIC_KEY remove
   Effect:  Router can no longer connect

4. Bring Up Interface
   Command: sudo wg-quick up wg0
   Effect:  Loads and applies config

5. Bring Down Interface
   Command: sudo wg-quick down wg0
   Effect:  Stops interface and peers

${colors.cyan}Validation Points${colors.reset}

Before Each Command:
  ✓ Validate key regex: /^[A-Za-z0-9+/]+={0,2}$/
  ✓ Validate key length: 43-44 characters
  ✓ Validate IP regex: /^(\d{1,3}\.){3}\d{1,3}$/
  ✓ Validate octets: 0-255 each
  ✓ Use execFile() (never exec() or shell)
`);

// ═══════════════════════════════════════════════════════════════════════════════
section('9. ISSUES & RECOMMENDATIONS');
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`
${colors.red}🔴 CRITICAL${colors.reset}

1. Invalid Default Endpoint Fallback
   ${colors.cyan}Issue:${colors.reset} Can fall back to "0.0.0.0" or "localhost"
   ${colors.cyan}Impact:${colors.reset} WireGuard will fail to connect
   ${colors.cyan}Fix:${colors.reset} Require explicit WG_SERVER_ENDPOINT env var
   
2. No Server Endpoint Validation
   ${colors.cyan}Issue:${colors.reset} router.wgServerEndpoint can be any string
   ${colors.cyan}Impact:${colors.reset} Invalid endpoints cause silent failures
   ${colors.cyan}Fix:${colors.reset} Validate IP or hostname format

${colors.yellow}🟡 HIGH${colors.reset}

1. Limited Tunnel IP Space
   ${colors.cyan}Issue:${colors.reset} Only .200 to .250 = max 51 routers per server
   ${colors.cyan}Impact:${colors.reset} Cannot scale beyond 51 routers
   ${colors.cyan}Fix:${colors.reset} Use larger subnet (e.g., 10.200.0.0/23 = 510 IPs)

2. No PSK Rotation
   ${colors.cyan}Issue:${colors.reset} Preshared key never changes after generation
   ${colors.cyan}Impact:${colors.reset} Long-lived PSK compromise = full tunnel breach
   ${colors.cyan}Fix:${colors.reset} Implement 90-day rotation policy
   
3. No Audit Logging
   ${colors.cyan}Issue:${colors.reset} VPN operations not fully logged
   ${colors.cyan}Impact:${colors.reset} Cannot trace security incidents
   ${colors.cyan}Fix:${colors.reset} Log all key generation, activation, peer adds

${colors.blue}🔵 MEDIUM${colors.reset}

1. Error Messages Reveal System Details
   ${colors.cyan}Issue:${colors.reset} "Failed to get server public key via sudo wg show..."
   ${colors.cyan}Impact:${colors.reset} Leaks system architecture
   ${colors.cyan}Fix:${colors.reset} Generic error message, log details server-side

2. No Rate Limiting on Configuration Requests
   ${colors.cyan}Issue:${colors.reset} Rapid GET requests generate keys repeatedly
   ${colors.cyan}Impact:${colors.reset} Key rotation without notification
   ${colors.cyan}Fix:${colors.reset} Rate limit per router per hour

3. PSK Shared Over HTTPS Only
   ${colors.cyan}Issue:${colors.reset} PSK transmitted in JSON response
   ${colors.cyan}Impact:${colors.reset} Secure only if HTTPS enforced
   ${colors.cyan}Fix:${colors.reset} Enforce HTTPS in production

${colors.green}🟢 RECOMMENDATIONS${colors.reset}

${colors.bright}Immediate (This Sprint):${colors.reset}
  1. Fix endpoint fallback (no 0.0.0.0)
  2. Add comprehensive audit logging
  3. Implement PSK rotation policy
  
${colors.bright}Short Term (Next Sprint):${colors.reset}
  1. Expand tunnel IP space to /23 or larger
  2. Add rate limiting on config requests
  3. Improve error messages (hide system details)
  
${colors.bright}Long Term (Next Quarter):${colors.reset}
  1. Implement WireGuard interface redundancy
  2. Add failover support (backup server)
  3. Implement zero-trust tunnel authentication
  4. Add monitoring/alerting for tunnel health
`);

log('bright', '\nAnalysis Complete ✓');
console.log('');
