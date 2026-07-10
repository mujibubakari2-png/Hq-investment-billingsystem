const fs = require('fs');
let sql = fs.readFileSync('pending_migration.sql', 'utf16le').replace(/^\uFEFF/, '');

const decimalSql = `
-- Convert Float fields to Decimal(12, 2)
ALTER TABLE "packages" ALTER COLUMN "price" TYPE DECIMAL(12, 2);
ALTER TABLE "transactions" ALTER COLUMN "amount" TYPE DECIMAL(12, 2);
ALTER TABLE "expenses" ALTER COLUMN "amount" TYPE DECIMAL(12, 2);
ALTER TABLE "invoices" ALTER COLUMN "amount" TYPE DECIMAL(12, 2);
ALTER TABLE "invoice_items" ALTER COLUMN "unitPrice" TYPE DECIMAL(12, 2), ALTER COLUMN "total" TYPE DECIMAL(12, 2);
ALTER TABLE "saas_plans" ALTER COLUMN "price" TYPE DECIMAL(12, 2);
ALTER TABLE "tenant_invoices" ALTER COLUMN "amount" TYPE DECIMAL(12, 2);
ALTER TABLE "tenant_payments" ALTER COLUMN "amount" TYPE DECIMAL(12, 2);
`;

sql = decimalSql + '\n' + sql;

const migrationDir = 'prisma/migrations/20260710120000_float_to_decimal_and_cascade_removal';
if (!fs.existsSync(migrationDir)) {
    fs.mkdirSync(migrationDir, { recursive: true });
}
fs.writeFileSync(migrationDir + '/migration.sql', sql);
console.log('Migration created successfully.');
