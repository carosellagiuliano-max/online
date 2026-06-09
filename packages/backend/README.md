# @beautifypro/backend

Shared backend package for BeautifyPro salon management system.

## Contains

- **Admin pages** (`src/admin/`) - Dashboard, calendar, customers, orders, etc.
- **API routes** (`src/api/`) - REST endpoints for admin operations
- **Components** (`src/components/`) - UI components (shadcn/ui based)
- **Lib** (`src/lib/`) - Business logic, actions, services
- **Supabase** (`supabase/`) - Database migrations and config

## Usage in Frontend Apps

### As pnpm workspace (current)

```json
{
  "dependencies": {
    "@beautifypro/backend": "workspace:*"
  }
}
```

### As git submodule (future)

```bash
# In your frontend repo
git submodule add https://github.com/beautifypro/backend packages/backend
git submodule update --init
```

### As npm package (future)

```bash
npm install @beautifypro/backend@1.5.0
```

## Splitting to Separate Repo

When ready to split:

1. Create new repo: `github.com/beautifypro/backend`
2. Copy this entire `packages/backend/` directory
3. Push to new repo
4. Tag releases: `git tag v1.0.0 && git push --tags`
5. In frontend repos, either:
   - Add as submodule
   - Publish to npm and install as dependency

## Versioning

Use semantic versioning:
- `1.0.0` - Initial stable release
- `1.1.0` - New features (backwards compatible)
- `1.0.1` - Bug fixes
- `2.0.0` - Breaking changes

## Feature Flags

Configure in frontend's `src/config/settings.ts`:

```typescript
features: {
  shopEnabled: true,
  bookingEnabled: true,
  galleryEnabled: true,
}
```
