# BeautifyPRO - Development Setup

## Prerequisites

- Node.js 20+
- npm 10+
- Git
- Supabase account
- Stripe account (for payments)

## Getting Started

### 1. Clone Repository

```bash
git clone <repository-url>
cd beauty
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env.local
```

Fill in the required values:

- **Supabase**: Get credentials from your Supabase project dashboard
- **Stripe**: Get test API keys from Stripe dashboard

### 4. Database Setup

```bash
# Link to your Supabase project
npx supabase link --project-ref <your-project-id>

# Run migrations
npx supabase db push

# (Optional) Seed development data
npx supabase db seed
```

### 5. Generate Types

```bash
npx supabase gen types typescript --project-id <your-project-id> > src/lib/db/types.ts
```

### 6. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm run typecheck` | Run TypeScript type check |

## Project Structure

```
src/
├── app/              # Next.js App Router pages
│   ├── (public)/     # Public website routes
│   ├── (customer)/   # Customer portal routes
│   ├── (admin)/      # Admin portal routes
│   └── api/          # API routes and webhooks
├── components/       # React components
│   ├── ui/           # shadcn/ui components
│   ├── layout/       # Layout components
│   └── ...
├── features/         # Feature-based modules
├── lib/              # Core libraries
│   ├── db/           # Database client and types
│   ├── domain/       # Business logic
│   ├── auth/         # Authentication
│   └── ...
├── hooks/            # React hooks
└── types/            # TypeScript types
```

## Development Guidelines

### Code Style

- Use TypeScript for all files
- Follow ESLint and Prettier configurations
- Use meaningful variable and function names
- Add JSDoc comments for public functions

### Git Workflow

1. Create feature branch from `develop`
2. Make changes and commit
3. Open Pull Request to `develop`
4. After review, merge to `develop`
5. Release to `main` via release workflow

### Testing

```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run e2e tests
npm run test:e2e
```
