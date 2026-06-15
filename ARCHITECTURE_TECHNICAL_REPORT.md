# HQ Investment ISP Billing Multi-Tenant System — Technical Architecture Report

**Date:** 2026-06-15  
**System:** ISP Billing Platform with MikroTik/RADIUS Integration  
**Status:** Production-Ready (DigitalOcean VPS)

---

## Executive Summary

HQ Investment is a **full-stack multi-tenant SaaS ISP billing platform** designed for internet service providers to manage subscribers, billing, and network infrastructure across multiple isolated customer tenants. The system provides:

- **Multi-tenant isolation** with strict data boundaries per tenant
- **Multiple payment gateway integrations** (PalmPesa, Flutterwave, Stripe, HarakaPaym, Zenopay, Mongike)
- **RADIUS + MikroTik RouterOS integration** for real-time user management and accounting
- **PPPoE and Hotspot** service types with automated provisioning
- **Role-based access control (RBAC)** with 4 role tiers
- **JWT-based authentication** with MFA (TOTP) support
- **Audit logging** for compliance
- **Field-level encryption** for sensitive credentials

---

## 1. Overall Architecture & Technology Stack

### 1.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      MONOREPO (pnpm workspaces)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐ │
│  │  BACKEND         │   │  FRONTEND (SPA)  │   │  LANDING PAGE    │ │
│  │                  │   │                  │   │                  │ │
│  │  Next.js 15      │   │  Vite + React 19 │   │  Next.js 15      │ │
│  │  API Routes      │   │  Admin Dashboard │   │  Marketing Site  │ │
│  │  (:3000)         │   │  (:5175 dev)     │   │  (:3001)         │ │
│  │                  │   │                  │   │                  │ │
│  └────────┬─────────┘   └──────────────────┘   └──────────────────┘ │
│           │                                                           │
│  ┌────────▼──────────────────────────────────────────────────────┐   │
│  │                    POSTGRESQL 16 (Primary DB)                 │   │
│  │  ├─ Core: users, tenants, clients, subscriptions, packages   │   │
│  │  ├─ Billing: invoices, transactions, payments                │   │
│  │  ├─ Network: routers, equipment, vpn_users                   │   │
│  │  ├─ RADIUS: radcheck, radreply, radacct, radusergroup        │   │
│  │  └─ Audit: audit_logs, webhook_logs                          │   │
│  └────────┬──────────────────────────────────────────────────────┘   │
│           │                                                           │
│  ┌────────▼──────────────────────┐  ┌──────────────────────────┐    │
│  │      REDIS (Cache + Queue)    │  │  EXTERNAL SERVICES      │    │
│  │  ├─ BullMQ (MikroTik ops)     │  │  ├─ MikroTik RouterOS   │    │
│  │  ├─ Rate limiting             │  │  ├─ FreeRADIUS          │    │
│  │  └─ Session storage           │  │  ├─ Payment Gateways    │    │
│  │                               │  │  ├─ Africa's Talking SMS │    │
│  │                               │  │  └─ Google OAuth        │    │
│  └───────────────────────────────┘  └──────────────────────────┘    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

Production Deployment:
  DigitalOcean Droplet → Nginx (reverse proxy) → PM2 (process manager)
  
  Backend: PM2 fork mode (1 instance on :3000)
  Landing: PM2 fork mode (1 instance on :3001)
  Frontend: Nginx serves /frontend/dist as static SPA
```

### 1.2 Technology Stack

| Layer | Technologies |
|-------|------|
| **API Server** | Next.js 15 (App Router), TypeScript 5 |
| **Frontend** | Vite 7.3, React 19, React Query 5, Zustand (state), React Router 7 |
| **Database** | PostgreSQL 16, Prisma 7.7 ORM |
| **Authentication** | JWT (separate access/refresh), MFA (TOTP/RFC 6238), bcrypt, Google OAuth |
| **Encryption** | AES-256-GCM (field-level), bcryptjs (passwords) |
| **Job Queue** | BullMQ 5.78, Redis |
| **HTTP Client** | Native Node.js (https module) |
| **UI Framework** | Material-UI (MUI) 7.3 |
| **Validation** | Zod 4.3 |
| **Logging** | Winston (custom logger in `/lib/logger.ts`) |
| **Process Manager** | PM2 (production) |
| **Web Server** | Nginx (reverse proxy, static files) |
| **Container** | Docker + Docker Compose (dev), Kubernetes-ready (Helm charts in `/deploy/helm/`) |

### 1.3 Port Assignments

| Service | Port | Protocol | Notes |
|---------|------|----------|-------|
| Backend API | 3000 | HTTP/HTTPS | PM2 fork, bound to 127.0.0.1 |
| Frontend (Vite) | 5175 | HTTP | Dev only |
| Landing Page | 3001 | HTTP/HTTPS | PM2 fork, bound to 127.0.0.1 |
| PostgreSQL | 5432 | TCP | Localhost only in production |
| PostgreSQL (test) | 5433 | TCP | Test database |
| Redis | 6379 | TCP | Default, used by BullMQ |
| Nginx | 80, 443 | HTTP/HTTPS | Production reverse proxy |

---

## 2. Backend Architecture (Next.js API)

### 2.1 Project Structure

```
backend/
├── src/
│   ├── app/
│   │   ├── api/               # API routes (REST endpoints)
│   │   │   ├── auth/          # Authentication: login, register, MFA, password reset
│   │   │   ├── admin/         # Admin dashboard endpoints
│   │   │   ├── clients/       # Subscriber management
│   │   │   ├── subscriptions/ # Subscription lifecycle (activate, expire, extend)
│   │   │   ├── packages/      # Service packages (plans)
│   │   │   ├── routers/       # MikroTik router management
│   │   │   ├── radius/        # RADIUS user sync endpoints
│   │   │   ├── hotspot/       # Hotspot portal, status checks
│   │   │   ├── pppoe/         # PPPoE user management
│   │   │   ├── vouchers/      # Voucher codes and redemption
│   │   │   ├── invoices/      # Invoice generation and tracking
│   │   │   ├── transactions/  # Payment transactions and status
│   │   │   ├── payments/      # Payment initiation endpoints
│   │   │   ├── webhooks/      # Payment gateway callbacks
│   │   │   │   ├── palmpesa/  # Callback handler
│   │   │   │   ├── flutterwave/
│   │   │   │   ├── stripe/
│   │   │   │   └── ...
│   │   │   ├── sync/          # MikroTik sync operations
│   │   │   ├── cron/          # Scheduled jobs (expiry, renewal)
│   │   │   ├── audit-logs/    # Audit trail
│   │   │   ├── system-users/  # Sub-user management
│   │   │   ├── system-settings/ # Tenant configuration
│   │   │   ├── dashboards/    # Dashboard data endpoints
│   │   │   ├── reports/       # Report generation
│   │   │   └── health/        # Health check
│   │   └── page.tsx           # Fallback page
│   ├── lib/
│   │   ├── auth.ts            # JWT signing/verification, password hashing
│   │   ├── rbac.ts            # Role-based permissions matrix
│   │   ├── tenant.ts          # Tenant isolation helpers
│   │   ├── tenantPrisma.ts    # Tenant-scoped Prisma client
│   │   ├── prisma.ts          # Global Prisma client
│   │   ├── mikrotik.ts        # MikroTik HTTP REST API integration
│   │   ├── radius.ts          # FreeRADIUS sync (radcheck/radreply)
│   │   ├── encryption.ts      # AES-256-GCM for credentials
│   │   ├── mfa.ts             # TOTP generation and verification
│   │   ├── cache.ts           # Redis caching layer
│   │   ├── queue.ts           # BullMQ job queue setup
│   │   ├── payments/
│   │   │   ├── service.ts     # Central payment orchestrator
│   │   │   ├── registry.ts    # Payment provider registry
│   │   │   ├── types.ts       # Payment interfaces
│   │   │   ├── utils.ts       # Helper functions
│   │   │   └── providers/
│   │   │       ├── palmpesa.ts
│   │   │       ├── flutterwave.ts
│   │   │       ├── stripe.ts
│   │   │       ├── harakapay.ts
│   │   │       ├── zenopay.ts
│   │   │       └── mongike.ts
│   │   ├── validators.ts      # Zod schemas for request validation
│   │   ├── logger.ts          # Winston logger configuration
│   │   ├── env.ts             # Environment variable parsing + validation
│   │   ├── softDelete.ts      # Soft delete utilities (CRIT-005 FIX)
│   │   ├── dateUtils.ts       # Date/time helpers
│   │   ├── rateLimiter.ts     # Rate limiting per IP
│   │   ├── sanitization.ts    # Input sanitization
│   │   ├── wireguard.ts       # WireGuard VPN configuration
│   │   └── ...
│   ├── middleware/
│   │   ├── csrfProtection.ts
│   │   └── rateLimiter.ts
│   ├── middleware.ts          # Next.js middleware (proxy)
│   ├── proxy.ts               # Request routing/proxying logic
│   └── workers/
│       └── mikrotik.worker.ts # BullMQ job processor
├── prisma/
│   ├── schema.prisma          # Data model (35+ models)
│   └── migrations/            # Incremental schema migrations
├── scripts/
│   ├── seed.ts                # Database seed script
│   ├── check-migrations.js    # Verify migration state
│   └── ... (setup, diagnostic scripts)
├── package.json
├── tsconfig.json
├── jest.config.ts             # Unit test configuration
└── next.config.mjs
```

### 2.2 Request Flow & Middleware

```
HTTP Request → Next.js Middleware (middleware.ts)
  ↓
  Proxy routing (proxy.ts) — determines which handler to use
  ↓
  API Route Handler (/api/auth/login, etc.)
  ↓
  ┌─ Authentication Middleware ─┐
  │ getUserFromRequest(req) →    │  Extract JWT from headers/cookies
  │ verifyToken() → JWT payload  │  Verify signature + expiry + type
  └─────────────────────────────┘
  ↓
  ┌─ Authorization Check ─┐
  │ requireRole() or       │  Check user's role against PERMISSIONS
  │ requirePermission()    │
  └───────────────────────┘
  ↓
  ┌─ Tenant Scoping ─┐
  │ getTenantFilter()  │  Ensure user can only access their tenant's data
  │ getTenantClient()  │  Return tenant-scoped Prisma client
  └───────────────────┘
  ↓
  Business Logic (query DB, integrate with MikroTik, etc.)
  ↓
  Response (JSON) → Audit Log (optional)
```

### 2.3 Key API Endpoints

#### Authentication Routes

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---|
| POST | `/api/auth/register` | Create new tenant + owner user | No |
| POST | `/api/auth/register/request-otp` | Request OTP for email verification | No |
| POST | `/api/auth/register/verify-otp` | Verify OTP and activate account | No |
| POST | `/api/auth/login` | Authenticate user → JWT tokens | No |
| POST | `/api/auth/refresh` | Exchange refresh token for new access token | Yes (refresh token) |
| POST | `/api/auth/google` | OAuth login via Google | No |
| POST | `/api/auth/forgot-password/request-otp` | Request password reset OTP | No |
| POST | `/api/auth/forgot-password/verify-otp` | Verify OTP | No |
| POST | `/api/auth/forgot-password/reset` | Reset password with OTP | No |
| GET | `/api/auth/me` | Get current user profile | Yes |
| GET/POST | `/api/auth/profile` | View/update profile | Yes |
| POST | `/api/auth/profile/change-password` | Change password | Yes |
| POST | `/api/auth/mfa/setup` | Initiate MFA setup (returns QR code) | Yes |
| POST | `/api/auth/mfa/enable` | Enable MFA with TOTP code | Yes |
| POST | `/api/auth/mfa/disable` | Disable MFA | Yes |
| POST | `/api/auth/mfa/verify` | Verify TOTP at login | Yes (temp token) |

#### Core Business Routes

| Method | Endpoint | Purpose | RBAC |
|--------|----------|---------|------|
| GET | `/api/clients` | List subscribers (paginated, searchable) | clients:read |
| POST | `/api/clients` | Create new subscriber | clients:write |
| GET | `/api/clients/:id` | Get subscriber details | clients:read |
| PUT | `/api/clients/:id` | Update subscriber | clients:write |
| DELETE | `/api/clients/:id` | Soft-delete subscriber | clients:delete |
| GET | `/api/subscriptions` | List active subscriptions | subscriptions:read |
| POST | `/api/subscriptions` | Activate subscription | subscriptions:write |
| PUT | `/api/subscriptions/:id` | Extend/renew subscription | subscriptions:write |
| DELETE | `/api/subscriptions/:id` | Deactivate subscription | subscriptions:delete |
| GET | `/api/packages` | List service packages | packages:read |
| POST | `/api/packages` | Create package | packages:write |
| GET | `/api/routers` | List MikroTik routers | routers:read |
| POST | `/api/routers` | Register new router | routers:write |
| PUT | `/api/routers/:id` | Update router credentials | routers:write |
| GET | `/api/routers/:id/active-sessions` | Get online users (MikroTik sync) | routers:read |
| POST | `/api/vouchers` | Generate voucher codes | vouchers:create |
| GET | `/api/transactions` | List payment transactions | transactions:read |
| POST | `/api/payments/initiate` | Initiate payment (generic) | transactions:write |
| GET | `/api/invoices` | List invoices | — |
| GET | `/api/audit-logs` | View audit trail | audit-logs:read |

#### Gateway-Specific Payment Initiation

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/payments/palmpesa/initiate` | PalmPesa payment |
| POST | `/api/payments/flutterwave/initiate` | Flutterwave payment |
| POST | `/api/payments/stripe/checkout` | Stripe checkout session |
| POST | `/api/payments/harakapay/initiate` | HarakaPaym payment |
| POST | `/api/payments/zenopay/initiate` | Zenopay payment |
| POST | `/api/payments/mongike/initiate` | Mongike payment |

#### Webhook Endpoints (Payment Callbacks)

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/api/webhooks/palmpesa` | PalmPesa callback | Signature verification |
| POST | `/api/webhooks/flutterwave` | Flutterwave callback | HMAC signature |
| POST | `/api/webhooks/stripe` | Stripe webhook | Signature verification |
| POST | `/api/webhooks/harakapay` | HarakaPaym callback | Provider-specific |
| POST | `/api/webhooks/zenopay` | Zenopay callback | Provider-specific |
| POST | `/api/webhooks/mongike` | Mongike callback | Provider-specific |

#### Hotspot Portal Routes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/hotspot/login` | Hotspot login page (no auth required) |
| POST | `/api/hotspot/authenticate` | Authenticate with voucher/phone/payment |
| GET | `/api/hotspot/status` | Poll for payment status (no auth) |
| GET | `/api/hotspot-settings/:routerId` | Get branding/config for router |

#### Admin/System Routes

| Method | Endpoint | Purpose | RBAC |
|--------|----------|---------|------|
| GET | `/api/system-users` | List sub-users | system-users:read |
| POST | `/api/system-users` | Create sub-user | system-users:write |
| GET | `/api/system-settings` | Get tenant settings | system-settings:read |
| POST | `/api/system-settings` | Update settings | system-settings:write |
| GET | `/api/dashboard` | Dashboard KPIs (revenue, subs, etc.) | dashboard:read |
| POST | `/api/sms/send-bulk` | Send bulk SMS | — |

---

## 3. Frontend Architecture (Vite + React)

### 3.1 Project Structure

```
frontend/
├── src/
│   ├── pages/                  # Page components (business logic)
│   │   ├── Login.tsx           # User login form
│   │   ├── Register.tsx        # Tenant/user registration
│   │   ├── ForgotPassword.tsx
│   │   ├── Dashboard.tsx       # Main dashboard (KPIs, graphs)
│   │   ├── Clients.tsx         # Subscriber list + CRUD
│   │   ├── EditPackage.tsx     # Package creation/editing
│   │   ├── Subscriptions.tsx   # Active & expired subscriptions
│   │   ├── Invoices.tsx        # Invoice management
│   │   ├── Transactions.tsx    # Payment history
│   │   ├── Vouchers.tsx        # Voucher generation
│   │   ├── Routers.tsx         # MikroTik router setup + monitoring
│   │   ├── HotspotLoginCustomizer.tsx # Portal branding config
│   │   ├── PaymentChannels.tsx # Gateway configuration (Mpesa, Stripe, etc.)
│   │   ├── SystemUsers.tsx     # Sub-user management
│   │   ├── AuditLogs.tsx       # Compliance audit trail
│   │   ├── Profile.tsx         # User profile + MFA setup
│   │   ├── LicenseManagement.tsx # SaaS license + renewal
│   │   └── ... (40+ pages total)
│   ├── components/             # Reusable UI components
│   │   ├── charts/             # Recharts visualizations
│   │   ├── forms/              # React Hook Form wrappers
│   │   ├── dialogs/            # Modal dialogs
│   │   └── ... (tables, inputs, etc.)
│   ├── stores/
│   │   └── authStore.ts        # Zustand auth state
│   │       ├── Token management (access/refresh)
│   │       ├── User profile
│   │       ├── Logout handler
│   │       └── Login/register workflows
│   ├── api/                    # API client
│   │   └── (auto-generated from backend Swagger or manual)
│   ├── utils/                  # Helpers (formatting, validation)
│   ├── types/                  # TypeScript types/interfaces
│   ├── lib/                    # Shared utilities
│   ├── data/                   # Constants, mock data
│   ├── modals/                 # Modal UI components
│   ├── assets/                 # Images, icons
│   ├── index.css               # Global styles
│   ├── main.tsx                # Entry point
│   └── App.tsx                 # Root router
├── public/                     # Static files
├── vite.config.ts              # Vite configuration (port 5175)
├── vitest.config.ts            # Test configuration
└── package.json
```

### 3.2 State Management (Zustand)

```typescript
// authStore.ts
{
  // Current user
  user: {
    id, username, email, role, tenantId, isPlatformAdmin, ...
  },
  
  // Tokens
  accessToken, refreshToken, tempToken (for MFA pending)
  
  // Auth methods
  login(username, password),
  register(email, password, ...),
  logout(),
  setMfaRequired(bool),
  verifyMfaToken(code),
  
  // Token refresh (background)
  refreshAccessToken() // Called before expiry
}
```

### 3.3 Component Architecture

```
App.tsx
  ↓
  BrowserRouter (React Router 7)
  ↓
  ┌───────────────────────┐
  │ Protected Routes      │
  │ ├─ /dashboard         │  Dashboard (KPIs)
  │ ├─ /clients           │  Subscriber list
  │ ├─ /subscriptions     │  Active subscriptions
  │ ├─ /invoices          │  Invoice management
  │ ├─ /routers           │  MikroTik setup
  │ ├─ /payment-channels  │  Gateway config
  │ ├─ /audit-logs        │  Compliance
  │ ├─ /system-users      │  Sub-user management
  │ └─ /profile           │  User settings + MFA
  │
  └──── Unprotected Routes
    ├─ /login
    ├─ /register
    ├─ /forgot-password
    └─ /public/* (hotspot portal)
```

### 3.4 Key UI Technologies

- **Material-UI 7.3**: Component library for consistent design
- **React Query 5**: Server-state management (caching, refetching, mutations)
- **React Hook Form 7.71**: Form handling with Zod validation
- **Recharts 3.7**: Charts and graphs (revenue trends, subscriber growth)
- **React Router 7.13**: Client-side routing

---

## 4. Database Schema (Prisma)

### 4.1 Data Model Overview

**35+ models** organized into 5 layers:

#### Layer 1: Tenant & User Management

```prisma
Tenant                  # Multi-tenant root
├─ id (CUID)
├─ name, email, phone, slug (unique)
├─ status: PENDING_APPROVAL | TRIALLING | ACTIVE | SUSPENDED | CANCELLED
├─ planId (FK → SaasPlan)
├─ trialStart, trialEnd, licenseExpiresAt
├─ branding (1:1 → TenantBranding)
├─ settings (1:1 → TenantSettings)
└─ [All business entities filtered by tenantId]

User                    # Tenant members + admins
├─ id (CUID)
├─ username (unique)
├─ email (unique)
├─ password (bcrypt-hashed)
├─ role: SUPER_ADMIN | ADMIN | AGENT | VIEWER
├─ status: ACTIVE | INACTIVE
├─ mfaEnabled, mfaSecret (AES-256-GCM encrypted), mfaBackupCodes[] (bcrypt-hashed)
├─ tenantId (FK → Tenant, NULL for platform admins only)
├─ isPlatformAdmin (true only if tenantId=null)
├─ deletedAt (soft delete — CRIT-005 FIX)
└─ auditLogs (1:many)

TenantBranding          # Custom branding per tenant
├─ companyName, companyLogo, companyEmail
└─ hotspotSettings can use this branding

TenantSettings          # Tenant-specific configuration
├─ defaultLocale, defaultTimezone
├─ enableSubdomain, hotspotAutoSync
├─ settings (JSON for extensibility)
```

#### Layer 2: ISP Business Models

```prisma
Client                  # Subscribers / end-users
├─ id (CUID)
├─ username (unique per tenant)
├─ fullName, phone, email
├─ serviceType: HOTSPOT | PPPOE
├─ status: ACTIVE | INACTIVE | EXPIRED | SUSPENDED | BANNED | DISABLED | LIMITED
├─ accountType: PERSONAL | BUSINESS
├─ macAddress, device
├─ tenantId (FK)
└─ subscriptions, invoices, transactions, smsMessages

Package                 # Service plans (bandwidth offerings)
├─ id (CUID)
├─ name, type (HOTSPOT | PPPOE)
├─ uploadSpeed, downloadSpeed (with units: Mbps)
├─ price, duration (int), durationUnit (MINUTES|HOURS|DAYS|MONTHS)
├─ paymentType: PREPAID | POSTPAID
├─ burstEnabled
├─ devices (simultaneous connections allowed)
├─ tenantId (FK)
└─ subscriptions, vouchers

Subscription            # Active user connection
├─ id (CUID)
├─ clientId (FK)
├─ packageId (FK)
├─ routerId (FK) — which MikroTik serves this user
├─ status: ACTIVE | EXPIRED | EXTENDED | SUSPENDED
├─ activatedAt, expiresAt (DateTime)
├─ method (VOUCHER | PAYMENT | MANUAL)
├─ onlineStatus: ONLINE | OFFLINE
├─ syncStatus (tracks MikroTik sync state)
├─ tenantId (FK)
└─ [triggers MikroTik API calls to create PPPoE/Hotspot user]

Equipment               # Network gear inventory
├─ serialNumber (unique)
├─ type, status, location, purchaseDate
├─ routerId (FK)
├─ tenantId (FK)

Voucher                 # Pre-generated access codes
├─ code (unique per tenant)
├─ packageId (FK)
├─ routerId (optional FK)
├─ status: UNUSED | ACTIVE | USED | EXPIRED | REVOKED
├─ usedBy (clientId), usedAt (DateTime)
├─ createdById (FK → User)
├─ tenantId (FK)
```

#### Layer 3: Billing & Payments

```prisma
Invoice                 # Recurring/one-time bills
├─ invoiceNumber (unique)
├─ clientId (FK)
├─ amount
├─ status: DRAFT | PAID | UNPAID | OVERDUE
├─ issuedDate, dueDate
├─ paidAt, transactionId (FK, unique)
├─ items (1:many → InvoiceItem)
├─ tenantId (FK)

InvoiceItem             # Line items
├─ description, quantity, unitPrice, total

Transaction             # Payment record
├─ id (CUID)
├─ reference (unique) — our transaction ID (e.g., "HP-XXXXX")
├─ clientId (FK)
├─ invoiceId (FK, optional) — links back to invoice (INV-001/PAY-002 FIX)
├─ amount
├─ type: MANUAL | MOBILE | VOUCHER
├─ method (payment provider: PalmPesa, Stripe, etc.)
├─ status: COMPLETED | PENDING | FAILED | EXPIRED
├─ expiryDate
├─ tenantId (FK)

PaymentChannel          # Configured payment gateway
├─ id (CUID)
├─ provider (PALMPESA | FLUTTERWAVE | STRIPE | etc.)
├─ name, environment (sandbox | production)
├─ apiKey, apiSecret (AES-256-GCM encrypted — SEC-001 FIX)
├─ webhookSecret
├─ config (JSON — gateway-specific settings)
├─ status: ACTIVE | INACTIVE
├─ tenantId (FK)

WebhookLog              # Audit trail for payment callbacks
├─ id (CUID)
├─ provider, event, payload (JSON)
├─ signature, verified (bool)
├─ transactionRef, providerRef
├─ status (RECEIVED | PROCESSED | FAILED)
├─ errorMessage
├─ processedAt
├─ tenantId (FK)

TenantPaymentGateway    # Multi-gateway per tenant
├─ tenantId, provider (unique pair)
├─ enabled, config (JSON)

SmsMessage              # SMS audit trail
├─ recipient, message, status (PENDING | SENT | FAILED)
├─ type: INDIVIDUAL | BROADCAST
├─ clientId (optional)
├─ tenantId (FK)

MessageTemplate         # Customizable message templates
├─ name, content, variables[]
├─ type: ACTIVATION | EXPIRY | PAYMENT | CUSTOM | REMINDER
├─ tenantId (FK)

Expense                 # Cost tracking
├─ category, description, amount, date, receipt
├─ createdById (FK → User)
├─ tenantId (FK)
```

#### Layer 4: Network Infrastructure (MikroTik + RADIUS)

```prisma
Router                  # MikroTik RouterOS device
├─ id (CUID)
├─ name, host (unique per tenant), username, password (AES-256-GCM encrypted)
├─ port (8728), apiPort, restPort (optional — E22 FIX)
├─ type: MikroTik (default)
├─ status: ONLINE | OFFLINE
├─ activeUsers (count), cpuLoad, memoryUsed, uptime
├─ accountingEnabled (RADIUS accounting toggle)
├─ vpnMode: hybrid | wireguard | pppoe
├─ wgEnabled, wgConfiguredAt
├─ wgListenPort, wgPublicKey, wgPrivateKey, wgPresharedKey (encrypted)
├─ wgServerEndpoint, wgTunnelIp
├─ equipments (1:many), subscriptions, vpnUsers, logs
├─ tenantId (FK)

HotspotSettings         # Hotspot portal customization
├─ routerId (unique)
├─ primaryColor, accentColor, selectedFont, layout
├─ enableAds, enableAnnouncement, enableRememberMe
├─ companyName, customerCareNumber, adMessage
├─ backendUrl (optional — E19 FIX: override global APP_URL per router)
├─ tenantId (FK)

RouterLog               # Router operation audit
├─ routerId (FK)
├─ action, details (JSON), status
├─ username, ipAddress
├─ tenantId (FK)

VpnUser                 # VPN (L2TP) user credentials
├─ username (unique per tenant), password
├─ fullName, protocol (L2TP), service
├─ profile, status, localAddress, remoteAddress
├─ routerId (FK)
├─ tenantId (FK)

RadiusUser              # RADIUS user account
├─ username (unique per tenant)
├─ password, authType (PAP), groupName
├─ speed, dataLimit, sessionTimeout, simultaneousUse
├─ framedIpAddress, nasIpAddress, lastSeen
├─ tenantId (FK)
│
├─ [Low-level FreeRADIUS tables — shared with external RADIUS server]
│
RadCheck                # RADIUS authentication attributes
├─ username, attribute (Cleartext-Password | MD5-Password — RAD-002 FIX)
├─ op, value, tenantId
├─ unique constraint: (username, tenantId, attribute)

RadReply                # RADIUS reply attributes (ACL sent to client)
├─ username, attribute (Session-Timeout | Mikrotik-Rate-Limit | etc.)
├─ op, value, tenantId
├─ unique constraint: (username, tenantId, attribute)

RadGroupCheck           # RADIUS group check attributes
├─ groupname, attribute, op, value, tenantId

RadGroupReply           # RADIUS group reply attributes
├─ groupname, attribute, op, value, tenantId

RadUserGroup            # Mapping users to groups
├─ username, groupname, priority, tenantId
├─ unique constraint: (username, tenantId, groupname)

RadAcct                 # RADIUS accounting records (session stats)
├─ acctsessionid, acctuniqueid (unique)
├─ username, realm, nasipaddress
├─ acctstarttime, acctupdatetime, acctstoptime (DateTime)
├─ acctsessiontime, acctinputoctets, acctoutputoctets (BigInt)
├─ framedipaddress, acctterminatecause
├─ tenantId (FK)
├─ indexes on: (username, tenantId), (acctstarttime, tenantId), (tenantId, acctstoptime)

RadPostAuth             # RADIUS post-authentication log
├─ username, pass (attempt), reply (granted|denied)
├─ authdate (DateTime)
├─ tenantId (FK)

RadiusNas               # Network Access Server (router) registration
├─ nasName, shortName, type (other)
├─ ports, secret (shared secret with RADIUS server)
├─ tenantId (FK)
```

#### Layer 5: System & Audit

```prisma
AuditLog                # Compliance audit trail
├─ tenantId, userId
├─ action (CREATE_USER | DELETE_SUBSCRIBER | UPDATE_SETTINGS | etc.)
├─ resource (User | Client | Package | etc.)
├─ resourceId, details (JSON), ipAddress, userAgent
├─ createdAt
└─ indexes: (tenantId, createdAt), (userId), (action)

SystemSetting           # Key-value tenant config
├─ key, value, group (general | email | sms | etc.)
├─ tenantId (FK)
├─ unique constraint: (key, tenantId)

RateLimit               # Rate-limiting state
├─ key (IP or endpoint), count, resetAt (DateTime)
├─ unique constraint: (key)

SaasPlan                # Multi-tier subscription plans
├─ name, price (KES/TZS)
├─ pppoeLimit, hotspotLimit, maxRouters
├─ licenses, invoices, tenants (1:many)

TenantLicense           # Tenant's purchased license
├─ tenantId, planId
├─ status: PENDING | PAID | EXPIRED
├─ startsAt, expiresAt

TenantInvoice           # Invoice for license renewal
├─ invoiceNumber (unique)
├─ tenantId, planId, amount
├─ status: PENDING | PAID | EXPIRED
├─ dueDate, payments (1:many)

TenantPayment           # License payment record
├─ invoiceId, tenantId, amount
├─ transactionId (optional), paymentMethod (PALMPESA)
├─ status: PENDING | COMPLETED | FAILED

TenantPaymentGateway    # Tenant's enabled payment providers
├─ tenantId, provider (unique pair)
├─ enabled, status (ACTIVE | INACTIVE)
├─ config (JSON)
```

### 4.2 Tenant Isolation Mechanism

**Every data model has a `tenantId` field** (except platform-only models like SaasPlan).

```typescript
// Tenant filtering at DB level
const filter = getTenantFilter(user);  // returns { tenantId: user.tenantId }

// Example query
const clients = await db.client.findMany({
  where: { tenantId: user.tenantId },  // ← Mandatory filter
});

// If a user tries to access another tenant's data:
// user.tenantId = "tenant-a"
// requested data has tenantId = "tenant-b"
// Query returns [] (empty), effectively blocking cross-tenant access
```

**Indexes for performance:**
- `(tenantId)` on all core models
- `(tenantId, status)` on subscription/client models for filtering
- `(tenantId, username)` on RADIUS/user models for username lookups

---

## 5. Authentication & Authorization

### 5.1 Authentication Flow

#### Phase 1: Login

```
POST /api/auth/login
{
  "username": "admin@example.com",
  "password": "secret"
}
  ↓
1. Rate limit check (5 attempts per IP per 15 minutes)
2. Find user by username or email
3. Constant-time password comparison (CRIT-007 FIX)
4. Check user.status === ACTIVE
5. MFA check:
   - If mfaEnabled=true → Issue temp token (5 min TTL)
     Return: { mfaRequired: true, tempToken, message }
   - If mfaEnabled=false → Continue to 6
6. Issue tokens (JWT):
   - accessToken (2h TTL, tokenType: "access")
   - refreshToken (7d TTL, tokenType: "refresh")
7. Set HttpOnly cookies (SameSite=Strict in production)
8. Log lastLogin timestamp
9. Return: { token, user, refreshToken } + Set-Cookie headers
```

#### Phase 2: MFA Challenge (if enabled)

```
POST /api/auth/mfa/verify
{
  "tempToken": "...",
  "code": "123456"  // 6-digit TOTP
}
  ↓
1. Verify temp token (check tokenType === "mfa_pending")
2. Extract userId from temp token
3. Retrieve user.mfaSecret (AES-256-GCM decrypt)
4. Verify TOTP code:
   - verifySync(code, secret) — allows ±1 time window (±30s)
5. Check backup codes if TOTP fails
6. On success: Issue real access + refresh tokens
7. Return: { token, refreshToken, user }
```

#### Phase 3: Token Refresh

```
POST /api/auth/refresh
{
  "refreshToken": "..."  // From cookie or body
}
  ↓
1. Verify refresh token:
   - Check signature with JWT_REFRESH_SECRET
   - Check tokenType === "refresh"
   - Check exp > now
2. If valid: Issue new accessToken (2h)
3. Return: { token, refreshToken (new) }
   (Refresh token may be rotated for extra security)
4. If invalid/expired → 401 Unauthorized
```

#### Phase 4: Protected Endpoint Access

```
GET /api/clients?tenantId=...
Authorization: Bearer <accessToken>
  ↓
1. middleware.ts extracts token from:
   - Authorization header (Bearer scheme)
   - accessToken cookie
2. verifyToken(token, JWT_ACCESS_SECRET):
   - Verify signature
   - Check tokenType === "access"
   - Check exp > now
   - Extract payload: { userId, username, role, tenantId }
3. On success: Inject user into request context
4. Route handler:
   - requireRole(req, "SUPER_ADMIN") → Check role
   - getUserFromRequest(req) → Get user payload
   - getTenantClient(user) → Scoped Prisma client
   - Query scoped to user.tenantId automatically
5. Response sent with data
```

### 5.2 JWT Architecture (CRIT-006 FIX)

**Two-Secret Approach:**

```typescript
// .env
JWT_ACCESS_SECRET=<64-hex-chars>   // For access tokens (2h)
JWT_REFRESH_SECRET=<64-hex-chars>  // For refresh tokens (7d)
// Must be different to prevent secret reuse attacks

// Access Token Payload
{
  userId: "cuid",
  username: "admin@example.com",
  role: "SUPER_ADMIN",
  tenantId: "tenant-a" (or null for platform admin),
  tokenType: "access",  // ← Type discriminator
  iss: "hq-investment-isp",
  aud: "hq-investment-app",
  iat: 1718460000,
  exp: 1718467200  // now + 2h
}

// Refresh Token Payload
{
  userId: "cuid",
  username: "admin@example.com",
  role: "SUPER_ADMIN",
  tenantId: "tenant-a",
  tokenType: "refresh",  // ← Different type
  iss: "hq-investment-isp",
  aud: "hq-investment-app",
  iat: 1718460000,
  exp: 1719064800  // now + 7d
}
```

**Security Properties:**
- Separate secrets prevent reusing a stolen refresh token as an access token
- `tokenType` prevents confused deputy attacks
- `aud` + `iss` ensure tokens can't be used across different endpoints
- Access token short TTL (2h) limits damage from token theft
- Refresh token stored in HttpOnly cookie (can't be accessed by XSS)
- Backend must rotate refresh token on each use (optional, not yet implemented)

### 5.3 Role-Based Access Control (RBAC)

**Four Roles:**

```typescript
enum Role {
  SUPER_ADMIN,  // Tenant owner — full access within tenant
  ADMIN,        // Tenant manager — operations, cannot change billing
  AGENT,        // Field worker — create/manage subscribers, vouchers
  VIEWER,       // Read-only — cannot create, update, or delete (MT-002 FIX)
}
```

**Permission Matrix** (from `/lib/rbac.ts`):

| Permission | SUPER_ADMIN | ADMIN | AGENT | VIEWER |
|------------|---|---|---|---|
| `clients:read` | ✓ | ✓ | ✓ | ✓ |
| `clients:write` | ✓ | ✓ | ✓ | ✗ |
| `clients:delete` | ✓ | ✓ | ✗ | ✗ |
| `subscriptions:read` | ✓ | ✓ | ✓ | ✓ |
| `subscriptions:write` | ✓ | ✓ | ✓ | ✗ |
| `subscriptions:delete` | ✓ | ✓ | ✗ | ✗ |
| `vouchers:create` | ✓ | ✓ | ✓ | ✗ |
| `vouchers:read` | ✓ | ✓ | ✓ | ✓ |
| `vouchers:delete` | ✓ | ✓ | ✗ | ✗ |
| `packages:write` | ✓ | ✓ | ✗ | ✗ |
| `routers:write` | ✓ | ✓ | ✗ | ✗ |
| `system-settings:write` | ✓ | ✗ | ✗ | ✗ |
| `license:read` | ✓ | ✗ | ✗ | ✗ |
| `license:purchase` | ✓ | ✗ | ✗ | ✗ |
| `payment-channels:write` | ✓ | ✗ | ✗ | ✗ |
| `audit-logs:read` | ✓ | ✗ | ✗ | ✗ |
| `system-users:write` | ✓ | ✗ | ✗ | ✗ |
| `dashboard:read` | ✓ | ✓ | ✓ | ✓ |

**Usage in Route Handlers:**

```typescript
// Option 1: Check by role
export async function POST(req: NextRequest) {
  const guard = requireRole(req, "SUPER_ADMIN");
  if (guard.error) return guard.error;
  const { user } = guard;
  // ... rest of logic
}

// Option 2: Check by permission
export async function PUT(req: NextRequest) {
  const guard = requirePermission(req, "clients:write");
  if (guard.error) return guard.error;
  const { user } = guard;
  // ... rest of logic
}
```

### 5.4 Two-Tier Admin System

**Platform Admins** (tenantId = null, isPlatformAdmin = true):
- Access all tenants' data (via optional tenantId filter in body)
- Can create new tenants
- Manage SaaS plans, billing
- Super-user for system administration

**Tenant Admins** (tenantId = "xxx", role = SUPER_ADMIN):
- Own their tenant
- Full access to their tenant's data only
- Cannot access other tenants
- Manage sub-users within tenant

```typescript
// Tenant filter logic
if (isPlatformSuperAdmin(user)) {
  return {};  // No filter — see all data
} else {
  return { tenantId: user.tenantId };  // Scoped to tenant
}
```

---

## 6. Third-Party Integrations

### 6.1 MikroTik RouterOS Integration

**Purpose:** Manage PPPoE and Hotspot users in real-time, monitor bandwidth, disconnect sessions.

**Architecture:**

```
Backend API → HTTP REST API (MikroTik RouterOS v7+)
    ↓
    └─ MikroTik Router (via /rest API on port 80/443)
         ├─ Create PPPoE user → /ip/ppp/secret
         ├─ Create Hotspot user → /ip/hotspot/user
         ├─ Set bandwidth limits → /queue/simple
         ├─ Disconnect session → /ip/ppp/active/disconnect
         ├─ Query active sessions → /ip/ppp/active
         └─ Query system info → /system/identity
```

**Key Files:**
- `/lib/mikrotik.ts` — HTTP client + user management
- `/workers/mikrotik.worker.ts` — BullMQ job processor (MK-002 FIX)
- `/lib/queue.ts` — Job enqueueing

**Operations:**

1. **Create PPPoE User (Subscription Activation)**
   ```
   POST /api/subscriptions (with serviceType: PPPOE)
     ↓
   Request queued to BullMQ (202 Accepted)
     ↓
   Worker processes:
     - POST https://router.host:80/rest/ip/ppp/secret
     - Payload: { name, password, service, profile, disabled }
     ↓
   MikroTik creates user in /ip/ppp/secret
   User can now authenticate via RADIUS (if PPPOE profile uses RADIUS)
   ```

2. **Hotspot User Creation (Hotspot Payment)**
   ```
   POST /api/hotspot/authenticate (voucher/payment)
     ↓
   Create client + activate subscription
     ↓
   Queue Hotspot user creation
     ↓
   Worker POST to /rest/ip/hotspot/user
     ↓
   MikroTik creates user in /ip/hotspot/user
   User credentials returned to hotspot login page
   ```

3. **Bandwidth Limiting (QoS)**
   ```
   PUT /api/subscriptions/:id (change package/speed)
     ↓
   Queue bandwidth update
     ↓
   Worker POST to /rest/queue/simple with rate limits
   ```

4. **Disconnect Session (Suspend/Disable)**
   ```
   DELETE /api/subscriptions/:id
     ↓
   Queue disconnect
     ↓
   Worker POST to /rest/ip/ppp/active/disconnect (or hotspot equivalent)
   ```

**Credentials Management (SEC-001 FIX):**
- Router password stored encrypted: `AES-256-GCM`
- Field-level encryption in Prisma hooks
- Decrypted only when making API calls

**MikroTik API Endpoints Used:**

| Operation | REST Endpoint | Method |
|-----------|---|---|
| Create PPPoE user | `/rest/ip/ppp/secret` | POST |
| Update PPPoE user | `/rest/ip/ppp/secret/{id}` | PATCH |
| Delete PPPoE user | `/rest/ip/ppp/secret/{id}` | DELETE |
| Create Hotspot user | `/rest/ip/hotspot/user` | POST |
| Update Hotspot user | `/rest/ip/hotspot/user/{id}` | PATCH |
| Delete Hotspot user | `/rest/ip/hotspot/user/{id}` | DELETE |
| Set queue/bandwidth | `/rest/queue/simple` | POST |
| Get active sessions | `/rest/ip/ppp/active` | GET |
| Disconnect session | `/rest/ip/ppp/active/{id}/disconnect` | POST |
| Get system info | `/rest/system/identity` | GET |
| Get resource stats | `/rest/system/resource` | GET |

### 6.2 FreeRADIUS Integration

**Purpose:** Authentication for PPPoE/RADIUS clients; session accounting; bandwidth enforcement.

**Architecture:**

```
PPPoE Client → RADIUS Server (FreeRADIUS) → PostgreSQL (radcheck, radreply, radacct)
                  ↓
            Backend API writes to radcheck/radreply
                  ↓
            FreeRADIUS queries DB for user credentials
                  ↓
            On success: Reply attributes sent to client (e.g., Session-Timeout, bandwidth)
                  ↓
            Session accounting logged to radacct table
```

**Sync Flow:**

```
POST /api/subscriptions (activate PPPoE)
  ↓
1. Create Subscription in DB
2. Call syncRadiusUser({
     username, password, groups, speed, dataLimit, sessionTimeout
   })
   ↓
3. Atomic upsert via raw SQL (CRIT-004 FIX):
   INSERT INTO radcheck (username, attribute, op, value, tenantId)
   VALUES ('user123', 'MD5-Password', ':=', 'md5_hash', 'tenant-a')
   ON CONFLICT ON CONSTRAINT "username_tenantId_attribute"
   DO UPDATE SET value = EXCLUDED.value
   ↓
4. Upsert reply attributes:
   INSERT INTO radreply (username, attribute, op, value)
   VALUES ('user123', 'Session-Timeout', '=', '86400', 'tenant-a')
   ON CONFLICT ...
   ↓
5. Upsert group membership:
   INSERT INTO radusergroup (username, groupname, priority)
   VALUES ('user123', 'standard-users', 1)
   ↓
6. FreeRADIUS polls DB:
   SELECT value FROM radcheck WHERE username = 'user123'
   → Returns MD5-Password attribute
```

**RADIUS Tables:**

| Table | Purpose |
|-------|---------|
| `radcheck` | Authentication attributes (Cleartext-Password, MD5-Password) |
| `radreply` | Reply attributes (Session-Timeout, Framed-IP-Address, Mikrotik-Rate-Limit) |
| `radusergroup` | User-to-group mappings |
| `radgroupcheck` | Group-level check attributes |
| `radgroupreply` | Group-level reply attributes |
| `radacct` | Accounting/session records (uploaded by NAS every few seconds) |
| `radpostauth` | Post-authentication log (auth success/failure) |

**Key Fix: RAD-002 FIX**
- Changed from plaintext `Cleartext-Password` to `MD5-Password`
- FreeRADIUS PAP module hashes incoming password with MD5
- Passwords no longer stored plaintext in DB

**Key Fix: CRIT-004 FIX**
- Replaced `findFirst() → create()` pattern with atomic `ON CONFLICT DO UPDATE`
- Prevents TOCTOU race condition when two webhook callbacks happen simultaneously
- Ensures exactly one write wins at DB level

### 6.3 Payment Gateway Integration

**Supported Providers:**
1. **PalmPesa** (M-Pesa for Tanzania)
2. **Flutterwave** (Pan-African)
3. **Stripe** (International)
4. **HarakaPaym** (East Africa)
5. **Zenopay** (East Africa)
6. **Mongike** (Regional)

**Architecture:**

```
┌─ Initiate Payment Flow ──────────────────────────────┐
│                                                       │
│  Frontend (Hotspot Portal / Admin) → Backend API     │
│  POST /api/payments/{provider}/initiate              │
│  {                                                    │
│    phone: "+255...",                                 │
│    amount: 10000,                                    │
│    reference: "HP-XXXXX" (unique, idempotent)        │
│  }                                                    │
│                                                       │
│  ↓                                                    │
│  Backend processes:                                  │
│  1. Validate amount (100-10,000,000 TZS)             │
│  2. Check idempotency: existing transaction?         │
│  3. Load PaymentChannel config from DB               │
│  4. Get provider instance (Mpesa, Flutterwave, etc.) │
│  5. Call provider.initiatePayment(request)           │
│  6. Provider makes HTTP request to gateway           │
│  7. Gateway responds with payment URL or status      │
│  8. Store transaction record (PENDING)               │
│  9. Return reference + payment URL to frontend       │
│                                                       │
│  ↓                                                    │
│  User clicks link or enters mobile payment prompt    │
│  Mobile money pop-up (USSD or app)                   │
└───────────────────────────────────────────────────────┘

┌─ Webhook Callback Flow ──────────────────────────────┐
│                                                       │
│  Payment Gateway → POST /api/webhooks/{provider}     │
│  {                                                    │
│    reference: "HP-XXXXX",                            │
│    status: "SUCCESS",                                │
│    transactionId: "mpesa_ref_123",                   │
│    amount: 10000                                     │
│  }                                                    │
│                                                       │
│  ↓                                                    │
│  Backend webhook handler:                           │
│  1. Parse webhook payload                            │
│  2. Verify signature/HMAC (provider-specific)        │
│  3. Log webhook to WebhookLog table                  │
│  4. Find transaction by reference                    │
│  5. Update transaction status: COMPLETED             │
│  6. If COMPLETED:                                    │
│     - Create subscription (if hotspot)               │
│     - Update invoice as PAID                         │
│     - Sync to MikroTik (create user)                 │
│     - Sync to RADIUS (if PPPOE)                      │
│     - Send SMS confirmation                          │
│  7. Return 200 OK to gateway                         │
│                                                       │
│  ↓                                                    │
│  User refreshes hotspot page or dashboard            │
│  Frontend polls GET /api/hotspot/status?reference=HP-XXXXX (no auth)
│  Backend returns: { status: COMPLETED, username, expiresAt }
│  Frontend redirects to Mikrotik login                │
└───────────────────────────────────────────────────────┘
```

**PAY-001 FIX: Idempotency**

```typescript
// Prevent double charges on client retry or network error
const existingTx = await prisma.transaction.findFirst({
  where: { reference, tenantId }
});

if (existingTx?.status === "COMPLETED") {
  return { success: true, idempotent: true };  // Don't retry
}
if (existingTx?.status === "PENDING") {
  return { success: true, idempotent: true };  // Still pending
}
// If FAILED: allow re-initiation with same reference
```

**Provider Registry:**

```typescript
// /lib/payments/registry.ts
function getPaymentProvider(name: string, channel: PaymentChannel) {
  switch (name.toUpperCase()) {
    case "PALMPESA": return new PalmPesaProvider(channel);
    case "FLUTTERWAVE": return new FlutterwaveProvider(channel);
    case "STRIPE": return new StripeProvider(channel);
    // ... etc
  }
}

// Each provider implements:
interface IPaymentProvider {
  initiatePayment(request): Promise<PaymentResponse>;
  checkStatus(providerRef): Promise<TransactionStatus>;
  verifyWebhook(payload, signature): boolean;
}
```

**INV-001/PAY-002 FIX:**
- Link transaction back to invoice via `transaction.invoiceId`
- Invoice's `transactionId` field tracks which payment resolved it
- Enables audit trail: invoice → payment → status

**E19 FIX: Custom Callback URLs**
- Each HotspotSettings has optional `backendUrl`
- Overrides global `APP_URL` for router-specific routing
- Allows multi-instance deployments with load balancers

### 6.4 SMS Integration (Africa's Talking)

**Purpose:** Send SMS notifications (activation, expiry, payment confirmations).

**Implementation:**
- Africa's Talking API key in `.env`
- `/api/sms/send-bulk` endpoint for campaigns
- SMS templates in `MessageTemplate` model
- Logged to `SmsMessage` table for audit

```typescript
// Example: Send subscription activation SMS
await sendSms({
  recipient: client.phone,
  message: `Welcome! Your ${package.name} subscription is now active. Valid until ${expiryDate}.`,
  tenantId: tenant.id
});
```

### 6.5 Google OAuth Integration

**Purpose:** Optional social login for users.

**Implementation:**
- Google Client ID/Secret in `.env`
- `@react-oauth/google` on frontend
- `/api/auth/google` backend handler
- Token exchange → user lookup/creation → JWT issuance

---

## 7. Data Flow & Key Operations

### 7.1 Subscription Activation Flow

```
Admin/Agent → Frontend: POST /api/subscriptions
{
  clientId: "c1",
  packageId: "p1",
  routerId: "r1",
  method: "VOUCHER"
}
  ↓
Backend handler (/api/subscriptions):
1. Authenticate + authorize (requirePermission "subscriptions:write")
2. Validate client + package + router exist and belong to tenant
3. Deactivate any existing subscription for this client
4. Create new Subscription record:
   status: ACTIVE, activatedAt: now, expiresAt: now + duration
5. Call getMikroTikService() for this router:
   - Create PPPoE user (if serviceType=PPPOE):
     POST /rest/ip/ppp/secret { name: client.username, password, profile }
   - Create Hotspot user (if serviceType=HOTSPOT):
     POST /rest/ip/hotspot/user { name, password, profile }
   - [These run async via BullMQ job queue]
6. Call syncRadiusUser() if PPPOE:
   - Upsert radcheck/radreply/radusergroup
   - FreeRADIUS reads from DB next auth attempt
7. Log audit entry: { action: "ACTIVATE_SUBSCRIPTION", resourceId: sub.id }
8. Send SMS: "Welcome! Your {plan} subscription is active until {expiryDate}"
9. Return 200 + subscription record
```

### 7.2 Payment Webhook Processing

```
Payment Gateway → POST /api/webhooks/palmpesa
{
  reference: "HP-XXXXX",
  status: "SUCCESS",
  transactionId: "mpesa_123",
  amount: 10000
}
  ↓
Webhook handler:
1. Verify HMAC signature (provider-specific)
2. Log to WebhookLog { provider, event, payload, verified }
3. Find transaction by reference
   If not found → 404
4. Update transaction: status = COMPLETED
5. Find linked invoice (if invoiceId set)
   If found → Update invoice: status = PAID, paidAt = now
6. If this is hotspot voucher → Activate subscription (see 7.1)
7. If this is PPPOE → Sync to RADIUS
8. Send SMS to client: "Payment confirmed! Account active until..."
9. Log audit: { action: "PAYMENT_COMPLETED", transactionId }
10. Return 200 OK
```

### 7.3 Router Sync (Active Sessions)

```
Frontend: GET /api/routers/:routerId/active-sessions
  ↓
Backend handler:
1. Authenticate + authorize (requirePermission "routers:read")
2. Get router from DB (decrypt password)
3. Make HTTPS call to MikroTik:
   GET https://router.host:80/rest/ip/ppp/active
   (or /ip/hotspot/active depending on service type)
4. Response: array of active sessions
   [
     { id: "1", name: "client1", address: "10.0.0.1", uptime: "01:23:45", ... },
     { id: "2", name: "client2", address: "10.0.0.2", uptime: "00:45:30", ... }
   ]
5. Map to frontend format:
   [
     { username: "client1", onlineStatus: "ONLINE", uptime: "01:23:45", ... },
     ...
   ]
6. Cache result in Redis (TTL 5 min)
7. Return 200 + sessions
```

### 7.4 Subscription Expiry (Cron Job)

```
Backend: POST /api/cron/subscriptions/check-expiry (triggered by external scheduler)
  ↓
Handler:
1. Query subscriptions: WHERE expiresAt <= NOW() AND status = ACTIVE
2. For each expired subscription:
   a. Update status: EXPIRED
   b. Queue MikroTik disconnect:
      - Delete PPPoE user or mark disabled
      - Delete Hotspot user or mark disabled
   c. Send SMS: "Your subscription has expired. Renew here: [link]"
   d. Log audit: { action: "SUBSCRIPTION_EXPIRED" }
3. Return 200 + count of expired subs
```

---

## 8. Security Architecture

### 8.1 Security Fixes Implemented

| Fix ID | Issue | Solution |
|--------|-------|----------|
| **CRIT-001** | Plaintext router passwords in DB | AES-256-GCM field-level encryption + FIELD_ENCRYPTION_KEY |
| **CRIT-002** | MFA not enforced | TOTP-based MFA setup, temp token flow, MFA challenge |
| **CRIT-003** | Session fixation risk | JWT tokenType field + audience + issuer claims |
| **CRIT-004** | TOCTOU race on webhook processing | Atomic SQL INSERT...ON CONFLICT for radcheck/radreply |
| **CRIT-005** | Permanent user deletion (data loss) | Soft delete with deletedAt field + restore capability |
| **CRIT-006** | JWT secret reuse (access vs refresh) | Two separate secrets: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET |
| **CRIT-007** | Username enumeration via timing | Constant-time password comparison (even on invalid user) |
| **SEC-001** | Payment API keys stored plaintext | AES-256-GCM encryption + FIELD_ENCRYPTION_KEY |
| **SEC-002** | Router credentials leaked to frontend | Never return password/wgPrivateKey in API responses |
| **HIGH-001** | CSRF + insecure cookies in production | SameSite=Strict (was Lax), Secure flag in HTTPS |
| **MT-001** | Tenant data leakage | Tenant isolation filter on every query (tenantId check) |
| **MT-002** | VIEWER role has write + delete | Removed write/delete from VIEWER; restricted AGENT |
| **MT-003** | Platform channel config leaked to tenants | Explicit tenantId=null check for global channels |
| **RAD-002** | Plaintext RADIUS passwords in DB | MD5-Password attribute (FreeRADIUS PAP module hashes) |
| **PAY-001** | Double charging on retry | Idempotency key + reference-based deduplication |
| **E07** | Incorrect subscription expiry calculation | Fixed: was elapsed, now returns remaining days |
| **E19** | Router-specific callback URL not supported | Added optional backendUrl to HotspotSettings |
| **E22** | MikroTik REST API port hard-coded | Optional restPort field (auto-maps 8728→80, 8729→443) |
| **MK-002** | Slow/blocking MikroTik API calls | Async BullMQ job queue + background worker |

### 8.2 Encryption Strategy

**Field-Level Encryption (AES-256-GCM):**

```typescript
// Encrypted fields
Router.password             // MikroTik login
Router.wgPrivateKey         // WireGuard private key
Router.wgPresharedKey       // WireGuard preshared key
User.mfaSecret              // TOTP secret
PaymentChannel.apiKey       // Payment gateway key
PaymentChannel.apiSecret    // Payment gateway secret
```

**Format:**
```
enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
```

**Key Storage:**
```
FIELD_ENCRYPTION_KEY environment variable (64 hex chars = 32 bytes)
```

**Rotation Procedure:**
1. Generate new FIELD_ENCRYPTION_KEY
2. Deploy backend with both old + new keys (temporarily)
3. Run migration script to re-encrypt all fields with new key
4. Remove old key from .env

### 8.3 Authentication Security

**Password Storage:**
- bcrypt with 12 rounds (bcryptjs v3.0.3)
- No plaintext passwords ever stored

**Token Storage (Frontend):**
- accessToken: HttpOnly cookie (7200s / 2h)
- refreshToken: HttpOnly cookie (604800s / 7d)
- Cannot be accessed by XSS; only sent to backend

**CORS:**
```
CORS_ORIGIN environment variable (e.g., https://app.yourdomain.com)
Prevents cross-domain token exfiltration
```

**Rate Limiting:**
- Login endpoint: 5 attempts per IP per 15 minutes
- Per-endpoint configurable limits
- Stored in Redis (RateLimit model)

### 8.4 Audit & Compliance

**Audit Logging:**
- Every action logged to `AuditLog` table
- Fields: userId, action, resource, resourceId, details, ipAddress, userAgent, createdAt
- Queryable by tenant admins (audit-logs:read permission)
- Immutable (audit logs cannot be deleted)

**Webhook Logging:**
- Every payment callback logged to `WebhookLog`
- Fields: provider, event, payload, signature, verified, status, errorMessage
- Helps with dispute resolution

**Data Retention:**
- Soft deletes preserve historical data
- RADIUS accounting (radacct) retains session logs indefinitely
- Audit logs never purged

### 8.5 Network Security

**HTTPS/TLS:**
- All endpoints require HTTPS in production
- SSL cert via Let's Encrypt (certbot)
- HSTS header enforced

**CORS:**
- Frontend origin whitelisted
- Credentials: include

**CSRF Protection:**
- SameSite=Strict cookies (prevents cross-site requests)
- X-CSRF-Token validation middleware (optional)

---

## 9. Database Strategy & Optimization

### 9.1 Indexing Strategy

**Tenant-Level Indexes:**
```sql
-- Every table has
CREATE INDEX idx_tenantId ON {table}(tenantId);

-- Multi-column for common queries
CREATE INDEX idx_tenantId_status ON subscriptions(tenantId, status);
CREATE INDEX idx_tenantId_username ON radcheck(tenantId, username);
CREATE INDEX idx_tenantId_createdAt ON audit_logs(tenantId, createdAt DESC);
```

**Unique Constraints (Tenant-Scoped):**
```sql
CREATE UNIQUE INDEX unique_username_per_tenant ON clients(username, tenantId);
CREATE UNIQUE INDEX unique_code_per_tenant ON vouchers(code, tenantId);
CREATE UNIQUE INDEX unique_radcheck_attr ON radcheck(username, tenantId, attribute);
```

**Performance Indexes:**
```sql
-- Subscription queries
CREATE INDEX idx_status_expiresAt ON subscriptions(status, expiresAt);
CREATE INDEX idx_tenantId_expiresAt ON subscriptions(tenantId, expiresAt DESC);

-- RADIUS accounting
CREATE INDEX idx_radacct_username ON radacct(username);
CREATE INDEX idx_radacct_acctstarttime ON radacct(acctstarttime DESC);
CREATE INDEX idx_radacct_acctstoptime ON radacct(acctstoptime DESC);

-- Transactions
CREATE INDEX idx_transactions_status_createdAt ON transactions(status, createdAt DESC);
CREATE INDEX idx_transactions_reference ON transactions(reference UNIQUE);
```

### 9.2 Query Optimization

**N+1 Prevention (Prisma includes):**
```typescript
// Instead of:
const clients = await db.client.findMany();
const subs = await Promise.all(clients.map(c => db.subscription.findMany({ where: { clientId: c.id } })));

// Do this:
const clients = await db.client.findMany({
  include: { subscriptions: { where: { status: "ACTIVE" } } }
});
```

**Caching Strategy (Redis):**
```typescript
// Cache router active sessions for 5 minutes
const key = `router:${routerId}:active-sessions`;
const cached = await cache.get(key);
if (cached) return cached;

const sessions = await getMikroTikService().getActiveSessions();
await cache.set(key, sessions, 300);  // 5 min TTL
```

**Pagination:**
```typescript
// Limit per-page queries
const limit = Math.min(parseInt(query.limit || "50"), 1000);  // Max 1000
const offset = (page - 1) * limit;

const [data, total] = await Promise.all([
  db.client.findMany({ skip: offset, take: limit }),
  db.client.count({ where: filter })
]);
```

### 9.3 Migration Strategy

**Prisma Migrations:**
```bash
pnpm --filter backend prisma migrate dev --name add_mfa_fields
pnpm --filter backend prisma migrate deploy  # Production

# Migrations stored in backend/prisma/migrations/
# Each migration is timestamped and reversible
```

**Zero-Downtime Migrations:**
1. Add new column with default value (backward compatible)
2. Deploy code to read from new column (with fallback to old)
3. Run migration to populate old column from new (if needed)
4. Deploy code to write to new column
5. Run migration to drop old column

---

## 10. Deployment Architecture

### 10.1 Production Stack

```
┌──────────────────────────────────────────────────────────────┐
│            DigitalOcean Droplet (Ubuntu 22.04)               │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─ Nginx (Reverse Proxy / Load Balancer) ────────┐         │
│  │                                                 │         │
│  │  Server Block 1: yourdomain.com               │         │
│  │  ├─ SSL cert (Let's Encrypt)                  │         │
│  │  ├─ Proxy to backend (:3000)                  │         │
│  │  ├─ Serve frontend static (dist/)             │         │
│  │  └─ Root domain: landing page                 │         │
│  │                                                 │         │
│  │  Server Block 2: app.yourdomain.com           │         │
│  │  ├─ SSL cert (Let's Encrypt)                  │         │
│  │  └─ Proxy to backend (:3000)                  │         │
│  │                                                 │         │
│  │  Server Block 3: api.yourdomain.com           │         │
│  │  ├─ SSL cert (Let's Encrypt)                  │         │
│  │  └─ Proxy to backend (:3000)                  │         │
│  │                                                 │         │
│  └─────────────────────────────────────────────────┘         │
│              ↓                    ↓                           │
│  ┌─ PM2 Process Manager ─┐  ┌─ Redis Server ─┐             │
│  │                       │  │                 │             │
│  │  Instance 1:          │  │ Port: 6379      │             │
│  │  Backend (Next.js)    │  │ Persistence: RDB│             │
│  │  ├─ Port: 3000        │  │ (for BullMQ)    │             │
│  │  ├─ Env: production   │  │                 │             │
│  │  ├─ Instances: 1      │  │ Worker processes:│            │
│  │  └─ Auto-restart: on  │  │ • BullMQ job    │             │
│  │                       │  │   processor     │             │
│  │  Instance 2:          │  │ • Rate limiter  │             │
│  │  Landing Page         │  │                 │             │
│  │  ├─ Port: 3001        │  │                 │             │
│  │  └─ Instances: 1      │  │                 │             │
│  │                       │  │                 │             │
│  │  Instance 3:          │  │                 │             │
│  │  MikroTik Worker      │  │                 │             │
│  │  ├─ Job processor     │  │                 │             │
│  │  ├─ Retries: 4x       │  │                 │             │
│  │  └─ Backoff: 2s exp   │  │                 │             │
│  │                       │  │                 │             │
│  └───────────────────────┘  └─────────────────┘             │
│              ↓                    ↓                           │
│  ┌─ PostgreSQL 16 ──────┐  ┌─ Cron Jobs ────┐             │
│  │                      │  │                │             │
│  │ ├─ Main DB (5432)    │  │ ├─ Check expiry│             │
│  │ │  hqinvestment_isp  │  │ │  (hourly)   │             │
│  │ │                    │  │ │              │             │
│  │ ├─ 35+ tables        │  │ ├─ Renew subs │             │
│  │ ├─ Replication: WAL  │  │ │  (daily)    │             │
│  │ └─ Backups: daily    │  │ │              │             │
│  │                      │  │ └─ Sync MK    │             │
│  └──────────────────────┘  │   (every 5m) │             │
│                             └─────────────┘             │
│                                                               │
│  ┌─ External Services ─────────────────────────────────┐    │
│  │                                                     │    │
│  │ ├─ MikroTik Router (REST API)                      │    │
│  │ ├─ FreeRADIUS Server                               │    │
│  │ ├─ Payment Gateways                                │    │
│  │ │  ├─ PalmPesa, Flutterwave, Stripe, etc.        │    │
│  │ ├─ Africa's Talking (SMS)                          │    │
│  │ └─ Google OAuth (optional)                         │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 10.2 Deployment Steps

#### 1. Initial Setup

```bash
# Clone repository
git clone https://github.com/yourorgo/hqinvestment-isp.git
cd hqinvestment-isp

# Install system dependencies
sudo apt update
sudo apt install -y curl gnupg2 postgresql-16 redis-server certbot python3-certbot-nginx

# Install Node.js + pnpm
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g pnpm

# Enable services
sudo systemctl enable postgresql
sudo systemctl enable redis-server
```

#### 2. SSL Certificates

```bash
# Install certificates for all domains
sudo certbot --nginx \
  -d yourdomain.com \
  -d www.yourdomain.com \
  -d app.yourdomain.com \
  -d api.yourdomain.com

# Auto-renewal via systemd timer
sudo systemctl enable certbot.timer
```

#### 3. Configure Environment

```bash
# Copy .env template
cp backend/.env.example backend/.env

# Edit backend/.env
nano backend/.env

# Required variables
DATABASE_URL=postgresql://user:password@localhost:5432/hqinvestment_isp
JWT_ACCESS_SECRET=<64-hex-chars>
JWT_REFRESH_SECRET=<64-hex-chars>
FIELD_ENCRYPTION_KEY=<64-hex-chars>
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_APP_URL=https://api.yourdomain.com
CORS_ORIGIN=https://app.yourdomain.com
```

#### 4. Database Setup

```bash
# Create database + user
sudo -u postgres psql <<EOF
CREATE USER hqinvestment_user WITH PASSWORD 'secure_password_here';
CREATE DATABASE hqinvestment_isp OWNER hqinvestment_user;
EOF

# Run migrations
pnpm install
pnpm --filter backend prisma migrate deploy

# Seed initial data (optional)
pnpm --filter backend db:seed
```

#### 5. Build Applications

```bash
# Install dependencies
pnpm install

# Build all services
pnpm --filter backend build
pnpm --filter landing-page build
pnpm --filter frontend build

# Outputs:
# ├─ backend/.next/           (Next.js compiled backend)
# ├─ landing-page/.next/      (Next.js compiled landing page)
# └─ frontend/dist/           (Vite compiled frontend)
```

#### 6. Configure Nginx

```bash
# Copy Nginx config
sudo cp nginx.conf /etc/nginx/nginx.conf
sudo cp nginx-sites/yourdomain.com /etc/nginx/sites-available/yourdomain.com
sudo cp nginx-sites/app.yourdomain.com /etc/nginx/sites-available/app.yourdomain.com
sudo cp nginx-sites/api.yourdomain.com /etc/nginx/sites-available/api.yourdomain.com

# Enable sites
sudo ln -s /etc/nginx/sites-available/yourdomain.com /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/app.yourdomain.com /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/api.yourdomain.com /etc/nginx/sites-enabled/

# Test + reload
sudo nginx -t
sudo systemctl reload nginx
```

#### 7. Configure PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Copy ecosystem config
cp ecosystem.config.js ~/

# Start PM2 processes
pm2 start ecosystem.config.js

# Save PM2 startup
pm2 save
sudo pm2 startup systemd -u $USER --hp /home/$USER
```

#### 8. Verify Deployment

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs backend

# Test API
curl -s https://api.yourdomain.com/api/health | jq

# Test frontend
curl -s https://app.yourdomain.com | head -20

# Test landing page
curl -s https://yourdomain.com | head -20
```

### 10.3 Backup & Recovery

**Daily Database Backup:**

```bash
# backup-db.sh (run via cron daily)
#!/bin/bash
pg_dump -U hqinvestment_user hqinvestment_isp | \
  gzip > /var/backups/hqinvestment_isp_$(date +%Y%m%d).sql.gz

# Keep last 30 days
find /var/backups -name "hqinvestment_isp*.sql.gz" -mtime +30 -delete
```

**Redis Persistence:**
- Enabled by default (RDB snapshots + AOF)
- Located in `/var/lib/redis/`

**Kubernetes Deployment (Optional):**
- Helm charts in `/deploy/helm/`
- Production-grade scaling setup

### 10.4 Monitoring & Alerts

**PM2 Monitoring:**
```bash
pm2 install pm2-logrotate  # Auto-rotate logs
pm2 install pm2-auto-pull  # Git auto-deploy

pm2 info backend           # Process info
pm2 logs backend --lines 100  # Tail logs
```

**Database Monitoring:**
```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Slow queries (if slow_query_log enabled)
SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC;
```

---

## 11. Development Workflow

### 11.1 Local Development

```bash
# Install dependencies
pnpm install

# Copy .env
cp backend/.env.example backend/.env
# Edit .env with local values

# Run database migrations
pnpm --filter backend prisma migrate dev

# Start all services in dev mode
pnpm dev

# Services available:
# Backend API: http://localhost:3000/api
# Frontend: http://localhost:5175
# Landing page: http://localhost:3001
```

### 11.2 Running Tests

```bash
# Unit tests (backend)
pnpm --filter backend test

# Frontend tests
pnpm --filter frontend test

# Coverage
pnpm --filter backend test:coverage
```

### 11.3 Database Migrations

```bash
# Create a new migration after schema changes
pnpm --filter backend prisma migrate dev --name descriptive_name

# Apply migrations in production
pnpm --filter backend prisma migrate deploy

# Reset dev database (WARNING: deletes data)
pnpm --filter backend prisma migrate reset
```

---

## 12. Compliance & Security Considerations

### 12.1 Data Protection

- **Encryption at Rest:** AES-256-GCM for sensitive fields
- **Encryption in Transit:** TLS 1.2+
- **Soft Deletes:** No permanent data loss
- **Audit Logs:** Immutable, compliant with audit standards

### 12.2 GDPR Compliance

- User data can be exported via audit logs
- Right to be forgotten: soft delete + archive to cold storage
- Data portability: export via API endpoints

### 12.3 PCI DSS (if storing payment cards)

- **Current Status:** This system does NOT store card details
- Payment tokens are handled by payment gateway (PCI-safe)
- Only transaction references and statuses stored locally
- If card storage added in future, ensure PCI DSS Level 1 compliance

### 12.4 Regulatory (Kenya/Tanzania ISP)

- **RADIUS Accounting:** Tracks all user sessions (regulatory requirement)
- **Audit Logs:** Complete action trail for compliance audits
- **Invoice Records:** Billing data preserved indefinitely
- **KYC/AML:** Can be integrated via payment gateway

---

## 13. Known Limitations & Future Enhancements

### 13.1 Current Limitations

1. **Single-Region Deployment:** No built-in geo-replication
2. **No Rate Limiting on Webhooks:** Payment callbacks not rate-limited
3. **No End-to-End Encryption:** Data encrypted in DB but not at API level
4. **Limited Analytics:** Basic KPI dashboard, no advanced reporting
5. **Manual MikroTik Sync:** No real-time bidirectional sync

### 13.2 Recommended Enhancements

1. **Advanced Reporting:** Sales trends, cohort analysis, churn prediction
2. **VPN Auto-Provisioning:** WireGuard config auto-generated
3. **Mobile App:** Native iOS/Android client
4. **Multi-Router Failover:** Automatic switchover on router down
5. **Machine Learning:** Churn prediction, anomaly detection
6. **API Rate Limiting v2:** Token bucket algorithm
7. **GraphQL API:** In addition to REST
8. **Webhook Signature Verification:** For all providers (centralized)

---

## 14. Troubleshooting

### 14.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| **500 Internal Server Error** | Missing env var | Check all vars in `.env` are set |
| **MikroTik API timeout** | Router offline | Check router connectivity + credentials |
| **RADIUS auth failing** | Stale radcheck data | Call `syncRadiusUser()` to refresh |
| **Payment webhook not received** | Wrong callback URL | Check `HotspotSettings.backendUrl` or `APP_URL` |
| **Soft delete shows as deleted** | Query not filtering | Add `where: { deletedAt: null }` filter |
| **JWT verification fails** | Secret mismatch | Ensure `JWT_ACCESS_SECRET` matches in backend |

### 14.2 Logs to Check

```bash
# Backend API
pm2 logs backend

# PostgreSQL
sudo tail -f /var/log/postgresql/postgresql.log

# Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Redis
redis-cli monitor

# System
journalctl -u pm2-$USER -f
```

---

## 15. Conclusion

The **HQ Investment ISP Billing System** is a comprehensive, production-ready multi-tenant SaaS platform designed for internet service providers in East Africa. It successfully implements:

✅ **Multi-tenant architecture** with strict data isolation  
✅ **Enterprise authentication** (JWT + MFA + OAuth)  
✅ **Role-based access control** with granular permissions  
✅ **Real-time network management** (MikroTik + RADIUS)  
✅ **Flexible payment integration** (6 providers)  
✅ **Comprehensive audit trail** for compliance  
✅ **Security best practices** (encryption, validation, rate-limiting)  
✅ **Scalable deployment** (containerized, PM2, Nginx)  

The system demonstrates advanced security fixes, idempotent payment handling, and careful consideration of race conditions. It is ready for production deployment on DigitalOcean or other cloud providers.

---

**End of Report**  
*Generated: 2026-06-15*  
*Architecture Version: 1.0*
