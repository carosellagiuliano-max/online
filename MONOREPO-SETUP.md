# Monorepo Setup Summary

**Date:** 2026-01-10
**Status:** Complete, ready for testing

---

## What Was Done

### 1. Split codebase into monorepo structure

```
beauty/
├── pnpm-workspace.yaml          # Workspace config
├── package.json                 # Root scripts
├── packages/
│   └── backend/                 # @beautifypro/backend
│       ├── src/
│       │   ├── admin/           # Admin pages (symlinked to frontend)
│       │   ├── api/             # API routes (symlinked to frontend)
│       │   ├── components/      # All UI components
│       │   ├── lib/             # Business logic, actions, services
│       │   ├── contexts/        # React contexts
│       │   └── hooks/           # Custom hooks
│       ├── supabase/            # Database migrations
│       └── tests/               # Unit/integration tests
└── apps/
    └── frontend-schnittwerk/    # Demo customer app
        ├── src/
        │   ├── app/             # Public pages + symlinks to admin/api
        │   └── config/settings.ts  # Customer config
        ├── public/              # Customer assets
        ├── Dockerfile           # Docker build
        ├── docker-compose.yml   # Production stack
        ├── docker-compose.dev.yml # Dev stack with ports
        └── .env.dev             # Dev environment
```

### 2. Key Configuration Files

**Frontend tsconfig.json paths:**
```json
{
  "paths": {
    "@/components/*": ["../../packages/backend/src/components/*"],
    "@/lib/*": ["../../packages/backend/src/lib/*"],
    "@/contexts/*": ["../../packages/backend/src/contexts/*"],
    "@/hooks/*": ["../../packages/backend/src/hooks/*"],
    "@/config/*": ["./src/config/*"],
    "@/*": ["./src/*"]
  }
}
```

**Frontend next.config.ts:**
- `turbopack.root: '../..'` for monorepo support
- `turbopack.resolveAlias` for path aliases
- `transpilePackages: ['@beautifypro/backend']`

**Frontend globals.css:**
```css
@import "tailwindcss";
@import "tw-animate-css";

/* Critical: Include backend for Tailwind scanning */
@source "../../../../packages/backend/src/**/*.{ts,tsx}";
@source "../../../src/**/*.{ts,tsx}";
```

---

## Commands

### Development
```bash
pnpm dev                    # Start frontend dev server
pnpm build                  # Build frontend
pnpm test                   # Run backend tests
```

### Docker
```bash
# Build image (from repo root)
docker build -f packages/backend/Dockerfile -t beauty --build-arg APP_NAME=frontend-schnittwerk .

# Dev stack (with exposed ports: 3000, 54321, 54323)
docker compose -f apps/frontend-schnittwerk/docker-compose.dev.yml \
  --env-file apps/frontend-schnittwerk/.env.dev up -d

# Production stack (no exposed ports, use reverse proxy)
docker compose -f apps/frontend-schnittwerk/docker-compose.yml \
  --env-file apps/frontend-schnittwerk/.env up -d
```

---

## Tomorrow: Testing Checklist

### Frontend Public Pages
- [ ] Homepage loads with correct styling
- [ ] Services page (Leistungen)
- [ ] Team page
- [ ] Gallery page
- [ ] Booking flow (termin-buchen)
- [ ] Shop pages
- [ ] Checkout flow
- [ ] Customer account (konto)

### Admin Pages
- [ ] Admin login (/admin/login)
- [ ] Dashboard (/admin)
- [ ] Calendar (Kalender)
- [ ] Customers (Kunden)
- [ ] Orders (Bestellungen)
- [ ] Products (Produkte)
- [ ] Team management
- [ ] Settings (Einstellungen)

### API Routes
- [ ] Health check (/api/health)
- [ ] Admin endpoints
- [ ] Webhooks (Stripe, Twilio)

### Docker
- [ ] Dev compose starts all services
- [ ] App connects to Supabase
- [ ] Database migrations run

---

## Creating Customer Template

When testing is complete, create a template:

```bash
# 1. Copy frontend as template
cp -r apps/frontend-schnittwerk apps/frontend-template

# 2. Clean customer-specific files
cd apps/frontend-template
rm -rf .next node_modules
# Edit src/config/settings.ts → placeholder values
# Edit src/app/globals.css → neutral colors
# Edit public/ → remove customer logos

# 3. Document in template README
```

**Template should include:**
- Placeholder settings in `src/config/settings.ts`
- Neutral color scheme in `globals.css`
- Generic public/ assets
- Clear README for customization

---

## Future: Splitting to Separate Repos

See `SPLITTING.md` for detailed instructions when adding 2nd customer.

**Options:**
1. Git submodules (see backend code locally)
2. npm package (cleaner, version locked)

---

## Troubleshooting

### CSS/Styling broken
Ensure globals.css has `@source` directives for backend package.

### Module not found errors
Check tsconfig.json paths and next.config.ts turbopack.resolveAlias.

### Docker build fails
Ensure pnpm-lock.yaml is up to date: `pnpm install`

### Admin pages 404
Check symlinks in `apps/frontend-schnittwerk/src/app/(admin)/`
