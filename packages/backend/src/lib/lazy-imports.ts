/**
 * Lazy import utilities for optional, heavy UI modules.
 */

import dynamic from 'next/dynamic';
import { ComponentType, createElement } from 'react';

const DefaultLoading = () =>
  createElement(
    'div',
    { className: 'flex items-center justify-center p-8' },
    createElement('div', {
      className: 'h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent',
    })
  );

const EmptyComponent = () => null;
const loading = () => createElement(DefaultLoading);

const lazyEmpty = (ssr = false) =>
  dynamic(() => Promise.resolve(EmptyComponent), {
    loading,
    ssr,
  });

export const LazyCalendarView = dynamic(
  () =>
    import('@/components/admin/admin-calendar-view').then((mod) => mod.AdminCalendarView),
  {
    loading,
    ssr: false,
  }
);

export const LazyCustomerCalendar = lazyEmpty();

export const LazyAnalyticsDashboard = dynamic(
  () =>
    import('@/components/admin/admin-analytics-view').then((mod) => mod.AdminAnalyticsView),
  {
    loading,
    ssr: false,
  }
);

export const LazyFinancialOverview = dynamic(
  () =>
    import('@/components/admin/admin-finance-view').then((mod) => mod.AdminFinanceView),
  {
    loading,
    ssr: false,
  }
);

export const LazyRichTextEditor = lazyEmpty();
export const LazyImageUploader = lazyEmpty();
export const LazyImageGallery = lazyEmpty();
export const LazyInvoicePDF = lazyEmpty();
export const LazyLocationMap = lazyEmpty();
export const LazyAddCustomerModal = lazyEmpty();
export const LazyCustomerDetailModal = lazyEmpty();
export const LazyEditEmployeeModal = lazyEmpty();
export const LazyAppointmentBookingDialog = lazyEmpty();
export const LazyStripeCheckoutDialog = lazyEmpty();
export const LazyGoogleReviews = lazyEmpty(true);

interface LazyOptions {
  loading?: ComponentType;
  ssr?: boolean;
}

export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T } | T>,
  options: LazyOptions = {}
) {
  return dynamic(
    () => importFn().then((mod) => ('default' in mod ? mod.default : mod)),
    {
      loading: options.loading ? () => createElement(options.loading as ComponentType) : loading,
      ssr: options.ssr ?? false,
    }
  );
}

export function prefetchComponent(importFn: () => Promise<any>) {
  importFn().catch(() => {
    // Prefetching is opportunistic.
  });
}

export function prefetchCommonRoutes() {
  if (typeof window === 'undefined') return;

  const prefetch = () => {
    import('@/components/booking/booking-flow').catch(() => {});
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(prefetch);
  } else {
    setTimeout(prefetch, 2000);
  }
}
