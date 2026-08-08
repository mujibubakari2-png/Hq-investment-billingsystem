# Production Readiness Notes

## Current Build Blocker

The landing page cannot be fully verified with `next build` until the workspace install repairs the missing `styled-jsx` package under `landing-page/node_modules/next/node_modules`.

The super admin build is also blocked before code compilation because the local package store denies reads from `node_modules/.pnpm` for TypeScript and Vite files.

Observed state:

- `styled-jsx` is referenced by the lockfile and Next.js expects it at runtime.
- The package is not currently linked in `landing-page/node_modules`.
- `pnpm install --config.confirmModulesPurge=false` was attempted after moving overrides into `pnpm-workspace.yaml`, but it timed out before repairing the dependency tree.
- `npm.cmd run build` in `super-admin` reaches `tsc -b`, then fails with `EPERM` while opening the TypeScript binary in the root `node_modules/.pnpm` store.
- Direct reads of the same TypeScript and Vite files also fail with access denied, so this is a dependency store permission issue rather than an application route error.

## Required Environment Variables

Core app:

- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`
- `NEXT_PUBLIC_WHATSAPP_NUMBER`

PayPal checkout:

- `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_SECRET`
- `PAYPAL_API_BASE_URL`

Mobile money checkout:

- Active `paymentChannel` records for `PALMPESA`, `ZENOPAY`, `MONGIKE`, or `HARAKAPAY`
- Encrypted `apiKey` values that can be decrypted by `src/lib/encryption.ts`
- Optional provider-specific `config.apiUrl`

## Verification Checklist

- Run install until `styled-jsx` is restored.
- Run landing build.
- Test product listing, product detail, wishlist, compare, recently viewed, cart, checkout, review submission, newsletter subscription, sitemap, and robots endpoints.
- Test mobile money webhook with duplicate callbacks to confirm stock is decremented once.
- Test PayPal create and capture with valid sandbox credentials.

## Super Admin Module Roadmap

The landing page now exposes the commerce surfaces needed by the public storefront. The super admin E-Commerce shell has been started as a separate admin phase, without changing the existing platform modules.

Implemented shell coverage:

- Shared `commerceModules` config is now the single source for the E-Commerce dashboard and sidebar navigation.
- Navigation covers Dashboard, Products, Categories, Brands, Collections, Inventory, Warehouses, Orders, Customers, Reviews, Coupons, Flash Sales, Promotions, Banners, CMS, Blog, Pages, Menus, Media Library, Shipping, Taxes, Payments, Analytics, Reports, Settings, API Keys, and Developer.
- Module statuses now use production-oriented labels: Operational, Configured, and Integration Required.
- The E-Commerce command center search now filters real modules instead of showing a non-functional search field.

Shared API contracts should reuse the same product, review, cart, checkout, and payment-provider concepts already cleaned up in the landing page.
