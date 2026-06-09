/**
 * BeautifyPRO Performance - Lazy Loading Utilities
 * Dynamic imports and code splitting helpers
 */

import dynamic from 'next/dynamic';
import { ComponentType, lazy, Suspense } from 'react';

// ============================================
// LAZY COMPONENT FACTORY
// ============================================

interface LazyComponentOptions {
  ssr?: boolean;
  loading?: ComponentType;
}

/**
 * Create a lazy-loaded component with optional SSR
 */
export function createLazyComponent<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: LazyComponentOptions = {}
) {
  const { ssr = false, loading: LoadingComponent } = options;

  return dynamic(importFn, {
    ssr,
    loading: LoadingComponent ? () => <LoadingComponent /> : undefined,
  });
}

// ============================================
// PRELOADED LAZY COMPONENTS
// ============================================

// Admin components (heavy, not needed on initial load)
export const LazyAdminCalendar = createLazyComponent(
  () =>
    import('@/components/admin/admin-calendar-view').then((mod) => ({
      default: mod.AdminCalendarView as ComponentType<object>,
    })),
  { ssr: false }
);

export const LazyAdminAnalytics = createLazyComponent(
  () =>
    import('@/components/admin/admin-analytics-view').then((mod) => ({
      default: mod.AdminAnalyticsView as ComponentType<object>,
    })),
  { ssr: false }
);

export const LazyAdminFinance = createLazyComponent(
  () =>
    import('@/components/admin/admin-finance-view').then((mod) => ({
      default: mod.AdminFinanceView as ComponentType<object>,
    })),
  { ssr: false }
);

// Chart components (large bundle)
export const LazyCharts = createLazyComponent(
  () => Promise.resolve({ default: (() => null) as ComponentType }),
  { ssr: false }
);

// ============================================
// INTERSECTION OBSERVER HOOK
// ============================================

import { useEffect, useRef, useState, RefObject } from 'react';

interface UseIntersectionObserverOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

export function useIntersectionObserver<T extends Element>(
  options: UseIntersectionObserverOptions = {}
): [RefObject<T>, boolean] {
  const { threshold = 0, rootMargin = '100px', triggerOnce = true } = options;
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce) {
            observer.unobserve(element);
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [threshold, rootMargin, triggerOnce]);

  return [ref, isVisible];
}

// ============================================
// LAZY IMAGE COMPONENT
// ============================================

interface LazyImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

export function LazyImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
}: LazyImageProps) {
  const [ref, isVisible] = useIntersectionObserver<HTMLDivElement>({
    rootMargin: '200px',
    triggerOnce: true,
  });

  if (priority || isVisible) {
    // Use Next.js Image when visible
    const NextImage = require('next/image').default;
    return (
      <NextImage
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
      />
    );
  }

  // Placeholder until visible
  return (
    <div
      ref={ref}
      className={className}
      style={{
        width: width || '100%',
        height: height || 'auto',
        backgroundColor: '#f3f4f6',
      }}
      aria-label={alt}
    />
  );
}

// ============================================
// PREFETCH UTILITIES
// ============================================

/**
 * Prefetch a route on hover/focus
 */
export function prefetchOnInteraction(href: string) {
  if (typeof window === 'undefined') return;

  const router = require('next/navigation').useRouter;
  // Note: This is a simplified version
  // In production, use next/link with prefetch prop
}

/**
 * Preload critical resources
 */
export function preloadCriticalAssets() {
  if (typeof window === 'undefined') return;

  // Preload fonts
  const fontLink = document.createElement('link');
  fontLink.rel = 'preload';
  fontLink.as = 'font';
  fontLink.type = 'font/woff2';
  fontLink.crossOrigin = 'anonymous';
  // Add to head

  // Preload critical images
  const heroImage = new Image();
  heroImage.src = '/images/hero.jpg';
}

// ============================================
// BUNDLE ANALYSIS HELPERS
// ============================================

/**
 * Log component render time (dev only)
 */
export function logRenderTime(componentName: string) {
  if (process.env.NODE_ENV !== 'development') return;

  const start = performance.now();

  return () => {
    const end = performance.now();
    console.log(`[Perf] ${componentName} rendered in ${(end - start).toFixed(2)}ms`);
  };
}

/**
 * Measure and report Web Vitals
 */
export function reportWebVitals(metric: {
  id: string;
  name: string;
  value: number;
  label: string;
}) {
  // Send to analytics
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to Google Analytics
    // gtag('event', metric.name, {
    //   event_category: 'Web Vitals',
    //   value: Math.round(metric.value),
    //   event_label: metric.id,
    //   non_interaction: true,
    // });

    // Or send to custom endpoint
    fetch('/api/analytics/vitals', {
      method: 'POST',
      body: JSON.stringify(metric),
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {
      // Silently fail
    });
  }
}
