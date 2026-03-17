const fs = require('fs');

const schemaPath = 'c:\\Users\\hqbak\\kenge\\backend\\prisma\\schema.prisma';
let schema = fs.readFileSync(schemaPath, 'utf8');

// Models that need tenantId
const modelsToUpdate = [
  'User', 'UserOtp', 'Client', 'Package', 'Subscription', 'Transaction', 'Router',
  'Equipment', 'Voucher', 'Expense', 'Invoice', 'SmsMessage', 'MessageTemplate',
  'PaymentChannel', 'SystemSetting'
];

modelsToUpdate.forEach(model => {
  const regex = new RegExp(`(model ${model} \\{[\\s\\S]*?)(@@map)`);
  schema = schema.replace(regex, `$1  tenantId String?\n  tenant   Tenant? @relation(fields: [tenantId], references: [id], onDelete: Cascade)\n\n  $2`);
});

const newModels = `
// ─── SAAS TENANT MODELS ───────────────────────────────────────────────────
model Tenant {
  id          String       @id @default(cuid())
  name        String
  email       String       @unique
  phone       String?
  status      TenantStatus @default(ACTIVE)
  planId      String
  plan        SaasPlan     @relation(fields: [planId], references: [id])
  trialStart  DateTime?
  trialEnd    DateTime?

  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  users             User[]
  clients           Client[]
  packages          Package[]
  subscriptions     Subscription[]
  transactions      Transaction[]
  routers           Router[]
  equipments        Equipment[]
  vouchers          Voucher[]
  expenses          Expense[]
  invoices          Invoice[]
  smsMessages       SmsMessage[]
  messageTemplates  MessageTemplate[]
  paymentChannels   PaymentChannel[]
  systemSettings    SystemSetting[]
  tenantInvoices    TenantInvoice[]
  tenantPayments    TenantPayment[]
  userOtps          UserOtp[]

  @@map("tenants")
}

enum TenantStatus {
  TRIALLING
  ACTIVE
  SUSPENDED
  CANCELLED
}

model SaasPlan {
  id          String   @id @default(cuid())
  name        String
  price       Float
  clientLimit Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenants     Tenant[]
  invoices    TenantInvoice[]

  @@map("saas_plans")
}

model TenantInvoice {
  id            String              @id @default(cuid())
  invoiceNumber String              @unique
  tenantId      String
  tenant        Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  planId        String
  plan          SaasPlan            @relation(fields: [planId], references: [id])
  amount        Float
  status        TenantInvoiceStatus @default(PENDING)
  dueDate       DateTime
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  payments      TenantPayment[]

  @@map("tenant_invoices")
}

enum TenantInvoiceStatus {
  PENDING
  PAID
  EXPIRED
}

model TenantPayment {
  id            String         @id @default(cuid())
  invoiceId     String
  invoice       TenantInvoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  tenantId      String
  tenant        Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  amount        Float
  transactionId String?        @unique
  paymentMethod String         @default("PALMPESA") // e.g. MIX_BY_YAS, AIRTEL_MONEY, HALOPESA, MPESA
  status        PaymentStatus  @default(PENDING)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@map("tenant_payments")
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
}
`;

schema += "\n" + newModels;
fs.writeFileSync(schemaPath, schema);
console.log("Schema updated");
