import { z } from 'zod';
import {
  createPackageSchema,
  updatePackageSchema,
  createClientSchema,
  createExpenseSchema,
} from './validation';

export const VoucherCreateSchema = z.object({
  code: z.string().optional(),
  packageId: z.string(),
  routerId: z.string().nullable().optional(),
  createdById: z.string().nullable().optional(),
  status: z.string().optional(),
  usedBy: z.string().nullable().optional(),
  customer: z.number().nullable().optional(),
});

export const VoucherUpdateSchema = VoucherCreateSchema.partial();

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

export const EquipmentCreateSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  serialNumber: z.string().optional(),
  location: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  routerId: z.string().nullable().optional(),
});

export const EquipmentUpdateSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  serialNumber: z.string().optional(),
  status: z.string().optional(),
  location: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  routerId: z.string().nullable().optional(),
});

export type VoucherCreate = z.infer<typeof VoucherCreateSchema>;
export type VoucherUpdate = z.infer<typeof VoucherUpdateSchema>;
export type RadiusUserCreate = z.infer<typeof RadiusUserCreateSchema>;
export type EquipmentCreate = z.infer<typeof EquipmentCreateSchema>;
export type EquipmentUpdate = z.infer<typeof EquipmentUpdateSchema>;

export const AuthRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().optional(),
  tenantName: z.string().optional(),
  companyName: z.string().optional(),
  organization: z.string().optional(),
  planId: z.string().optional(),
  phone: z.string().optional(),
  companyLogo: z.string().optional(),
  logoUrl: z.string().optional(),
  otp: z.string().optional(),
});

export const ClientCreateSchema = z.object({
  username: z.string().optional(),
  fullName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  serviceType: z.string().optional(),
  accountType: z.string().optional(),
  planId: z.string().optional(),
  status: z.string().optional(),
  device: z.string().optional(),
  macAddress: z.string().optional(),
});

export const ClientUpdateSchema = ClientCreateSchema.partial();

export const ExpenseCreateSchema = createExpenseSchema;
export const ExpenseUpdateSchema = ExpenseCreateSchema.partial();

export const InvoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  total: z.number().min(0),
});

export const InvoiceCreateSchema = z.object({
  invoiceNumber: z.string().optional(),
  clientId: z.string().optional(),
  tenantId: z.string().optional(),
  amount: z.number().min(0),
  status: z.enum(['PAID', 'UNPAID', 'OVERDUE', 'DRAFT']).optional(),
  dueDate: z.string().optional(),
  issuedDate: z.string().optional(),
  items: z.array(InvoiceItemSchema).optional(),
});

export const InvoiceUpdateSchema = InvoiceCreateSchema.partial();

export const PackageCreateSchema = createPackageSchema;
export const PackageUpdateSchema = updatePackageSchema;

export const PaymentChannelUpdateSchema = z.object({}).passthrough();
export const SubscriptionCreateSchema = z.object({}).passthrough();
export const SubscriptionUpdateSchema = z.object({}).passthrough();
export const RouterUpdateSchema = z.object({
  name: z.string().optional(),
  host: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  port: z.union([z.number(), z.string().transform(Number), z.null()]).optional(),
  apiPort: z.union([z.number(), z.string().transform(Number), z.null()]).optional(),
  type: z.string().optional(),
  vendor: z.string().optional(),
  model: z.string().optional(),
  architecture: z.string().optional(),
  firmwareVersion: z.string().optional(),
  apiType: z.string().optional(),
  vpnMode: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  accountingEnabled: z.boolean().optional(),
  licenseLevel: z.string().optional(),
  healthStatus: z.string().optional(),
  provisioningStatus: z.string().optional(),
  featureFlags: z.string().optional(),
  lanIp: z.string().nullable().optional(),
  lanGateway: z.string().nullable().optional(),
  hotspotPoolRange: z.string().nullable().optional(),
  pppoePoolRange: z.string().nullable().optional(),
  dns: z.string().nullable().optional(),
  serviceType: z.enum(['hotspot', 'pppoe', 'both']).nullable().optional(),
})
.passthrough()
.superRefine((data, ctx) => {
    // Only enforce conditional requirement if the user is explicitly setting network fields.
    const hasNetworkFields = data.lanIp !== undefined || data.lanGateway !== undefined || data.hotspotPoolRange !== undefined || data.pppoePoolRange !== undefined || data.serviceType !== undefined;
    
    if (hasNetworkFields) {
        const sType = data.serviceType || 'both';
        if ((sType === 'hotspot' || sType === 'both') && data.hotspotPoolRange === null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "hotspotPoolRange is required when serviceType includes hotspot",
                path: ['hotspotPoolRange'],
            });
        }
        if ((sType === 'pppoe' || sType === 'both') && data.pppoePoolRange === null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "pppoePoolRange is required when serviceType includes pppoe",
                path: ['pppoePoolRange'],
            });
        }
    }
});
export const VpnUserCreateSchema = z.object({}).passthrough();
