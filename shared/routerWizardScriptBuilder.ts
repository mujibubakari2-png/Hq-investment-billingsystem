export type RouterServiceType = 'pppoe' | 'hotspot' | 'both';

export interface RouterSetupWizardScriptParams {
  routerName: string;
  routerId: string;
  publicApiBase: string;
  apiHost: string;
  serviceType: RouterServiceType;
  selectedInterfaces: string[];
  vpnEnabled: boolean;
  vpnProtocol?: string;
  vpnPoolStart?: string;
  vpnPoolEnd?: string;
  vpnSecrets?: Array<{ username: string; password: string; protocol?: string; profile?: string; localAddress?: string; remoteAddress?: string }>;
  hotspotLocalAddress: string;
  hotspotPoolStart: string;
  hotspotPoolEnd: string;
  pppoeLocalAddress: string;
  pppoePoolStart: string;
  pppoePoolEnd: string;
  radiusAddress: string;
  radiusSecret: string;
  vpnMode?: string;
  vpnDns?: string;
  ipsecSecret?: string;
  wgConfig?: { routerTunnelIp?: string | null } | null;
  certName?: string;
  vpnManagementSubnet?: string | null;
  dnsServers?: string;
}

export interface RouterSetupWizardServiceValidation {
  ok: boolean;
  missingFields: string[];
}

function sanitizeMikroTikName(name: string): string {
  if (!name) return 'unnamed';
  return name.trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'unnamed';
}

function normalizeInterfaceList(selectedInterfaces: string[] = []): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of selectedInterfaces) {
    if (!value) continue;
    const item = value.trim();
    if (!item || seen.has(item)) continue;
    seen.add(item);
    normalized.push(item);
  }

  return normalized;
}

export function normalizeWizardScriptInputs(input: Partial<RouterSetupWizardScriptParams>): RouterSetupWizardScriptParams {
  return {
    routerName: input.routerName || 'Router',
    routerId: input.routerId || 'router',
    publicApiBase: input.publicApiBase || '',
    apiHost: input.apiHost || 'router.local',
    serviceType: input.serviceType || 'hotspot',
    selectedInterfaces: normalizeInterfaceList(input.selectedInterfaces),
    vpnEnabled: input.vpnEnabled ?? true,
    vpnMode: input.vpnMode,
    vpnProtocol: input.vpnProtocol,
    vpnPoolStart: input.vpnPoolStart,
    vpnPoolEnd: input.vpnPoolEnd,
    vpnSecrets: input.vpnSecrets || [],
    hotspotLocalAddress: input.hotspotLocalAddress || '',
    hotspotPoolStart: input.hotspotPoolStart || '',
    hotspotPoolEnd: input.hotspotPoolEnd || '',
    pppoeLocalAddress: input.pppoeLocalAddress || '',
    pppoePoolStart: input.pppoePoolStart || '',
    pppoePoolEnd: input.pppoePoolEnd || '',
    radiusAddress: input.radiusAddress || '',
    radiusSecret: input.radiusSecret || '',
    vpnDns: input.vpnDns,
    ipsecSecret: input.ipsecSecret,
    wgConfig: input.wgConfig || null,
    certName: input.certName || 'hq-hotspot-cert',
    vpnManagementSubnet: input.vpnManagementSubnet || null,
    dnsServers: input.dnsServers || '8.8.8.8,8.8.4.4',
  };
}

export function validateRouterSetupWizardServiceInputs(input: {
  serviceType: RouterSetupWizardScriptParams['serviceType'];
  hotspotLocalAddress: string;
  pppoeLocalAddress: string;
  hotspotPoolStart: string;
  hotspotPoolEnd: string;
  pppoePoolStart: string;
  pppoePoolEnd: string;
}): RouterSetupWizardServiceValidation {
  const missingFields: string[] = [];

  if (input.serviceType === 'pppoe' || input.serviceType === 'both') {
    if (!input.pppoeLocalAddress.trim()) missingFields.push('PPPoE gateway address');
    if (!input.pppoePoolStart.trim()) missingFields.push('PPPoE pool start');
    if (!input.pppoePoolEnd.trim()) missingFields.push('PPPoE pool end');
  }

  if (input.serviceType === 'hotspot' || input.serviceType === 'both') {
    if (!input.hotspotLocalAddress.trim()) missingFields.push('Hotspot gateway address');
    if (!input.hotspotPoolStart.trim()) missingFields.push('Hotspot pool start');
    if (!input.hotspotPoolEnd.trim()) missingFields.push('Hotspot pool end');
  }

  return { ok: missingFields.length === 0, missingFields };
}

export function buildHotspotFlowEnforcementLines(targetBridge: string): string[] {
  return [
    '',
    '# ===== Hotspot flow enforcement =====',
    '# CRITICAL: the unauthenticated LAN forward drop must come AFTER walled-garden rules so clients can still reach the login portal.',
    ':if ([:len [/ip firewall filter find where comment="Drop unauthenticated LAN forward - HQ INVESTMENT"]] = 0) do={',
    `    /ip firewall filter add chain=forward in-interface=${targetBridge} action=drop comment="Drop unauthenticated LAN forward - HQ INVESTMENT"`,
    '}',
  ];
}

export function buildRouterWizardScript(params: RouterSetupWizardScriptParams): string {
  const normalized = normalizeWizardScriptInputs(params);
  const safeRouterName = sanitizeMikroTikName(normalized.routerName);
  const hsPoolName = `hs-pool-${safeRouterName}`;
  const pppoePoolName = `pppoe-pool-${safeRouterName}`;
  const pppoeProfile = `pppoe-profile-${safeRouterName}`;
  const hotspotProfile = `hq-hotspot-${safeRouterName}`;
  const vpnPoolName = `vpn-pool-${safeRouterName}`;
  const vpnProfile = `vpn-profile-${safeRouterName}`;
  const targetBridge = `bridge-${safeRouterName}`;
  const dnsServers = normalized.dnsServers || '8.8.8.8,8.8.4.4';
  const hotspotPrefix = normalized.hotspotLocalAddress.split('.').slice(0, 3).join('.');
  const hotspotNetwork = `${hotspotPrefix}.0/24`;
  const hotspotCidr = `${normalized.hotspotLocalAddress}/24`;

  const lines: string[] = [
    '# HQ INVESTMENT Router Setup Wizard - generated configuration',
    `# Router: ${normalized.routerName}`,
    `# Router ID: ${normalized.routerId}`,
    '',
    '# ===== Management Safety =====',
    ':if ([:len [/interface list find name="hq-mgmt"]] = 0) do={',
    '    /interface list add name="hq-mgmt" comment="HQ INVESTMENT management interfaces (VPN only)"',
    '}',
    ':if ([:len [/interface wireguard find name="wg-hq"]] > 0) do={',
    '    :if ([:len [/interface list member find list="hq-mgmt" interface="wg-hq"]] = 0) do={ /interface list member add list="hq-mgmt" interface="wg-hq" }',
    '}',
    '/tool mac-server set allowed-interface-list=hq-mgmt',
    '/tool mac-server mac-winbox set allowed-interface-list=hq-mgmt',
    '/ip neighbor discovery-settings set discover-interface-list=hq-mgmt',
    '',
    '# ===== WAN Interface List =====',
    ':if ([:len [/interface list find name="WAN"]] = 0) do={',
    '    /interface list add name="WAN" comment="HQ INVESTMENT WAN"',
    '}',
    ':if ([:len [/interface list member find list="WAN" interface="ether1"]] = 0) do={',
    '    /interface list member add list="WAN" interface="ether1" comment="HQ INVESTMENT WAN port"',
    '}',
    '',
    '# ===== TLS / HTTPS =====',
    '# RC-3 FIX: certificate=auto fails on RouterOS devices with no certificate in the store.',
    '# This safe conditional only enables www-ssl when a valid (non-expired) certificate exists.',
    '# To add a certificate: /certificate import file-name=my-cert.pem',
    ':local certCount [:len [/certificate find where name!="none" expires-after!="0s"]]',
    ':if ($certCount > 0) do={',
    '    :local certName [/certificate get [find where name!="none" expires-after!="0s"] name]',
    '    /ip service set www-ssl disabled=no certificate=$certName',
    '    /log info "HQ INVESTMENT: www-ssl enabled with certificate $certName"',
    '} else={',
    '    /log warning "HQ INVESTMENT: No valid certificate found. www-ssl left disabled. Import a certificate first, then re-run this section."',
    '}',
    '',
    '# ===== Firewall: Management Ports =====',
    ...(normalized.vpnManagementSubnet ? [
      `:if ([:len [/ip firewall filter find where comment="Allow HQ INVESTMENT API Access (VPN only)"]] = 0) do={` ,
      `    /ip firewall filter add chain=input action=accept protocol=tcp dst-port=80,443,8291 src-address=${normalized.vpnManagementSubnet} comment="Allow HQ INVESTMENT API Access (VPN only)"`,
      '}',
      `:if ([:len [/ip firewall filter find where comment="Block HQ INVESTMENT Management Ports (non-VPN)"]] = 0) do={` ,
      `    /ip firewall filter add chain=input action=drop protocol=tcp dst-port=80,443,8291 in-interface-list=WAN comment="Block HQ INVESTMENT Management Ports (non-VPN)"`,
      '}',
    ] : [
      ':if ([:len [/ip firewall filter find where comment="Block HQ INVESTMENT Management Ports (no VPN yet)"]] = 0) do={',
      '    /ip firewall filter add chain=input action=drop protocol=tcp dst-port=80,443,8291 in-interface-list=WAN comment="Block HQ INVESTMENT Management Ports (no VPN yet)"',
      '}',
    ]),
    ':if ([:len [/ip firewall filter find where comment="Drop WAN input - HQ INVESTMENT"]] = 0) do={',
    '    /ip firewall filter add chain=input in-interface-list=WAN action=drop comment="Drop WAN input - HQ INVESTMENT"',
    '}',
    '',
    '# ===== Bridge Setup =====',
    ...(normalized.selectedInterfaces.length > 0
      ? [
          `:local targetBridge "${targetBridge}"`,
          `:if ([:len [/interface bridge find where name=$targetBridge]] = 0) do={ /interface bridge add name=$targetBridge protocol-mode=none arp=enabled vlan-filtering=no comment="HQ Investment Bridge" }`,
          `:if ([:len [/interface bridge find where name=$targetBridge]] > 0) do={ /interface bridge set [find name=$targetBridge] protocol-mode=none arp=enabled vlan-filtering=no }`,
          ...normalized.selectedInterfaces.map((iface) => `:if ([:len [/interface bridge port find where interface="${iface}"]] = 0) do={ /interface bridge port add bridge=$targetBridge interface=${iface} comment="HQ LAN port" }`),
        ]
      : [
          '# No interfaces selected; bridge creation step skipped.',
        ]),
    '',
    '# ===== Hotspot / PPPoE Services =====',
    `# Service type: ${normalized.serviceType}`,
    '',
    ...(normalized.serviceType === 'pppoe' || normalized.serviceType === 'both'
      ? [
          '# ===== PPPoE Server =====',
          `:if ([:len [/ip pool find where name="${pppoePoolName}"]] = 0) do={ /ip pool add name="${pppoePoolName}" ranges=${normalized.pppoePoolStart}-${normalized.pppoePoolEnd} }`,
          `/ppp profile add name="${pppoeProfile}" local-address=${normalized.pppoeLocalAddress} dns-server=${dnsServers} use-compression=no use-encryption=yes use-radius=yes`,
          `/interface pppoe-server server add service-name="hq-pppoe-${safeRouterName}" interface=$targetBridge default-profile="${pppoeProfile}" authentication=mschapv2 one-session-per-host=yes disabled=no`,
          ':if ([:len [/ip firewall filter find where comment="Allow PPPoE to Internet"]] = 0) do={',
          '    /ip firewall filter add chain=forward in-interface=all-ppp out-interface-list=WAN action=accept comment="Allow PPPoE to Internet"',
          '}',
        ]
      : []),
    ...(normalized.serviceType === 'hotspot' || normalized.serviceType === 'both'
      ? [
          '',
          '# ===== Hotspot Server =====',
          `:if ([:len [/ip pool find where name="${hsPoolName}"]] = 0) do={ /ip pool add name="${hsPoolName}" ranges=${normalized.hotspotPoolStart}-${normalized.hotspotPoolEnd} }`,
          `:if ([:len [/ip hotspot profile find where name="${hotspotProfile}"]] = 0) do={ /ip hotspot profile add name="${hotspotProfile}" hotspot-address=${normalized.hotspotLocalAddress} html-directory=hotspot login-by=http-chap,https,cookie use-radius=yes }`,
          `:if ([:len [/ip address find where interface=$targetBridge]] = 0) do={ /ip address add address=${hotspotCidr} interface=$targetBridge }`,
          `:if ([:len [/ip hotspot find where name="hq-hotspot-${safeRouterName}"]] = 0) do={ /ip hotspot add name="hq-hotspot-${safeRouterName}" interface=$targetBridge address-pool="${hsPoolName}" profile="${hotspotProfile}" disabled=no } else={ /ip hotspot set [find name="hq-hotspot-${safeRouterName}"] interface=$targetBridge address-pool="${hsPoolName}" profile="${hotspotProfile}" disabled=no }`,
          `:if ([:len [/ip dhcp-server network find where address="${hotspotNetwork}"]] = 0) do={ /ip dhcp-server network add address=${hotspotNetwork} gateway=${normalized.hotspotLocalAddress} dns-server=${dnsServers} } else={ /ip dhcp-server network set [find where address="${hotspotNetwork}"] gateway=${normalized.hotspotLocalAddress} dns-server=${dnsServers} }`,
          `:if ([:len [/ip dhcp-server find where name="dhcp-${safeRouterName}"]] = 0) do={ /ip dhcp-server add name="dhcp-${safeRouterName}" interface=$targetBridge address-pool="${hsPoolName}" lease-time=1h disabled=no } else={ /ip dhcp-server set [find where name="dhcp-${safeRouterName}"] interface=$targetBridge address-pool="${hsPoolName}" lease-time=1h disabled=no }`,
        ]
      : []),
    '',
    ...(normalized.vpnEnabled && normalized.vpnProtocol && normalized.vpnPoolStart && normalized.vpnPoolEnd ? [
      '# ===== VPN Server (L2TP/PPP) =====',
      ...(normalized.vpnProtocol === 'L2TP' || normalized.vpnMode === 'hybrid'
        ? [
            `/ip pool add name="${vpnPoolName}" ranges=${normalized.vpnPoolStart}-${normalized.vpnPoolEnd}`,
            `/ppp profile add name="${vpnProfile}" local-address=${normalized.pppoeLocalAddress || normalized.hotspotLocalAddress} remote-address="${vpnPoolName}" dns-server=${normalized.vpnDns ?? '8.8.8.8'}`,
            `/interface l2tp-server server set enabled=yes use-ipsec=yes ipsec-secret="${normalized.ipsecSecret ?? ''}" default-profile="${vpnProfile}"`,
          ]
        : []),
      ...((normalized.vpnSecrets ?? []).length > 0 ? (normalized.vpnSecrets ?? []).map((s) => `/ppp secret add name="${s.username}" password="${s.password}" service=${(s.protocol ?? normalized.vpnProtocol ?? 'l2tp').toLowerCase()} profile="${vpnProfile}"${s.localAddress ? ` local-address=${s.localAddress}` : ''}${s.remoteAddress ? ` remote-address=${s.remoteAddress}` : ''}`) : []),
    ] : []),
    '',
    '# ===== RADIUS Client =====',
    `:if ([:len [/radius find where address="${normalized.radiusAddress}"]] = 0) do={` ,
    `  /radius add service=hotspot,ppp address=${normalized.radiusAddress} secret="${normalized.radiusSecret}" authentication-port=1812 accounting-port=1813 timeout=3s`,
    '}',
    '/radius incoming set accept=yes port=3799',
    '/ppp aaa set use-radius=yes accounting=yes',
    '',
    '# ===== Walled Garden =====',
    `:if ([:len [/ip hotspot walled-garden find where dst-host="${normalized.apiHost}"]] = 0) do={ /ip hotspot walled-garden add dst-host="${normalized.apiHost}" action=allow comment="Billing Portal" }`,
    `:if ([:len [/ip hotspot walled-garden ip find where dst-address="${normalized.hotspotLocalAddress}"]] = 0) do={ /ip hotspot walled-garden ip add dst-address="${normalized.hotspotLocalAddress}" action=accept comment="Hotspot Gateway" }`,
    `:if ([:len [/ip hotspot walled-garden ip find where dst-address="${normalized.radiusAddress}"]] = 0) do={ /ip hotspot walled-garden ip add dst-address="${normalized.radiusAddress}" action=accept comment="Billing Portal IP" }`,
    normalized.wgConfig?.routerTunnelIp
      ? `:if ([:len [/ip hotspot walled-garden ip find where dst-address="${normalized.wgConfig.routerTunnelIp.split('.').slice(0, 3).join('.')}.0/24"]] = 0) do={ /ip hotspot walled-garden ip add dst-address="${normalized.wgConfig.routerTunnelIp.split('.').slice(0, 3).join('.')}.0/24" action=accept comment="VPN Subnet" }`
      : '',
    ...buildHotspotFlowEnforcementLines('$targetBridge'),
    '',
    '# ===== Logging =====',
    '# Configuration complete',
  ];

  return lines.filter((line) => line !== '').join('\n');
}
