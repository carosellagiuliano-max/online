# BeautifyPRO - Architecture

## Overview

BeautifyPRO is a full-stack salon management system built for Swiss hair salons, specifically designed for "BeautifyPRO Demo Salon" in St. Gallen, Switzerland.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14+ (App Router), React, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Backend | Next.js Server Actions, Route Handlers |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Payments | Stripe |
| Email | Resend |
| Hosting | Replit Demo Deployments / portable Next.js hosting |

## Architecture Layers

```
┌─────────────────────────────────────────────────┐
│                  CLIENT LAYER                    │
│  Public Website │ Customer Portal │ Admin Portal │
└─────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────┐
│              APPLICATION LAYER                   │
│         Server Components & Server Actions       │
└─────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────┐
│                 DOMAIN LAYER                     │
│  BookingService │ PaymentService │ OrderService  │
└─────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────┐
│              DATA ACCESS LAYER                   │
│      Supabase Client │ Repositories │ RLS       │
└─────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────┐
│             INFRASTRUCTURE LAYER                 │
│  PostgreSQL │ Auth │ Storage │ Edge Functions   │
└─────────────────────────────────────────────────┘
```

## Key Design Principles

### 1. Multi-Salon Ready
- All business data scoped by `salon_id`
- RLS policies enforce tenant isolation
- No data leakage between salons

### 2. Configuration over Code
- Business rules stored in database
- Admin UI for configuration
- No redeployment for business changes

### 3. Domain-Driven Design
- Clear domain boundaries
- Business logic in domain services
- Server Actions call domain services

### 4. Security First
- Row Level Security on all tables
- RBAC with strict role hierarchy
- Input validation at boundaries

## Data Flow Example: Booking

1. Customer selects service and time in UI
2. Server Action calls `bookingService.createReservation()`
3. Domain service validates slot availability
4. Database transaction creates appointment with `reserved` status
5. Payment Intent created via Stripe
6. On payment success, webhook confirms appointment
7. Notification sent via email

## Environments

| Environment | Purpose | Database |
|-------------|---------|----------|
| Development | Local development | Supabase local or dev project |
| Staging | Testing before production | Separate Supabase project |
| Production | Live system | Production Supabase project |

## Security Model

### Role Hierarchy

```
HQ (Cross-Salon)
    │
  Admin (Full Salon Access)
    │
  Manager (Operational Access)
    │
  Mitarbeiter (Staff Access)
    │
  Kunde (Customer Access)
```

### RLS Strategy

- All tables have RLS enabled
- Policies check `salon_id` and user role
- Service role used only server-side
- Never trust client-provided `salon_id`
