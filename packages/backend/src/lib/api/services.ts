import { BaseService, ServiceResult, ServiceListResult } from './base';
import type {
  Service,
  ServiceCategory,
  Staff,
  InsertTables,
  UpdateTables,
} from '../db/types';

// ============================================
// SERVICE CATEGORY SERVICE
// ============================================

class ServiceCategoryServiceClass extends BaseService<'service_categories'> {
  constructor() {
    super('service_categories');
  }

  // Get categories for salon
  async findBySalon(salonId: string, activeOnly: boolean = true): Promise<ServiceListResult<ServiceCategory>> {
    const filters: Record<string, unknown> = { salon_id: salonId };
    if (activeOnly) filters.is_active = true;

    return this.findMany({
      filters,
      sort: { sortBy: 'sort_order', sortOrder: 'asc' },
    });
  }

  // Get category with services
  async findWithServices(categoryId: string): Promise<
    ServiceResult<ServiceCategory & { services: Service[] }>
  > {
    const { data, error } = await this.client
      .from('service_categories')
      .select(`
        *,
        services (*)
      `)
      .eq('id', categoryId)
      .single();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data: data as ServiceCategory & { services: Service[] }, error: null };
  }
}

// ============================================
// SERVICE SERVICE
// ============================================

interface ServiceWithCategory extends Service {
  category?: ServiceCategory | null;
}

interface ServiceWithVariants extends Service {
  service_length_variants?: Array<{
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number | null;
    price_cents: number;
    sort_order: number;
  }>;
}

class ServiceServiceClass extends BaseService<'services'> {
  constructor() {
    super('services');
  }

  // Get services for salon
  async findBySalon(
    salonId: string,
    options?: {
      categoryId?: string;
      bookableOnly?: boolean;
      activeOnly?: boolean;
    }
  ): Promise<ServiceListResult<ServiceWithCategory>> {
    const { categoryId, bookableOnly = false, activeOnly = true } = options || {};

    let query = this.client
      .from('services')
      .select(`
        *,
        category:service_categories (*)
      `, { count: 'exact' })
      .eq('salon_id', salonId);

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (bookableOnly) {
      query = query.eq('is_bookable_online', true);
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    query = query.order('sort_order', { ascending: true });

    const { data, error, count } = await query;

    if (error) {
      return { data: [], count: null, error: this.handleError(error) };
    }

    return { data: (data || []) as ServiceWithCategory[], count, error: null };
  }

  // Get service with variants
  async findWithVariants(serviceId: string): Promise<ServiceResult<ServiceWithVariants>> {
    const { data, error } = await this.client
      .from('services')
      .select(`
        *,
        service_length_variants (*)
      `)
      .eq('id', serviceId)
      .single();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data: data as ServiceWithVariants, error: null };
  }

  // Get bookable services for online booking
  async findBookable(salonId: string): Promise<ServiceListResult<ServiceWithCategory>> {
    return this.findBySalon(salonId, { bookableOnly: true, activeOnly: true });
  }

  // Get services grouped by category
  async findGroupedByCategory(salonId: string): Promise<
    ServiceResult<Array<ServiceCategory & { services: Service[] }>>
  > {
    const { data, error } = await this.client
      .from('service_categories')
      .select(`
        *,
        services (*)
      `)
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    // Filter active services within categories
    const result = (data || []).map((category) => ({
      ...category,
      services: ((category as ServiceCategory & { services: Service[] }).services || [])
        .filter((s: Service) => s.is_active)
        .sort((a: Service, b: Service) => a.sort_order - b.sort_order),
    }));

    return { data: result, error: null };
  }

  // Get staff who can perform service
  async findStaffForService(serviceId: string): Promise<ServiceListResult<Staff>> {
    const { data, error } = await this.client
      .from('staff_service_skills')
      .select(`
        staff (*)
      `)
      .eq('service_id', serviceId);

    if (error) {
      return { data: [], count: null, error: this.handleError(error) };
    }

    const staffList = (data || [])
      .map((item) => (item as { staff: Staff }).staff)
      .filter((s) => s && s.is_active && s.is_bookable);

    return { data: staffList, count: staffList.length, error: null };
  }

  // Calculate service duration (including variants and buffers)
  async calculateDuration(
    serviceId: string,
    variantId?: string
  ): Promise<{ duration: number; totalDuration: number }> {
    const { data } = await this.findWithVariants(serviceId);

    if (!data) {
      return { duration: 0, totalDuration: 0 };
    }

    let duration = data.duration_minutes;

    // Check for variant duration
    if (variantId && data.service_length_variants) {
      const variant = data.service_length_variants.find((v) => v.id === variantId);
      if (variant?.duration_minutes) {
        duration = variant.duration_minutes;
      }
    }

    const totalDuration =
      duration + (data.buffer_before_minutes || 0) + (data.buffer_after_minutes || 0);

    return { duration, totalDuration };
  }

  // Get service price (including variants)
  async getPrice(
    serviceId: string,
    variantId?: string
  ): Promise<{ priceCents: number; priceChf: number }> {
    const { data } = await this.findWithVariants(serviceId);

    if (!data) {
      return { priceCents: 0, priceChf: 0 };
    }

    let priceCents = data.price_cents;

    // Check for variant price
    if (variantId && data.service_length_variants) {
      const variant = data.service_length_variants.find((v) => v.id === variantId);
      if (variant) {
        priceCents = variant.price_cents;
      }
    }

    return {
      priceCents,
      priceChf: priceCents / 100,
    };
  }
}

// Export singleton instances
export const ServiceCategoryService = new ServiceCategoryServiceClass();
export const ServiceService = new ServiceServiceClass();
