# Database Schema Setup Guide - Railway PostgreSQL

## 🚨 ISSUE: Database Has No Tables

Your Railway PostgreSQL database is empty and needs the schema to be applied. The Prisma schema defines **20+ tables** that need to be created.

---

## 📋 Required Database Tables (20 Models)

### Core Business Tables:
1. **users** - User accounts and authentication
2. **tenants** - Multi-tenant support
3. **clients** - ISP subscribers
4. **packages** - Service offerings
5. **subscriptions** - Client service activations
6. **transactions** - Payment records
7. **invoices** - Billing documents
8. **invoice_items** - Invoice line items
9. **vouchers** - Prepaid service vouchers
10. **expenses** - Cost tracking

### Network & Infrastructure Tables:
11. **routers** - Network equipment
12. **router_logs** - Router activity logs
13. **equipment** - Hardware inventory
14. **hotspot_settings** - WiFi hotspot configuration

### Communication Tables:
15. **sms_messages** - SMS notifications
16. **message_templates** - SMS templates
17. **payment_channels** - Payment methods

### RADIUS Integration Tables:
18. **radacct** - RADIUS accounting records
19. **radcheck** - RADIUS authentication checks

### System Tables:
20. **system_settings** - Application configuration
21. **user_otps** - OTP verification
22. **saas_plans** - SaaS subscription plans
23. **tenant_invoices** - Multi-tenant billing

---

## 🛠️ Solution: Apply Database Schema

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

## 📊 Verification Steps

### 1. Check Table Creation:
```sql
-- Run in PostgreSQL web interface
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Expected Result:** 23+ tables including:
- users, tenants, clients, packages, subscriptions, transactions, invoices, vouchers, routers, radacct, radcheck, etc.

### 2. Check Admin User:
```sql
SELECT id, username, role FROM users WHERE username = 'admin';
```

### 3. Check SaaS Plans:
```sql
SELECT id, name, price FROM saas_plans;
```

---

## 🚨 Common Issues & Solutions

### Issue: "Database schema is not empty"
**Solution:** The database already has tables. Check if they're the right ones.

### Issue: "Can't reach database server"
**Solution:** Check DATABASE_URL and Railway PostgreSQL service status.

### Issue: "Permission denied"
**Solution:** Ensure Railway PostgreSQL service is properly linked.

### Issue: "Schema push failed"
**Solution:** Try accessing database directly via web interface and run SQL manually.

---

## 🔄 Alternative: Reset Database

If you need to start fresh:

1. **Delete Railway PostgreSQL service**
2. **Create new PostgreSQL service**
3. **Update DATABASE_URL in Railway**
4. **Run schema push again**

---

## ✅ Success Indicators

- ✅ **23+ tables created** in PostgreSQL
- ✅ **Admin user exists** (admin/admin123)
- ✅ **SaaS plans created** (Basic, Standard, Premium)
- ✅ **RADIUS triggers applied**
- ✅ **Backend service starts** without database errors
- ✅ **Frontend can login** with admin credentials

---

## 📞 Next Steps

1. **Set Railway environment variables** (see above)
2. **Run:** `cd backend && npx prisma db push`
3. **Run:** `cd backend && npx prisma db seed`
4. **Restart** Railway backend service
5. **Test:** Visit frontend and login with admin/admin123

If you encounter issues, check Railway service logs and database connection status.