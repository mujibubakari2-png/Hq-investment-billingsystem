// ── Auth & Profile API ────────────────────────────────────────────────────────
import { get, post, put } from './httpClient';

export interface AuthUser {
    id: string;
    username: string;
    email: string;
    role: string;
    phone?: string;
    fullName?: string;
    tenantId?: string | null;
    // BRAND-001: Tenant branding — returned by login/register, stored in authStore.
    // Used by Sidebar (company name split), Header (display name), and reports.
    companyName?: string | null;
    companyLogo?: string | null;
    companyEmail?: string | null;
    tenantSlug?: string | null;
    isPlatformAdmin?: boolean;
}

export interface AuthLoginResponse {
    token: string;
    user: AuthUser;
}

// CRIT-002: MFA challenge — returned instead of token when user has MFA enabled
export interface AuthMfaChallenge {
    mfaRequired: true;
    tempToken: string;
    message: string;
}

export type LoginResult = AuthLoginResponse | AuthMfaChallenge;

export function isMfaChallenge(r: LoginResult): r is AuthMfaChallenge {
    return (r as AuthMfaChallenge).mfaRequired === true;
}

export const authApi = {
    login: (username: string, password: string) =>
        post<LoginResult>('/auth/login', { username, password }),

    // CRIT-002: Complete MFA challenge with a 6-digit TOTP code or backup code
    mfaVerify: (tempToken: string, code: string) =>
        post<AuthLoginResponse>('/auth/mfa/verify', { tempToken, code }),

    // MFA management (Profile page)
    mfaSetup: () =>
        post<{ secret: string; qrDataUrl: string; backupCodes: string[] }>('/auth/mfa/setup', {}),

    mfaEnable: (data: { secret: string; code: string; backupCodes: string[] }) =>
        post<{ success: boolean; message: string }>('/auth/mfa/enable', data),

    mfaDisable: (password: string) =>
        post<{ success: boolean; message: string }>('/auth/mfa/disable', { password }),

    me: () => get<AuthUser & { status: string }>('/auth/me'),

    requestRegisterOtp: (data: { email: string; fullName: string }) =>
        post<{ message: string; otp: string }>('/auth/register/request-otp', data),

    verifyRegisterOtp: (data: { email: string; otp: string }) =>
        post<{ message: string }>('/auth/register/verify-otp', data),

    register: (data: {
        username?: string;
        email: string;
        password: string;
        fullName: string;
        phone?: string;
        otp?: string;
        companyName?: string;
        tenantName?: string;
        planId?: string;
        city?: string;
        country?: string;
    }) => post<{ message: string; token: string; user: AuthUser }>('/auth/register', data),

    requestPasswordResetOtp: (data: { email?: string; phone?: string; identifier?: string }) =>
        post<{ message: string; otp?: string }>('/auth/forgot-password/request-otp', data),

    verifyPasswordResetOtp: (data: { email: string; otp: string }) =>
        post<{ message: string }>('/auth/forgot-password/verify-otp', data),

    resetPassword: (data: { email: string; otp: string; newPassword: string }) =>
        post<{ message: string }>('/auth/forgot-password/reset', data),

    googleLogin: (data: { credential: string; action: 'login' | 'register' }) =>
        post<{ message: string; token: string; user: AuthUser }>('/auth/google', data),
};

export const profileApi = {
    get: () => get<AuthUser>('/auth/profile'),
    update: (data: { fullName?: string; username?: string; email?: string; phone?: string }) =>
        put<{ message: string }>('/auth/profile', data),
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
        post<{ message: string }>('/auth/profile/change-password', data),
};
