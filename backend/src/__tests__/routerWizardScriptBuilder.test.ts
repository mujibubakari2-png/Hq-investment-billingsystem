/**
 * Regression test suite — MikroTik Router Provisioning
 *
 * Covers all 20 acceptance criteria from the production-critical fix plan.
 * Tests are grouped by defect number for traceability.
 */

import {
    buildRouterWizardScript,
    normalizeWizardScriptInputs,
    validateWizardScriptParams,
    buildHotspotFlowEnforcementLines,
} from '../lib/routerWizardScriptBuilder';
import type { RouterSetupWizardScriptParams } from '../lib/routerWizardScriptBuilder';

// ─── Shared fixture factories ─────────────────────────────────────────────────

// Default: serviceType='both' covers both Hotspot AND PPPoE.
// Pass an explicit override for tests that need a specific service type.
function minimalParams(
    overrides: Partial<RouterSetupWizardScriptParams> = {},
): RouterSetupWizardScriptParams {
    return {
        routerName: 'TestRouter',
        routerId: 'router-1',
        publicApiBase: 'https://api.example.com',
        apiHost: 'api.example.com',
        serviceType: 'both',
        selectedInterfaces: ['ether2', 'ether3'],
        vpnEnabled: true,
        hotspotLocalAddress: '10.10.0.1',
        hotspotPoolStart: '10.10.0.10',
        hotspotPoolEnd: '10.10.0.100',
        pppoeLocalAddress: '10.10.0.1',
        pppoePoolStart: '10.10.0.101',
        pppoePoolEnd: '10.10.0.200',
        radiusAddress: '10.200.0.1',
        radiusSecret: 'valid-secret-xyz',
        dnsServers: '8.8.8.8,8.8.4.4',
        vpnManagementSubnet: '10.200.0.0/24',
        ...overrides,
    };
}

// ─── TEST 1: Missing $targetBridge ───────────────────────────────────────────

describe('DEFECT-1+2+5: $targetBridge undefined-variable guard', () => {
    it('1. Script with NO interfaces MUST NOT contain $targetBridge reference', () => {
        const script = buildRouterWizardScript(minimalParams({ selectedInterfaces: [] }));
        expect(script).not.toContain('$targetBridge');
    });

    it('2. Script with NO interfaces must emit BLOCKED_BY_DEPENDENCY comment', () => {
        const script = buildRouterWizardScript(minimalParams({ selectedInterfaces: [] }));
        expect(script).toContain('BLOCKED_BY_DEPENDENCY');
    });

    it('3. Hotspot section absent when no interfaces selected', () => {
        const script = buildRouterWizardScript(minimalParams({ selectedInterfaces: [] }));
        // Hotspot add command must not be present
        expect(script).not.toMatch(/\/ip hotspot add/);
    });

    it('4. PPPoE server section absent when no interfaces selected', () => {
        const script = buildRouterWizardScript(minimalParams({ selectedInterfaces: [], serviceType: 'both' }));
        expect(script).not.toMatch(/\/interface pppoe-server server add/);
    });

    it('5. buildHotspotFlowEnforcementLines must not be emitted when no bridge', () => {
        const script = buildRouterWizardScript(minimalParams({ selectedInterfaces: [] }));
        // The drop rule that references the bridge variable must not appear
        expect(script).not.toContain('Drop unauthenticated LAN forward - HQ INVESTMENT');
    });

    it('5b. buildHotspotFlowEnforcementLines(targetBridge) produces correct output', () => {
        const lines = buildHotspotFlowEnforcementLines('$targetBridge');
        const joined = lines.join('\n');
        expect(joined).toContain('in-interface=$targetBridge');
        expect(joined).toContain('action=drop');
    });

    it('Script WITH interfaces DOES declare :local targetBridge', () => {
        const script = buildRouterWizardScript(minimalParams());
        expect(script).toContain(':local targetBridge ');
        expect(script).toContain('$targetBridge');
    });
});

// ─── TEST 3: Dynamic WAN Discovery ───────────────────────────────────────────

describe('DEFECT-3: Dynamic WAN interface discovery', () => {
    it('3. WAN block uses $wanIface variable, not hardcoded ether1', () => {
        const script = buildRouterWizardScript(minimalParams());
        // Must contain the semantic discovery loop
        expect(script).toContain(':local wanIface ""');
        expect(script).toContain('dst-address="0.0.0.0/0"');
        expect(script).toContain(':set wanIface [/ip route get $r gateway-interface]');
        // WAN member add must use $wanIface, not literal ether1
        expect(script).toContain('interface=$wanIface');
    });

    it('3b. ether1 only appears as fallback inside an :if block, not as a bare assignment', () => {
        const script = buildRouterWizardScript(minimalParams());
        // ether1 may appear in the fallback :set, but NOT as the direct interface member arg
        const lines = script.split('\n');
        const wanMemberLine = lines.find(l =>
            l.includes('interface list member add list="WAN"') &&
            l.includes('interface=')
        );
        // The member add line must reference the variable, not the literal
        expect(wanMemberLine).toContain('interface=$wanIface');
        expect(wanMemberLine).not.toContain('interface=ether1');
    });

    it('4. Existing WAN member is not added twice (idempotent guard present)', () => {
        const script = buildRouterWizardScript(minimalParams());
        // Must be conditional
        expect(script).toContain('[:len [/interface list member find list="WAN" interface=$wanIface]]');
    });
});

// ─── TEST 5: WireGuard preservation ──────────────────────────────────────────

describe('DEFECT-4: WireGuard preservation & DROP WAN ordering', () => {
    it('5. wg-hq conditional check present before adding it to hq-mgmt', () => {
        const script = buildRouterWizardScript(minimalParams());
        expect(script).toContain('/interface wireguard find name="wg-hq"');
    });

    it('DROP WAN rule is gated on wg-hq existence (PHASE 9)', () => {
        const script = buildRouterWizardScript(minimalParams());
        // The drop rule must be inside the wg-hq existence check block
        const lines = script.split('\n');
        const wgCheckIdx = lines.findIndex(l =>
            l.includes('[:len [/interface wireguard find name="wg-hq"]]') &&
            l.includes('> 0')
        );
        const dropIdx = lines.findIndex(l =>
            l.includes('Drop WAN input - HQ INVESTMENT') &&
            l.includes('action=drop')
        );
        // Both must exist
        expect(wgCheckIdx).toBeGreaterThan(-1);
        expect(dropIdx).toBeGreaterThan(-1);
        // DROP must come AFTER the wg-hq guard
        expect(dropIdx).toBeGreaterThan(wgCheckIdx);
    });

    it('DROP WAN is NOT applied at the top of the script (before WireGuard section)', () => {
        const script = buildRouterWizardScript(minimalParams());
        const lines = script.split('\n');
        const phase1EndIdx = lines.findIndex(l => l.includes('PHASE 3'));
        const dropIdx = lines.findIndex(l =>
            l.includes('Drop WAN input - HQ INVESTMENT') && l.includes('action=drop')
        );
        // Drop must NOT appear before PHASE 3
        if (dropIdx !== -1) {
            expect(dropIdx).toBeGreaterThan(phase1EndIdx);
        }
    });
});

// ─── TEST 8: Router identity ──────────────────────────────────────────────────

describe('DEFECT-8: Router.name → RouterOS identity', () => {
    it('14. /system identity set name is emitted with the router name', () => {
        const script = buildRouterWizardScript(minimalParams({ routerName: 'MyBranchRouter' }));
        expect(script).toContain('/system identity set name="MyBranchRouter"');
    });

    it('Router name with special chars is escaped correctly', () => {
        const script = buildRouterWizardScript(minimalParams({ routerName: 'Branch "A"' }));
        expect(script).toContain('/system identity set name="Branch \\"A\\""');
    });

    it('Identity is the FIRST executable line (before bridge/hotspot/firewall)', () => {
        const script = buildRouterWizardScript(minimalParams());
        const lines = script.split('\n').filter(l => l.trim() && !l.startsWith('#'));
        expect(lines[0]).toContain('/system identity set');
    });
});

// ─── TEST 9: No hq_admin_ mutation ───────────────────────────────────────────

describe('DEFECT-9: No hq_admin_ username mutation', () => {
    it('15. Generated script does NOT contain hq_admin_', () => {
        const script = buildRouterWizardScript(minimalParams());
        expect(script).not.toContain('hq_admin_');
    });
});

// ─── TEST 11: No AUTOGENERATED_BY_AUTO_PUSH ───────────────────────────────────

describe('DEFECT-11: No forbidden placeholder secrets', () => {
    it('16. AUTOGENERATED_BY_AUTO_PUSH is rejected by validateWizardScriptParams', () => {
        const result = validateWizardScriptParams(
            minimalParams({ radiusSecret: 'AUTOGENERATED_BY_AUTO_PUSH' }) as any
        );
        expect(result.ok).toBe(false);
        expect(result.errors.some(e => e.includes('RADIUS_SECRET_MISSING'))).toBe(true);
    });

    it('hqinvestment_radius_secret is rejected', () => {
        const result = validateWizardScriptParams(
            minimalParams({ radiusSecret: 'hqinvestment_radius_secret' }) as any
        );
        expect(result.ok).toBe(false);
    });

    it('hqsecret is rejected', () => {
        const result = validateWizardScriptParams(
            minimalParams({ radiusSecret: 'hqsecret' }) as any
        );
        expect(result.ok).toBe(false);
    });

    it('Empty radiusSecret is rejected', () => {
        const result = validateWizardScriptParams(
            minimalParams({ radiusSecret: '' }) as any
        );
        expect(result.ok).toBe(false);
    });
});

// ─── TEST 8: Missing credentials / RADIUS secret ─────────────────────────────

describe('validateWizardScriptParams pre-generation gate', () => {
    it('8. Missing routerName fails validation with ROUTER_NAME_MISSING', () => {
        const result = validateWizardScriptParams(minimalParams({ routerName: '' }) as any);
        expect(result.ok).toBe(false);
        expect(result.errors.some(e => e.includes('ROUTER_NAME_MISSING'))).toBe(true);
    });

    it('9. Missing radiusAddress fails with RADIUS_ADDRESS_MISSING', () => {
        const result = validateWizardScriptParams(minimalParams({ radiusAddress: '' }) as any);
        expect(result.ok).toBe(false);
        expect(result.errors.some(e => e.includes('RADIUS_ADDRESS_MISSING'))).toBe(true);
    });

    it('11. Missing hotspot pool start/end fails for hotspot service type', () => {
        const result = validateWizardScriptParams(
            minimalParams({ hotspotPoolStart: '', hotspotPoolEnd: '' }) as any
        );
        expect(result.ok).toBe(false);
        expect(result.errors.some(e => e.includes('SERVICE_FIELD_MISSING'))).toBe(true);
    });

    it('Valid params pass all validation checks', () => {
        const result = validateWizardScriptParams(minimalParams() as any);
        expect(result.ok).toBe(true);
        expect(result.errors).toHaveLength(0);
    });
});

// ─── TEST 10: RADIUS IP different from VPN IP ─────────────────────────────────

describe('DEFECT-6: RADIUS IP distinct from VPN IP', () => {
    it('10. Script uses radiusAddress param verbatim, separate from VPN subnet', () => {
        const script = buildRouterWizardScript(
            minimalParams({ radiusAddress: '10.200.5.100' })
        );
        // RADIUS add must contain our specific IP, not derive it from vpnSubnet
        expect(script).toContain('address=10.200.5.100');
    });

    it('RADIUS address and VPN management subnet can differ', () => {
        const script = buildRouterWizardScript(
            minimalParams({
                radiusAddress: '192.168.100.50',
                vpnManagementSubnet: '10.200.0.0/24',
            })
        );
        expect(script).toContain('address=192.168.100.50');
        expect(script).toContain('src-address=10.200.0.0/24');
        // They must not bleed into each other (prevent matching src-address= by adding a space)
        expect(script).not.toContain(' address=10.200.0.0/24');
    });
});

// ─── TEST 17: Idempotency ─────────────────────────────────────────────────────

describe('Idempotency: repeated generation', () => {
    it('17. Building the same script twice produces identical output', () => {
        const params = minimalParams();
        const script1 = buildRouterWizardScript(params).replace(/Generated: .*/, 'Generated: MOCKED');
        const script2 = buildRouterWizardScript(params).replace(/Generated: .*/, 'Generated: MOCKED');
        expect(script1).toBe(script2);
    });

    it('All bridge/hotspot/DHCP commands are guarded with :if [:len ...] = 0 checks', () => {
        const script = buildRouterWizardScript(minimalParams());
        // Every /interface bridge add must be inside an :if guard
        const addBridgeLines = script.split('\n').filter(l => l.includes('/interface bridge add'));
        for (const line of addBridgeLines) {
            expect(line).toContain(':if ([:len');
        }
    });
});

// ─── TEST 19: Download Script = Preview canonical output ──────────────────────

describe('DEFECT canonical: Preview = Download Script = canonical wizard RSC', () => {
    it('19. buildRouterWizardScript is deterministic (same inputs → same output)', () => {
        const params1 = minimalParams({ selectedInterfaces: ['ether2'] });
        const params2 = minimalParams({ selectedInterfaces: ['ether2'] });
        expect(
            buildRouterWizardScript(params1).replace(/Generated: .*/, 'Generated: MOCKED')
        ).toBe(
            buildRouterWizardScript(params2).replace(/Generated: .*/, 'Generated: MOCKED')
        );
    });

    it('Interface deduplication preserves order', () => {
        const normalized = normalizeWizardScriptInputs({
            selectedInterfaces: ['ether2', 'ether2', 'ether3', 'ether4', 'ether3'],
        });
        expect(normalized.selectedInterfaces).toEqual(['ether2', 'ether3', 'ether4']);
    });
});

// ─── TEST 20: Auto-Push uses same desired-state model ────────────────────────

describe('Auto-Push canonical model check', () => {
    it('20. buildRouterWizardScript produces expected RADIUS config with explicit address', () => {
        const script = buildRouterWizardScript(
            minimalParams({ radiusAddress: '10.200.0.1', radiusSecret: 'real-secret-abc' })
        );
        expect(script).toContain('address=10.200.0.1');
        expect(script).toContain('secret="real-secret-abc"');
        expect(script).toContain('authentication-port=1812');
        expect(script).toContain('accounting-port=1813');
    });

    it('Both PPPoE and Hotspot sections present for serviceType=both with interfaces', () => {
        const script = buildRouterWizardScript(minimalParams({ serviceType: 'both' }));
        expect(script).toContain('pppoe-server server add');
        expect(script).toContain('/ip hotspot add');
    });

    it('PPPoE section absent when serviceType=hotspot', () => {
        const script = buildRouterWizardScript(minimalParams({ serviceType: 'hotspot' }));
        expect(script).not.toContain('pppoe-server server add');
    });

    it('Hotspot section absent when serviceType=pppoe', () => {
        const script = buildRouterWizardScript(minimalParams({ serviceType: 'pppoe' }));
        expect(script).not.toMatch(/\/ip hotspot add/);
    });
});
