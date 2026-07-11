import { sanitizeMikroTikName } from '../utils/mikrotikUtils';

export interface RouterSetupWizardScriptParams {
  routerName: string;
  routerId: string;
  publicApiBase: string;
  apiHost: string;
  serviceType: 'pppoe' | 'hotspot' | 'both';
  selectedInterfaces: string[];
  vpnEnabled: boolean;
  vpnProtocol: string;
  vpnPoolStart: string;
  vpnPoolEnd: string;
  vpnSecrets: Array<{ username: string; password: string; protocol?: string; profile?: string; localAddress?: string; remoteAddress?: string }>;
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
    '', '# ===== Hotspot flow enforcement =====',
    '# CRITICAL: the unauthenticated LAN forward drop must come AFTER walled-garden rules so clients can still reach the login portal.',
    ':if ([:len [/ip firewall filter find where comment="Drop unauthenticated LAN forward - HQInvestment"]] = 0) do={',
    `    /ip firewall filter add chain=forward in-interface=${targetBridge} out-interface=ether1 action=drop comment="Drop unauthenticated LAN forward - HQInvestment"`,
    '}',
  ];
}

export function buildRouterSetupWizardScript(params: RouterSetupWizardScriptParams): string {
  const safeRouterName = sanitizeMikroTikName(params.routerName);
  const hsPoolName = `hs-pool-${safeRouterName}`;
  const pppoePoolName = `pppoe-pool-${safeRouterName}`;
  const pppoeProfile = `pppoe-profile-${safeRouterName}`;
  const hotspotProfile = `hq-hotspot-${safeRouterName}`;
  const vpnPoolName = `vpn-pool-${safeRouterName}`;
  const vpnProfile = `vpn-profile-${safeRouterName}`;
  const targetBridge = `bridge-${safeRouterName}`;
  const dnsServers = params.dnsServers || '8.8.8.8,8.8.4.4';
  const hotspotPrefix = params.hotspotLocalAddress.split('.').slice(0, 3).join('.');
  const hotspotNetwork = `${hotspotPrefix}.0/24`;
  const hotspotCidr = `${params.hotspotLocalAddress}/24`;

  const lines: string[] = [
    '# HQInvestment Router Setup Wizard - generated configuration',
    `# Router: ${params.routerName}`,
    `# Router ID: ${params.routerId}`,
    '',
    '# ===== Management Safety =====',
    '/tool mac-server set allowed-interface-list=all',
    '/tool mac-server mac-winbox set allowed-interface-list=all',
    '/ip neighbor discovery-settings set discover-interface-list=all',
    '',
    '# ===== TLS / HTTPS =====',
    '/ip service set www-ssl disabled=no certificate=auto',
    '',
    '# ===== Firewall: Management Ports =====',
    '# Winbox/Web/API must never be reachable from the open WAN.',
    ...(params.vpnManagementSubnet ? [
      `:if ([:len [/ip firewall filter find where comment="Allow HQInvestment API Access (VPN only)"]] = 0) do={` ,
      `    /ip firewall filter add chain=input action=accept protocol=tcp dst-port=80,443,8291 src-address=${params.vpnManagementSubnet} comment="Allow HQInvestment API Access (VPN only)"`,
      '}',
      `:if ([:len [/ip firewall filter find where comment="Block HQInvestment Management Ports (non-VPN)"]] = 0) do={` ,
      `    /ip firewall filter add chain=input action=drop protocol=tcp dst-port=80,443,8291 comment="Block HQInvestment Management Ports (non-VPN)"`,
      '}',
    ] : [
      '# No WireGuard tunnel IP detected yet — management ports are fully',
      '# blocked from every source until VPN is set up and this script is',
      '# regenerated.',
      `:if ([:len [/ip firewall filter find where comment="Block HQInvestment Management Ports (no VPN yet)"]] = 0) do={` ,
      `    /ip firewall filter add chain=input action=drop protocol=tcp dst-port=80,443,8291 comment="Block HQInvestment Management Ports (no VPN yet)"`,
      '}',
      '/log warning "HQInvestment: Router HAINA WireGuard VPN -- Winbox/Web/API zimefungwa. Sanidi VPN kisha zalisha script upya."',
    ]),
    '',
    '# ===== Bridge Setup =====',
    '# FIX CAUSE #5+#13: arp=enabled prevents reply-only breaking DHCP. vlan-filtering=no prevents',
    '# untagged client traffic being dropped silently. protocol-mode=none disables STP delay.',
    ...params.selectedInterfaces.length > 0
      ? [
          `:local targetBridge "${targetBridge}"`,
          `:if ([:len [/interface bridge find where name=$targetBridge]] = 0) do={ /interface bridge add name=$targetBridge protocol-mode=none arp=enabled vlan-filtering=no comment="HQ Investment Bridge" }`,
          `:if ([:len [/interface bridge find where name=$targetBridge]] > 0) do={ /interface bridge set [find name=$targetBridge] protocol-mode=none arp=enabled vlan-filtering=no }`,
          // Selected interfaces (ether ports)
          ...params.selectedInterfaces.map((iface) => `:if ([:len [/interface bridge port find where interface="${iface}"]] = 0) do={ /interface bridge port add bridge=$targetBridge interface=${iface} comment="HQ LAN port" }`),
          // FIX CAUSE #4+#12+#15: Add wlan1/wlan2 with edge=yes and bridge-mode=enabled
          '# FIX CAUSE #4+#12+#15: wlan interfaces must be in bridge with edge=yes (portfast) and bridge-mode=enabled.',
          '# bridge-mode=enabled prevents client isolation. edge=yes removes STP 30s delay on wifi ports.',
          ':if ([:len [/interface wireless find default-name="wlan1"]] > 0) do={',
          '    /interface wireless set [find default-name="wlan1"] bridge-mode=enabled disabled=no',
          '    :if ([:len [/interface bridge port find where interface="wlan1"]] = 0) do={',
          `        /interface bridge port add interface=wlan1 bridge=$targetBridge edge=yes comment="HQ WiFi"`,
          '    } else={',
          '        /interface bridge port set [find interface="wlan1"] edge=yes',
          '    }',
          '}',
          ':if ([:len [/interface wireless find default-name="wlan2"]] > 0) do={',
          '    /interface wireless set [find default-name="wlan2"] bridge-mode=enabled disabled=no',
          '    :if ([:len [/interface bridge port find where interface="wlan2"]] = 0) do={',
          `        /interface bridge port add interface=wlan2 bridge=$targetBridge edge=yes comment="HQ WiFi 5GHz"`,
          '    } else={',
          '        /interface bridge port set [find interface="wlan2"] edge=yes',
          '    }',
          '}',
        ]
      : [
          '# No interfaces selected; bridge creation step skipped.',
        ],
    '',
    '# ===== Hotspot / PPPoE Services =====',
    `# Service type: ${params.serviceType}`,
    '',
    ...(params.serviceType === 'pppoe' || params.serviceType === 'both'
      ? [
          '# ===== PPPoE Server =====',
          `:if ([:len [/ip pool find where name="${pppoePoolName}"]] = 0) do={ /ip pool add name="${pppoePoolName}" ranges=${params.pppoePoolStart}-${params.pppoePoolEnd} }`,
          `/ppp profile add name="${pppoeProfile}" local-address=${params.pppoeLocalAddress} dns-server=${dnsServers} use-compression=no use-encryption=no`,
          `/interface pppoe-server server add service-name="hq-pppoe-${safeRouterName}" interface=$targetBridge default-profile="${pppoeProfile}" authentication=mschapv2 disabled=no`,
        ]
      : []),
    ...(params.serviceType === 'hotspot' || params.serviceType === 'both'
      ? [
          '',
          '# ===== Hotspot Server =====',
          `:if ([:len [/ip pool find where name="${hsPoolName}"]] = 0) do={ /ip pool add name="${hsPoolName}" ranges=${params.hotspotPoolStart}-${params.hotspotPoolEnd} }`,
          `:if ([:len [/ip hotspot profile find where name="${hotspotProfile}"]] = 0) do={ /ip hotspot profile add name="${hotspotProfile}" hotspot-address=${params.hotspotLocalAddress} html-directory=hotspot login-by=http-chap,http-pap,https,cookie ssl-certificate=auto use-radius=yes }`,
          `:if ([:len [/ip address find where interface=$targetBridge]] = 0) do={ /ip address add address=${hotspotCidr} interface=$targetBridge }`,
          `:if ([:len [/ip hotspot find where name="hq-hotspot-${safeRouterName}"]] = 0) do={ /ip hotspot add name="hq-hotspot-${safeRouterName}" interface=$targetBridge address-pool="${hsPoolName}" profile="${hotspotProfile}" disabled=no } else={ /ip hotspot set [find name="hq-hotspot-${safeRouterName}"] interface=$targetBridge address-pool="${hsPoolName}" profile="${hotspotProfile}" disabled=no }`,
          `/ip hotspot profile set [/ip hotspot profile find where name="${hotspotProfile}"] hotspot-address=${params.hotspotLocalAddress} html-directory=hotspot ssl-certificate=auto use-radius=yes`,
          `:if ([:len [/ip dhcp-server network find where address="${hotspotNetwork}"]] = 0) do={ /ip dhcp-server network add address=${hotspotNetwork} gateway=${params.hotspotLocalAddress} dns-server=${dnsServers} }`,
        ]
      : []),
    '',
    ...(params.vpnEnabled ? [
      '# ===== VPN Server =====',
      ...(params.vpnProtocol === 'L2TP' || params.vpnMode === 'hybrid'
        ? [
            `/ip pool add name="${vpnPoolName}" ranges=${params.vpnPoolStart}-${params.vpnPoolEnd}`,
            `/ppp profile add name="${vpnProfile}" local-address=${params.pppoeLocalAddress || params.hotspotLocalAddress} remote-address="${vpnPoolName}" dns-server=${params.vpnDns ?? '8.8.8.8'}`,
            `/interface l2tp-server server set enabled=yes use-ipsec=yes ipsec-secret="${params.ipsecSecret ?? ''}" default-profile="${vpnProfile}"`,
          ]
        : []),
      ...(params.vpnSecrets.length > 0 ? params.vpnSecrets.map((s) => `/ppp secret add name="${s.username}" password="${s.password}" service=${(s.protocol ?? params.vpnProtocol).toLowerCase()} profile="${vpnProfile}"${s.localAddress ? ` local-address=${s.localAddress}` : ''}${s.remoteAddress ? ` remote-address=${s.remoteAddress}` : ''}`) : []),
    ] : []),
    '',
    '# ===== RADIUS Client =====',
    `:if ([:len [/radius find where address="${params.radiusAddress}"]] = 0) do={` ,
    `  /radius add service=hotspot,ppp address=${params.radiusAddress} secret="${params.radiusSecret}" authentication-port=1812 accounting-port=1813 timeout=3s`,
    '}',
    '/radius incoming set accept=yes port=3799',
    '/ppp aaa set use-radius=yes accounting=yes',
    '',
    '# ===== Walled Garden =====',
    `:if ([:len [/ip hotspot walled-garden find where dst-host="${params.apiHost}"]] = 0) do={ /ip hotspot walled-garden add dst-host="${params.apiHost}" action=allow comment="Billing Portal" }`,
    `:if ([:len [/ip hotspot walled-garden ip find where dst-address="${params.hotspotLocalAddress}"]] = 0) do={ /ip hotspot walled-garden ip add dst-address="${params.hotspotLocalAddress}" action=accept comment="Hotspot Gateway" }`,
    `:if ([:len [/ip hotspot walled-garden ip find where dst-address="${params.radiusAddress}"]] = 0) do={ /ip hotspot walled-garden ip add dst-address="${params.radiusAddress}" action=accept comment="Billing Portal IP" }`,
    params.wgConfig?.routerTunnelIp
      ? `:if ([:len [/ip hotspot walled-garden ip find where dst-address="${params.wgConfig.routerTunnelIp.split('.').slice(0, 3).join('.')}.0/24"]] = 0) do={ /ip hotspot walled-garden ip add dst-address="${params.wgConfig.routerTunnelIp.split('.').slice(0, 3).join('.')}.0/24" action=accept comment="VPN Subnet" }`
      : '',
    ...buildHotspotFlowEnforcementLines('$targetBridge'),
    '',
    '# ===== DHCP Firewall (Must be first — before FastTrack and drop rules) =====',
    '# FIX CAUSE #3+#8: DHCP accept rules at TOP prevent FastTrack or drop rules from',
    '# discarding DHCP DISCOVER/REQUEST. Without these, clients never receive an IP address.',
    ':if ([:len [/ip firewall filter find where comment="Allow DHCP input - HQWizard"]] = 0) do={',
    '    /ip firewall filter add place-before=0 chain=input protocol=udp dst-port=67,68 action=accept comment="Allow DHCP input - HQWizard"',
    '}',
    ':if ([:len [/ip firewall filter find where comment="Allow DHCP forward - HQWizard"]] = 0) do={',
    '    /ip firewall filter add place-before=0 chain=forward protocol=udp dst-port=67,68 action=accept comment="Allow DHCP forward - HQWizard"',
    '}',
    '',
    '# ===== NAT (Masquerade) =====',
    ':if ([:len [/ip firewall nat find where action=masquerade]] = 0) do={ /ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade }',
    '',
    '# ===== MSS Clamping =====',
    '# FIX CAUSE #18: Clamp TCP MSS to path MTU. Prevents HTTPS/large downloads from',
    '# failing on PPPoE/WAN links where the MTU is smaller than Ethernet default (1500).',
    ':if ([:len [/ip firewall mangle find where comment="MSS Clamp - HQWizard"]] = 0) do={',
    '    /ip firewall mangle add chain=forward protocol=tcp tcp-flags=syn action=change-mss new-mss=clamp-to-pmtu passthrough=yes comment="MSS Clamp - HQWizard"',
    '}',
    '',
    '# ===== System Scheduler =====',
    `:if ([:len [/system scheduler find name="billing-sync"]] > 0) do={ /system scheduler remove [find name="billing-sync"] }`,
    `:local syncUrl "${params.publicApiBase}/api/sync/${params.routerId}"`,
    ':local syncScript "/tool fetch url=$syncUrl keep-result=no"',
    '/system scheduler add name="billing-sync" interval=5m on-event=$syncScript start-time=00:00:00 comment="HQ INVESTMENT Auto-Sync"',
    '',
    '# ===== Logging =====',
    '# FIX CAUSE #19: Enable all relevant log topics for diagnostics.',
    ':if ([:len [/system logging find topics=hotspot]] = 0) do={ /system logging add topics=hotspot action=memory }',
    ':if ([:len [/system logging find topics=radius]] = 0) do={ /system logging add topics=radius action=memory }',
    ':if ([:len [/system logging find topics=dhcp]] = 0) do={ /system logging add topics=dhcp action=memory }',
    ':if ([:len [/system logging find topics=wireless]] = 0) do={ /system logging add topics=wireless action=memory }',
    ':if ([:len [/system logging find topics=firewall]] = 0) do={ /system logging add topics=firewall action=memory }',
    '',
    '# Configuration complete',
  ];

  return lines.filter((line) => line !== '').join('\n');
}
