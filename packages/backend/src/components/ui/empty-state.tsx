'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Calendar,
  ShoppingBag,
  Users,
  Package,
  FileText,
  Image,
  BarChart3,
  Clock,
  Search,
  Inbox,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ============================================
// TYPES
// ============================================

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  variant?: 'default' | 'compact' | 'card';
}

// ============================================
// PRESET EMPTY STATES
// ============================================

export const emptyStatePresets = {
  appointments: {
    icon: Calendar,
    title: 'Keine Termine',
    description: 'Es sind keine Termine für diesen Zeitraum vorhanden.',
  },
  customers: {
    icon: Users,
    title: 'Keine Kunden',
    description: 'Es wurden noch keine Kunden angelegt.',
  },
  orders: {
    icon: ShoppingBag,
    title: 'Keine Bestellungen',
    description: 'Es sind keine Bestellungen vorhanden.',
  },
  products: {
    icon: Package,
    title: 'Keine Produkte',
    description: 'Es wurden noch keine Produkte hinzugefügt.',
  },
  services: {
    icon: Clock,
    title: 'Keine Dienstleistungen',
    description: 'Es wurden noch keine Dienstleistungen definiert.',
  },
  documents: {
    icon: FileText,
    title: 'Keine Dokumente',
    description: 'Es sind keine Dokumente vorhanden.',
  },
  images: {
    icon: Image,
    title: 'Keine Bilder',
    description: 'Es wurden noch keine Bilder hochgeladen.',
  },
  analytics: {
    icon: BarChart3,
    title: 'Keine Daten',
    description: 'Für diesen Zeitraum liegen keine Analysedaten vor.',
  },
  search: {
    icon: Search,
    title: 'Keine Ergebnisse',
    description: 'Keine Übereinstimmungen für Ihre Suche gefunden.',
  },
  inbox: {
    icon: Inbox,
    title: 'Keine Nachrichten',
    description: 'Ihr Posteingang ist leer.',
  },
} as const;

// ============================================
// EMPTY STATE COMPONENT
// ============================================

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  variant = 'default',
}: EmptyStateProps) {
  if (variant === 'compact') {
    return (
      <div className={cn('py-6 text-center', className)}>
        <Icon className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">{title}</p>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed p-8 text-center',
          className
        )}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-sm font-medium">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
        {action && (
          <Button onClick={action.onClick} className="mt-4" size="sm">
            {action.label}
          </Button>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-medium">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-6">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// ============================================
// LOADING SKELETON COMPONENTS
// ============================================

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 w-full animate-pulse rounded-md bg-muted/50" />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border p-6">
      <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
      <div className="mt-4 h-8 w-1/2 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-muted/50" />
    </div>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4">
          <div className="aspect-square w-full animate-pulse rounded-md bg-muted" />
          <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-muted/50" />
        </div>
      ))}
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-8 w-8 animate-pulse rounded bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-6 animate-pulse rounded bg-muted/50" />
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded bg-muted/30" />
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="h-64 w-full">
      <div className="flex h-full items-end justify-between gap-2 px-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="w-full animate-pulse rounded-t bg-muted"
            style={{ height: `${Math.random() * 60 + 20}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-muted/50" />
          </div>
        </div>
      ))}
    </div>
  );
}
