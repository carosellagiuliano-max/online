'use server';

import { createServerClient } from '@/lib/db/client';
import { createServerClient as createAuthServerClient } from '@/lib/supabase/server';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { addDays } from 'date-fns';
import { z } from 'zod';
import { sendBookingConfirmationEmail } from '@/lib/email';
import {
  getAppointmentRecipient,
  sendAdminAppointmentConfirmationEmail,
} from '@/lib/email/admin-appointment-confirmation';
import { headers } from 'next/headers';
import { requireAdminAction, type AdminActionAuthResult } from './admin-auth';
import { adminCreateCustomer } from './customer';
import { isMockMode } from '@/lib/mock/mock-auth';
import {
  MOCK_APPOINTMENTS,
  MOCK_OPENING_HOURS,
  MOCK_SALON,
  MOCK_SERVICE_CATEGORIES,
  MOCK_SERVICES,
  MOCK_STAFF,
} from '@/lib/mock/mock-data';
import {
  computeAvailableSlots,
  formatDateKeyInTimeZone,
  parseDateKeyBoundaryInTimeZone,
} from '@/lib/domain/booking';
import type {
  BookableService,
  BookableStaff,
  DayOpeningHours,
  StaffWorkingHours,
  StaffAbsence,
  BlockedTime,
  ExistingAppointment,
  BookingRules,
  BookingRequest,
  BookingServiceSelection,
  BookingConfirmation,
} from '@/lib/domain/booking/types';

// ============================================
// BOOKING SERVER ACTIONS
// ============================================

const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';
type DbClient = NonNullable<ReturnType<typeof createServerClient>>;
const ACTIVE_CALENDAR_STATUSES = ['reserved', 'requested', 'confirmed'];
const MOCK_STAFF_SKILLS = new Map<string, string[]>([
  ['mock-staff-uuid-001', MOCK_SERVICES.map((service) => service.id)],
  ['mock-staff-uuid-002', ['svc-001', 'svc-002', 'svc-003']],
]);
const MOCK_RESERVATIONS = new Map<string, BookingConfirmation>();

const bookingRulesSettingsSchema = z.object({
  salonId: z.string().uuid('Ungültiger Salon'),
  requireAppointmentApproval: z.boolean(),
  minNoticeHours: z.number().int().min(0, 'Mindestvorlauf darf nicht negativ sein').max(720, 'Mindestvorlauf darf maximal 720 Stunden betragen'),
  maxAdvanceDays: z.number().int().min(1, 'Buchungshorizont muss mindestens 1 Tag betragen').max(365, 'Buchungshorizont darf maximal 365 Tage betragen'),
  bufferMinutes: z.number().int().min(0, 'Pufferzeit darf nicht negativ sein').max(240, 'Pufferzeit darf maximal 240 Minuten betragen'),
  allowSameDayBooking: z.boolean(),
  requirePhoneForBooking: z.boolean(),
  allowCustomerCancellation: z.boolean(),
  cancellationDeadlineHours: z.number().int().min(0, 'Stornofrist darf nicht negativ sein').max(720, 'Stornofrist darf maximal 720 Stunden betragen'),
});

function revalidateBookingRulePaths() {
  revalidateTag('booking', 'max');
  revalidatePath('/admin/einstellungen');
  revalidatePath('/admin/kalender');
  revalidatePath('/termin-buchen');
  revalidatePath('/konto/termine');
}

function normalizePhoneForRule(phone?: string | null): string {
  return phone?.trim() || '';
}

function normalizeEmailForRule(email?: string | null): string {
  return email?.trim().toLowerCase() || '';
}

function getAdminAuthError(auth: AdminActionAuthResult): string {
  return 'error' in auth ? auth.error : 'Keine Berechtigung für diese Aktion';
}

function normalizeOptionalEmail(email?: string | null): string | null {
  return email?.trim().toLowerCase() || null;
}

function normalizeOptionalText(value?: string | null): string | null {
  return value?.trim() || null;
}

function getMockBookingRules(): BookingRules {
  return {
    slotGranularityMinutes: 15,
    leadTimeMinutes: 60,
    horizonDays: 60,
    bufferBetweenMinutes: 15,
    allowMultipleServices: true,
    allowSameDayBooking: true,
    requireDeposit: false,
    cancellationDeadlineHours: 24,
    requireAppointmentApproval: false,
    requirePhoneForBooking: true,
    allowCustomerCancellation: true,
  };
}

function getMockBookingPageData(): BookingPageData {
  return {
    salonId: MOCK_SALON.id,
    salonAddress: `${MOCK_SALON.address}, ${MOCK_SALON.postal_code} ${MOCK_SALON.city}`,
    timeZone: MOCK_SALON.timezone,
    services: MOCK_SERVICES.filter((service) => service.is_active).map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      durationMinutes: service.duration_minutes,
      currentPrice: Math.round(service.price * 100),
      categoryId: service.category_id,
      categoryName: MOCK_SERVICE_CATEGORIES.find((category) => category.id === service.category_id)?.name,
      isActive: service.is_active,
      hasVariants: false,
    })),
    categories: MOCK_SERVICE_CATEGORIES.map((category) => ({
      id: category.id,
      name: category.name,
    })),
    staff: MOCK_STAFF.filter((staff) => staff.is_active && staff.accepts_bookings).map((staff) => ({
      id: staff.id,
      name: `${staff.first_name} ${staff.last_name}`,
      imageUrl: undefined,
      serviceIds: MOCK_STAFF_SKILLS.get(staff.id) || [],
      isBookable: staff.accepts_bookings,
    })),
    openingHours: MOCK_OPENING_HOURS.map((hours) => ({
      dayOfWeek: hours.day_of_week,
      openTime: hours.open_time || '09:00',
      closeTime: hours.close_time || '18:00',
      isClosed: hours.is_closed,
      hasLunchBreak: false,
      lunchStart: null,
      lunchEnd: null,
    })),
    staffWorkingHours: MOCK_STAFF.flatMap((staff) =>
      MOCK_OPENING_HOURS
        .filter((hours) => !hours.is_closed)
        .map((hours) => ({
          staffId: staff.id,
          dayOfWeek: hours.day_of_week,
          startTime: hours.open_time || '09:00',
          endTime: hours.close_time || '18:00',
        }))
    ),
    bookingRules: getMockBookingRules(),
  };
}

function getMockBookingServiceSnapshots(request: BookingRequest): ReservationServiceSnapshot[] {
  return normalizeServiceSelections(request).map((selection) => {
    const service = MOCK_SERVICES.find((entry) => entry.id === selection.serviceId);

    return {
      serviceId: selection.serviceId,
      serviceName: service?.name || 'Demo-Leistung',
      durationMinutes: service?.duration_minutes || 60,
      priceCents: Math.round((service?.price || 0) * 100),
      lengthVariantId: null,
      lengthVariantName: null,
    };
  });
}

function hasValidTimeRange(startTime: string, endTime: string): boolean {
  const start = new Date(startTime);
  const end = new Date(endTime);

  return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end > start;
}

function toDateOnly(value: string): string {
  return value.slice(0, 10);
}

function toTimeKey(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);

  const get = (type: string) => parts.find((part) => part.type === type)?.value || '00';
  return `${get('hour')}:${get('minute')}:${get('second')}`;
}

async function getSalonTimeZone(supabase: DbClient, salonId: string): Promise<string> {
  const { data } = await (supabase.from('salons') as any)
    .select('timezone')
    .eq('id', salonId)
    .maybeSingle();

  return data?.timezone || 'Europe/Zurich';
}

async function getActiveServiceForSalon(
  supabase: DbClient,
  salonId: string,
  serviceId: string
): Promise<{
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
} | null> {
  const { data, error } = await (supabase.from('services') as any)
    .select('id, name, duration_minutes, price_cents')
    .eq('id', serviceId)
    .eq('salon_id', salonId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[calendar] Service lookup error:', error);
    return null;
  }

  return data || null;
}

async function staffHasAllServices(
  supabase: DbClient,
  staffId: string | null,
  serviceIds: string[]
): Promise<boolean> {
  if (!staffId || serviceIds.length === 0) return true;

  const { data, error } = await (supabase.from('staff_service_skills') as any)
    .select('service_id')
    .eq('staff_id', staffId)
    .in('service_id', serviceIds);

  if (error) {
    console.error('[calendar] Staff skill check error:', error);
    return false;
  }

  const assignedServiceIds = new Set((data || []).map((row: { service_id: string }) => row.service_id));
  return serviceIds.every((serviceId) => assignedServiceIds.has(serviceId));
}

async function staffWorksDuringSlot(
  supabase: DbClient,
  staffId: string | null,
  startTime: string,
  endTime: string,
  timeZone: string
): Promise<boolean> {
  if (!staffId) return true;

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return false;
  }

  const startDateKey = formatDateKeyInTimeZone(start, timeZone);
  const endDateKey = formatDateKeyInTimeZone(new Date(end.getTime() - 1), timeZone);
  if (startDateKey !== endDateKey) {
    return false;
  }

  const [year, month, day] = startDateKey.split('-').map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const localStart = toTimeKey(start, timeZone);
  const localEnd = toTimeKey(end, timeZone);

  const { data, error } = await (supabase.from('staff_working_hours') as any)
    .select('start_time, end_time')
    .eq('staff_id', staffId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true);

  if (error) {
    console.error('[calendar] Staff working hours check error:', error);
    return false;
  }

  return (data || []).some((hours: { start_time: string; end_time: string }) => (
    localStart >= hours.start_time && localEnd <= hours.end_time
  ));
}

async function hasOverlappingSalonClosure(
  supabase: DbClient,
  salonId: string,
  startTime: string,
  endTime: string
): Promise<boolean> {
  const { data, error } = await (supabase.from('blocked_times') as any)
    .select('id')
    .eq('salon_id', salonId)
    .lt('start_time', endTime)
    .gt('end_time', startTime)
    .limit(1);

  if (error) {
    console.error('[calendar] Closure conflict check error:', error);
    return true;
  }

  return (data || []).length > 0;
}

async function hasOverlappingAppointment(
  supabase: DbClient,
  salonId: string,
  staffId: string | null,
  startTime: string,
  endTime: string,
  excludeAppointmentId?: string
): Promise<boolean> {
  if (!staffId) return false;

  let query = (supabase.from('appointments') as any)
    .select('id')
    .eq('salon_id', salonId)
    .eq('staff_id', staffId)
    .in('status', ACTIVE_CALENDAR_STATUSES)
    .lt('start_time', endTime)
    .gt('end_time', startTime)
    .limit(1);

  if (excludeAppointmentId) {
    query = query.neq('id', excludeAppointmentId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[calendar] Appointment conflict check error:', error);
    return true;
  }

  return (data || []).length > 0;
}

async function hasOverlappingStaffBlock(
  supabase: DbClient,
  staffId: string | null,
  startTime: string,
  endTime: string,
  excludeBlockId?: string
): Promise<boolean> {
  if (!staffId) return false;

  let query = (supabase.from('staff_blocks') as any)
    .select('id')
    .eq('staff_id', staffId)
    .lt('start_time', endTime)
    .gt('end_time', startTime)
    .limit(1);

  if (excludeBlockId) {
    query = query.neq('id', excludeBlockId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[calendar] Staff block conflict check error:', error);
    return true;
  }

  return (data || []).length > 0;
}

async function validateCalendarSlot(
  supabase: DbClient,
  input: {
    salonId: string;
    staffId: string | null;
    startTime: string;
    endTime: string;
    serviceIds?: string[];
    excludeAppointmentId?: string;
    excludeBlockId?: string;
    checkAppointments?: boolean;
    checkStaffBlocks?: boolean;
    checkSkills?: boolean;
    checkWorkingHours?: boolean;
  }
): Promise<{ success: true } | { success: false; error: string }> {
  if (!hasValidTimeRange(input.startTime, input.endTime)) {
    return { success: false, error: 'Ungültiger Zeitraum' };
  }

  if (await hasOverlappingSalonClosure(supabase, input.salonId, input.startTime, input.endTime)) {
    return { success: false, error: 'Der Zeitraum liegt in einer Betriebsferien- oder Sperrzeit' };
  }

  if (
    input.checkAppointments !== false &&
    await hasOverlappingAppointment(
      supabase,
      input.salonId,
      input.staffId,
      input.startTime,
      input.endTime,
      input.excludeAppointmentId
    )
  ) {
    return { success: false, error: 'Der Mitarbeiter hat in diesem Zeitraum bereits einen Termin' };
  }

  if (
    input.checkStaffBlocks !== false &&
    await hasOverlappingStaffBlock(
      supabase,
      input.staffId,
      input.startTime,
      input.endTime,
      input.excludeBlockId
    )
  ) {
    return { success: false, error: 'Der Mitarbeiter ist in diesem Zeitraum blockiert' };
  }

  if (
    input.checkSkills &&
    input.staffId &&
    input.serviceIds &&
    input.serviceIds.length > 0 &&
    !await staffHasAllServices(supabase, input.staffId, input.serviceIds)
  ) {
    return { success: false, error: 'Der Mitarbeiter bietet die gewählte Leistung nicht an' };
  }

  if (input.checkWorkingHours && input.staffId) {
    const timeZone = await getSalonTimeZone(supabase, input.salonId);
    const worksDuringSlot = await staffWorksDuringSlot(
      supabase,
      input.staffId,
      input.startTime,
      input.endTime,
      timeZone
    );

    if (!worksDuringSlot) {
      return { success: false, error: 'Der Termin liegt ausserhalb der Arbeitszeit des Mitarbeiters' };
    }
  }

  return { success: true };
}

// ============================================
// GET BOOKABLE DATA (All data needed for booking flow)
// ============================================

export interface BookingPageData {
  salonId: string;
  salonAddress: string;
  timeZone: string;
  services: BookableService[];
  categories: { id: string; name: string }[];
  staff: BookableStaff[];
  openingHours: DayOpeningHours[];
  staffWorkingHours: StaffWorkingHours[];
  bookingRules: BookingRules;
}

export const getBookingPageData = unstable_cache(
  async (salonId: string = DEFAULT_SALON_ID): Promise<BookingPageData | null> => {
    if (isMockMode()) {
      return getMockBookingPageData();
    }

    const supabase = createServerClient() as any;

    if (!supabase) {
      console.error('getBookingPageData: Supabase client not available');
      return null;
    }

    // Fetch salon
    const { data: salon } = await supabase
      .from('salons')
      .select('id, address, zip_code, city, timezone')
      .eq('id', salonId)
      .single();

    if (!salon) return null;

    // Fetch all data in parallel
    const [
      { data: categories },
      { data: services },
      { data: staff },
      { data: staffSkills },
      { data: openingHours },
      { data: staffWorkingHours },
      { data: bookingRules },
    ] = await Promise.all([
      // Categories
      supabase
        .from('service_categories')
        .select('id, name')
        .eq('salon_id', salonId)
        .eq('is_active', true)
        .order('sort_order'),

      // Services (bookable online) with variants
      supabase
        .from('services')
        .select(`
          id, name, description, duration_minutes, price_cents,
          category_id, is_active, has_length_variants,
          service_length_variants (
            id, name, description, duration_minutes, price_cents, sort_order
          )
        `)
        .eq('salon_id', salonId)
        .eq('is_bookable_online', true)
        .eq('is_active', true)
        .order('sort_order'),

      // Staff
      supabase
        .from('staff')
        .select('id, display_name, avatar_url, is_bookable')
        .eq('salon_id', salonId)
        .eq('is_bookable', true)
        .eq('is_active', true)
        .order('sort_order'),

      // Staff skills - join via staff table since skills doesn't have salon_id
      supabase
        .from('staff_service_skills')
        .select(`
          staff_id,
          service_id,
          staff!inner(salon_id)
        `)
        .eq('staff.salon_id', salonId),

      // Opening hours
      supabase
        .from('opening_hours')
        .select('day_of_week, open_time, close_time, is_open, has_lunch_break, lunch_start, lunch_end')
        .eq('salon_id', salonId)
        .order('day_of_week'),

      // Staff working hours - join via staff table since working_hours doesn't have salon_id
      supabase
        .from('staff_working_hours')
        .select(`
          staff_id,
          day_of_week,
          start_time,
          end_time,
          staff!inner(salon_id)
        `)
        .eq('staff.salon_id', salonId)
        .eq('is_active', true),

      // Booking rules
      supabase
        .from('booking_rules')
        .select('*')
        .eq('salon_id', salonId)
        .single(),
    ]);

    // Build staff skills map
    const skillsMap = new Map<string, string[]>();
    staffSkills?.forEach((skill) => {
      const existing = skillsMap.get(skill.staff_id) || [];
      existing.push(skill.service_id);
      skillsMap.set(skill.staff_id, existing);
    });

    // Build category name map
    const categoryMap = new Map(categories?.map((c) => [c.id, c.name]) || []);

    // Transform data
    const bookableStaffIds = new Set<string>((staff || []).map((s: { id: string }) => s.id));
    const servicesWithQualifiedStaff = (services || []).filter((service: { id: string }) =>
      Array.from(bookableStaffIds).some((staffId) => (skillsMap.get(staffId) || []).includes(service.id))
    );

    const bookableServices: BookableService[] = servicesWithQualifiedStaff.map((s) => {
      // Sort variants by sort_order
      const sortedVariants = (s.service_length_variants || [])
        .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
        .map((v: { id: string; name: string; description: string | null; duration_minutes: number | null; price_cents: number }) => ({
          id: v.id,
          name: v.name,
          description: v.description || undefined,
          durationMinutes: v.duration_minutes || undefined,
          priceCents: v.price_cents,
        }));

      return {
        id: s.id,
        name: s.name,
        description: s.description || undefined,
        durationMinutes: s.duration_minutes,
        currentPrice: s.price_cents,
        categoryId: s.category_id,
        categoryName: categoryMap.get(s.category_id) || undefined,
        isActive: s.is_active,
        hasVariants: s.has_length_variants && sortedVariants.length > 0,
        variants: sortedVariants.length > 0 ? sortedVariants : undefined,
      };
    });

    const bookableStaff: BookableStaff[] = (staff || []).map((s) => ({
      id: s.id,
      name: s.display_name,
      imageUrl: s.avatar_url || undefined,
      serviceIds: skillsMap.get(s.id) || [],
      isBookable: s.is_bookable,
    }));

    const visibleCategoryIds = new Set(bookableServices.map((service) => service.categoryId).filter(Boolean));

    const dayOpeningHours: DayOpeningHours[] = (openingHours || []).map((h) => ({
      dayOfWeek: h.day_of_week,
      openTime: h.open_time?.substring(0, 5) || '09:00',
      closeTime: h.close_time?.substring(0, 5) || '18:00',
      isClosed: !h.is_open,
      hasLunchBreak: h.has_lunch_break || false,
      lunchStart: h.lunch_start?.substring(0, 5) || null,
      lunchEnd: h.lunch_end?.substring(0, 5) || null,
    }));

    const staffHours: StaffWorkingHours[] = (staffWorkingHours || []).map((h) => ({
      staffId: h.staff_id,
      dayOfWeek: h.day_of_week,
      startTime: h.start_time?.substring(0, 5) || '09:00',
      endTime: h.end_time?.substring(0, 5) || '18:00',
    }));

    const rules: BookingRules = bookingRules
      ? {
          slotGranularityMinutes: 15,
          leadTimeMinutes: (bookingRules.min_notice_hours || 24) * 60, // Convert hours to minutes
          horizonDays: bookingRules.max_advance_days || 90,
          bufferBetweenMinutes: bookingRules.buffer_minutes || 15,
          allowMultipleServices: true,
          allowSameDayBooking: bookingRules.allow_same_day_booking ?? false,
          requireDeposit: false,
          cancellationDeadlineHours: bookingRules.cancellation_deadline_hours ?? 24,
          requireAppointmentApproval: bookingRules.require_appointment_approval ?? false,
          requirePhoneForBooking: bookingRules.require_phone_for_booking ?? true,
          allowCustomerCancellation: bookingRules.allow_customer_cancellation ?? true,
        }
      : {
          slotGranularityMinutes: 15,
          leadTimeMinutes: 24 * 60, // 24 hours in minutes
          horizonDays: 90,
          bufferBetweenMinutes: 15,
          allowMultipleServices: true,
          allowSameDayBooking: false,
          requireDeposit: false,
          cancellationDeadlineHours: 24,
          requireAppointmentApproval: false,
          requirePhoneForBooking: true,
          allowCustomerCancellation: true,
        };

    return {
      salonId: salon.id,
      salonAddress: `${salon.address}, ${salon.zip_code} ${salon.city}`,
      timeZone: salon.timezone || 'Europe/Zurich',
      services: bookableServices,
      categories: (categories || []).filter((category: { id: string }) => visibleCategoryIds.has(category.id)),
      staff: bookableStaff,
      openingHours: dayOpeningHours,
      staffWorkingHours: staffHours,
      bookingRules: rules,
    };
  },
  ['booking-page-data'],
  { revalidate: 300, tags: ['booking'] } // 5 min cache
);

// ============================================
// GET EXISTING APPOINTMENTS (for slot calculation)
// ============================================

export async function getExistingAppointments(
  salonId: string,
  startDate: string,
  endDate: string
): Promise<ExistingAppointment[]> {
  if (isMockMode()) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return MOCK_APPOINTMENTS
      .map((appointment) => ({
        id: appointment.id,
        staffId: appointment.staff_id,
        startsAt: new Date(`${appointment.date}T${appointment.start_time}:00`),
        endsAt: new Date(`${appointment.date}T${appointment.end_time}:00`),
        status: appointment.status as ExistingAppointment['status'],
      }))
      .filter((appointment) => appointment.startsAt <= end && appointment.endsAt >= start);
  }

  const supabase = createServerClient() as any;

  const { data, error } = await supabase
    .from('appointments')
    .select('id, staff_id, start_time, end_time, status')
    .eq('salon_id', salonId)
    .in('status', ['reserved', 'confirmed', 'requested'])
    .gte('start_time', startDate)
    .lte('end_time', endDate);

  if (error) {
    console.error('Error fetching appointments:', error);
    return [];
  }

  return (data || []).map((a: any) => ({
    id: a.id,
    staffId: a.staff_id,
    startsAt: new Date(a.start_time),
    endsAt: new Date(a.end_time),
    status: a.status,
  }));
}

// ============================================
// GET STAFF ABSENCES
// ============================================

export async function getStaffAbsencesForDateRange(
  salonId: string,
  startDate: string,
  endDate: string,
  timeZone: string = 'Europe/Zurich'
): Promise<StaffAbsence[]> {
  if (isMockMode()) {
    return [];
  }

  const supabase = createServerClient() as any;
  const rangeStartDate = toDateOnly(startDate);
  const rangeEndDate = toDateOnly(endDate);

  const { data, error } = await supabase
    .from('staff_absences')
    .select('staff_id, start_date, end_date, notes, status')
    .eq('salon_id', salonId)
    .eq('status', 'approved') // Only include approved absences
    .lte('start_date', rangeEndDate)
    .gte('end_date', rangeStartDate);

  if (error) {
    console.error('Error fetching staff absences:', error);
    return [];
  }

  return (data || []).map((a) => {
    const absenceStart = parseDateKeyBoundaryInTimeZone(a.start_date, 'start', timeZone);
    const absenceEnd = parseDateKeyBoundaryInTimeZone(a.end_date, 'endExclusive', timeZone);

    return {
      staffId: a.staff_id,
      startsAt: absenceStart,
      endsAt: absenceEnd,
      reason: a.notes || undefined,
      status: a.status,
    };
  });
}

// ============================================
// GET BLOCKED TIMES (from staff_blocks table)
// ============================================

export async function getBlockedTimes(
  salonId: string,
  startDate: string,
  endDate: string
): Promise<BlockedTime[]> {
  if (isMockMode()) {
    return [];
  }

  const supabase = createServerClient() as any;

  // Query staff_blocks table for staff-specific blocked times
  const { data: staffBlocks, error: staffBlocksError } = await supabase
    .from('staff_blocks')
    .select('staff_id, start_time, end_time, reason')
    .eq('salon_id', salonId)
    .lte('start_time', endDate)
    .gte('end_time', startDate);

  if (staffBlocksError) {
    console.error('Error fetching staff blocks:', staffBlocksError);
  }

  // Also query salon-wide blocked_times
  const { data: salonBlocks, error: salonBlocksError } = await supabase
    .from('blocked_times')
    .select('start_time, end_time, reason')
    .eq('salon_id', salonId)
    .lte('start_time', endDate)
    .gte('end_time', startDate);

  if (salonBlocksError) {
    console.error('Error fetching salon blocked times:', salonBlocksError);
  }

  // Combine both types of blocks
  const results: BlockedTime[] = [];

  // Add staff-specific blocks
  if (staffBlocks) {
    for (const b of staffBlocks) {
      results.push({
        staffId: b.staff_id,
        startsAt: new Date(b.start_time),
        endsAt: new Date(b.end_time),
        reason: b.reason || undefined,
      });
    }
  }

  // Add salon-wide blocks (apply to all staff - staffId null means all)
  if (salonBlocks) {
    for (const b of salonBlocks) {
      results.push({
        staffId: null, // null means applies to all staff
        startsAt: new Date(b.start_time),
        endsAt: new Date(b.end_time),
        reason: b.reason || undefined,
      });
    }
  }

  return results;
}

// ============================================
// CREATE APPOINTMENT RESERVATION
// ============================================

export type CreateReservationResult = {
  success: boolean;
  appointmentId?: string;
  error?: string;
  errorCode?: 'SLOT_ALREADY_TAKEN' | 'VALIDATION_ERROR' | 'SERVER_ERROR';
};

type ReservationServiceSnapshot = {
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  priceCents: number;
  lengthVariantId: string | null;
  lengthVariantName: string | null;
};

function normalizeServiceSelections(request: BookingRequest): BookingServiceSelection[] {
  const submittedSelections = request.serviceSelections?.length
    ? request.serviceSelections
    : request.serviceIds.map((serviceId) => ({ serviceId, lengthVariantId: null }));

  return submittedSelections
    .map((selection) => ({
      serviceId: selection.serviceId,
      lengthVariantId: selection.lengthVariantId || null,
    }))
    .filter((selection) => selection.serviceId);
}

export async function createAppointmentReservation(
  request: BookingRequest,
  idempotencyKey?: string
): Promise<CreateReservationResult> {
  if (isMockMode()) {
    const serviceSnapshots = getMockBookingServiceSnapshots(request);
    const durationMinutes = serviceSnapshots.reduce(
      (sum, service) => sum + service.durationMinutes,
      0
    );
    const startsAt = new Date(request.startsAt);
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
    const staff =
      MOCK_STAFF.find((entry) => entry.id === request.staffId) || MOCK_STAFF[0];
    const appointmentId = `mock-reservation-${Date.now()}`;

    MOCK_RESERVATIONS.set(appointmentId, {
      appointmentId,
      bookingNumber: `BP-DEMO-${Date.now().toString(36).toUpperCase()}`,
      status: 'confirmed',
      requiresApproval: false,
      startsAt,
      endsAt,
      staffName: `${staff.first_name} ${staff.last_name}`,
      services: serviceSnapshots.map((service) => ({
        serviceId: service.serviceId,
        name: service.serviceName,
        duration: service.durationMinutes,
        price: service.priceCents,
      })),
      totalPrice: serviceSnapshots.reduce((sum, service) => sum + service.priceCents, 0),
    });

    return { success: true, appointmentId };
  }

  const supabase = createServerClient() as any;

  try {
    // Check idempotency if key provided
    if (idempotencyKey) {
      const { data: existingKey } = await supabase
        .from('idempotency_keys')
        .select('result, entity_id')
        .eq('key', idempotencyKey)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (existingKey?.result) {
        // Return cached result
        return existingKey.result as CreateReservationResult;
      }

      // Create idempotency key entry
      await supabase.from('idempotency_keys').upsert({
        key: idempotencyKey,
        operation: 'create_reservation',
        entity_type: 'appointment',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: 'key' });
    }

    if (request.paymentMethod === 'online') {
      return {
        success: false,
        error: 'Online-Zahlung für Termine ist derzeit nicht verfügbar. Bitte wählen Sie Zahlung vor Ort.',
        errorCode: 'VALIDATION_ERROR',
      };
    }

    const requestedStartsAt = new Date(request.startsAt);
    if (!Number.isFinite(requestedStartsAt.getTime())) {
      return {
        success: false,
        error: 'Ungültige Startzeit.',
        errorCode: 'VALIDATION_ERROR',
      };
    }

    const serviceSelections = normalizeServiceSelections(request);
    const uniqueServiceIds = Array.from(new Set(serviceSelections.map((selection) => selection.serviceId)));

    if (serviceSelections.length === 0 || uniqueServiceIds.length !== serviceSelections.length) {
      return {
        success: false,
        error: 'Bitte wählen Sie gültige Leistungen aus.',
        errorCode: 'VALIDATION_ERROR',
      };
    }

    const { data: serviceRows, error: serviceFetchError } = await supabase
      .from('services')
      .select(`
        id,
        name,
        duration_minutes,
        price_cents,
        is_active,
        is_bookable_online,
        service_length_variants (
          id,
          name,
          duration_minutes,
          price_cents,
          sort_order
        )
      `)
      .eq('salon_id', request.salonId)
      .in('id', uniqueServiceIds);

    if (serviceFetchError) {
      console.error('Error fetching booking services:', serviceFetchError);
      return {
        success: false,
        error: 'Leistungen konnten nicht geprüft werden.',
        errorCode: 'SERVER_ERROR',
      };
    }

    if (!serviceRows || serviceRows.length !== uniqueServiceIds.length) {
      return {
        success: false,
        error: 'Eine ausgewählte Leistung ist nicht mehr verfügbar.',
        errorCode: 'VALIDATION_ERROR',
      };
    }

    const servicesById = new Map<string, any>(serviceRows.map((service: any) => [service.id, service]));
    const serviceSnapshots: ReservationServiceSnapshot[] = [];
    const selectedBookableServices: BookableService[] = [];

    for (const selection of serviceSelections) {
      const service = servicesById.get(selection.serviceId);

      if (!service?.is_active || !service?.is_bookable_online) {
        return {
          success: false,
          error: 'Eine ausgewählte Leistung ist nicht mehr online buchbar.',
          errorCode: 'VALIDATION_ERROR',
        };
      }

      const variants = [...(service.service_length_variants || [])].sort(
        (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
      );
      const selectedVariant = selection.lengthVariantId
        ? variants.find((variant: any) => variant.id === selection.lengthVariantId)
        : null;

      if (selection.lengthVariantId && !selectedVariant) {
        return {
          success: false,
          error: 'Die ausgewählte Längenvariante ist nicht mehr verfügbar.',
          errorCode: 'VALIDATION_ERROR',
        };
      }

      if (!selection.lengthVariantId && variants.length > 0) {
        return {
          success: false,
          error: `Bitte wählen Sie eine Längenvariante für ${service.name}.`,
          errorCode: 'VALIDATION_ERROR',
        };
      }

      const durationMinutes = selectedVariant?.duration_minutes || service.duration_minutes;
      const priceCents = selectedVariant?.price_cents ?? service.price_cents;

      serviceSnapshots.push({
        serviceId: service.id,
        serviceName: selectedVariant ? `${service.name} (${selectedVariant.name})` : service.name,
        durationMinutes,
        priceCents,
        lengthVariantId: selectedVariant?.id || null,
        lengthVariantName: selectedVariant?.name || null,
      });

      selectedBookableServices.push({
        id: service.id,
        name: service.name,
        durationMinutes,
        currentPrice: priceCents,
        isActive: service.is_active,
        selectedVariantId: selectedVariant?.id,
      });
    }

    const bookingData = await getBookingPageData(request.salonId);
    if (!bookingData) {
      return {
        success: false,
        error: 'Online-Buchung ist derzeit nicht verfügbar.',
        errorCode: 'SERVER_ERROR',
      };
    }

    const normalizedCustomerName = normalizeOptionalText(request.customerName);
    const normalizedCustomerEmail = normalizeEmailForRule(request.customerEmail);
    const normalizedCustomerPhone = normalizePhoneForRule(request.customerPhone);
    const requiresPhone = bookingData.bookingRules?.requirePhoneForBooking ?? true;

    if (!normalizedCustomerName || !normalizedCustomerEmail) {
      return {
        success: false,
        error: 'Bitte geben Sie Name und E-Mail-Adresse an.',
        errorCode: 'VALIDATION_ERROR',
      };
    }

    if (requiresPhone && !normalizedCustomerPhone) {
      return {
        success: false,
        error: 'Bitte geben Sie eine Telefonnummer an.',
        errorCode: 'VALIDATION_ERROR',
      };
    }

    const now = new Date();
    const horizonEnd = addDays(now, bookingData.bookingRules?.horizonDays || 90).toISOString();
    const [existingAppointments, staffAbsences, blockedTimes] = await Promise.all([
      getExistingAppointments(request.salonId, now.toISOString(), horizonEnd),
      getStaffAbsencesForDateRange(request.salonId, now.toISOString(), horizonEnd, bookingData.timeZone),
      getBlockedTimes(request.salonId, now.toISOString(), horizonEnd),
    ]);

    const availableSlots = await computeAvailableSlots(
      {
        salonId: request.salonId,
        dateRangeStart: now,
        dateRangeEnd: addDays(now, bookingData.bookingRules?.horizonDays || 90),
        serviceIds: uniqueServiceIds,
        preferredStaffId: request.staffId || undefined,
        timeZone: bookingData.timeZone,
      },
      {
        services: selectedBookableServices,
        openingHours: bookingData.openingHours,
        staff: bookingData.staff,
        staffWorkingHours: bookingData.staffWorkingHours,
        staffAbsences,
        blockedTimes,
        existingAppointments,
        bookingRules: bookingData.bookingRules,
      }
    );

    const requestedStartTime = requestedStartsAt.getTime();
    const matchingSlot = availableSlots.find((slot) =>
      slot.startsAt.getTime() === requestedStartTime &&
      (!request.staffId || slot.staffId === request.staffId)
    );

    if (!matchingSlot) {
      return {
        success: false,
        error: 'Dieser Termin ist leider nicht mehr verfügbar. Bitte wählen Sie einen anderen Zeitpunkt.',
        errorCode: 'SLOT_ALREADY_TAKEN',
      };
    }

    const assignedStaffId = request.staffId || matchingSlot.staffId;
    const totalDuration = matchingSlot.totalDuration;
    const totalPrice = serviceSnapshots.reduce((sum, service) => sum + service.priceCents, 0);
    const endsAt = matchingSlot.endsAt;

    // Check if user is logged in
    let loggedInUserId: string | null = null;
    try {
      const authClient = await createAuthServerClient();
      const { data: { user: authUser } } = await authClient.auth.getUser();
      if (authUser) {
        loggedInUserId = authUser.id;
      }
    } catch (err) {
      // Not logged in - continue as guest
    }

    // Try to find or create customer by email
    let customerId = request.customerId || null;
    if (!customerId && normalizedCustomerEmail) {
      // Check if customer with this email already exists in this salon
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id, phone, profile_id')
        .eq('salon_id', request.salonId)
        .eq('email', normalizedCustomerEmail)
        .single();

      if (existingCustomer) {
        // Link to existing customer
        customerId = existingCustomer.id;

        // Build update payload
        const customerUpdate: Record<string, unknown> = {};
        if (normalizedCustomerPhone && normalizedCustomerPhone !== existingCustomer.phone) {
          customerUpdate.phone = normalizedCustomerPhone;
        }
        // Link profile if logged in and not yet linked
        if (loggedInUserId && !existingCustomer.profile_id) {
          customerUpdate.profile_id = loggedInUserId;
        }
        if (Object.keys(customerUpdate).length > 0) {
          await supabase
            .from('customers')
            .update(customerUpdate)
            .eq('id', existingCustomer.id);
        }
      } else {
        // Create new customer
        const nameParts = normalizedCustomerName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            salon_id: request.salonId,
            first_name: firstName,
            last_name: lastName,
            email: normalizedCustomerEmail,
            phone: normalizedCustomerPhone || null,
            // Link to profile if logged in
            ...(loggedInUserId ? { profile_id: loggedInUserId } : {}),
          })
          .select('id')
          .single();

        if (!customerError && newCustomer) {
          customerId = newCustomer.id;
        } else {
          console.error('[Booking] Error creating customer:', customerError);
          // Continue without customer_id - appointment will still be created with guest info
        }
      }

      // Always sync phone number to profile if logged in
      if (loggedInUserId && normalizedCustomerPhone) {
        try {
          await supabase
            .from('profiles')
            .update({ phone: normalizedCustomerPhone })
            .eq('id', loggedInUserId);
        } catch (err) {
          console.error('[Booking] Error syncing profile phone:', err);
        }
      }
    }

    // Re-check the assigned staff immediately before insert for race condition protection.
    const { data: conflictingAppointments } = await supabase
      .from('appointments')
      .select('id')
      .eq('salon_id', request.salonId)
      .eq('staff_id', assignedStaffId)
      .in('status', ['reserved', 'confirmed', 'requested'])
      .lt('start_time', endsAt.toISOString())
      .gt('end_time', requestedStartsAt.toISOString());

    if (conflictingAppointments && conflictingAppointments.length > 0) {
      return {
        success: false,
        error: 'Dieser Termin ist leider nicht mehr verfügbar. Bitte wählen Sie einen anderen Zeitpunkt.',
        errorCode: 'SLOT_ALREADY_TAKEN',
      };
    }

    // Create appointment with reserved status
    const reservationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min reservation

    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert({
        salon_id: request.salonId,
        staff_id: assignedStaffId,
        customer_id: customerId,
        start_time: requestedStartsAt.toISOString(),
        end_time: endsAt.toISOString(),
        duration_minutes: totalDuration,
        status: 'reserved',
        reserved_at: new Date().toISOString(),
        reservation_expires_at: reservationExpires.toISOString(),
        subtotal_cents: totalPrice,
        total_cents: totalPrice,
        customer_name: normalizedCustomerName,
        customer_email: normalizedCustomerEmail,
        customer_phone: normalizedCustomerPhone || null,
        customer_notes: request.notes || null,
        payment_method: 'cash',
        booked_online: true,
      })
      .select('id')
      .single();

    if (appointmentError || !appointment) {
      // Check if it's a unique constraint violation (double booking)
      if (appointmentError?.code === '23505') {
        const result: CreateReservationResult = {
          success: false,
          error: 'Dieser Termin wurde soeben vergeben. Bitte wählen Sie einen anderen Zeitpunkt.',
          errorCode: 'SLOT_ALREADY_TAKEN',
        };
        return result;
      }
      console.error('Error creating appointment:', appointmentError);
      return { success: false, error: 'Fehler beim Erstellen des Termins.', errorCode: 'SERVER_ERROR' };
    }

    // Create appointment_services entries
    const appointmentServices = serviceSnapshots.map((service, index) => ({
      appointment_id: appointment.id,
      service_id: service.serviceId,
      price_cents: service.priceCents,
      duration_minutes: service.durationMinutes,
      service_name: service.serviceName,
      length_variant_id: service.lengthVariantId,
      length_variant_name: service.lengthVariantName,
      sort_order: index,
    }));

    const { error: appointmentServicesError } = await supabase
      .from('appointment_services')
      .insert(appointmentServices);

    if (appointmentServicesError) {
      console.error('Error creating appointment services:', appointmentServicesError);
      // Rollback appointment
      await supabase.from('appointments').delete().eq('id', appointment.id);
      return { success: false, error: 'Fehler beim Erstellen des Termins.', errorCode: 'SERVER_ERROR' };
    }

    const result: CreateReservationResult = { success: true, appointmentId: appointment.id };

    // Store idempotency result
    if (idempotencyKey) {
      await supabase
        .from('idempotency_keys')
        .update({ entity_id: appointment.id, result })
        .eq('key', idempotencyKey);
    }

    return result;
  } catch (error) {
    console.error('Reservation error:', error);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.', errorCode: 'SERVER_ERROR' };
  }
}

// ============================================
// CONFIRM APPOINTMENT
// ============================================

interface ConfirmAppointmentOptions {
  appointmentId: string;
  acceptedLegalDocuments?: {
    type: 'agb' | 'datenschutz';
    version: number;
  }[];
  ipAddress?: string;
  userAgent?: string;
}

export async function confirmAppointment(
  appointmentId: string,
  options?: Partial<ConfirmAppointmentOptions>
): Promise<BookingConfirmation | { error: string }> {
  if (isMockMode()) {
    const confirmation = MOCK_RESERVATIONS.get(appointmentId);

    if (confirmation) {
      return confirmation;
    }

    const startsAt = addDays(new Date(), 1);
    startsAt.setHours(10, 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + 60 * 60_000);

    return {
      appointmentId,
      bookingNumber: `BP-DEMO-${Date.now().toString(36).toUpperCase()}`,
      status: 'confirmed',
      requiresApproval: false,
      startsAt,
      endsAt,
      staffName: 'BeautifyPRO Team',
      services: [
        {
          serviceId: 'svc-001',
          name: 'Waschen, Schneiden, Föhnen',
          duration: 60,
          price: 8500,
        },
      ],
      totalPrice: 8500,
    };
  }

  const supabase = createServerClient() as any;

  // Get appointment with staff, services, and customer info
  const { data: appointment, error } = await supabase
    .from('appointments')
    .select(`
      id,
      start_time,
      end_time,
      total_cents,
      status,
      customer_name,
      customer_email,
      customer_id,
      salon_id,
      staff:staff_id (display_name),
      appointment_services (
        service_id,
        service_name,
        duration_minutes,
        price_cents
      )
    `)
    .eq('id', appointmentId)
    .single();

  if (error || !appointment) {
    return { error: 'Termin nicht gefunden.' };
  }

  if (appointment.status !== 'reserved') {
    return { error: 'Termin ist nicht mehr reserviert.' };
  }

  // Generate booking number
  const bookingNumber = `SW-${Date.now().toString(36).toUpperCase()}`;

  // Check if approval is required
  const { data: bookingRulesData } = await supabase
    .from('booking_rules')
    .select('require_appointment_approval')
    .eq('salon_id', appointment.salon_id)
    .single();

  const requiresApproval = bookingRulesData?.require_appointment_approval ?? false;

  // Approval-required bookings are real slot blockers, but not final confirmations yet.
  const nextStatus = requiresApproval ? 'requested' : 'confirmed';
  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('appointments')
    .update({
      status: nextStatus,
      confirmed_at: requiresApproval ? null : nowIso,
      reservation_expires_at: null,
      booking_number: bookingNumber,
      is_approved: !requiresApproval, // Auto-approve if no approval required
    })
    .eq('id', appointmentId);

  if (updateError) {
    return { error: 'Fehler beim Bestätigen des Termins.' };
  }

  // Record legal document acceptances
  if (options?.acceptedLegalDocuments && options.acceptedLegalDocuments.length > 0) {
    const acceptances = options.acceptedLegalDocuments.map((doc) => ({
      profile_id: null, // Will be filled if customer is logged in
      customer_id: appointment.customer_id,
      legal_document_type: doc.type,
      legal_document_version: doc.version,
      appointment_id: appointmentId,
      ip_address: options.ipAddress || null,
      user_agent: options.userAgent || null,
      accepted_at: new Date().toISOString(),
    }));

    await supabase
      .from('legal_document_acceptances')
      .insert(acceptances)
      .catch((err) => {
        console.warn('Failed to record legal acceptances:', err);
      });
  }

  // Get salon info for email
  const { data: salon } = await supabase
    .from('salons')
    .select('name, address, zip_code, city, phone')
    .eq('id', appointment.salon_id)
    .single();

  // Send confirmation email only if no approval required
  // If approval is required, email will be sent when admin approves
  if (!requiresApproval && appointment.customer_email && salon) {
    const services = appointment.appointment_services.map((s: any) => ({
      name: s.service_name,
      durationMinutes: s.duration_minutes,
      priceCents: s.price_cents,
    }));

    const emailResult = await sendBookingConfirmationEmail({
      customerName: appointment.customer_name || 'Kunde',
      customerEmail: appointment.customer_email,
      bookingNumber,
      appointmentId: appointment.id,
      startsAt: new Date(appointment.start_time),
      endsAt: new Date(appointment.end_time),
      staffName: (appointment.staff as any)?.display_name || 'Ihr Stylist',
      services,
      totalPriceCents: appointment.total_cents,
      salonName: salon.name,
      salonAddress: `${salon.address}, ${salon.zip_code} ${salon.city}`,
      salonPhone: salon.phone || '+41 71 222 81 82',
    }).catch((err) => {
      // Log but don't fail the booking
      console.error('Failed to send confirmation email:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown email error' };
    });

    if (!emailResult.success) {
      console.error('Failed to send confirmation email:', emailResult.error);
    }
  }

  if (requiresApproval) {
    const services = appointment.appointment_services
      .map((service: any) => service.service_name)
      .join(', ');

    await supabase.from('admin_notifications').insert({
      salon_id: appointment.salon_id,
      type: 'appointment_requested',
      title: 'Neue Terminanfrage',
      message: `${appointment.customer_name || 'Kunde'} hat ${services || 'einen Termin'} angefragt. Bitte im Kalender prüfen und bestätigen.`,
      reference_type: 'appointment',
      reference_id: appointment.id,
      link: '/admin/kalender',
    }).catch((err: unknown) => {
      console.error('[Booking] Failed to create approval notification:', err);
    });
  }

  return {
    appointmentId: appointment.id,
    bookingNumber,
    status: nextStatus,
    requiresApproval, // Add flag to indicate if approval is pending
    startsAt: new Date(appointment.start_time),
    endsAt: new Date(appointment.end_time),
    staffName: (appointment.staff as any)?.display_name || 'Unbekannt',
    services: appointment.appointment_services.map((s: any) => ({
      serviceId: s.service_id,
      name: s.service_name,
      duration: s.duration_minutes,
      price: s.price_cents,
    })),
    totalPrice: appointment.total_cents,
  };
}

// ============================================
// MARK APPOINTMENT AS NO-SHOW (Admin)
// ============================================

export type NoShowResult = {
  success: boolean;
  noShowFeeCents?: number;
  error?: string;
};

export async function markAppointmentNoShow(
  appointmentId: string,
  options?: {
    noShowFeeCents?: number;
    reason?: string;
  }
): Promise<NoShowResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    // Get appointment
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        id,
        status,
        total_cents,
        salon_id,
        booking_number,
        customer_email
      `)
      .eq('id', appointmentId)
      .single();

    if (fetchError || !appointment) {
      return { success: false, error: 'Termin nicht gefunden.' };
    }

    const auth = await requireAdminAction(supabase, { salonId: appointment.salon_id });
    if (!auth.success) {
      return { success: false, error: getAdminAuthError(auth) };
    }

    // Only confirmed appointments can be marked as no-show
    if (appointment.status !== 'confirmed') {
      return { success: false, error: 'Nur bestätigte Termine können als No-Show markiert werden.' };
    }

    // Calculate no-show fee if not provided
    let noShowFeeCents = options?.noShowFeeCents;
    if (noShowFeeCents === undefined) {
      // Get salon settings for default no-show fee
      const { data: salon } = await supabase
        .from('salons')
        .select('no_show_fee_percent, no_show_fee_flat_cents')
        .eq('id', appointment.salon_id)
        .single();

      if (salon?.no_show_fee_flat_cents) {
        noShowFeeCents = salon.no_show_fee_flat_cents;
      } else if (salon?.no_show_fee_percent) {
        noShowFeeCents = Math.round(
          (appointment.total_cents * salon.no_show_fee_percent) / 100
        );
      } else {
        noShowFeeCents = 0;
      }
    }

    // Update appointment
    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        status: 'no_show',
        no_show_fee_cents: noShowFeeCents,
        marked_no_show_at: new Date().toISOString(),
        marked_no_show_by: auth.context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);

    if (updateError) {
      console.error('Error marking no-show:', updateError);
      return { success: false, error: 'Fehler beim Markieren als No-Show.' };
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      action: 'mark_no_show',
      entity_type: 'appointment',
      entity_id: appointmentId,
      actor_id: auth.context.userId,
      actor_type: 'user',
      details: {
        booking_number: appointment.booking_number,
        no_show_fee_cents: noShowFeeCents,
        reason: options?.reason,
        timestamp: new Date().toISOString(),
      },
    }).catch((e) => console.warn('Audit log failed:', e));

    return { success: true, noShowFeeCents };
  } catch (error) {
    console.error('No-show error:', error);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

// ============================================
// MARK APPOINTMENT AS COMPLETED (Admin)
// ============================================

export type CompleteResult = {
  success: boolean;
  error?: string;
};

// ============================================
// ADMIN UPDATE APPOINTMENT TIME
// ============================================

export type AdminUpdateTimeResult = {
  success: boolean;
  error?: string;
};

export async function adminUpdateAppointmentTime(
  appointmentId: string,
  startTime: string,
  endTime: string,
  durationMinutes?: number,
  sendNotification?: boolean
): Promise<AdminUpdateTimeResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    const { data: appointmentData, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        id,
        salon_id,
        staff_id,
        start_time,
        booking_number,
        customer_name,
        customer_email,
        customer:customers (
          first_name,
          last_name,
          email,
          profiles (email)
        ),
        staff:staff_id (
          display_name
        ),
        appointment_services (
          service_id,
          service_name
        )
      `)
      .eq('id', appointmentId)
      .single();

    if (fetchError || !appointmentData) {
      console.error('[adminUpdateAppointmentTime] Fetch error:', fetchError);
      return { success: false, error: 'Termin nicht gefunden' };
    }

    const auth = await requireAdminAction(supabase, { salonId: appointmentData.salon_id });
    if (!auth.success) {
      return { success: false, error: getAdminAuthError(auth) };
    }

    const slotValidation = await validateCalendarSlot(supabase, {
      salonId: appointmentData.salon_id,
      staffId: appointmentData.staff_id,
      startTime,
      endTime,
      serviceIds: (appointmentData.appointment_services || [])
        .map((service: { service_id?: string | null }) => service.service_id)
        .filter((serviceId: string | null | undefined): serviceId is string => Boolean(serviceId)),
      excludeAppointmentId: appointmentId,
      checkSkills: true,
      checkWorkingHours: true,
    });

    if (!slotValidation.success) {
      return slotValidation;
    }

    const updateData: Record<string, unknown> = {
      start_time: startTime,
      end_time: endTime,
    };

    if (durationMinutes !== undefined) {
      updateData.duration_minutes = durationMinutes;
    }

    const { error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId);

    if (error) {
      console.error('[adminUpdateAppointmentTime] Error:', error);
      return { success: false, error: error.message };
    }

    // Send reschedule notification email if requested and customer has email
    const recipient = getAppointmentRecipient(appointmentData);

    if (sendNotification && recipient.email && appointmentData.booking_number) {
      // Get salon info for email
      const { data: salon } = await supabase
        .from('salons')
        .select('name, address, zip_code, city, phone')
        .eq('id', appointmentData.salon_id)
        .single();

      if (salon) {
        const { sendAppointmentRescheduledEmail } = await import('@/lib/email');

        await sendAppointmentRescheduledEmail({
          customerName: recipient.name,
          customerEmail: recipient.email,
          bookingNumber: appointmentData.booking_number,
          oldStartsAt: new Date(appointmentData.start_time),
          newStartsAt: new Date(startTime),
          newEndsAt: new Date(endTime),
          staffName: (appointmentData.staff as any)?.display_name || 'Ihr Stylist',
          services: (appointmentData.appointment_services || []).map((s: any) => ({
            name: s.service_name,
          })),
          salonName: salon.name,
          salonAddress: `${salon.address}, ${salon.zip_code} ${salon.city}`,
          salonPhone: salon.phone || '+41 71 222 81 82',
        }).catch((err) => {
          console.error('[adminUpdateAppointmentTime] Failed to send reschedule email:', err);
        });
      }
    }

    return { success: true };
  } catch (err) {
    console.error('[adminUpdateAppointmentTime] Exception:', err);
    return { success: false, error: 'Unbekannter Fehler' };
  }
}

// ============================================
// ADMIN CANCEL APPOINTMENT
// ============================================

export type AdminCancelResult = {
  success: boolean;
  error?: string;
};

export async function adminCancelAppointment(
  appointmentId: string
): Promise<AdminCancelResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    // First fetch appointment details for the cancellation email
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        id,
        salon_id,
        start_time,
        booking_number,
        customer_name,
        customer_email,
        customer:customers (
          first_name,
          last_name,
          email,
          profiles (email)
        ),
        staff:staff_id (
          display_name
        ),
        appointment_services (
          service_name
        )
      `)
      .eq('id', appointmentId)
      .single();

    if (fetchError || !appointment) {
      console.error('[adminCancelAppointment] Fetch error:', fetchError);
      return { success: false, error: 'Termin nicht gefunden' };
    }

    const auth = await requireAdminAction(supabase, { salonId: appointment.salon_id });
    if (!auth.success) {
      return { success: false, error: getAdminAuthError(auth) };
    }

    // Update appointment status
    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: auth.context.userId,
      })
      .eq('id', appointmentId);

    if (error) {
      console.error('[adminCancelAppointment] Error:', error);
      return { success: false, error: error.message };
    }

    // Send cancellation email if customer has email
    const recipient = getAppointmentRecipient(appointment);

    if (recipient.email && appointment.booking_number) {
      // Get salon info for email
      const { data: salon } = await supabase
        .from('salons')
        .select('name, address, zip_code, city, phone')
        .eq('id', appointment.salon_id)
        .single();

      if (salon) {
        const { sendCancellationEmail } = await import('@/lib/email');

        await sendCancellationEmail({
          customerName: recipient.name,
          customerEmail: recipient.email,
          bookingNumber: appointment.booking_number,
          startsAt: new Date(appointment.start_time),
          staffName: (appointment.staff as any)?.display_name || 'Ihr Stylist',
          services: (appointment.appointment_services || []).map((s: any) => ({
            name: s.service_name,
          })),
          salonName: salon.name,
          salonAddress: `${salon.address}, ${salon.zip_code} ${salon.city}`,
          salonPhone: salon.phone || '+41 71 222 81 82',
          cancelledBy: 'salon',
        }).catch((err) => {
          console.error('[adminCancelAppointment] Failed to send cancellation email:', err);
        });
      }
    }

    return { success: true };
  } catch (err) {
    console.error('[adminCancelAppointment] Exception:', err);
    return { success: false, error: 'Unbekannter Fehler' };
  }
}

// ============================================
// ADMIN CONFIRM APPOINTMENT
// ============================================

export type AdminConfirmResult = {
  success: boolean;
  error?: string;
};

export async function adminConfirmAppointment(
  appointmentId: string,
  sendConfirmationEmail: boolean = true
): Promise<AdminConfirmResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('id, salon_id, booking_number')
      .eq('id', appointmentId)
      .single();

    if (fetchError || !appointment) {
      console.error('[adminConfirmAppointment] Fetch error:', fetchError);
      return { success: false, error: 'Termin nicht gefunden' };
    }

    const auth = await requireAdminAction(supabase, { salonId: appointment.salon_id });
    if (!auth.success) {
      return { success: false, error: getAdminAuthError(auth) };
    }

    const bookingNumber = appointment.booking_number || `SW-${Date.now().toString(36).toUpperCase()}`;

    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        confirmed_by: auth.context.userId,
        booking_number: bookingNumber,
        is_approved: true,
        approved_at: new Date().toISOString(),
        approved_by: auth.context.userId,
      })
      .eq('id', appointmentId);

    if (error) {
      console.error('[adminConfirmAppointment] Error:', error);
      return { success: false, error: error.message };
    }

    if (sendConfirmationEmail) {
      await sendAdminAppointmentConfirmationEmail(supabase, appointmentId);
    }

    return { success: true };
  } catch (err) {
    console.error('[adminConfirmAppointment] Exception:', err);
    return { success: false, error: 'Unbekannter Fehler' };
  }
}

// ============================================
// ADMIN CREATE APPOINTMENT
// ============================================

export interface AdminCreateAppointmentInput {
  salonId: string;
  staffId: string;
  serviceId: string;
  serviceName: string;
  serviceDurationMinutes: number;
  servicePriceCents: number;
  startTime: string;
  endTime: string;
  notes?: string;
  // Customer options (one of these should be set):
  customerId?: string | null; // Existing customer
  // Guest-only (no customer record):
  guestName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  // New customer creation:
  createNewCustomer?: boolean;
  newCustomerName?: string;
  newCustomerEmail?: string;
  newCustomerPhone?: string;
  sendConfirmationEmail?: boolean;
}

export type AdminCreateAppointmentResult = {
  success: boolean;
  appointmentId?: string;
  bookingNumber?: string;
  confirmationEmailSent?: boolean;
  error?: string;
};

export async function adminCreateAppointment(
  input: AdminCreateAppointmentInput
): Promise<AdminCreateAppointmentResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    // Generate booking number
    const bookingNumber = `SW-${Date.now().toString(36).toUpperCase()}`;

    // Calculate duration
    const startTime = new Date(input.startTime);
    const endTime = new Date(input.endTime);
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

    const auth = await requireAdminAction(supabase, { salonId: input.salonId });
    if (!auth.success) {
      return { success: false, error: getAdminAuthError(auth) };
    }

    const { data: selectedStaff, error: staffError } = await (supabase.from('staff') as any)
      .select('id, salon_id, is_active')
      .eq('id', input.staffId)
      .eq('salon_id', input.salonId)
      .eq('is_active', true)
      .maybeSingle();

    if (staffError || !selectedStaff) {
      console.error('[adminCreateAppointment] Staff lookup error:', staffError);
      return { success: false, error: 'Mitarbeiter nicht gefunden' };
    }

    const service = await getActiveServiceForSalon(supabase, input.salonId, input.serviceId);
    if (!service) {
      return { success: false, error: 'Leistung nicht gefunden oder nicht aktiv' };
    }

    const slotValidation = await validateCalendarSlot(supabase, {
      salonId: input.salonId,
      staffId: input.staffId,
      startTime: input.startTime,
      endTime: input.endTime,
      serviceIds: [service.id],
      checkSkills: true,
      checkWorkingHours: true,
    });

    if (!slotValidation.success) {
      return slotValidation;
    }

    // Handle customer creation if needed
    let customerId = input.customerId || null;
    let customerName = input.guestName || null;
    let customerEmail = input.guestEmail?.trim().toLowerCase() || null;
    let customerPhone = input.guestPhone?.trim() || null;

    if (customerId && !input.createNewCustomer) {
      const { data: existingCustomer, error: existingCustomerError } = await supabase
        .from('customers')
        .select(`
          first_name,
          last_name,
          email,
          phone,
          profiles (email, phone)
        `)
        .eq('id', customerId)
        .eq('salon_id', input.salonId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .maybeSingle();

      if (existingCustomerError || !existingCustomer) {
        console.error('[adminCreateAppointment] Existing customer error:', existingCustomerError);
        return { success: false, error: 'Kunde nicht gefunden' };
      }

      const profile = Array.isArray((existingCustomer as any).profiles)
        ? (existingCustomer as any).profiles[0]
        : (existingCustomer as any).profiles;

      customerName = [existingCustomer.first_name, existingCustomer.last_name]
        .filter(Boolean)
        .join(' ');
      customerEmail = existingCustomer.email || profile?.email || null;
      customerPhone = existingCustomer.phone || profile?.phone || null;
    }

    if (input.createNewCustomer && input.newCustomerName) {
      const newCustomerEmail = input.newCustomerEmail?.trim().toLowerCase();

      if (!newCustomerEmail) {
        return { success: false, error: 'E-Mail ist erforderlich für neue Kunden' };
      }

      const nameParts = input.newCustomerName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const customerResult = await adminCreateCustomer({
        firstName,
        lastName: lastName || '-',
        email: newCustomerEmail,
        phone: input.newCustomerPhone || undefined,
        salonId: input.salonId,
        createAccount: true,
      });

      if (!customerResult.success || !customerResult.customerId) {
        return {
          success: false,
          error: customerResult.error || 'Kunde konnte nicht angelegt werden',
        };
      }

      customerId = customerResult.customerId;
      customerName = input.newCustomerName;
      customerEmail = newCustomerEmail;
      customerPhone = input.newCustomerPhone?.trim() || null;
    }

    // Create appointment
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert({
        salon_id: input.salonId,
        customer_id: customerId,
        staff_id: input.staffId,
        start_time: input.startTime,
        end_time: input.endTime,
        duration_minutes: durationMinutes,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        confirmed_by: auth.context.userId,
        booking_number: bookingNumber,
        is_approved: true,
        approved_at: new Date().toISOString(),
        approved_by: auth.context.userId,
        subtotal_cents: service.price_cents,
        total_cents: service.price_cents,
        booked_online: false,
        created_by: auth.context.userId,
        notes: input.notes || null,
        // Guest fields
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
      })
      .select('id')
      .single();

    if (appointmentError) {
      console.error('[adminCreateAppointment] Error creating appointment:', appointmentError);
      return { success: false, error: appointmentError.message };
    }

    // Create appointment_services
    const { error: serviceError } = await supabase
      .from('appointment_services')
      .insert({
        appointment_id: appointment.id,
        service_id: service.id,
        service_name: service.name,
        duration_minutes: service.duration_minutes,
        price_cents: service.price_cents,
        sort_order: 0,
      });

    if (serviceError) {
      console.error('[adminCreateAppointment] Error creating appointment service:', serviceError);
      // Don't fail completely, the appointment was created
    }

    const confirmationEmailSent = input.sendConfirmationEmail
      ? await sendAdminAppointmentConfirmationEmail(supabase, appointment.id)
      : false;

    return {
      success: true,
      appointmentId: appointment.id,
      bookingNumber,
      confirmationEmailSent,
    };
  } catch (err) {
    console.error('[adminCreateAppointment] Exception:', err);
    return { success: false, error: 'Unbekannter Fehler' };
  }
}

// ============================================
// GET APPOINTMENTS FOR ADMIN CALENDAR
// ============================================

export interface AdminCalendarAppointment {
  id: string;
  staff_id: string | null; // null when "Keine Präferenz" - unassigned
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  booking_number: string | null;
  total_cents: number;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  } | null;
  appointment_services: {
    service_id: string;
    service_name: string;
    duration_minutes: number;
    price_cents: number;
  }[];
  staff: {
    id: string;
    display_name: string;
    color: string | null;
  } | null;
  // Approval fields
  is_approved: boolean;
  approved_at: string | null;
  // Payment fields
  paid_amount_cents: number;
  paid_at: string | null;
  payment_method: string | null;
}

export async function getAdminCalendarAppointments(
  salonId: string,
  startDate: string,
  endDate: string,
  staffIds: string[]
): Promise<AdminCalendarAppointment[]> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    console.error('[getAdminCalendarAppointments] Supabase client not available');
    return [];
  }

  const auth = await requireAdminAction(supabase, { salonId });
  if (!auth.success) {
    console.error('[getAdminCalendarAppointments] Unauthorized:', getAdminAuthError(auth));
    return [];
  }

  // Build query - need to include both assigned (to selected staff) and unassigned appointments
  let query = supabase
    .from('appointments')
    .select(`
      id,
      staff_id,
      start_time,
      end_time,
      status,
      notes,
      booking_number,
      total_cents,
      customer_name,
      customer_email,
      customer_phone,
      is_approved,
      approved_at,
      paid_amount_cents,
      paid_at,
      payment_method,
      customers (
        id,
        first_name,
        last_name,
        email,
        phone,
        profiles (email, phone)
      ),
      appointment_services (
        service_id,
        service_name,
        duration_minutes,
        price_cents
      ),
      staff (
        id,
        display_name,
        color
      )
    `)
    .eq('salon_id', salonId)
    .lt('start_time', endDate)
    .gt('end_time', startDate)
    .order('start_time');

  // Filter by staff - include appointments for selected staff OR unassigned appointments (staff_id is null)
  if (staffIds.length > 0) {
    // Use OR filter: staff_id in staffIds OR staff_id is null
    query = query.or(`staff_id.in.(${staffIds.join(',')}),staff_id.is.null`);
  } else {
    // No staff selected - only show unassigned
    query = query.is('staff_id', null);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[getAdminCalendarAppointments] Error:', error);
    return [];
  }

  return (data || []).map((apt: any) => {
    const customer = apt.customers
      ? Array.isArray(apt.customers)
        ? apt.customers[0]
        : apt.customers
      : null;
    const profile = Array.isArray(customer?.profiles)
      ? customer.profiles[0]
      : customer?.profiles;

    return {
      id: apt.id,
      staff_id: apt.staff_id, // Can be null for unassigned appointments
      start_time: apt.start_time,
      end_time: apt.end_time,
      status: apt.status,
      notes: apt.notes,
      booking_number: apt.booking_number,
      total_cents: apt.total_cents || 0,
      customer_name: apt.customer_name,
      customer_email: apt.customer_email,
      customer_phone: apt.customer_phone,
      customer: customer
        ? {
            id: customer.id,
            first_name: customer.first_name,
            last_name: customer.last_name,
            email: customer.email || profile?.email || null,
            phone: customer.phone || profile?.phone || null,
          }
        : null,
      appointment_services: apt.appointment_services || [],
      staff: apt.staff,
      // Approval fields
      is_approved: apt.is_approved || false,
      approved_at: apt.approved_at,
      // Payment fields
      paid_amount_cents: apt.paid_amount_cents || 0,
      paid_at: apt.paid_at,
      payment_method: apt.payment_method,
    };
  });
}

// ============================================
// ADMIN STAFF BLOCKS
// ============================================

export interface AdminStaffBlock {
  id: string;
  staff_id: string;
  start_time: string;
  end_time: string;
  reason: string | null;
  staff: {
    display_name: string;
    color: string | null;
  } | null;
}

export async function getAdminStaffBlocks(
  salonId: string,
  startDate: string,
  endDate: string,
  staffIds: string[]
): Promise<AdminStaffBlock[]> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    console.error('[getAdminStaffBlocks] Supabase client not available');
    return [];
  }

  const auth = await requireAdminAction(supabase, { salonId });
  if (!auth.success) {
    console.error('[getAdminStaffBlocks] Unauthorized:', getAdminAuthError(auth));
    return [];
  }

  let query = (supabase.from('staff_blocks') as any)
    .select(`
      id,
      staff_id,
      start_time,
      end_time,
      reason,
      staff (
        display_name,
        color
      )
    `)
    .eq('salon_id', salonId)
    .lt('start_time', endDate)
    .gt('end_time', startDate)
    .order('start_time');

  if (staffIds.length > 0) {
    query = query.in('staff_id', staffIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[getAdminStaffBlocks] Error:', error);
    return [];
  }

  return (data || []) as AdminStaffBlock[];
}

export interface AdminCreateStaffBlockInput {
  staffId: string;
  startTime: string;
  endTime: string;
  reason?: string;
}

export type AdminStaffBlockMutationResult = {
  success: boolean;
  error?: string;
};

export async function adminCreateStaffBlock(
  input: AdminCreateStaffBlockInput
): Promise<AdminStaffBlockMutationResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    const { data: staffMember, error: staffError } = await (supabase.from('staff') as any)
      .select('id, salon_id')
      .eq('id', input.staffId)
      .eq('is_active', true)
      .maybeSingle();

    if (staffError || !staffMember) {
      console.error('[adminCreateStaffBlock] Staff lookup error:', staffError);
      return { success: false, error: 'Mitarbeiter nicht gefunden' };
    }

    const auth = await requireAdminAction(supabase, {
      salonId: staffMember.salon_id,
      allowedRoles: ['admin', 'manager', 'hq'],
    });
    if (!auth.success) {
      return { success: false, error: getAdminAuthError(auth) };
    }

    const slotValidation = await validateCalendarSlot(supabase, {
      salonId: staffMember.salon_id,
      staffId: input.staffId,
      startTime: input.startTime,
      endTime: input.endTime,
      checkStaffBlocks: true,
      checkAppointments: true,
    });

    if (!slotValidation.success) {
      return slotValidation;
    }

    const { error } = await (supabase.from('staff_blocks') as any)
      .insert({
        salon_id: staffMember.salon_id,
        staff_id: input.staffId,
        start_time: input.startTime,
        end_time: input.endTime,
        reason: normalizeOptionalText(input.reason) || 'Blockiert',
      });

    if (error) {
      console.error('[adminCreateStaffBlock] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[adminCreateStaffBlock] Exception:', err);
    return { success: false, error: 'Unbekannter Fehler' };
  }
}

export async function adminUpdateStaffBlockTime(
  blockId: string,
  startTime: string,
  endTime: string
): Promise<AdminStaffBlockMutationResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    const { data: block, error: fetchError } = await (supabase.from('staff_blocks') as any)
      .select('id, salon_id, staff_id')
      .eq('id', blockId)
      .maybeSingle();

    if (fetchError || !block) {
      console.error('[adminUpdateStaffBlockTime] Fetch error:', fetchError);
      return { success: false, error: 'Blockzeit nicht gefunden' };
    }

    const auth = await requireAdminAction(supabase, {
      salonId: block.salon_id,
      allowedRoles: ['admin', 'manager', 'hq'],
    });
    if (!auth.success) {
      return { success: false, error: getAdminAuthError(auth) };
    }

    const slotValidation = await validateCalendarSlot(supabase, {
      salonId: block.salon_id,
      staffId: block.staff_id,
      startTime,
      endTime,
      excludeBlockId: blockId,
      checkAppointments: true,
      checkStaffBlocks: true,
    });

    if (!slotValidation.success) {
      return slotValidation;
    }

    const { error } = await (supabase.from('staff_blocks') as any)
      .update({
        start_time: startTime,
        end_time: endTime,
        updated_at: new Date().toISOString(),
      })
      .eq('id', blockId);

    if (error) {
      console.error('[adminUpdateStaffBlockTime] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[adminUpdateStaffBlockTime] Exception:', err);
    return { success: false, error: 'Unbekannter Fehler' };
  }
}

export async function adminDeleteStaffBlock(
  blockId: string
): Promise<AdminStaffBlockMutationResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    const { data: block, error: fetchError } = await (supabase.from('staff_blocks') as any)
      .select('id, salon_id')
      .eq('id', blockId)
      .maybeSingle();

    if (fetchError || !block) {
      console.error('[adminDeleteStaffBlock] Fetch error:', fetchError);
      return { success: false, error: 'Blockzeit nicht gefunden' };
    }

    const auth = await requireAdminAction(supabase, {
      salonId: block.salon_id,
      allowedRoles: ['admin', 'manager', 'hq'],
    });
    if (!auth.success) {
      return { success: false, error: getAdminAuthError(auth) };
    }

    const { error } = await (supabase.from('staff_blocks') as any)
      .delete()
      .eq('id', blockId);

    if (error) {
      console.error('[adminDeleteStaffBlock] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[adminDeleteStaffBlock] Exception:', err);
    return { success: false, error: 'Unbekannter Fehler' };
  }
}

// ============================================
// MARK APPOINTMENT AS COMPLETED (Admin)
// ============================================

export async function markAppointmentCompleted(
  appointmentId: string,
  options?: {
    actualTotalCents?: number;
    notes?: string;
  }
): Promise<CompleteResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('id, status, salon_id')
      .eq('id', appointmentId)
      .single();

    if (fetchError || !appointment) {
      return { success: false, error: 'Termin nicht gefunden.' };
    }

    const auth = await requireAdminAction(supabase, { salonId: appointment.salon_id });
    if (!auth.success) {
      return { success: false, error: getAdminAuthError(auth) };
    }

    if (appointment.status !== 'confirmed') {
      return { success: false, error: 'Nur bestätigte Termine können als abgeschlossen markiert werden.' };
    }

    const updateData: Record<string, any> = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: auth.context.userId,
      updated_at: new Date().toISOString(),
    };

    if (options?.actualTotalCents !== undefined) {
      updateData.actual_total_cents = options.actualTotalCents;
    }

    if (options?.notes) {
      updateData.staff_notes = options.notes;
    }

    const { error: updateError } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId);

    if (updateError) {
      console.error('Error completing appointment:', updateError);
      return { success: false, error: 'Fehler beim Abschliessen des Termins.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Complete error:', error);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

// ============================================
// ADMIN APPROVE APPOINTMENT
// ============================================

export type AdminApproveResult = {
  success: boolean;
  error?: string;
};

export async function adminApproveAppointment(
  appointmentId: string
): Promise<AdminApproveResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    // Fetch appointment with all details needed for confirmation email
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        id,
        salon_id,
        start_time,
        end_time,
        booking_number,
        customer_name,
        customer_email,
        total_cents,
        staff:staff_id (
          id,
          display_name
        ),
        appointment_services (
          service_id,
          service_name,
          duration_minutes,
          price_cents
        )
      `)
      .eq('id', appointmentId)
      .single();

    if (fetchError || !appointment) {
      console.error('[adminApproveAppointment] Fetch error:', fetchError);
      return { success: false, error: 'Termin nicht gefunden' };
    }

    const auth = await requireAdminAction(supabase, { salonId: appointment.salon_id });
    if (!auth.success) {
      return { success: false, error: getAdminAuthError(auth) };
    }

    // Update appointment as approved
    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        confirmed_by: auth.context.userId,
        is_approved: true,
        approved_at: new Date().toISOString(),
        approved_by: auth.context.userId,
      })
      .eq('id', appointmentId);

    if (error) {
      console.error('[adminApproveAppointment] Error:', error);
      return { success: false, error: error.message };
    }

    await sendAdminAppointmentConfirmationEmail(supabase, appointmentId);

    return { success: true };
  } catch (err) {
    console.error('[adminApproveAppointment] Exception:', err);
    return { success: false, error: 'Unbekannter Fehler' };
  }
}

// ============================================
// ADMIN RECORD PAYMENT
// ============================================

export interface AdminRecordPaymentInput {
  appointmentId: string;
  amountCents: number;
  paymentMethod?: string;
  notes?: string;
}

export type AdminRecordPaymentResult = {
  success: boolean;
  error?: string;
};

export async function adminRecordPayment(
  input: AdminRecordPaymentInput
): Promise<AdminRecordPaymentResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('id, salon_id')
      .eq('id', input.appointmentId)
      .single();

    if (fetchError || !appointment) {
      console.error('[adminRecordPayment] Fetch error:', fetchError);
      return { success: false, error: 'Termin nicht gefunden' };
    }

    const auth = await requireAdminAction(supabase, { salonId: appointment.salon_id });
    if (!auth.success) {
      return { success: false, error: getAdminAuthError(auth) };
    }

    const { error } = await supabase
      .from('appointments')
      .update({
        paid_amount_cents: input.amountCents,
        payment_method: input.paymentMethod || 'cash',
        payment_notes: input.notes || null,
        paid_at: new Date().toISOString(),
        paid_by: auth.context.userId,
      })
      .eq('id', input.appointmentId);

    if (error) {
      console.error('[adminRecordPayment] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[adminRecordPayment] Exception:', err);
    return { success: false, error: 'Unbekannter Fehler' };
  }
}

// ============================================
// ADMIN ASSIGN STAFF TO APPOINTMENT
// ============================================

export type AdminAssignStaffResult = {
  success: boolean;
  error?: string;
};

export async function adminAssignStaff(
  appointmentId: string,
  staffId: string
): Promise<AdminAssignStaffResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        id,
        salon_id,
        start_time,
        end_time,
        appointment_services (
          service_id
        )
      `)
      .eq('id', appointmentId)
      .single();

    if (fetchError || !appointment) {
      console.error('[adminAssignStaff] Fetch error:', fetchError);
      return { success: false, error: 'Termin nicht gefunden' };
    }

    const auth = await requireAdminAction(supabase, { salonId: appointment.salon_id });
    if (!auth.success) {
      return { success: false, error: getAdminAuthError(auth) };
    }

    const { data: selectedStaff, error: staffError } = await (supabase.from('staff') as any)
      .select('id')
      .eq('id', staffId)
      .eq('salon_id', appointment.salon_id)
      .eq('is_active', true)
      .maybeSingle();

    if (staffError || !selectedStaff) {
      console.error('[adminAssignStaff] Staff lookup error:', staffError);
      return { success: false, error: 'Mitarbeiter nicht gefunden' };
    }

    const slotValidation = await validateCalendarSlot(supabase, {
      salonId: appointment.salon_id,
      staffId,
      startTime: appointment.start_time,
      endTime: appointment.end_time,
      serviceIds: (appointment.appointment_services || [])
        .map((service: { service_id?: string | null }) => service.service_id)
        .filter((serviceId: string | null | undefined): serviceId is string => Boolean(serviceId)),
      excludeAppointmentId: appointmentId,
      checkSkills: true,
      checkWorkingHours: true,
    });

    if (!slotValidation.success) {
      return slotValidation;
    }

    const { error } = await supabase
      .from('appointments')
      .update({
        staff_id: staffId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);

    if (error) {
      console.error('[adminAssignStaff] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[adminAssignStaff] Exception:', err);
    return { success: false, error: 'Unbekannter Fehler' };
  }
}

// ============================================
// GET BOOKING RULES SETTING
// ============================================

export interface BookingRulesSettingsData {
  requireAppointmentApproval: boolean;
  minNoticeHours: number;
  maxAdvanceDays: number;
  bufferMinutes: number;
  allowSameDayBooking: boolean;
  requirePhoneForBooking: boolean;
  allowCustomerCancellation: boolean;
  cancellationDeadlineHours: number;
}

export async function getBookingRulesSettings(salonId: string): Promise<BookingRulesSettingsData> {
  const supabase = createServerClient() as any;

  const defaults: BookingRulesSettingsData = {
    requireAppointmentApproval: false,
    minNoticeHours: 24,
    maxAdvanceDays: 90,
    bufferMinutes: 15,
    allowSameDayBooking: false,
    requirePhoneForBooking: true,
    allowCustomerCancellation: true,
    cancellationDeadlineHours: 24,
  };

  if (!supabase) {
    return defaults;
  }

  try {
    const { data } = await supabase
      .from('booking_rules')
      .select(`
        require_appointment_approval,
        min_notice_hours,
        max_advance_days,
        buffer_minutes,
        allow_same_day_booking,
        require_phone_for_booking,
        allow_customer_cancellation,
        cancellation_deadline_hours
      `)
      .eq('salon_id', salonId)
      .single();

    if (!data) return defaults;

    return {
      requireAppointmentApproval: data.require_appointment_approval ?? false,
      minNoticeHours: data.min_notice_hours ?? 24,
      maxAdvanceDays: data.max_advance_days ?? 90,
      bufferMinutes: data.buffer_minutes ?? 15,
      allowSameDayBooking: data.allow_same_day_booking ?? false,
      requirePhoneForBooking: data.require_phone_for_booking ?? true,
      allowCustomerCancellation: data.allow_customer_cancellation ?? true,
      cancellationDeadlineHours: data.cancellation_deadline_hours ?? 24,
    };
  } catch {
    return defaults;
  }
}

// ============================================
// SAVE BOOKING RULES
// ============================================

export interface SaveBookingRulesInput {
  salonId: string;
  requireAppointmentApproval: boolean;
  minNoticeHours: number;
  maxAdvanceDays: number;
  bufferMinutes: number;
  allowSameDayBooking: boolean;
  requirePhoneForBooking: boolean;
  allowCustomerCancellation: boolean;
  cancellationDeadlineHours: number;
}

export type SaveBookingRulesResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveBookingRules(
  input: SaveBookingRulesInput
): Promise<SaveBookingRulesResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    const parsed = bookingRulesSettingsSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path.join('.');
        if (key) fieldErrors[key] = issue.message;
      });
      return {
        success: false,
        error: 'Bitte prüfen Sie die Buchungsregeln.',
        fieldErrors,
      };
    }

    const auth = await requireAdminAction(supabase, {
      salonId: parsed.data.salonId,
      allowedRoles: ['admin', 'manager', 'hq'],
    });
    if (!auth.success) {
      return { success: false, error: getAdminAuthError(auth) };
    }

    // Upsert - insert or update
    const { error } = await supabase
      .from('booking_rules')
      .upsert({
        salon_id: parsed.data.salonId,
        require_appointment_approval: parsed.data.requireAppointmentApproval,
        min_notice_hours: parsed.data.minNoticeHours,
        max_advance_days: parsed.data.maxAdvanceDays,
        buffer_minutes: parsed.data.bufferMinutes,
        allow_same_day_booking: parsed.data.allowSameDayBooking,
        require_phone_for_booking: parsed.data.requirePhoneForBooking,
        allow_customer_cancellation: parsed.data.allowCustomerCancellation,
        cancellation_deadline_hours: parsed.data.cancellationDeadlineHours,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'salon_id',
      });

    if (error) {
      console.error('[saveBookingRules] Error:', error);
      return { success: false, error: error.message };
    }

    revalidateBookingRulePaths();

    return { success: true };
  } catch (err) {
    console.error('[saveBookingRules] Exception:', err);
    return { success: false, error: 'Unbekannter Fehler' };
  }
}

// ============================================
// SALON CLOSURES (Betriebsferien)
// ============================================

export interface SalonClosure {
  id: string;
  startTime: Date;
  endTime: Date;
  reason: string | null;
  createdAt: Date;
}

export async function getSalonClosures(
  salonId: string = DEFAULT_SALON_ID
): Promise<SalonClosure[]> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('blocked_times')
    .select('id, start_time, end_time, reason, created_at')
    .eq('salon_id', salonId)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('[getSalonClosures] Error:', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    startTime: new Date(row.start_time),
    endTime: new Date(row.end_time),
    reason: row.reason,
    createdAt: new Date(row.created_at),
  }));
}

export interface CreateSalonClosureInput {
  salonId: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  reason?: string;
}

export interface CreateSalonClosureResult {
  success: boolean;
  error?: string;
  id?: string;
}

export async function createSalonClosure(
  input: CreateSalonClosureInput
): Promise<CreateSalonClosureResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    const { data, error } = await supabase
      .from('blocked_times')
      .insert({
        salon_id: input.salonId,
        start_time: input.startTime,
        end_time: input.endTime,
        block_type: 'vacation',
        reason: input.reason || 'Betriebsferien',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[createSalonClosure] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (err) {
    console.error('[createSalonClosure] Exception:', err);
    return { success: false, error: 'Unbekannter Fehler' };
  }
}

export interface UpdateSalonClosureInput {
  id: string;
  startTime: string;
  endTime: string;
  reason?: string;
}

export interface UpdateSalonClosureResult {
  success: boolean;
  error?: string;
}

export async function updateSalonClosure(
  input: UpdateSalonClosureInput
): Promise<UpdateSalonClosureResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    const { error } = await supabase
      .from('blocked_times')
      .update({
        start_time: input.startTime,
        end_time: input.endTime,
        reason: input.reason || 'Betriebsferien',
      })
      .eq('id', input.id);

    if (error) {
      console.error('[updateSalonClosure] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[updateSalonClosure] Exception:', err);
    return { success: false, error: 'Unbekannter Fehler' };
  }
}

export interface DeleteSalonClosureResult {
  success: boolean;
  error?: string;
}

export async function deleteSalonClosure(
  id: string
): Promise<DeleteSalonClosureResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    const { error } = await supabase
      .from('blocked_times')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[deleteSalonClosure] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[deleteSalonClosure] Exception:', err);
    return { success: false, error: 'Unbekannter Fehler' };
  }
}
