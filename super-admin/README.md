# Super Admin Standalone App

This is a **standalone Vite + React** application for the **Platform Super Admin Portal**.

## Subdomain Architecture

Deploy this app on a dedicated subdomain:
- **Development:** `http://localhost:5174`  
- **Production:** `https://admin.yourdomain.com`

> The Super Admin portal runs completely separately from the main tenant frontend.

## Privacy Guarantee

The Super Admin can ONLY see:
- ✅ Tenant metadata (name, email, status, plan, license expiry)
- ✅ Platform-level MRR from license payments
- ✅ SaaS plan configuration
- ✅ Platform audit logs (PLATFORM_* actions only)
- ✅ Platform system settings (gateways, SMTP, SMS)

The Super Admin **CANNOT** see:
- ❌ Tenant clients / hotspot users / PPPoE users  
- ❌ Tenant internal revenue / transactions  
- ❌ Vouchers, router configs, VPN users  
- ❌ Tenant-level audit logs  
- ❌ Tenant system settings  

## Getting Started

```bash
cd super-admin
npm install
npm run dev
```

App runs at: http://localhost:5174

## Production Build

```bash
npm run build
# Deploy dist/ folder to your admin subdomain
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Backend API base URL | `` (proxied via Vite in dev) |

In production, set `VITE_API_URL=https://api.yourdomain.com`

## Pages

| Route | Page | Description |
|---|---|---|
| `/login` | Login | Platform admin sign-in |
| `/dashboard` | Dashboard | Platform overview, MRR, alerts |
| `/tenants` | Tenants | List, create, search, filter tenants |
| `/tenants/:id` | Tenant Detail | Full tenant profile + actions |
| `/licenses` | Licenses | Manage tenant licenses |
| `/plans` | SaaS Plans | Create/edit/delete billing plans |
| `/audit-logs` | Audit Logs | Platform action history |
| `/settings` | Settings | Gateways, SMTP, SMS, platform config |

## Authentication

Uses a **completely separate token** (`sa_token` in localStorage) from the tenant app. The `/api/super-admin/auth/login` endpoint enforces:
1. `role === 'SUPER_ADMIN'`
2. `tenantId === null` (must be a platform admin, not a tenant's own SUPER_ADMIN)
