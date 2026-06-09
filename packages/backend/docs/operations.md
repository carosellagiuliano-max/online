# Operations Guide - BeautifyPRO Demo

## Deployment

This demo repository is prepared for Replit. It is a Next.js App Router pnpm
workspace and should not be migrated to Vite or another React template.

### Replit Preview

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm dev:replit
```

### Replit Deployment

```bash
corepack pnpm build
corepack pnpm start:replit
```

The production start command binds Next.js to `0.0.0.0` and uses Replit's
`PORT` environment variable.

## Environment Variables

For the presentation demo, no real Supabase, Stripe, SMTP or payment credentials
are required. The app runs in mock mode.

```env
NEXT_PUBLIC_MOCK_MODE=true
PAYMENT_PROVIDER=pay_at_venue
NEXT_PUBLIC_PAYMENT_PROVIDER=pay_at_venue
NEXT_PUBLIC_FEATURE_SHOP_ENABLED=true
NEXT_PUBLIC_FEATURE_BOOKING_ENABLED=true
NEXT_PUBLIC_FEATURE_GALLERY_ENABLED=true
NEXT_PUBLIC_FEATURE_FINANCE_ENABLED=true
```

If the demo is later connected to real services, add secrets only through the
host's secret manager. Do not commit production credentials.

## Health Check

```bash
curl https://your-replit-app.replit.app/api/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2026-06-09T12:00:00Z"
}
```

## Logs

Use the Replit console and deployment logs for preview/deployment diagnostics.
Application logs are structured and should not include secrets.

## Rollback

Use Git as the source of truth:

```bash
git fetch origin
git reset --hard origin/main
git clean -fd
```

If a Replit Agent run changed files unexpectedly, reset first and then run the
existing pnpm/Replit commands again.

## Database Operations

The demo defaults to mock data. If a real Supabase project is connected later:

```bash
npx supabase migration new feature_name
npx supabase db push
```

Use Supabase backups before applying schema changes to a real database.

## Scheduled Jobs

Cron endpoints are protected with `CRON_SECRET`. Any scheduler can call them if
it sends:

```http
Authorization: Bearer <CRON_SECRET>
```

Do not expose cron endpoints without a secret.

## Security

- Keep mock mode enabled for presentation deployments.
- Store real secrets only in the hosting provider's secret manager.
- Keep Supabase RLS enabled when using a real backend.
- Restrict admin routes to authorized demo/admin users.
- Do not deploy payment providers with test/demo secrets unless the flow is
  clearly marked as test mode.

## Maintenance

Before a public presentation:

1. Pull the latest `main`.
2. Run `corepack pnpm build`.
3. Run `corepack pnpm start:replit` or publish through Replit Deployments.
4. Test `/`, `/termin-buchen`, `/admin/login`, `/konto/login` and `/shop`.

## Demo Accounts

- Admin: `admin@beautifypro.demo` / `beauty-admin-demo`
- Customer: `kunde@beautifypro.demo` / `beauty-kunde-demo`
- Staff: `staff@beautifypro.demo` / `beauty-staff-demo`
