// ── Auth & Profile API ────────────────────────────────────────────────────────
import { get, post, put } from './httpClient';

export interface AuthUser {
    id: string; username: string; email: string;
    role: string; phone?: string; fullName?: string;
}
export interface AuthLoginResponse { token: string; user: AuthUser; }

export const authApi = {
    login: (username: string, password: string) =>
        post<AuthLoginResponse>('/auth/login', { username, password }),
    me: () => get<AuthUser & { status: string }>('/auth/me'),
    requestRegisterOtp: (data: { email: string; fullName: string }) =>
        post<{ message: string; otp: string }>('/auth/register/request-otp', data),
    verifyRegisterOtp: (data: { email: string; otp: string }) =>
        post<{ message: string }>('/auth/register/verify-otp', data),
    register: (data: {
        username: string; email: string; password: string; fullName: string;
        phone?: string; otp?: string; companyName?: string; planId?: string;
        city?: string; country?: string;
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
        put<{ message: string }>('/auth/profile', data),
};
