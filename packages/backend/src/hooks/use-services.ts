'use client';

import { useQuery, useListQuery, useMutation } from './use-api';
import { ServiceService, ServiceCategoryService } from '@/lib/api';

// ============================================
// SERVICE HOOKS
// ============================================

/**
 * Hook to fetch service categories for a salon
 */
export function useServiceCategories(salonId: string | null, activeOnly: boolean = true) {
  return useQuery(
    async () => {
      if (!salonId) {
        return { data: [], count: null, error: null };
      }
      return ServiceCategoryService.findBySalon(salonId, activeOnly);
    },
    { enabled: !!salonId }
  );
}

/**
 * Hook to fetch services for a salon
 */
export function useSalonServices(
  salonId: string | null,
  options?: {
    categoryId?: string;
    bookableOnly?: boolean;
    activeOnly?: boolean;
  }
) {
  return useListQuery(
    async (page) => {
      if (!salonId) {
        return { data: [], count: null, error: null };
      }
      // Note: Service API doesn't have pagination, but we keep the pattern consistent
      const result = await ServiceService.findBySalon(salonId, options);
      return result;
    },
    { enabled: !!salonId }
  );
}

/**
 * Hook to fetch bookable services for online booking
 */
export function useBookableServices(salonId: string | null) {
  return useQuery(
    async () => {
      if (!salonId) {
        return { data: [], count: null, error: null };
      }
      return ServiceService.findBookable(salonId);
    },
    { enabled: !!salonId }
  );
}

/**
 * Hook to fetch services grouped by category
 */
export function useServicesGroupedByCategory(salonId: string | null) {
  return useQuery(
    async () => {
      if (!salonId) {
        return { data: null, error: null };
      }
      return ServiceService.findGroupedByCategory(salonId);
    },
    { enabled: !!salonId }
  );
}

/**
 * Hook to fetch a service with its variants
 */
export function useServiceWithVariants(serviceId: string | null) {
  return useQuery(
    async () => {
      if (!serviceId) {
        return { data: null, error: null };
      }
      return ServiceService.findWithVariants(serviceId);
    },
    { enabled: !!serviceId }
  );
}

/**
 * Hook to fetch staff who can perform a service
 */
export function useStaffForService(serviceId: string | null) {
  return useQuery(
    async () => {
      if (!serviceId) {
        return { data: [], count: null, error: null };
      }
      return ServiceService.findStaffForService(serviceId);
    },
    { enabled: !!serviceId }
  );
}

/**
 * Hook to calculate service duration
 */
export function useServiceDuration(serviceId: string | null, variantId?: string) {
  return useQuery(
    async () => {
      if (!serviceId) {
        return { data: { duration: 0, totalDuration: 0 }, error: null };
      }
      const result = await ServiceService.calculateDuration(serviceId, variantId);
      return { data: result, error: null };
    },
    { enabled: !!serviceId }
  );
}

/**
 * Hook to get service price
 */
export function useServicePrice(serviceId: string | null, variantId?: string) {
  return useQuery(
    async () => {
      if (!serviceId) {
        return { data: { priceCents: 0, priceChf: 0 }, error: null };
      }
      const result = await ServiceService.getPrice(serviceId, variantId);
      return { data: result, error: null };
    },
    { enabled: !!serviceId }
  );
}
