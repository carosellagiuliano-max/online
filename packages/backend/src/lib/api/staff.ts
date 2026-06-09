import { BaseService, ServiceResult, ServiceListResult } from './base';
import type {
  Staff,
  ScheduleOverride,
  Service,
  InsertTables,
  Database,
} from '../db/types';

// ============================================
// TYPES
// ============================================

interface StaffWithServices extends Staff {
  services?: Service[];
}

interface StaffSchedule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isWorking: boolean;
}

interface StaffAvailability {
  date: Date;
  staffId: string;
  available: boolean;
  workingHours?: {
    start: string;
    end: string;
  };
  override?: ScheduleOverride;
}

// ============================================
// STAFF SERVICE
// ============================================

class StaffServiceClass extends BaseService<'staff'> {
  constructor() {
    super('staff');
  }

  // Get staff by profile ID
  async findByProfileId(profileId: string, salonId: string): Promise<ServiceResult<Staff>> {
    const { data, error } = await this.client
      .from('staff')
      .select('*')
      .eq('profile_id', profileId)
      .eq('salon_id', salonId)
      .single();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data, error: null };
  }

  // Get staff for salon
  async findBySalon(
    salonId: string,
    options?: {
      activeOnly?: boolean;
      bookableOnly?: boolean;
    }
  ): Promise<ServiceListResult<Staff>> {
    const { activeOnly = true, bookableOnly = false } = options || {};

    let query = this.client
      .from('staff')
      .select('*', { count: 'exact' })
      .eq('salon_id', salonId);

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (bookableOnly) {
      query = query.eq('is_bookable', true);
    }

    query = query.order('sort_order', { ascending: true });

    const { data, error, count } = await query;

    if (error) {
      return { data: [], count: null, error: this.handleError(error) };
    }

    return { data: data || [], count, error: null };
  }

  // Get bookable staff
  async findBookable(salonId: string): Promise<ServiceListResult<Staff>> {
    return this.findBySalon(salonId, { activeOnly: true, bookableOnly: true });
  }

  // Get staff with their services
  async findWithServices(staffId: string): Promise<ServiceResult<StaffWithServices>> {
    const { data, error } = await this.client
      .from('staff')
      .select(`
        *,
        staff_service_skills (
          service:services (*)
        )
      `)
      .eq('id', staffId)
      .single();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    // Transform the data to flatten services
    const staffData = data as Staff & {
      staff_service_skills: Array<{ service: Service }>;
    };

    const result: StaffWithServices = {
      ...staffData,
      services: staffData.staff_service_skills?.map((s) => s.service) || [],
    };

    return { data: result, error: null };
  }

  // Get staff for a specific service
  async findForService(serviceId: string, salonId: string): Promise<ServiceListResult<Staff>> {
    const { data, error, count } = await this.client
      .from('staff_service_skills')
      .select(`
        staff (*)
      `, { count: 'exact' })
      .eq('service_id', serviceId);

    if (error) {
      return { data: [], count: null, error: this.handleError(error) };
    }

    const staffList = (data || [])
      .map((item) => (item as { staff: Staff }).staff)
      .filter((s) => s && s.is_active && s.is_bookable && s.salon_id === salonId);

    return { data: staffList, count: staffList.length, error: null };
  }

  // Get staff default schedule
  getDefaultSchedule(staff: Staff): StaffSchedule[] {
    const defaultSchedule = staff.default_schedule as Record<string, { start: string; end: string; isWorking: boolean }> | null;

    if (!defaultSchedule) {
      // Return default 9-18 schedule Monday-Friday
      return [
        { dayOfWeek: 0, startTime: '09:00', endTime: '18:00', isWorking: false }, // Sunday
        { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isWorking: true },  // Monday
        { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', isWorking: true },  // Tuesday
        { dayOfWeek: 3, startTime: '09:00', endTime: '18:00', isWorking: true },  // Wednesday
        { dayOfWeek: 4, startTime: '09:00', endTime: '18:00', isWorking: true },  // Thursday
        { dayOfWeek: 5, startTime: '09:00', endTime: '18:00', isWorking: true },  // Friday
        { dayOfWeek: 6, startTime: '09:00', endTime: '14:00', isWorking: true },  // Saturday
      ];
    }

    const schedule: StaffSchedule[] = [];
    for (let day = 0; day < 7; day++) {
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][day];
      const daySchedule = defaultSchedule[dayName];

      schedule.push({
        dayOfWeek: day,
        startTime: daySchedule?.start || '09:00',
        endTime: daySchedule?.end || '18:00',
        isWorking: daySchedule?.isWorking ?? (day >= 1 && day <= 6),
      });
    }

    return schedule;
  }

  // Update staff schedule
  async updateSchedule(
    staffId: string,
    schedule: StaffSchedule[]
  ): Promise<ServiceResult<Staff>> {
    const scheduleJson: Record<string, { start: string; end: string; isWorking: boolean }> = {};

    for (const day of schedule) {
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][day.dayOfWeek];
      scheduleJson[dayName] = {
        start: day.startTime,
        end: day.endTime,
        isWorking: day.isWorking,
      };
    }

    return this.update(staffId, { default_schedule: scheduleJson });
  }

  // Get availability for a date
  async getAvailability(
    staffId: string,
    date: Date
  ): Promise<StaffAvailability> {
    const { data: staff } = await this.findById(staffId);

    if (!staff) {
      return {
        date,
        staffId,
        available: false,
      };
    }

    // Check for schedule override
    const dateStr = date.toISOString().split('T')[0];
    const { data: override } = await this.client
      .from('schedule_overrides')
      .select('*')
      .eq('staff_id', staffId)
      .eq('date', dateStr)
      .single();

    if (override) {
      if (!override.is_available) {
        return {
          date,
          staffId,
          available: false,
          override: override as ScheduleOverride,
        };
      }

      return {
        date,
        staffId,
        available: true,
        workingHours: {
          start: override.custom_start_time || '09:00',
          end: override.custom_end_time || '18:00',
        },
        override: override as ScheduleOverride,
      };
    }

    // Check default schedule
    const schedule = this.getDefaultSchedule(staff);
    const dayOfWeek = date.getDay();
    const daySchedule = schedule.find((s) => s.dayOfWeek === dayOfWeek);

    if (!daySchedule || !daySchedule.isWorking) {
      return {
        date,
        staffId,
        available: false,
      };
    }

    return {
      date,
      staffId,
      available: true,
      workingHours: {
        start: daySchedule.startTime,
        end: daySchedule.endTime,
      },
    };
  }

  // Create schedule override
  async createOverride(
    staffId: string,
    date: Date,
    params: {
      isAvailable: boolean;
      reason?: string;
      customStartTime?: string;
      customEndTime?: string;
    }
  ): Promise<ServiceResult<ScheduleOverride>> {
    const { isAvailable, reason, customStartTime, customEndTime } = params;

    const { data, error } = await this.client
      .from('schedule_overrides')
      .upsert(
        {
          staff_id: staffId,
          date: date.toISOString().split('T')[0],
          is_available: isAvailable,
          reason: reason || null,
          custom_start_time: customStartTime || null,
          custom_end_time: customEndTime || null,
        },
        { onConflict: 'staff_id,date' }
      )
      .select()
      .single();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data: data as ScheduleOverride, error: null };
  }

  // Delete schedule override
  async deleteOverride(staffId: string, date: Date): Promise<ServiceResult<boolean>> {
    const { error } = await this.client
      .from('schedule_overrides')
      .delete()
      .eq('staff_id', staffId)
      .eq('date', date.toISOString().split('T')[0]);

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data: true, error: null };
  }

  // Get schedule overrides for date range
  async getOverrides(
    staffId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ServiceListResult<ScheduleOverride>> {
    const { data, error, count } = await this.client
      .from('schedule_overrides')
      .select('*', { count: 'exact' })
      .eq('staff_id', staffId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) {
      return { data: [], count: null, error: this.handleError(error) };
    }

    return { data: (data || []) as ScheduleOverride[], count, error: null };
  }

  // Assign service skill to staff
  async assignService(staffId: string, serviceId: string): Promise<ServiceResult<boolean>> {
    const { error } = await this.client
      .from('staff_service_skills')
      .insert({
        staff_id: staffId,
        service_id: serviceId,
      });

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data: true, error: null };
  }

  // Remove service skill from staff
  async removeService(staffId: string, serviceId: string): Promise<ServiceResult<boolean>> {
    const { error } = await this.client
      .from('staff_service_skills')
      .delete()
      .eq('staff_id', staffId)
      .eq('service_id', serviceId);

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data: true, error: null };
  }

  // Update staff sort order
  async updateSortOrder(
    salonId: string,
    staffOrders: Array<{ id: string; sortOrder: number }>
  ): Promise<ServiceResult<boolean>> {
    for (const item of staffOrders) {
      await this.update(item.id, { sort_order: item.sortOrder });
    }

    return { data: true, error: null };
  }

  // Deactivate staff
  async deactivate(staffId: string): Promise<ServiceResult<Staff>> {
    return this.update(staffId, { is_active: false, is_bookable: false });
  }

  // Reactivate staff
  async reactivate(staffId: string): Promise<ServiceResult<Staff>> {
    return this.update(staffId, { is_active: true });
  }
}

// Export singleton instance
export const StaffService = new StaffServiceClass();
