/**
 * BeautifyPRO - Loading States Components
 * Reusable loading indicators and skeletons
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

// ============================================
// SPINNER
// ============================================

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <Loader2
      className={cn('animate-spin text-primary', sizeClasses[size], className)}
    />
  );
}

// ============================================
// FULL PAGE LOADER
// ============================================

interface PageLoaderProps {
  message?: string;
}

export function PageLoader({ message = 'Laden...' }: PageLoaderProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <Spinner size="lg" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ============================================
// INLINE LOADER
// ============================================

interface InlineLoaderProps {
  message?: string;
  className?: string;
}

export function InlineLoader({ message, className }: InlineLoaderProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Spinner size="sm" />
      {message && <span className="text-sm text-muted-foreground">{message}</span>}
    </div>
  );
}

// ============================================
// BUTTON LOADING STATE
// ============================================

interface ButtonLoadingProps {
  isLoading: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export function ButtonLoading({
  isLoading,
  loadingText = 'Laden...',
  children,
}: ButtonLoadingProps) {
  if (isLoading) {
    return (
      <>
        <Spinner size="sm" className="mr-2" />
        {loadingText}
      </>
    );
  }
  return <>{children}</>;
}

// ============================================
// SKELETON LOADERS
// ============================================

export function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <Skeleton className="mb-4 h-40 w-full rounded-md" />
      <Skeleton className="mb-2 h-4 w-3/4" />
      <Skeleton className="mb-4 h-4 w-1/2" />
      <div className="flex justify-between">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Skeleton className="aspect-square w-full" />
      <div className="p-4">
        <Skeleton className="mb-2 h-5 w-3/4" />
        <Skeleton className="mb-3 h-4 w-1/2" />
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="flex-1">
        <Skeleton className="mb-2 h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="border-b">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton className="h-4 w-full max-w-[100px]" />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="p-4 text-left">
                <Skeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AppointmentCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <Skeleton className="mb-2 h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

export function CustomerCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-4 mb-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1">
          <Skeleton className="mb-2 h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <Skeleton className="mb-1 h-3 w-16" />
          <Skeleton className="h-5 w-12" />
        </div>
        <div>
          <Skeleton className="mb-1 h-3 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

export function OrderSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <Skeleton className="mb-2 h-5 w-28" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="space-y-2 mb-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}

export function StatsCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-5 rounded" />
      </div>
      <Skeleton className="mb-1 h-8 w-20" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

// ============================================
// GRID SKELETONS
// ============================================

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function AppointmentListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <AppointmentCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatsCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ============================================
// CONTENT LOADER (with pulse animation)
// ============================================

interface ContentLoaderProps {
  className?: string;
  children: React.ReactNode;
}

export function ContentLoader({ className, children }: ContentLoaderProps) {
  return (
    <div className={cn('animate-pulse', className)}>
      {children}
    </div>
  );
}
