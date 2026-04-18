# Railway PostgreSQL Database Schema Setup Guide

**Last Updated:** April 18, 2026  
**Database:** PostgreSQL 15+  
**ORM:** Prisma 7.4.2  
**Node.js:** 20.19.0+

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Database Tables Overview](#database-tables-overview)
3. [Step-by-Step Schema Setup](#step-by-step-schema-setup)
4. [Verification Steps](#verification-steps)
5. [Troubleshooting](#troubleshooting)
6. [Post-Setup Validation](#post-setup-validation)

---

## 🚀 Quick Start

### Prerequisites
- Railway PostgreSQL instance running
- Backend service installed with `pnpm install`
- Node.js 20.19.0+ installed locally
- `DATABASE_URL` environment variable configured

### One-Command Setup

```bash
# From backend directory
cd backend

# 1. Apply schema (creates all tables)
npx prisma db push

# 2. Seed initial data
npx prisma db seed

# 3. Verify setup (see Verification section)
npx prisma studio  # Opens interactive database browser
```

---

## 📊 Database Tables Overview

### Core Tables (28 Total)

#### **Authentication & User Management (2 tables)**
| Table | Purpose | Records |
|-------|---------|---------|
| `users` | System users (super admin, admin, agents, viewers) | Multiple per tenant |
| `user_otps` | One-time passwords for authentication | Temporary |

#### **Client Management (2 tables)**
| Table | Purpose | Records |
|-------|---------|---------|
| `clients` | Internet service customers/subscribers | Multiple per tenant |
| `subscriptions` | Active subscriptions linking clients to packages | One per client package |

#### **Service & Billing (5 tables)**
| Table | Purpose | Records |
|-------|---------|---------|
| `packages` | Internet service packages (speeds, prices, durations) | Multiple per router |
| `invoices` | Customer billing documents | Multiple per client |
| `invoice_items` | Line items within invoices | Multiple per invoice |
| `transactions` | Payment records from clients | Multiple per client |
| `tenant_invoices` | SaaS billing for tenant subscriptions | Multiple per tenant |

#### **Payment Processing (2 tables)**
| Table | Purpose | Records |
|-------|---------|---------|
| `payment_channels` | Payment providers/methods configured | Multiple per tenant |
| `tenant_payments` | Payment history for tenant subscriptions | Multiple per invoice |

#### **Router & Network Infrastructure (4 tables)**
| Table | Purpose | Records |
|-------|---------|---------|
| `routers` | MikroTik/network devices | Multiple per tenant |
| `router_logs` | Router activity audit trail | Multiple per router |
| `equipments` | Physical equipment inventory | Multiple per router |
| `hotspot_settings` | Hotspot portal customization per router | One per router |

#### **Voucher & Promotions (1 table)**
| Table | Purpose | Records |
|-------|---------|---------|
| `vouchers` | Prepaid service vouchers | Multiple per package |

#### **RADIUS Authentication (3 tables)**
| Table | Purpose | Records |
|-------|---------|---------|
| `radius_users` | RADIUS user accounts for PPPoE authentication | Multiple per tenant |
| `radius_nas` | Network Access Server configurations | Multiple per tenant |
| `radcheck` | RADIUS check attributes (passwords) | One per user |

#### **RADIUS Accounting (1 table)**
| Table | Purpose | Records |
|-------|---------|---------|
| `radacct` | Session accounting records from RADIUS | Millions (high-volume) |

#### **VPN Users (1 table)**
| Table | Purpose | Records |
|-------|---------|---------|
| `vpn_users` | L2TP/VPN account users | Multiple per router |

#### **System Configuration (4 tables)**
| Table | Purpose | Records |
|-------|---------|---------|
| `system_settings` | Key-value configuration storage | Multiple per tenant |
| `message_templates` | SMS/notification message templates | Multiple per tenant |
| `expenses` | Operational expense tracking | Multiple per tenant |
| `sms_messages` | SMS message history | Multiple per tenant |

#### **Multi-Tenancy (3 tables)**
| Table | Purpose | Records |
|-------|---------|---------|
| `tenants` | SaaS customers/organizations | One per customer |
| `saas_plans` | Available subscription tier plans | Few (3-5 typically) |
| `rate_limits` | Request rate limiting per endpoint | Dynamic |

---

## 🔧 Step-by-Step Schema Setup

### ✅ **Automatic Deployment (Recommended)**

The database schema and seeding are now **automatically applied** during Railway deployment:

```toml
# railway.toml - Backend Service Build Command
buildCommand = "npm install -g pnpm && pnpm install --frozen-lockfile && pnpm run build && npx prisma db push && npx prisma db seed"
```

**What happens automatically:**
1. ✅ Install dependencies
2. ✅ Build the application
3. ✅ **Apply database schema** (`npx prisma db push`)
4. ✅ **Seed the database** (`npx prisma db seed`)
5. ✅ Start the application

### Method 2: Manual Execution (If needed)

Since your project uses Prisma without migration files, use `prisma db push`:

```bash
# Navigate to backend directory
cd backend

# Push schema to Railway database
npx prisma db push
```

**Requirements:**
- Railway backend service must have `DATABASE_URL` set
- Backend service must be running
- Database must be accessible

### Method 2: Manual Railway Database Setup

If Method 1 fails:

1. **Access Railway PostgreSQL:**
   - Go to: https://postgres-production-caa91.up.railway.app/
   - Use the web interface to run SQL commands

2. **Generate Schema SQL:**
   ```bash
   cd backend
   npx prisma generate
   npx prisma db push --preview-feature
   ```

3. **Run Custom SQL:**
   Execute the RADIUS triggers SQL:
   ```sql
   -- Copy from: backend/prisma/migrations/radius_tenant_triggers.sql
   ```

---

## 🌱 Database Seeding

After schema is applied, seed with initial data:

```bash
cd backend
npx prisma db seed
```

**Seeds Created:**
- ✅ Admin user (username: `admin`, password: `admin123`)
- ✅ Basic, Standard, Premium SaaS plans
- ✅ Default system settings
- ✅ Sample tenant structure

---

## 🔧 Railway Environment Variables (Required)

Ensure these are set in Railway Backend Service:

```bash
CORS_ORIGIN=https://frontend-production-440c.up.railway.app
NODE_ENV=production
JWT_SECRET=5deed8661cd0e80017907acb9012ae57054bc2e341bb64db9f683c888fb8fc9f
DATABASE_URL=postgresql://postgres:MgIqXNpCJxZpTPOgodBgtoZYnOrcgsUD@postgres.railway.internal:5432/railway
```

---

## ✅ Verification Steps

### 1. Check All Tables Exist

```bash
cd backend

# Interactive browser to explore database
npx prisma studio

# Or run SQL query to list all tables
npx prisma db execute --stdin <<EOF
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
EOF
```

**Expected:** 28 tables listed, all owned by postgres user.

---

### 2. Verify Key Relationships

```bash
# Check foreign key constraints exist
npx prisma db execute --stdin <<EOF
SELECT 
  constraint_name,
  table_name,
  column_name,
  foreign_table_name
FROM information_schema.key_column_usage
WHERE table_schema = 'public'
AND foreign_table_name IS NOT NULL
ORDER BY table_name;
EOF
```

**Expected relationships:**
- `clients.tenantId` → `tenants.id`
- `subscriptions.clientId` → `clients.id`
- `packages.tenantId` → `tenants.id`
- And 20+ more...

---

### 3. Verify Indexes Exist

```bash
# Check indexes for performance optimization
npx prisma db execute --stdin <<EOF
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename;
EOF
```

**Expected:** 50+ indexes on common query columns (tenantId, status, createdAt, etc.)

---

### 4. Check Admin User Created

```bash
npx prisma db execute --stdin <<EOF
SELECT id, username, email, role FROM users LIMIT 1;
EOF
```

**Expected:** At least one user with SUPER_ADMIN role

---

### 5. Check SaaS Plans Seeded

```bash
npx prisma db execute --stdin <<EOF
SELECT id, name, price, "clientLimit" FROM saas_plans;
EOF
```

**Expected:** 3 plans (Basic, Pro, Enterprise)

---

### 6. Check Database Size

```bash
# See table sizes
npx prisma db execute --stdin <<EOF
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
EOF
```

**Expected:** Total database < 100MB

---

## 🔍 Troubleshooting

### Issue 1: "Database connection failed"

**Error Message:**
```
error: connect ECONNREFUSED 127.0.0.1:5432
Error: connect() failed: could not connect to server
```

**Solutions:**
```bash
# 1. Verify DATABASE_URL is set correctly
echo $DATABASE_URL
# Expected: postgresql://postgres:password@postgres.railway.internal:5432/railway

# 2. Test connection directly
psql $DATABASE_URL -c "SELECT NOW();"

# 3. Check Railway PostgreSQL service is running
# Go to Railway Dashboard → Postgres Plugin → View Logs
```

---

### Issue 2: "Schema validation error"

**Error Message:**
```
Error: Schema validation error: Invalid @relation
The relation could not be found
```

**Solutions:**
```bash
# Validate schema syntax
npx prisma validate

# Check for duplicate model names
grep "^model" backend/prisma/schema.prisma | sort | uniq -d

# Regenerate Prisma client
rm -rf backend/src/generated/prisma
npx prisma generate
```

---

### Issue 3: "Permission denied" on table creation

**Error Message:**
```
Error: permission denied for schema public
```

**Solutions:**
```bash
# Check user permissions
npx prisma db execute --stdin <<EOF
SELECT * FROM information_schema.role_table_grants 
WHERE grantee = 'postgres';
EOF

# Grant permissions (as superuser)
psql -U postgres -d railway -c "GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;"
```

---

### Issue 4: "Tables already exist" when pushing schema

**Error Message:**
```
Error: The database already contains tables with the same names as the ones in your schema
```

**Solutions:**
```bash
# Option 1: Ask Prisma to handle existing tables
npx prisma db push

# Option 2: Skip generation step
npx prisma db push --skip-generate

# Option 3: Reset database (CAUTION: deletes all data - development only!)
npx prisma db push --force-reset
```

---

### Issue 5: "Seed script fails"

**Error Message:**
```
Error: Unable to evaluate data source `db`
error: The first argument must be of type string or an instance of Buffer
```

**Solutions:**
```bash
# Ensure DATABASE_URL is set
export NODE_ENV=production
export DATABASE_URL="postgresql://..."

# Check seed.ts has correct date formatting
grep -n "toISOString()" backend/prisma/seed.ts

# Run seed manually to see error details
npx prisma db seed --debug

# Check seed file permissions
chmod +x backend/prisma/seed.ts
```

**Common seed error - Date format:**
```javascript
// ❌ WRONG - JavaScript Date object
const now = new Date();

// ✅ CORRECT - ISO string
const now = new Date().toISOString();
```

---

### Issue 6: "Foreign key constraint violation"

**Error Message:**
```
Error: duplicate key violates unique constraint
OR
Error: foreign key constraint
```

**Solutions:**
```bash
# Check for orphaned references
npx prisma db execute --stdin <<EOF
SELECT * FROM clients 
WHERE "tenantId" NOT IN (SELECT id FROM tenants);
EOF

# Fix: Delete orphaned records
DELETE FROM clients WHERE "tenantId" NOT IN (SELECT id FROM tenants);

# Or recreate schema
npx prisma db push --force-reset
```

---

### Issue 7: "High memory usage during schema creation"

**Error Message:**
```
JavaScript heap out of memory
Error: Process exited with code 134
```

**Solutions:**
```bash
# Increase Node memory limit
NODE_OPTIONS=--max-old-space-size=4096 npx prisma db push

# Or use batch approach
NODE_OPTIONS=--max-old-space-size=4096 npx prisma db seed
```

---

### Issue 8: "RADIUS tables not created properly"

**Error Message:**
```
Error: radacct.radacctid is not auto-incrementing
Error: sequence not found
```

**Solutions:**
```bash
# Verify sequence exists
npx prisma db execute --stdin <<EOF
SELECT * FROM information_schema.sequences 
WHERE sequence_name LIKE '%radacct%';
EOF

# Fix sequence if missing
npx prisma db execute --stdin <<EOF
CREATE SEQUENCE IF NOT EXISTS radacct_radacctid_seq 
START WITH 1 INCREMENT BY 1;
ALTER TABLE radacct ALTER COLUMN radacctid 
SET DEFAULT nextval('radacct_radacctid_seq');
EOF
```

---

### Issue 9: "Can't find schema.prisma"

**Error Message:**
```
Error: Could not find schema.prisma
```

**Solutions:**
```bash
# Make sure you're in backend directory
cd backend

# Verify file exists
ls -la prisma/schema.prisma

# If missing, restore from git
git checkout prisma/schema.prisma
```

---

### Issue 10: "Timeout waiting for database"

**Error Message:**
```
Error: P4001: Client initialization timed out
Error: Target database does not exist
```

**Solutions:**
```bash
# Increase timeout
PRISMA_CLIENT_ENGINE_TYPE=binary npx prisma db push

# Check if database exists
psql $DATABASE_URL -c "SELECT datname FROM pg_database WHERE datname = 'railway';"

# If not, create it
createdb -U postgres railway
```

---

## 📈 Post-Setup Validation

### Performance Baseline Checks

```bash
# Query execution time (should be < 100ms)
npx prisma db execute --stdin <<EOF
EXPLAIN ANALYZE
SELECT * FROM clients WHERE "tenantId" = 'any-tenant-id' LIMIT 10;
EOF

# Index usage statistics
npx prisma db execute --stdin <<EOF
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
EOF

# Table bloat check
npx prisma db execute --stdin <<EOF
SELECT 
  schemaname,
  tablename,
  ROUND(100.0 * pg_total_relation_size(schemaname||'.'||tablename) / 
    (SELECT pg_database_size(current_database()))) AS pct
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
EOF
```

---

### Backup After Successful Setup

```bash
# Create backup after successful schema application
pg_dump $DATABASE_URL > backup_schema_complete_$(date +%Y%m%d_%H%M%S).sql

# Store backup securely
ls -lh backup_schema_complete_*.sql

# Test backup can be restored (on separate database)
# createdb -U postgres railway_test
# pg_restore -d railway_test backup_schema_complete_20260418_120000.sql
```

---

### Create Monitoring Views

```bash
# Save these queries as views for monitoring
npx prisma db execute --stdin <<EOF

-- Tenant statistics view
CREATE OR REPLACE VIEW v_tenant_stats AS
SELECT 
  t.id,
  t.name,
  COUNT(DISTINCT c.id) as client_count,
  COUNT(DISTINCT u.id) as user_count,
  COUNT(DISTINCT r.id) as router_count,
  t."createdAt",
  t.status
FROM tenants t
LEFT JOIN clients c ON c."tenantId" = t.id
LEFT JOIN users u ON u."tenantId" = t.id
LEFT JOIN routers r ON r."tenantId" = t.id
GROUP BY t.id, t.name, t."createdAt", t.status;

-- Active subscriptions view
CREATE OR REPLACE VIEW v_active_subscriptions AS
SELECT 
  s.id,
  c.username,
  p.name,
  s."activatedAt",
  s."expiresAt",
  CASE WHEN s."expiresAt" < NOW() THEN 'EXPIRED' ELSE s.status END as actual_status
FROM subscriptions s
JOIN clients c ON c.id = s."clientId"
JOIN packages p ON p.id = s."packageId"
WHERE s.status = 'ACTIVE';

-- Monthly revenue view
CREATE OR REPLACE VIEW v_monthly_revenue AS
SELECT 
  DATE_TRUNC('month', t."createdAt")::date as month,
  COUNT(DISTINCT t.id) as transaction_count,
  SUM(t.amount) as total_amount,
  AVG(t.amount) as avg_amount
FROM transactions t
WHERE t.status = 'COMPLETED'
GROUP BY DATE_TRUNC('month', t."createdAt")
ORDER BY month DESC;

EOF
```

---

## 🎯 Success Indicators

✅ **Schema Setup Complete When:**

- [ ] All 28 tables created in `information_schema.tables`
- [ ] All foreign key constraints active in `information_schema.table_constraints`
- [ ] 50+ indexes created for query optimization
- [ ] Super admin user created successfully
- [ ] Can insert records without constraint violations
- [ ] Database size < 100MB
- [ ] All queries execute < 100ms
- [ ] Backup file created successfully
- [ ] No errors in Railway logs

✅ **Ready for Production When:**

- [ ] Backend API connects and queries database successfully
- [ ] Frontend dashboard displays data without errors
- [ ] User registration and login works
- [ ] All 3 services (backend, frontend, landing-page) deploy successfully
- [ ] SaaS billing processes without errors
- [ ] RADIUS authentication working (if PPPoE enabled)
- [ ] No console errors related to database operations
- [ ] Monitoring views created and working

---

## 🚀 Post-Deployment Steps

1. **Update Environment Variables** in Railway Dashboard
2. **Test Database Connectivity:**
   ```bash
   cd backend
   npm test
   ```
3. **Verify Admin Login** - Use credentials from seed output
4. **Create Test Tenant** from admin dashboard
5. **Add Test Router** and test RADIUS connectivity
6. **Create Test Packages** and test client subscriptions
7. **Verify RADIUS Accounting** - Check radacct table for sessions

---

## 📞 Support Resources

| Resource | Link |
|----------|------|
| PostgreSQL Docs | https://www.postgresql.org/docs/15/sql.html |
| Prisma Documentation | https://www.prisma.io/docs/ |
| Railway PostgreSQL | https://docs.railway.app/guides/databases#postgresql |
| RADIUS Server Guide | https://freeradius.org/documentation/ |
| MikroTik API | https://wiki.mikrotik.com/wiki/Manual:Database |

---

**Last Verified:** April 18, 2026  
**Database Version:** PostgreSQL 15+  
**Prisma Version:** 7.4.2  
**Node.js:** 20.19.0+  
**Total Tables:** 28  
**Total Indexes:** 50+  
**Schema Size:** < 100MB