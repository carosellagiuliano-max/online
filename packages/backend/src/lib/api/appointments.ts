import { BaseService, ServiceResult, ServiceListResult } from './base';
import type {
  Appointment,
  AppointmentService as AppointmentServiceRow,
  Customer,
  Staff,
  Service,
  AppointmentStatus,
  InsertTables,
} from '../db/types';

// ============================================
// TYPES
// ============================================

interface AppointmentWithRelations extends Appointment {
  customer?: Customer;
  staff?: Staff;
  appointment_services?: Array<AppointmentServiceRow & { service?: Service }>;
}

interface AvailableSlot {
  start: Date;
  end: Date;
  staffId: string;
  staffName: string;
}

interface BookingParams {
  salonId: string;
  customerId: string;
  staffId: string;
  startTime: Date;
  services: Array<{
    serviceId: string;
    variantId?: string;
  }>;
  customerNotes?: string;
}

// ============================================
// APPOINTMENT SERVICE
// ============================================

class AppointmentServiceClass extends BaseService<'appointments'> {
  constructor() {
    super('appointments');
  }

  // Get appointment with relations
  async findWithRelations(appointmentId: string): Promise<ServiceResult<AppointmentWithRelations>> {
    const { data, error } = await this.client
      .from('appointments')
      .select(`
        *,
        customer:customers (*),
        staff (*),
        appointment_services (
          *,
          service:services (*)
        )
      `)
      .eq('id', appointmentId)
      .single();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data: data as AppointmentWithRelations, error: null };
  }

  // Get appointments for salon
  async findBySalon(
    salonId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      staffId?: string;
      status?: AppointmentStatus[];
      page?: number;
      pageSize?: number;
    }
  ): Promise<ServiceListResult<AppointmentWithRelations>> {
    const { startDate, endDate, staffId, status, page = 1, pageSize = 50 } = options || {};

    let query = this.client
      .from('appointments')
      .select(`
        *,
        customer:customers (*),
        staff (*)
      `, { count: 'exact' })
      .eq('salon_id', salonId);

    if (startDate) {
      query = query.gte('start_time', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('start_time', endDate.toISOString());
    }

    if (staffId) {
      query = query.eq('staff_id', staffId);
    }

    if (status && status.length > 0) {
      query = query.in('status', status);
    }

    query = query
      .order('start_time', { ascending: true })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      return { data: [], count: null, error: this.handleError(error) };
    }

    return { data: (data || []) as AppointmentWithRelations[], count, error: null };
  }

  // Get appointments for customer
  async findByCustomer(
    customerId: string,
    options?: {
      upcoming?: boolean;
      status?: AppointmentStatus[];
    }
  ): Promise<ServiceListResult<AppointmentWithRelations>> {
    const { upcoming = false, status } = options || {};

    let query = this.client
      .from('appointments')
      .select(`
        *,
        staff (*),
        appointment_services (
          *,
          service:services (*)
        )
      `, { count: 'exact' })
      .eq('customer_id', customerId);

    if (upcoming) {
      query = query.gte('start_time', new Date().toISOString());
    }

    if (status && status.length > 0) {
      query = query.in('status', status);
    }

    query = query.order('start_time', { ascending: !upcoming });

    const { data, error, count } = await query;

    if (error) {
      return { data: [], count: null, error: this.handleError(error) };
    }

    return { data: (data || []) as AppointmentWithRelations[], count, error: null };
  }

  // Get today's appointments
  async findToday(salonId: string, staffId?: string): Promise<ServiceListResult<AppointmentWithRelations>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.findBySalon(salonId, {
      startDate: today,
      endDate: tomorrow,
      staffId,
      status: ['confirmed', 'reserved'],
    });
  }

  // Create reservation (temporary hold)
  async createReservation(params: BookingParams): Promise<ServiceResult<Appointment>> {
    const { salonId, customerId, staffId, startTime, services, customerNotes } = params;

    // Calculate total duration
    let totalDuration = 0;
    let totalPrice = 0;

    for (const svc of services) {
      const { data: service } = await this.client
        .from('services')
        .select('duration_minutes, price_cents')
        .eq('id', svc.serviceId)
        .single();

      if (service) {
        totalDuration += service.duration_minutes;
        totalPrice += service.price_cents;
      }
    }

    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + totalDuration);

    // Check availability via RPC
    const { data: isAvailable } = await this.client.rpc('is_slot_available', {
      p_salon_id: salonId,
      p_staff_id: staffId,
      p_start_time: startTime.toISOString(),
      p_end_time: endTime.toISOString(),
    });

    if (!isAvailable) {
      return {
        data: null,
        error: {
          code: 'SLOT_NOT_AVAILABLE',
          message: 'Der gewählte Termin ist nicht mehr verfügbar.',
        },
      };
    }

    // Create appointment
    const reservationExpiry = new Date();
    reservationExpiry.setMinutes(reservationExpiry.getMinutes() + 15);

    const { data: appointment, error: createError } = await this.client
      .from('appointments')
      .insert({
        salon_id: salonId,
        customer_id: customerId,
        staff_id: staffId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration_minutes: totalDuration,
        status: 'reserved',
        reserved_at: new Date().toISOString(),
        reservation_expires_at: reservationExpiry.toISOString(),
        subtotal_cents: totalPrice,
        total_cents: totalPrice,
        customer_notes: customerNotes,
        booked_online: true,
      })
      .select()
      .single();

    if (createError) {
      return { data: null, error: this.handleError(createError) };
    }

    // Add services to appointment
    const appointmentServices = services.map((svc, index) => ({
      appointment_id: appointment.id,
      service_id: svc.serviceId,
      service_name: '', // Will be filled from service
      duration_minutes: 0,
      price_cents: 0,
      length_variant_id: svc.variantId || null,
      sort_order: index,
    }));

    // Fetch service details and update
    for (const svc of appointmentServices) {
      const { data: serviceData } = await this.client
        .from('services')
        .select('name, duration_minutes, price_cents')
        .eq('id', svc.service_id)
        .single();

      if (serviceData) {
        svc.service_name = serviceData.name;
        svc.duration_minutes = serviceData.duration_minutes;
        svc.price_cents = serviceData.price_cents;
      }
    }

    await this.client.from('appointment_services').insert(appointmentServices);

    return { data: appointment, error: null };
  }

  // Confirm appointment
  async confirm(appointmentId: string, confirmedBy?: string): Promise<ServiceResult<Appointment>> {
    const { data, error } = await this.client.rpc('confirm_appointment', {
      p_appointment_id: appointmentId,
      p_confirmed_by: confirmedBy || null,
    });

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return this.findById(appointmentId);
  }

  // Cancel appointment
  async cancel(
    appointmentId: string,
    cancelledBy: string,
    reason?: string
  ): Promise<ServiceResult<Appointment>> {
    const { data, error } = await this.client.rpc('cancel_appointment', {
      p_appointment_id: appointmentId,
      p_cancelled_by: cancelledBy,
      p_reason: reason || null,
    });

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return this.findById(appointmentId);
  }

  // Mark as completed
  async complete(appointmentId: string, completedBy: string): Promise<ServiceResult<Appointment>> {
    return this.update(appointmentId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: completedBy,
    });
  }

  // Mark as no-show
  async markNoShow(appointmentId: string, markedBy: string): Promise<ServiceResult<Appointment>> {
    return this.update(appointmentId, {
      status: 'no_show',
      marked_no_show_at: new Date().toISOString(),
      marked_no_show_by: markedBy,
    });
  }

  // Get available slots
  async getAvailableSlots(
    salonId: string,
    date: Date,
    durationMinutes: number,
    staffId?: string
  ): Promise<AvailableSlot[]> {
    // Get bookable staff
    let staffQuery = this.client
      .from('staff')
      .select('id, display_name, default_schedule')
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .eq('is_bookable', true);

    if (staffId) {
      staffQuery = staffQuery.eq('id', staffId);
    }

    const { data: staffList } = await staffQuery;

    if (!staffList || staffList.length === 0) {
      return [];
    }

    const slots: AvailableSlot[] = [];
    const dateStr = date.toISOString().split('T')[0];

    for (const staff of staffList) {
      // Call database function for slots
      const { data: dbSlots } = await this.client.rpc('get_available_slots', {
        p_salon_id: salonId,
        p_staff_id: staff.id,
        p_date: dateStr,
        p_duration_minutes: durationMinutes,
        p_slot_granularity_minutes: 15,
      });

      if (dbSlots) {
        for (const slot of dbSlots) {
          slots.push({
            start: new Date(slot.slot_start),
            end: new Date(slot.slot_end),
            staffId: staff.id,
            staffName: staff.display_name,
          });
        }
      }
    }

    return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  // Reschedule appointment
  async reschedule(
    appointmentId: string,
    newStartTime: Date,
    newStaffId?: string
  ): Promise<ServiceResult<Appointment>> {
    const { data: current } = await this.findById(appointmentId);

    if (!current) {
      return {
        data: null,
        error: { code: 'NOT_FOUND', message: 'Termin nicht gefunden.' },
      };
    }

    const newEndTime = new Date(newStartTime);
    newEndTime.setMinutes(newEndTime.getMinutes() + current.duration_minutes);

    // Check availability
    const { data: isAvailable } = await this.client.rpc('is_slot_available', {
      p_salon_id: current.salon_id,
      p_staff_id: newStaffId || current.staff_id,
      p_start_time: newStartTime.toISOString(),
      p_end_time: newEndTime.toISOString(),
      p_exclude_appointment_id: appointmentId,
    });

    if (!isAvailable) {
      return {
        data: null,
        error: {
          code: 'SLOT_NOT_AVAILABLE',
          message: 'Der gewählte Termin ist nicht verfügbar.',
        },
      };
    }

    return this.update(appointmentId, {
      start_time: newStartTime.toISOString(),
      end_time: newEndTime.toISOString(),
      staff_id: newStaffId || current.staff_id,
    });
  }
}

// Export singleton instance
export const AppointmentService = new AppointmentServiceClass();
