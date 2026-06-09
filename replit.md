# BeautifyPRO Demo - Replit Instructions

## Critical Rules

This repository is already a working Next.js app. Do not migrate it.

- Do not convert this project to Vite.
- Do not create or use `App.tsx`.
- Do not edit all `page.tsx` files to remove async server components.
- Do not change environment variables to `VITE_*`.
- Do not install Vite or React template packages.
- Do not rewrite the app structure.
- Do not move files out of the pnpm workspace.

If the workspace looks broken because an Agent migration already changed files,
reset first:

```bash
git fetch origin
git reset --hard origin/main
git clean -fd
```

## Project Type

- Framework: Next.js 16 App Router
- Language: TypeScript
- Package manager: pnpm 10.28.0 through Corepack
- Monorepo: pnpm workspaces
- Main app package: `apps/frontend-schnittwerk`
- Shared backend package: `packages/backend`
- Demo mode: enabled through mock data

The technical package name `frontend-schnittwerk` is intentional. The visible
demo branding is BeautifyPRO.

## Correct Commands

Install:

```bash
NPM_CONFIG_REGISTRY=https://registry.npmjs.org/ npm_config_registry=https://registry.npmjs.org/ corepack pnpm install --frozen-lockfile --registry=https://registry.npmjs.org/
```

Development preview:

```bash
corepack pnpm dev:replit
```

Production build:

```bash
corepack pnpm build
```

Production start:

```bash
corepack pnpm start:replit
```

The start script binds Next.js to `0.0.0.0` and uses Replit's `PORT`
environment variable.

## Demo Accounts

- Admin: `admin@beautifypro.demo` / `beauty-admin-demo`
- Customer: `kunde@beautifypro.demo` / `beauty-kunde-demo`
- Staff: `staff@beautifypro.demo` / `beauty-staff-demo`

## Environment

No real Supabase, Stripe, SMTP or payment setup is required for the demo.
The app runs in mock mode. Add real secrets only through Replit Secrets if the
demo is intentionally connected to real services later.

## Expected Behavior

Use the existing `.replit`, `replit.nix`, `package.json`, `pnpm-lock.yaml` and
`scripts/replit-next.mjs` files. The goal is to run the existing app, not to
repair or regenerate the project.
