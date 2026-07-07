/**
 * RouterSetupWizard — shared types, constants, and WizardStepBar
 * FE-001: Extracted from RouterSetupWizard.tsx (1531 lines)
 */

import React from 'react';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import CableIcon from '@mui/icons-material/Cable';
import DescriptionIcon from '@mui/icons-material/Description';
import VerifiedIcon from '@mui/icons-material/Verified';
import VpnKeyIcon from '@mui/icons-material/VpnKey';

// ── Shared Types ──────────────────────────────────────────────────────────────

export interface EthernetInterface {
    name: string;
    type: string;
    mac: string;
    status: 'Up' | 'Down';
}

export interface VpnSecret {
    id?: string;
    username: string;
    password: string;
    protocol: string;
    profile: string;
    localAddress: string;
    remoteAddress: string;
}

export type ServiceType = 'pppoe' | 'hotspot' | 'both';
export type VpnMode    = 'hybrid' | 'wireguard' | 'openvpn';
export type VerifyStatus = 'checking' | 'success' | 'failed';

// ── Step definitions ──────────────────────────────────────────────────────────

interface WizardStep {
    label: string;
    sub: string;
    icon: React.ReactElement<SvgIconProps>;
}

export const WIZARD_STEPS: WizardStep[] = [
    { label: 'Download',    sub: 'OVPN Script',    icon: <DownloadIcon /> },
    { label: 'Connection',  sub: 'Verify Online',  icon: <CableIcon /> },
    { label: 'Services',    sub: 'Choose Setup',   icon: <SettingsIcon /> },
    { label: 'VPN',         sub: 'Tunnel Config',  icon: <VpnKeyIcon /> },
    { label: 'Interfaces',  sub: 'Select Ports',   icon: <CableIcon /> },
    { label: 'Generate',    sub: 'Create Config',  icon: <DescriptionIcon /> },
    { label: 'Verify',      sub: 'Check Status',   icon: <VerifiedIcon /> },
];

export const NEXT_BUTTON_LABELS: Record<number, string> = {
    0: 'Next: Check Connection',
    1: 'Continue to Service Selection',
    2: 'Next: VPN Configuration',
    3: 'Next: Select Interfaces',
    4: 'Next: Generate Config',
    5: 'Next: Verify Setup',
    6: 'Finish Setup',
};

// ── WizardStepBar ─────────────────────────────────────────────────────────────

interface WizardStepBarProps {
    currentStep: number;
    onStepClick?: (step: number) => void;
}

export function WizardStepBar({ currentStep, onStepClick }: WizardStepBarProps) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 0, marginBottom: 36, overflowX: 'auto', paddingBottom: 4,
        }}>
            {WIZARD_STEPS.map((step, index) => {
                const isDone    = index < currentStep;
                const isActive  = index === currentStep;
                return (
                    <React.Fragment key={index}>
                        <div
                            onClick={() => isDone && onStepClick?.(index)}
                            style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                gap: 4, cursor: isDone ? 'pointer' : 'default', minWidth: 72,
                            }}
                        >
                            <div style={{
                                width: 40, height: 40, borderRadius: '50%', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                background: isDone ? '#4caf50' : isActive ? 'var(--primary, #2196f3)' : 'var(--bg-surface, #f3f4f6)',
                                color: isDone || isActive ? '#fff' : 'var(--text-muted)',
                                fontSize: 20, fontWeight: 700,
                                boxShadow: isActive ? '0 0 0 3px rgba(33,150,243,0.2)' : 'none',
                                transition: 'all 0.2s',
                            }}>
                                {isDone ? (
                                    <CheckCircleIcon style={{ fontSize: 22 }} />
                                ) : (
                                    (() => {
                                        const Icon = step.icon.type as any;
                                        return <Icon style={{ fontSize: 20 }} />;
                                    })()
                                )}
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--primary)' : 'var(--text-secondary)' }}>
                                    {step.label}
                                </div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{step.sub}</div>
                            </div>
                        </div>
                        {index < WIZARD_STEPS.length - 1 && (
                            <div style={{
                                height: 2, flex: 1, minWidth: 16, maxWidth: 40,
                                background: index < currentStep ? '#4caf50' : 'var(--border-light)',
                                marginBottom: 24, transition: 'background 0.3s',
                            }} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}
