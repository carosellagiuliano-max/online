# syntax=docker.io/docker/dockerfile:1
# Frontend App - Docker Build
# Build context should be the monorepo root

FROM node:20-alpine AS base

# Build argument for app name (default: frontend-schnittwerk)
ARG APP_NAME=frontend-schnittwerk

# Install dependencies only when needed
FROM base AS deps
ARG APP_NAME
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Enable pnpm
RUN corepack enable pnpm

# Copy workspace config and lock files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/backend/package.json ./packages/backend/
COPY apps/${APP_NAME}/package.json ./apps/${APP_NAME}/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
ARG APP_NAME
RUN corepack enable pnpm
WORKDIR /app

# Copy entire node_modules structure (pnpm uses symlinks that need to be preserved)
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/backend ./packages/backend
COPY apps/${APP_NAME} ./apps/${APP_NAME}

# Reinstall to fix symlinks in the builder stage
RUN pnpm install --frozen-lockfile --offline

# Resolve symlinks - copy actual files for admin and api routes
RUN rm -rf apps/${APP_NAME}/src/app/\(admin\)/admin && \
    cp -r packages/backend/src/admin/admin apps/${APP_NAME}/src/app/\(admin\)/admin && \
    rm -f apps/${APP_NAME}/src/app/\(admin\)/layout.tsx && \
    cp packages/backend/src/admin/layout.tsx apps/${APP_NAME}/src/app/\(admin\)/layout.tsx

RUN rm -rf apps/${APP_NAME}/src/app/api/* && \
    cp -r packages/backend/src/api/* apps/${APP_NAME}/src/app/api/

# Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Build arguments for environment variables
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_ROLE_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_DOMAIN
ARG NEXT_PUBLIC_FEATURE_SHOP_ENABLED=true
ARG NEXT_PUBLIC_FEATURE_BOOKING_ENABLED=true
ARG NEXT_PUBLIC_FEATURE_GALLERY_ENABLED=true
ARG NEXT_PUBLIC_FEATURE_NOTIFICATION_TEMPLATES_ENABLED=true
ARG NEXT_PUBLIC_FEATURE_FINANCE_ENABLED=true
ARG NEXT_PUBLIC_THEME=ocean
ARG NEXT_PUBLIC_THEME_STRUCTURE=classic

# Set environment variables for build
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_DOMAIN=$NEXT_PUBLIC_DOMAIN
ENV NEXT_PUBLIC_FEATURE_SHOP_ENABLED=$NEXT_PUBLIC_FEATURE_SHOP_ENABLED
ENV NEXT_PUBLIC_FEATURE_BOOKING_ENABLED=$NEXT_PUBLIC_FEATURE_BOOKING_ENABLED
ENV NEXT_PUBLIC_FEATURE_GALLERY_ENABLED=$NEXT_PUBLIC_FEATURE_GALLERY_ENABLED
ENV NEXT_PUBLIC_FEATURE_NOTIFICATION_TEMPLATES_ENABLED=$NEXT_PUBLIC_FEATURE_NOTIFICATION_TEMPLATES_ENABLED
ENV NEXT_PUBLIC_FEATURE_FINANCE_ENABLED=$NEXT_PUBLIC_FEATURE_FINANCE_ENABLED
ENV NEXT_PUBLIC_THEME=$NEXT_PUBLIC_THEME
ENV NEXT_PUBLIC_THEME_STRUCTURE=$NEXT_PUBLIC_THEME_STRUCTURE

# Build the frontend app
WORKDIR /app/apps/${APP_NAME}
RUN pnpm build

# Production image
FROM base AS runner
ARG APP_NAME
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install postgresql-client for admin user creation
RUN apk add --no-cache postgresql-client

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/${APP_NAME}/public ./public

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP_NAME}/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static

# Copy entrypoint script
COPY --chown=nextjs:nodejs packages/backend/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Admin credentials are passed via environment variables at runtime
# See docker-compose.dev.yml for configuration

ENTRYPOINT ["./docker-entrypoint.sh"]
