# Payment Integration Guide

> Complete setup guide for PalmPesa, ZenoPay, Mongike, and HarakaPay integrations.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                       │
│  PaymentCheckout → ProviderSelector → PaymentStatus       │
└────────────────────────┬────────────────────────────────┘
                         │ POST /api/payments/initiate
                         │ GET  /api/payments/status/{ref}
┌────────────────────────▼────────────────────────────────┐
│                  Next.js Backend (API Routes)             │
│                                                           │
│  /api/payments/initiate       → PaymentService            │
│  /api/payments/status/{ref}   → DB lookup + live poll     │
│  /api/webhooks/palmpesa       → PaymentService            │
│  /api/webhooks/zenopay        → PaymentService            │
│  /api/webhooks/mongike        → PaymentService            │
│  /api/webhooks/harakapay      → PaymentService            │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│              lib/payments/ (Service Layer)                │
│                                                           │
│  service.ts    ← Central orchestrator                     │
│  registry.ts   ← Provider factory                         │
│  utils.ts      ← Phone, HMAC, retry helpers               │
│  types.ts      ← Shared interfaces                        │
│                                                           │
│  providers/palmpesa.ts   providers/zenopay.ts             │
│  providers/mongike.ts    providers/harakapay.ts           │
└─────────────────────────────────────────────────────────┘
```

---

## Step 1: Get API Credentials

### PalmPesa
1. Email **Support@palmpesa.co.tz** requesting developer access
2. Provide your business name and use case
3. You will receive: `API Key`, `Webhook Secret`
4. Add to `.env`:
   ```env
   PALMPESA_API_KEY="your_api_key_here"
   PALMPESA_WEBHOOK_SECRET="your_webhook_secret"
   ```

### ZenoPay
1. Email **support@zenopay.net** with:
   - Business overview
   - BRELA Certificate, Business License, TIN Certificate, NIDA ID
2. You will receive: `API Key`, `Account ID`
3. Add to `.env`:
   ```env
   ZENOPAY_API_KEY="your_api_key"
   ZENOPAY_ACCOUNT_ID="your_account_id"
   ZENOPAY_WEBHOOK_SECRET="your_webhook_secret"
   ```

### Mongike
1. Register at **https://mongike.com**
2. Complete KYC verification
3. Generate API credentials from the merchant dashboard
4. Add to `.env`:
   ```env
   MONGIKE_API_KEY="your_api_key"
   MONGIKE_API_SECRET="your_api_secret"
   MONGIKE_WEBHOOK_SECRET="your_webhook_secret"
   ```

### HarakaPay
1. Register at **https://harakapayment.com** or **https://harakapay.net**
2. Request developer API access
3. Add to `.env`:
   ```env
   HARAKAPAY_API_KEY="your_api_key"
   HARAKAPAY_API_SECRET="your_api_secret"
   HARAKAPAY_WEBHOOK_SECRET="your_webhook_secret"
   ```

---

## Step 2: Configure Webhook URLs

Each provider needs a publicly accessible URL to POST payment callbacks to.  
Set `APP_URL` in `.env` to your **public server IP or domain**:

```env
APP_URL="https://your-server.com"
```

Webhook URLs to register with each provider:

| Provider  | Webhook URL                                      |
|-----------|--------------------------------------------------|
| PalmPesa  | `https://your-server.com/api/webhooks/palmpesa`  |
| ZenoPay   | `https://your-server.com/api/webhooks/zenopay`   |
| Mongike   | `https://your-server.com/api/webhooks/mongike`   |
| HarakaPay | `https://your-server.com/api/webhooks/harakapay` |

> **⚠️ Important:** Webhooks must be reachable from the internet.  
> During local development, use [ngrok](https://ngrok.com): `ngrok http 3000`

---

## Step 3: Configure Payment Channels in DB

Each tenant can have their own payment channel credentials stored in the database.  
Use the admin dashboard → **Payment Channels** to add channels.

**PaymentChannel fields:**
- `name` — Display name (e.g. "My ZenoPay")
- `provider` — `PALMPESA`, `ZENOPAY`, `MONGIKE`, or `HARAKAPAY`
- `apiKey` — Provider API key (encrypted at rest)
- `apiSecret` — Provider API secret
- `webhookSecret` — For webhook signature verification
- `environment` — `sandbox` or `live`

**Priority:** DB channel credentials > environment variables

---

## Step 4: Run Database Migration

```bash
cd backend
npx prisma migrate dev --name add_webhook_logs
npx prisma generate
```

This creates the new `webhook_logs` table and adds `webhookSecret` + `environment` to `payment_channels`.

---

## Step 5: Switch to Live Mode

1. Set `PAYMENT_ENVIRONMENT="live"` in `.env`
2. Or set `environment: "live"` on the PaymentChannel DB record
3. Verify webhooks are reachable from provider servers
4. Test with a small real transaction first

---

## Step 6: Update Provider API Endpoints

If a provider gives you different base URLs than the defaults, update them:

**Option A — environment variables (global):**
```env
PALMPESA_API_URL="https://api.palmpesa.com/v1"
ZENOPAY_API_URL="https://zenoapi.com/api"
MONGIKE_API_URL="https://api.mongike.com/v1"
HARAKAPAY_API_URL="https://api.harakapay.net/v1"
```

**Option B — per-tenant via DB PaymentChannel `config` JSON:**
```json
{ "apiUrl": "https://custom.provider.url/v2" }
```

---

## Payment Flow

```
Client          Frontend         Backend           Provider
  │                │                │                 │
  │  Select pkg    │                │                 │
  │─────────────►  │                │                 │
  │                │ POST /initiate  │                 │
  │                │───────────────►│                 │
  │                │                │ STK Push API    │
  │                │                │────────────────►│
  │                │                │◄────────────────│
  │                │◄───────────────│  {reference}    │
  │  USSD prompt   │                │                 │
  │◄──────────────────────────────────────────────────│
  │  Enter PIN     │                │                 │
  │──────────────────────────────────────────────────►│
  │                │  Poll /status  │                 │
  │                │───────────────►│                 │
  │                │                │   Webhook POST  │
  │                │                │◄────────────────│
  │                │                │ Mark COMPLETED  │
  │                │                │ Activate RADIUS │
  │                │                │ Activate Router │
  │                │◄───────────────│  status:DONE    │
  │  Connected!    │                │                 │
```

---

## Monitoring & Logs

All webhook calls are logged to the `webhook_logs` table:

```sql
SELECT provider, status, transaction_ref, provider_ref, verified, created_at
FROM webhook_logs
ORDER BY created_at DESC
LIMIT 50;
```

| Column          | Description                              |
|-----------------|------------------------------------------|
| `provider`      | PALMPESA, ZENOPAY, MONGIKE, HARAKAPAY    |
| `verified`      | Was the webhook signature valid?         |
| `status`        | RECEIVED, PROCESSED, FAILED, DUPLICATE  |
| `transaction_ref` | Our internal HP-XXXX reference         |
| `provider_ref`  | Provider's transaction ID                |
| `error_message` | Failure reason if status=FAILED          |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Webhook not received | Check `APP_URL` is publicly reachable. Use ngrok locally. |
| `verified: false` in webhook_logs | Webhook secret mismatch — check `*_WEBHOOK_SECRET` env vars |
| Payment stays PENDING | Provider webhook not configured — register webhook URL with provider |
| `Transaction not found` in logs | `reference` mismatch — check `AccountReference` field from provider |
| MikroTik activation fails | Router offline — check routerLogs table for details |
| `apiKey is required` error | Provider credentials not set in `.env` or PaymentChannel DB record |
