import { z } from 'zod';

// Package validation schemas
export const createPackageSchema = z.object({
    name: z.string().min(1, 'Package name is required').max(100, 'Package name too long'),
    type: z.enum(['HOTSPOT', 'PPPOE']),
    category: z.enum(['PERSONAL', 'BUSINESS']),
    uploadSpeed: z.number().min(0, 'Upload speed must be positive'),
    uploadUnit: z.enum(['Kbps', 'Mbps', 'Gbps']),
    downloadSpeed: z.number().min(0, 'Download speed must be positive'),
    downloadUnit: z.enum(['Kbps', 'Mbps', 'Gbps']),
    price: z.number().min(0, 'Price must be positive'),
    duration: z.number().int().min(1, 'Duration must be at least 1'),
    durationUnit: z.enum(['MINUTES', 'HOURS', 'DAYS', 'MONTHS']),
    routerId: z.string().optional(),
    burstEnabled: z.boolean().optional(),
    hotspotType: z.enum(['UNLIMITED', 'DATA_CAPPED']).optional(),
    devices: z.number().int().min(1).optional(),
    paymentType: z.enum(['PREPAID', 'POSTPAID']),
});

export const updatePackageSchema = createPackageSchema.partial().extend({
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

// Client validation schemas
export const createClientSchema = z.object({
    username: z.string().min(1, 'Username is required').max(50, 'Username too long'),
    fullName: z.string().min(1, 'Full name is required').max(100, 'Full name too long'),
    phone: z.string().optional(),
    email: z.string().email('Invalid email format').optional(),
    serviceType: z.enum(['HOTSPOT', 'PPPOE']),
    accountType: z.enum(['PERSONAL', 'BUSINESS']),
    macAddress: z.string().optional(),
    device: z.string().optional(),
});

// User validation schemas
export const createUserSchema = z.object({
    username: z.string().min(1, 'Username is required').max(50, 'Username too long'),
    fullName: z.string().min(1, 'Full name is required').max(100, 'Full name too long'),
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    phone: z.string().optional(),
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'AGENT', 'VIEWER']),
});

// Transaction validation schemas
export const createTransactionSchema = z.object({
    clientId: z.string().min(1, 'Client ID is required'),
    amount: z.number().min(0, 'Amount must be positive'),
    type: z.enum(['MANUAL', 'MOBILE', 'VOUCHER']),
    method: z.string().min(1, 'Payment method is required'),
    reference: z.string().min(1, 'Reference is required'),
});

// Expense validation schemas
export const createExpenseSchema = z.object({
    category: z.string().min(1, 'Category is required'),
    description: z.string().min(1, 'Description is required'),
    amount: z.number().min(0, 'Amount must be positive'),
    date: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid date format'),
    reference: z.string().optional(),
    receipt: z.string().optional(),
});

// Helper function to validate and return errors
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
    const result = schema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    } else {
        const errors = result.error.issues.map((err: any) => err.message);
        return { success: false, errors };
    }
}