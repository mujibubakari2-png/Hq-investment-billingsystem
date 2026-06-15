import { z } from 'zod';

// ─── Clients ──────────────────────────────────────────────────────────────
export const ClientCreateSchema = z.object({
    username: z.string().min(3),
    fullName: z.string(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    serviceType: z.enum(['HOTSPOT', 'PPPOE']),
    accountType: z.enum(['PERSONAL', 'BUSINESS']).optional(),
    macAddress: z.string().optional(),
    device: z.string().optional(),
});

export const ClientUpdateSchema = z.object({
    username: z.string().min(3).optional(),
    fullName: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    serviceType: z.enum(['HOTSPOT', 'PPPOE']).optional(),
    accountType: z.enum(['PERSONAL', 'BUSINESS']).optional(),
    macAddress: z.string().optional(),
    device: z.string().optional(),
    status: z.string().optional(),
});

// ─── Invoices ──────────────────────────────────────────────────────────────
export const InvoiceCreateSchema = z.object({
    clientId: z.string(),
    amount: z.number().positive(),
    dueDate: z.string().datetime(),
    issuedDate: z.string().datetime().optional(),
    invoiceNumber: z.string().optional(),
    status: z.enum(['DRAFT', 'PAID', 'UNPAID', 'OVERDUE']).optional(),
    items: z.array(z.object({
        description: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive(),
        total: z.number().positive(),
    })).optional(),
});

export const InvoiceUpdateSchema = z.object({
    amount: z.number().positive().optional(),
    dueDate: z.string().datetime().optional(),
    status: z.enum(['DRAFT', 'PAID', 'UNPAID', 'OVERDUE']).optional(),
});

export const InvoicePaySchema = z.object({
    transactionId: z.string().optional(),
});

export const InvoiceMarkPaidSchema = z.object({
    paidAt: z.string().datetime().optional(),
});

// ─── Subscriptions ────────────────────────────────────────────────────────
export const SubscriptionCreateSchema = z.object({
    clientId: z.string(),
    packageId: z.string(),
    routerId: z.string().optional(),
    expiresAt: z.string().datetime(),
    method: z.string().optional(),
});

export const SubscriptionUpdateSchema = z.object({
    status: z.enum(['ACTIVE', 'EXPIRED', 'EXTENDED', 'SUSPENDED']).optional(),
    expiresAt: z.string().datetime().optional(),
    onlineStatus: z.enum(['ONLINE', 'OFFLINE']).optional(),
    packageId: z.string().optional(),
    routerId: z.string().nullable().optional(),
    activatedAt: z.string().datetime().optional(),
    method: z.string().optional(),
});

// ─── Packages ─────────────────────────────────────────────────────────────
export const PackageCreateSchema = z.object({
    name: z.string(),
    type: z.enum(['HOTSPOT', 'PPPOE']),
    uploadSpeed: z.number().positive(),
    downloadSpeed: z.number().positive(),
    price: z.number().positive(),
    duration: z.number().int().positive(),
    durationUnit: z.enum(['MINUTES', 'HOURS', 'DAYS', 'MONTHS']),
    category: z.enum(['PERSONAL', 'BUSINESS']).optional(),
    routerId: z.string().optional(),
    paymentType: z.enum(['PREPAID', 'POSTPAID']).optional(),
    burstEnabled: z.boolean().optional(),
    devices: z.number().int().optional(),
});

export const PackageUpdateSchema = z.object({
    name: z.string().optional(),
    type: z.enum(['HOTSPOT', 'PPPOE']).optional(),
    category: z.enum(['PERSONAL', 'BUSINESS']).optional(),
    uploadSpeed: z.number().positive().optional(),
    uploadUnit: z.string().optional(),
    downloadSpeed: z.number().positive().optional(),
    downloadUnit: z.string().optional(),
    price: z.number().positive().optional(),
    duration: z.number().int().positive().optional(),
    durationUnit: z.enum(['MINUTES', 'HOURS', 'DAYS', 'MONTHS']).optional(),
    burstEnabled: z.boolean().optional(),
    hotspotType: z.string().optional(),
    devices: z.number().int().optional(),
    paymentType: z.enum(['PREPAID', 'POSTPAID']).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    routerId: z.string().optional(),
    router: z.string().optional(),
});

// ─── Routers ──────────────────────────────────────────────────────────────
export const RouterCreateSchema = z.object({
    name: z.string(),
    host: z.string(),
    username: z.string().optional(),
    password: z.string().optional(),
    port: z.number().int().optional(),
    apiPort: z.number().int().optional(),
    restPort: z.number().int().optional(),
    type: z.string().optional(),
    description: z.string().optional(),
});

export const RouterUpdateSchema = z.object({
    name: z.string().optional(),
    host: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    port: z.number().int().optional(),
    apiPort: z.number().int().optional(),
    restPort: z.number().int().optional(),
    type: z.string().optional(),
    description: z.string().optional(),
    vpnMode: z.string().optional(),
    accountingEnabled: z.boolean().optional(),
    status: z.enum(['ONLINE', 'OFFLINE']).optional(),
});

// ─── Vouchers ─────────────────────────────────────────────────────────────
export const VoucherCreateSchema = z.object({
    code: z.string().optional(),
    packageId: z.string(),
    routerId: z.string().nullable().optional(),
    createdById: z.string().nullable().optional(),
    status: z.enum(['ACTIVE', 'EXPIRED', 'UNUSED', 'USED', 'REVOKED']).optional(),
    usedBy: z.string().nullable().optional(),
    customer: z.string().nullable().optional(),
});

// ─── VPN Users ────────────────────────────────────────────────────────────
export const VpnUserCreateSchema = z.object({
    username: z.string().min(3),
    password: z.string().min(6),
    fullName: z.string().optional(),
    protocol: z.string().optional(),
    profile: z.string().optional(),
    routerId: z.string(),
    localAddress: z.string().optional(),
    remoteAddress: z.string().optional(),
    service: z.string().optional(),
});

export const VpnUserUpdateSchema = z.object({
    fullName: z.string().optional(),
    password: z.string().min(6).optional(),
    status: z.string().optional(),
});

// ─── RADIUS Users ─────────────────────────────────────────────────────────
export const RadiusUserCreateSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(6),
    fullName: z.string().nullable().optional(),
    authType: z.string().nullable().optional(),
    groupName: z.string().nullable().optional(),
    speed: z.string().nullable().optional(),
    dataLimit: z.string().nullable().optional(),
    sessionTimeout: z.string().nullable().optional(),
    simultaneousUse: z.number().int().nullable().optional(),
    framedIpAddress: z.string().nullable().optional(),
    tenantId: z.string().nullable().optional(),
});

export const RadiusUserUpdateSchema = z.object({
    password: z.string().min(6).optional(),
    fullName: z.string().optional(),
    speed: z.string().optional(),
    dataLimit: z.string().optional(),
});

// ─── Equipment ────────────────────────────────────────────────────────────
export const EquipmentCreateSchema = z.object({
    name: z.string(),
    type: z.string(),
    serialNumber: z.string(),
    location: z.string().optional(),
    assignedTo: z.string().optional(),
    purchaseDate: z.string().datetime().optional(),
    notes: z.string().optional(),
    routerId: z.string().optional(),
});

export const EquipmentUpdateSchema = z.object({
    name: z.string().optional(),
    type: z.string().optional(),
    location: z.string().optional(),
    assignedTo: z.string().optional(),
    serialNumber: z.string().optional(),
    purchaseDate: z.string().datetime().optional(),
    notes: z.string().optional(),
    routerId: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).optional(),
});

// ─── Expenses ─────────────────────────────────────────────────────────────
export const ExpenseCreateSchema = z.object({
    category: z.string(),
    description: z.string(),
    amount: z.number().positive(),
    date: z.string().datetime(),
    reference: z.string().optional(),
    receipt: z.string().optional(),
});

export const ExpenseUpdateSchema = z.object({
    category: z.string().optional(),
    description: z.string().optional(),
    amount: z.number().positive().optional(),
    date: z.string().datetime().optional(),
    reference: z.string().optional(),
    receipt: z.string().optional(),
});

// ─── Payment Channels ─────────────────────────────────────────────────────
export const PaymentChannelCreateSchema = z.object({
    name: z.string(),
    provider: z.string(),
    accountNumber: z.string().optional(),
    apiKey: z.string().optional(),
    apiSecret: z.string().optional(),
    webhookSecret: z.string().optional(),
    environment: z.string().optional(),
});

export const PaymentChannelUpdateSchema = z.object({
    name: z.string().optional(),
    provider: z.string().optional(),
    accountNumber: z.string().optional(),
    apiKey: z.string().optional(),
    apiSecret: z.string().optional(),
    webhookSecret: z.string().optional(),
    environment: z.string().optional(),
    status: z.string().optional(),
    config: z.any().optional(),
});

// ─── Auth ─────────────────────────────────────────────────────────────────
export const AuthRegisterSchema = z.object({
    email: z.string().email(),
    otp: z.string(),
    password: z.string().min(8),
    fullName: z.string().optional(),
});

export const AuthLoginSchema = z.object({
    username: z.string(),
    password: z.string(),
});

export const ChangePasswordSchema = z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(8),
});

export const VerifyMfaSchema = z.object({
    code: z.string(),
    rememberMe: z.boolean().optional(),
});

// ─── Export all types ─────────────────────────────────────────────────────
export type ClientCreate = z.infer<typeof ClientCreateSchema>;
export type ClientUpdate = z.infer<typeof ClientUpdateSchema>;
export type InvoiceCreate = z.infer<typeof InvoiceCreateSchema>;
export type InvoiceUpdate = z.infer<typeof InvoiceUpdateSchema>;
export type SubscriptionCreate = z.infer<typeof SubscriptionCreateSchema>;
export type SubscriptionUpdate = z.infer<typeof SubscriptionUpdateSchema>;
export type PackageCreate = z.infer<typeof PackageCreateSchema>;
export type PackageUpdate = z.infer<typeof PackageUpdateSchema>;
export type RouterCreate = z.infer<typeof RouterCreateSchema>;
export type RouterUpdate = z.infer<typeof RouterUpdateSchema>;
export type VoucherCreate = z.infer<typeof VoucherCreateSchema>;
export type VpnUserCreate = z.infer<typeof VpnUserCreateSchema>;
export type VpnUserUpdate = z.infer<typeof VpnUserUpdateSchema>;
export type RadiusUserCreate = z.infer<typeof RadiusUserCreateSchema>;
export type RadiusUserUpdate = z.infer<typeof RadiusUserUpdateSchema>;
export type EquipmentCreate = z.infer<typeof EquipmentCreateSchema>;
export type EquipmentUpdate = z.infer<typeof EquipmentUpdateSchema>;
export type ExpenseCreate = z.infer<typeof ExpenseCreateSchema>;
export type ExpenseUpdate = z.infer<typeof ExpenseUpdateSchema>;
export type PaymentChannelCreate = z.infer<typeof PaymentChannelCreateSchema>;
export type PaymentChannelUpdate = z.infer<typeof PaymentChannelUpdateSchema>;
export type AuthRegister = z.infer<typeof AuthRegisterSchema>;
export type AuthLogin = z.infer<typeof AuthLoginSchema>;
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;
export type VerifyMfa = z.infer<typeof VerifyMfaSchema>;
