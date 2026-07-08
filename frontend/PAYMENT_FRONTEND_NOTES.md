Frontend checklist for Payment Settings and UI

1. Masking
- Ensure API returns only masked `apiKey`, `apiSecret`, `webhookSecret` (last 4 chars).
- Disable copying full secret from UI; provide a "Show" toggle that requests the full secret via a privileged API route only for platform super-admins.

2. Tenant scoping
- Payment Settings UI must include `tenantId` selector for platform admins; tenant users must only see their own settings.
- Validate tenantId on the backend; frontend should default to current user's tenant.

3. Cache invalidation
- After updating a `PaymentChannel`, invalidate SWR/React Query keys for `payment-channels` and any related `tenant_payment_gateways`.
- On update, emit an event to server-sent events or revalidate pages where payment options are read.

4. Tests
- Add E2E test for creating a tenant-scoped payment channel and ensuring initiate payment uses tenant credentials.

5. Deployment
- Ensure frontend reads `NEXT_PUBLIC_*` only for non-sensitive settings. Secrets must never be baked into frontend bundles.
