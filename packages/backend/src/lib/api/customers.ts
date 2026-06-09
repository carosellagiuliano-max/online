import { BaseService, ServiceResult, ServiceListResult, ilike } from './base';
import type { Customer, InsertTables, UpdateTables } from '../db/types';

// ============================================
// CUSTOMER SERVICE
// ============================================

class CustomerServiceClass extends BaseService<'customers'> {
  constructor() {
    super('customers');
  }

  // Get customer by profile ID
  async findByProfileId(profileId: string, salonId: string): Promise<ServiceResult<Customer>> {
    const { data, error } = await this.client
      .from('customers')
      .select('*')
      .eq('profile_id', profileId)
      .eq('salon_id', salonId)
      .single();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data, error: null };
  }

  // Get customers for salon
  async findBySalon(
    salonId: string,
    options?: {
      search?: string;
      isActive?: boolean;
      page?: number;
      pageSize?: number;
    }
  ): Promise<ServiceListResult<Customer>> {
    const { search, isActive = true, page = 1, pageSize = 20 } = options || {};

    let query = this.client
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('salon_id', salonId);

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive);
    }

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    }

    query = query
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      return { data: [], count: null, error: this.handleError(error) };
    }

    return { data: data || [], count, error: null };
  }

  // Get customers with upcoming birthday
  async findUpcomingBirthdays(
    salonId: string,
    daysAhead: number = 30
  ): Promise<ServiceListResult<Customer>> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);

    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    const futureMonth = futureDate.getMonth() + 1;
    const futureDay = futureDate.getDate();

    // This is a simplified query - for production, use a database function
    const { data, error, count } = await this.client
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .not('birthday', 'is', null);

    if (error) {
      return { data: [], count: null, error: this.handleError(error) };
    }

    // Filter birthdays in JavaScript (for simplicity)
    const filtered = (data || []).filter((customer) => {
      if (!customer.birthday) return false;
      const birthday = new Date(customer.birthday);
      const bMonth = birthday.getMonth() + 1;
      const bDay = birthday.getDate();

      if (todayMonth === futureMonth) {
        return bMonth === todayMonth && bDay >= todayDay && bDay <= futureDay;
      } else {
        return (
          (bMonth === todayMonth && bDay >= todayDay) ||
          (bMonth === futureMonth && bDay <= futureDay)
        );
      }
    });

    return { data: filtered, count: filtered.length, error: null };
  }

  // Get inactive customers (no visit in X days)
  async findInactive(salonId: string, inactiveDays: number = 90): Promise<ServiceListResult<Customer>> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

    const { data, error, count } = await this.client
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .or(`last_visit_at.is.null,last_visit_at.lt.${cutoffDate.toISOString()}`)
      .order('last_visit_at', { ascending: true, nullsFirst: true });

    if (error) {
      return { data: [], count: null, error: this.handleError(error) };
    }

    return { data: data || [], count, error: null };
  }

  // Create or get customer for profile
  async getOrCreate(
    salonId: string,
    profileId: string,
    data: { first_name: string; last_name: string }
  ): Promise<ServiceResult<Customer>> {
    // Check if exists
    const existing = await this.findByProfileId(profileId, salonId);
    if (existing.data) {
      return existing;
    }

    // Create new
    return this.create({
      salon_id: salonId,
      profile_id: profileId,
      first_name: data.first_name,
      last_name: data.last_name,
    });
  }

  // Update last visit
  async updateLastVisit(customerId: string): Promise<ServiceResult<Customer>> {
    return this.update(customerId, {
      last_visit_at: new Date().toISOString(),
    });
  }

  // Update customer notes
  async updateNotes(
    customerId: string,
    notes: { notes?: string; hair_notes?: string }
  ): Promise<ServiceResult<Customer>> {
    return this.update(customerId, notes);
  }

  // Deactivate customer
  async deactivate(customerId: string): Promise<ServiceResult<Customer>> {
    return this.update(customerId, { is_active: false });
  }

  // Reactivate customer
  async reactivate(customerId: string): Promise<ServiceResult<Customer>> {
    return this.update(customerId, { is_active: true });
  }
}

// Export singleton instance
export const CustomerService = new CustomerServiceClass();
