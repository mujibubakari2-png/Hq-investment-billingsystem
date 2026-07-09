#!/usr/bin/env node
/**
 * WireGuard Configuration Validation Script
 * Standalone tool to validate WireGuard config without database dependencies
 * Usage: node wireguard-validate.js
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, text) {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.bright}${colors.cyan}${'═'.repeat(70)}${colors.reset}`);
  log('bright', `${title}`);
  console.log(`${colors.cyan}${'═'.repeat(70)}${colors.reset}`);
}

function logIssue(severity, title, description) {
  const icon =
    severity === 'CRITICAL' ? '❌' : severity === 'HIGH' ? '⚠️' : severity === 'INFO' ? 'ℹ️' : '✓';
  const color = severity === 'CRITICAL' ? 'red' : severity === 'HIGH' ? 'yellow' : 'blue';
  log(color, `${icon} [${severity}] ${title}`);
  console.log(`   ${description}\n`);
}

function validateKey(key, fieldName) {
  const issues = [];

  if (!key) {
    issues.push(`${fieldName} is empty`);
    return issues;
  }

  if (typeof key !== 'string') {
    issues.push(`${fieldName} is not a string`);
    return issues;
  }

  const keyRegex = /^[A-Za-z0-9+/]+={0,2}$/;
  if (!keyRegex.test(key)) {
    issues.push(`${fieldName} contains invalid Base64 characters`);
  }

  if (key.length < 43 || key.length > 44) {
    issues.push(`${fieldName} length is ${key.length}, expected 43-44 characters`);
  }

  return issues;
}

function validateIp(ip, fieldName) {
  const issues = [];

  if (!ip) {
    issues.push(`${fieldName} is empty`);
    return issues;
  }

  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ip)) {
    issues.push(`${fieldName} is not a valid IPv4 format`);
    return issues;
  }

  const octets = ip.split('.').map(Number);
  for (let i = 0; i < 4; i++) {
    if (isNaN(octets[i]) || octets[i] < 0 || octets[i] > 255) {
      issues.push(`${fieldName} octet ${i + 1} is ${octets[i]}, must be 0-255`);
    }
  }

  return issues;
}

function validatePort(port, fieldName) {
  const portNum = parseInt(port);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return [`${fieldName} is ${port}, must be 1-65535`];
  }
  return [];
}

// MAIN CONFIGURATION
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

// START VALIDATION
console.log(`\n${colors.bright}WireGuard Configuration Validator${colors.reset}`);
console.log(`Router: HQINVESTENT (cmqvhurq600004kra11ayo7ph)`);
console.log(`Date: ${new Date().toISOString()}`);

let criticalIssues = 0;
let highIssues = 0;
let infoIssues = 0;

// ════════════════════════════════════════════════════════════════
logSection('1. KEY VALIDATION');
// ════════════════════════════════════════════════════════════════

let keyIssues = validateKey(wgConfig.interface.privateKey, 'Interface Private Key');
if (keyIssues.length === 0) {
  log('green', '✓ Interface Private Key: Valid (44 chars, valid Base64)');
} else {
  keyIssues.forEach((issue) => {
    logIssue('HIGH', 'Interface Private Key', issue);
    highIssues++;
  });
}

keyIssues = validateKey(wgConfig.peer.publicKey, 'Peer Public Key');
if (keyIssues.length === 0) {
  log('green', '✓ Peer Public Key: Valid (44 chars, valid Base64)');
} else {
  keyIssues.forEach((issue) => {
    logIssue('HIGH', 'Peer Public Key', issue);
    highIssues++;
  });
}

keyIssues = validateKey(wgConfig.peer.presharedKey, 'Preshared Key');
if (keyIssues.length === 0) {
  log('green', '✓ Preshared Key: Valid (44 chars, valid Base64)');
  logIssue('INFO', 'Security', 'Preshared key is present ✓ (good for post-quantum hardening)');
  infoIssues++;
} else {
  keyIssues.forEach((issue) => {
    logIssue('HIGH', 'Preshared Key', issue);
    highIssues++;
  });
}

// ════════════════════════════════════════════════════════════════
logSection('2. IP ADDRESS VALIDATION');
// ════════════════════════════════════════════════════════════════

const [ifaceIp, ifaceCidr] = wgConfig.interface.address.split('/');
const ipIssues = validateIp(ifaceIp, 'Interface IP');
if (ipIssues.length === 0) {
  log('green', `✓ Interface IP: ${ifaceIp} is valid`);
} else {
  ipIssues.forEach((issue) => {
    logIssue('HIGH', 'Interface IP', issue);
    highIssues++;
  });
}

if (parseInt(ifaceCidr) === 24) {
  logIssue(
    'CRITICAL',
    'Interface Address',
    `Address = ${wgConfig.interface.address} means router OWNS 10.0.0.0/24\n` +
      `   This creates routing conflicts with peer allocation. Should be /32 for single IP.`
  );
  criticalIssues++;
} else {
  log('green', `✓ Interface CIDR: /${ifaceCidr}`);
}

const [allowedIp, allowedCidr] = wgConfig.peer.allowedIps.split('/');
const allowedIpIssues = validateIp(allowedIp, 'Allowed IP');
if (allowedIpIssues.length === 0) {
  log('green', `✓ Allowed IP: ${allowedIp} is valid`);
} else {
  allowedIpIssues.forEach((issue) => {
    logIssue('HIGH', 'Allowed IP', issue);
    highIssues++;
  });
}

if (ifaceIp.split('.')[3] === allowedIp.split('.')[3] && ifaceCidr === '24') {
  logIssue(
    'HIGH',
    'AllowedIPs Mismatch',
    `AllowedIPs = ${wgConfig.peer.allowedIps} conflicts with Interface = ${wgConfig.interface.address}\n` +
      `   Router owns 10.0.0.0/24, so 10.0.0.200 is ALREADY LOCAL\n` +
      `   Should be AllowedIPs = 10.0.0.0/24 to route entire subnet through peer`
  );
  highIssues++;
}

// ════════════════════════════════════════════════════════════════
logSection('3. ENDPOINT VALIDATION');
// ════════════════════════════════════════════════════════════════

const [endpoint, portStr] = wgConfig.peer.endpoint.split(':');
const portIssues = validatePort(portStr, 'Endpoint Port');
if (portIssues.length === 0) {
  log('green', `✓ Endpoint Port: ${portStr} is valid`);
} else {
  portIssues.forEach((issue) => {
    logIssue('HIGH', 'Endpoint Port', issue);
    highIssues++;
  });
}

if (endpoint === '0.0.0.0') {
  logIssue(
    'CRITICAL',
    'Invalid Endpoint',
    `Endpoint = 0.0.0.0:51820 is NOT a valid peer endpoint\n` +
      `   0.0.0.0 is "all interfaces" - WireGuard WILL FAIL TO CONNECT\n` +
      `   MUST use real IP (e.g., 203.0.113.45:51820) or hostname (vpn.isp.com:51820)`
  );
  criticalIssues++;
} else if (endpoint === 'localhost' || endpoint === '127.0.0.1') {
  logIssue('CRITICAL', 'Invalid Endpoint', `Endpoint is localhost - cannot connect to local machine`);
  criticalIssues++;
} else {
  logIssue('INFO', 'Endpoint', `Endpoint = ${wgConfig.peer.endpoint}`);
  infoIssues++;
}

// ════════════════════════════════════════════════════════════════
logSection('4. PORT VALIDATION');
// ════════════════════════════════════════════════════════════════

const listenPortIssues = validatePort(wgConfig.interface.listenPort, 'Listen Port');
if (listenPortIssues.length === 0) {
  log('green', `✓ Listen Port: ${wgConfig.interface.listenPort} is valid`);
} else {
  listenPortIssues.forEach((issue) => {
    logIssue('HIGH', 'Listen Port', issue);
    highIssues++;
  });
}

// ════════════════════════════════════════════════════════════════
logSection('5. DNS VALIDATION');
// ════════════════════════════════════════════════════════════════

wgConfig.interface.dns.forEach((dns) => {
  const dnsIssues = validateIp(dns, `DNS Server ${dns}`);
  if (dnsIssues.length === 0) {
    log('green', `✓ DNS Server: ${dns} is valid`);
  } else {
    dnsIssues.forEach((issue) => {
      logIssue('HIGH', `DNS Server ${dns}`, issue);
      highIssues++;
    });
  }
});

// ════════════════════════════════════════════════════════════════
logSection('6. SECURITY ASSESSMENT');
// ════════════════════════════════════════════════════════════════

if (wgConfig.interface.privateKey !== wgConfig.peer.publicKey) {
  log('green', '✓ Keys are unique (private ≠ public)');
} else {
  logIssue('CRITICAL', 'Key Uniqueness', 'Private key equals public key!');
  criticalIssues++;
}

if (wgConfig.interface.privateKey !== wgConfig.peer.presharedKey) {
  log('green', '✓ Keys are unique (private ≠ preshared)');
} else {
  logIssue('CRITICAL', 'Key Uniqueness', 'Private key equals preshared key!');
  criticalIssues++;
}

if (wgConfig.peer.publicKey !== wgConfig.peer.presharedKey) {
  log('green', '✓ Keys are unique (public ≠ preshared)');
} else {
  logIssue('CRITICAL', 'Key Uniqueness', 'Public key equals preshared key!');
  criticalIssues++;
}

// ════════════════════════════════════════════════════════════════
logSection('7. SUMMARY & RECOMMENDATIONS');
// ════════════════════════════════════════════════════════════════

console.log(`\n${colors.bright}Issues Found:${colors.reset}`);
console.log(`  ${colors.red}Critical: ${criticalIssues}${colors.reset}`);
console.log(`  ${colors.yellow}High: ${highIssues}${colors.reset}`);
console.log(`  ${colors.blue}Info: ${infoIssues}${colors.reset}`);

if (criticalIssues > 0 || highIssues > 0) {
  console.log(
    `\n${colors.red}${colors.bright}CONFIGURATION NOT READY FOR PRODUCTION${colors.reset}`
  );
  console.log(`Reason: ${criticalIssues} critical + ${highIssues} high severity issues\n`);

  console.log(`${colors.bright}REQUIRED FIXES:${colors.reset}`);
  console.log(`1. Replace Endpoint: 0.0.0.0:51820 → ISP_PUBLIC_IP:51820`);
  console.log(`2. Change Address: 10.0.0.1/24 → 10.0.0.200/32`);
  console.log(`3. Change AllowedIPs: 10.0.0.200/32 → 10.0.0.0/24`);

  console.log(`\n${colors.bright}CORRECTED CONFIGURATION:${colors.reset}\n`);
  console.log(`[Interface]`);
  console.log(`PrivateKey = kI56+MCLvtZnHyKjzce8iXKfqKr313SYZlYdho5WK18=`);
  console.log(`Address = 10.0.0.200/32              # CHANGED from 10.0.0.1/24`);
  console.log(`ListenPort = 51820`);
  console.log(`DNS = 8.8.8.8, 1.1.1.1\n`);
  console.log(`[Peer]`);
  console.log(`PublicKey = b7ADpdTy6UooXmb7Ve+PgGeXjGFLVFXqsuz32dYNaxA=`);
  console.log(`PresharedKey = +HjQAEn8GA2tU+HuZNdVfYw9TaqL277IqPMovrqTxls=`);
  console.log(`AllowedIPs = 10.0.0.0/24             # CHANGED from 10.0.0.200/32`);
  console.log(`Endpoint = ISP_ACTUAL_IP:51820       # CHANGED from 0.0.0.0:51820`);
  console.log(`PersistentKeepalive = 25\n`);

  process.exit(1);
} else {
  log('green', '\n✓ CONFIGURATION VALIDATED SUCCESSFULLY');
  process.exit(0);
}
