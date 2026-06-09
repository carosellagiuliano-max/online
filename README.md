# BeautifyPRO Demo

Praesentationskopie der Appointr-Beauty-App fuer `carosellagiuliano-max/BEAUTY`. Das Original-Repository `beautifypro/appointr` bleibt unangetastet.

## Demo-Logins

- Admin: `admin@beautifypro.demo` / `beauty-admin-demo`
- Kunde: `kunde@beautifypro.demo` / `beauty-kunde-demo`
- Staff: `staff@beautifypro.demo` / `beauty-staff-demo`

Weitere Vorfuehrpfade stehen in [demo/demo-scenarios.md](demo/demo-scenarios.md).

## Lokal starten

```bash
pnpm install
pnpm dev
```

## Vercel Deployment

Wichtig: In den Vercel-Projekteinstellungen (Settings -> General) muss das
**Root Directory** auf `apps/frontend-schnittwerk` gesetzt sein. Die Option
"Include source files outside of the Root Directory" muss aktiviert bleiben
(Standard), damit der pnpm-Workspace (`packages/backend`) mitgebaut wird.

Die komplette Build-Konfiguration inkl. Demo-Umgebungsvariablen (Mock Mode)
liegt in `apps/frontend-schnittwerk/vercel.json` und wird von Vercel
automatisch gelesen. Es muessen keine Environment-Variablen im Dashboard
gesetzt werden.

Hinweis: Die Cron-Routen unter `/api/cron/*` laufen auf Vercel nur, wenn sie
als Crons konfiguriert werden. Fuer die Mock-Demo ist das nicht noetig.

## Replit Preview & Deployment

Dieses Demo-Repo ist fuer Replit vorbereitet. Nach dem GitHub-Import kann Replit
die App ueber die vorhandene `.replit`-Konfiguration starten.

Preview im Replit Editor:

```bash
NPM_CONFIG_REGISTRY=https://registry.npmjs.org/ npm_config_registry=https://registry.npmjs.org/ corepack pnpm install --frozen-lockfile --registry=https://registry.npmjs.org/
pnpm dev:replit
```

Production Build/Start fuer Replit Deployments:

```bash
pnpm build
pnpm start:replit
```

Die Replit-Konfiguration nutzt:

- Node.js 20
- pnpm via Corepack ohne globale Symlink-Installation
- Next.js auf `0.0.0.0`
- Replit-`PORT` mit Fallback auf `3000`
- Mock Mode fuer eine sichere Praesentationsdemo ohne echte Zahlungen/E-Mails

Fuer Replit muessen keine produktiven Secrets im Repo liegen. Falls spaeter echte
Supabase-, SMTP- oder Payment-Daten genutzt werden, diese nur in Replit Secrets
hinterlegen und den Mock Mode bewusst deaktivieren.

Mit Docker/Supabase-Demo-Seed:

```bash
cd apps/frontend-schnittwerk
docker compose -p beauty -f docker-compose.dev.yml --env-file .env.dev up -d --build
```

---

# Appointr

Modern salon management system

## Features

- **Online Booking** - Customers can book appointments 24/7
- **Shop** - Sell hair care products online
- **Customer Portal** - View appointments, orders, loyalty points
- **Admin Dashboard** - Full salon management
- **Multi-Salon Ready** - Architecture supports multiple locations

## Tech Stack

- **Frontend**: Next.js 14+, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Payments**: Stripe
- **Email**: Resend
- **Hosting**: Replit Demo Deployments / portable Next.js hosting

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view.

See [docs/dev-setup.md](docs/dev-setup.md) for detailed setup instructions.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm run typecheck` | TypeScript check |

## Documentation

- [Development Setup](docs/dev-setup.md)
- [Architecture](docs/architecture.md)

## License

Proprietary - All rights reserved.
