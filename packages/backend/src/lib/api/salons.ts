import { BaseService, ServiceResult, ServiceListResult } from './base';
import type { Salon, OpeningHours, InsertTables, UpdateTables } from '../db/types';

// ============================================
// SALON SERVICE
// ============================================

class SalonServiceClass extends BaseService<'salons'> {
  constructor() {
    super('salons');
  }

  // Get salon by slug
  async findBySlug(slug: string): Promise<ServiceResult<Salon>> {
    const { data, error } = await this.client
      .from('salons')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data, error: null };
  }

  // Get active salons
  async findActive(): Promise<ServiceListResult<Salon>> {
    return this.findMany({
      filters: { is_active: true },
      sort: { sortBy: 'name', sortOrder: 'asc' },
    });
  }

  // Get salon with opening hours
  async findWithOpeningHours(salonId: string): Promise<
    ServiceResult<Salon & { opening_hours: OpeningHours[] }>
  > {
    const { data, error } = await this.client
      .from('salons')
      .select(`
        *,
        opening_hours (*)
      `)
      .eq('id', salonId)
      .single();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data: data as Salon & { opening_hours: OpeningHours[] }, error: null };
  }

  // Update salon settings
  async updateSettings(
    salonId: string,
    settings: Record<string, unknown>
  ): Promise<ServiceResult<Salon>> {
    const { data: current } = await this.findById(salonId);

    const newSettings = {
      ...(current?.settings_json as Record<string, unknown> || {}),
      ...settings,
    };

    return this.update(salonId, { settings_json: newSettings });
  }

  // Get salon setting value
  async getSetting(salonId: string, key: string): Promise<unknown | null> {
    const { data } = await this.findById(salonId);
    if (!data?.settings_json) return null;

    const settings = data.settings_json as Record<string, unknown>;
    return settings[key] ?? null;
  }
}

// ============================================
// OPENING HOURS SERVICE
// ============================================

class OpeningHoursServiceClass extends BaseService<'opening_hours'> {
  constructor() {
    super('opening_hours');
  }

  // Get opening hours for salon
  async findBySalon(salonId: string): Promise<ServiceListResult<OpeningHours>> {
    return this.findMany({
      filters: { salon_id: salonId },
      sort: { sortBy: 'day_of_week', sortOrder: 'asc' },
    });
  }

  // Update opening hours for a day
  async upsert(
    salonId: string,
    dayOfWeek: number,
    hours: { open_time: string; close_time: string; is_open: boolean }
  ): Promise<ServiceResult<OpeningHours>> {
    const { data, error } = await this.client
      .from('opening_hours')
      .upsert(
        {
          salon_id: salonId,
          day_of_week: dayOfWeek,
          ...hours,
        },
        { onConflict: 'salon_id,day_of_week' }
      )
      .select()
      .single();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data, error: null };
  }

  // Set full week opening hours
  async setWeekHours(
    salonId: string,
    weekHours: Array<{
      day_of_week: number;
      open_time: string;
      close_time: string;
      is_open: boolean;
    }>
  ): Promise<ServiceResult<OpeningHours[]>> {
    const { data, error } = await this.client
      .from('opening_hours')
      .upsert(
        weekHours.map((h) => ({ salon_id: salonId, ...h })),
        { onConflict: 'salon_id,day_of_week' }
      )
      .select();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data: data || [], error: null };
  }
}

// Export singleton instances
export const SalonService = new SalonServiceClass();
export const OpeningHoursService = new OpeningHoursServiceClass();
