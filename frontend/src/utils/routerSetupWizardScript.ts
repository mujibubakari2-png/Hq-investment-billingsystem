import {
  buildHotspotFlowEnforcementLines as buildSharedHotspotFlowEnforcementLines,
  buildRouterWizardScript as buildSharedRouterWizardScript,
  validateRouterSetupWizardServiceInputs as validateSharedRouterSetupWizardServiceInputs,
} from '../../../shared/routerWizardScriptBuilder';

export interface RouterSetupWizardScriptParams {
  routerName: string;
  routerId: string;
  publicApiBase: string;
  apiHost: string;
  serviceType: 'pppoe' | 'hotspot' | 'both';
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

export function validateRouterSetupWizardServiceInputs(input: {
  serviceType: RouterSetupWizardScriptParams['serviceType'];
  hotspotLocalAddress: string;
  pppoeLocalAddress: string;
  hotspotPoolStart: string;
  hotspotPoolEnd: string;
  pppoePoolStart: string;
  pppoePoolEnd: string;
}): RouterSetupWizardServiceValidation {
  return validateSharedRouterSetupWizardServiceInputs(input);
}

export function buildHotspotFlowEnforcementLines(targetBridge: string): string[] {
  return buildSharedHotspotFlowEnforcementLines(targetBridge);
}

export function buildRouterSetupWizardScript(params: RouterSetupWizardScriptParams): string {
  return buildSharedRouterWizardScript({
    ...params,
    selectedInterfaces: Array.from(new Set((params.selectedInterfaces || []).filter(Boolean))),
  });
}
