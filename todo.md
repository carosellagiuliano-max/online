# Multi-tenant Configuration - Complete

## All Issues Resolved

| Issue | Location | Status |
|-------|----------|--------|
| Hardcoded "BeautifyPRO" | Metadata, pages, SEO | ✅ Moved to env vars via `customerConfig` |
| APP_CONFIG constants | packages/backend/src/lib/config/constants.ts | ✅ Now reads from env vars |
| Hardcoded domain/URLs | robots.ts, sitemap, metadata | ✅ Uses `customerConfig.website` |
| Theme preset names | Theme config | ✅ Already uses env vars |
| Backend hardcoded values | Email, Stripe, API routes | ✅ All use `APP_CONFIG` now |
| App template | apps/frontend-template/ | ✅ Created with placeholders |

## What Was Done

### 1. Extract branding to config ✅
- Updated `apps/frontend-schnittwerk/src/config/settings.ts` with all branding/SEO fields
- All values now read from env vars with sensible defaults
- Updated `apps/frontend-schnittwerk/src/app/layout.tsx` to use `customerConfig`
- Updated `apps/frontend-schnittwerk/src/app/robots.ts` to use `customerConfig.website`
- Updated `apps/frontend-schnittwerk/src/app/sitemap.ts` to use `customerConfig.website`
- Updated `packages/backend/src/lib/config/constants.ts` to read from env vars

### 2. Create app template ✅
- Created `apps/frontend-template/` with all placeholder values
- Updated `.env` and `.env.dev` with `[CHANGE]` markers for customer-specific values
- Created template `seed.sql` with placeholder comments and generic data
- Uses `ocean` theme by default (different from beauty)

### 3. Backend made generic ✅
Fixed hardcoded "BeautifyPRO" references in:
- `src/api/webhooks/stripe/route.ts` - Uses `APP_CONFIG.name`
- `src/lib/email/send.ts` - Uses `APP_CONFIG.name` and `APP_CONFIG.email`
- `src/lib/email/order-emails.ts` - Uses `APP_CONFIG.name` as default
- `src/lib/actions/contact.ts` - Uses `APP_CONFIG` for fallbacks
- `src/lib/payments/stripe-client.ts` - Uses `NEXT_PUBLIC_BUSINESS_NAME`
- `src/components/layout/header.tsx` - Uses `NEXT_PUBLIC_*` env vars
- `src/components/layout/footer.tsx` - Uses `NEXT_PUBLIC_*` env vars
- `src/components/admin/admin-sidebar.tsx` - Uses `NEXT_PUBLIC_BUSINESS_NAME`
- `src/api/admin/appointments/send-confirmation/route.ts` - Uses `APP_CONFIG`
- `src/api/admin/notifications/test/route.ts` - Uses `APP_CONFIG`

## New Environment Variables

```bash
# Business Branding
NEXT_PUBLIC_BUSINESS_NAME=Your Salon Name
NEXT_PUBLIC_BUSINESS_FULL_NAME=Your Salon Name by Owner
NEXT_PUBLIC_BUSINESS_OWNER=Owner Name
NEXT_PUBLIC_BUSINESS_TAGLINE=Your tagline

# Business Address
NEXT_PUBLIC_ADDRESS_STREET=Street Address 123
NEXT_PUBLIC_ADDRESS_ZIP=12345
NEXT_PUBLIC_ADDRESS_CITY=City Name
NEXT_PUBLIC_ADDRESS_COUNTRY=Country

# Business Contact
NEXT_PUBLIC_PHONE=+41 00 000 00 00
NEXT_PUBLIC_EMAIL=info@example.com
NEXT_PUBLIC_INSTAGRAM=https://instagram.com/yoursalon

# Regional Settings
NEXT_PUBLIC_CURRENCY=CHF
NEXT_PUBLIC_LOCALE=de-CH
NEXT_PUBLIC_TIMEZONE=Europe/Zurich
NEXT_PUBLIC_VAT_RATE=0.081

# SEO Settings
NEXT_PUBLIC_SEO_TITLE=Premium Salon in Your City
NEXT_PUBLIC_SEO_DESCRIPTION=Your salon description...
NEXT_PUBLIC_SEO_KEYWORDS=Salon,Hair,Beauty,City
NEXT_PUBLIC_OG_IMAGE=/og-image.jpg
```

## How to Create a New Customer App

1. Copy `apps/frontend-template/` to `apps/frontend-{customer}/`
2. Update all `[CHANGE]` values in `.env` and `.env.dev`
3. Customize `seed.sql` with customer's services, staff, products
4. Update `public/` assets (favicon, og-image, etc.)
5. Run `pnpm install` in the new app directory

## Notes

### seed.sql
The seed file contains customer-specific test data and must be customized for each customer:
- Salon info (name, address, contact)
- Services and categories
- Staff members
- Products
- Notification templates
- About page content
