import type { Metadata } from 'next';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getCurrentStaffMember } from '@/lib/auth/rbac';
import { AdminFullCalendar } from '@/components/admin/admin-fullcalendar';

// Force dynamic rendering (API not available at build time)
export const dynamic = 'force-dynamic';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Kalender',
};

// ============================================
// DATA FETCHING
// ============================================

const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';
const DEFAULT_TIME_ZONE = 'Europe/Zurich';

async function getCalendarData() {
  const currentStaff = await getCurrentStaffMember();

  if (!currentStaff) {
    return {
      salonId: DEFAULT_SALON_ID,
      salonTimeZone: DEFAULT_TIME_ZONE,
      staff: [],
      services: [],
      staffSkills: [],
      staffWorkingHours: [],
      openingHours: [],
      requireAppointmentApproval: false,
      salonClosures: [],
    };
  }

  const salonId = currentStaff.salon_id === 'all' ? DEFAULT_SALON_ID : currentStaff.salon_id;

  // Use service role client after the page-level auth check; every query below is scoped.
  const supabase = createServiceRoleClient() as any;

  if (!supabase) {
    return {
      salonId,
      salonTimeZone: DEFAULT_TIME_ZONE,
      staff: [],
      services: [],
      staffSkills: [],
      staffWorkingHours: [],
      openingHours: [],
      requireAppointmentApproval: false,
      salonClosures: [],
    };
  }

  const [{ data: salonData }, { data: openingHoursData }] = await Promise.all([
    supabase
      .from('salons')
      .select('timezone')
      .eq('id', salonId)
      .maybeSingle(),
    supabase
      .from('opening_hours')
      .select('day_of_week, open_time, close_time, is_open, has_lunch_break, lunch_start, lunch_end')
      .eq('salon_id', salonId)
      .order('day_of_week'),
  ]);

  // Get staff members for the current salon with their skills
  const { data: staffData } = await supabase
    .from('staff')
    .select('id, display_name, color, is_active, salon_id')
    .eq('salon_id', salonId)
    .eq('is_active', true)
    .order('display_name');

  const staffIds = (staffData || []).map((member: { id: string }) => member.id);

  // Get staff service skills
  const { data: staffSkillsData } = staffIds.length > 0
    ? await supabase
        .from('staff_service_skills')
        .select('staff_id, service_id')
        .in('staff_id', staffIds)
    : { data: [] };

  // Get staff working hours
  const { data: staffWorkingHoursData } = staffIds.length > 0
    ? await supabase
        .from('staff_working_hours')
        .select('staff_id, day_of_week, start_time, end_time')
        .in('staff_id', staffIds)
    : { data: [] };

  // Get salon services
  const { data: servicesData } = await supabase
    .from('services')
    .select('id, name, duration_minutes, price_cents, is_active')
    .eq('salon_id', salonId)
    .eq('is_active', true)
    .order('name');

  // Get booking rules for approval setting
  const { data: bookingRules } = await supabase
    .from('booking_rules')
    .select('require_appointment_approval')
    .eq('salon_id', salonId)
    .single();

  // Get salon closures (Betriebsferien)
  const { data: salonClosuresData } = await supabase
    .from('blocked_times')
    .select('id, start_time, end_time, reason')
    .eq('salon_id', salonId)
    .order('start_time', { ascending: true });

  return {
    salonId,
    salonTimeZone: (salonData as { timezone?: string } | null)?.timezone || DEFAULT_TIME_ZONE,
    staff: (staffData || []) as Array<{
      id: string;
      display_name: string;
      color: string | null;
      is_active: boolean;
      salon_id: string;
    }>,
    services: (servicesData || []) as Array<{
      id: string;
      name: string;
      duration_minutes: number;
      price_cents: number;
      is_active: boolean;
    }>,
    staffSkills: (staffSkillsData || []) as Array<{
      staff_id: string;
      service_id: string;
    }>,
    staffWorkingHours: (staffWorkingHoursData || []) as Array<{
      staff_id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>,
    openingHours: (openingHoursData || []).map((hours: any) => ({
      dayOfWeek: hours.day_of_week,
      openTime: hours.open_time?.substring(0, 5) || null,
      closeTime: hours.close_time?.substring(0, 5) || null,
      isOpen: Boolean(hours.is_open),
      hasLunchBreak: Boolean(hours.has_lunch_break),
      lunchStart: hours.lunch_start?.substring(0, 5) || null,
      lunchEnd: hours.lunch_end?.substring(0, 5) || null,
    })),
    requireAppointmentApproval: (bookingRules as { require_appointment_approval?: boolean } | null)?.require_appointment_approval ?? false,
    salonClosures: (salonClosuresData || []).map((closure: any) => ({
      id: closure.id,
      startTime: closure.start_time,
      endTime: closure.end_time,
      reason: closure.reason,
    })),
  };
}

// ============================================
// ADMIN CALENDAR PAGE
// ============================================

export default async function AdminCalendarPage() {
  const {
    salonId,
    salonTimeZone,
    staff,
    services,
    staffSkills,
    staffWorkingHours,
    openingHours,
    requireAppointmentApproval,
    salonClosures,
  } = await getCalendarData();

  return (
    <AdminFullCalendar
      salonId={salonId}
      salonTimeZone={salonTimeZone}
      staff={staff}
      services={services}
      staffSkills={staffSkills}
      staffWorkingHours={staffWorkingHours}
      openingHours={openingHours}
      requireAppointmentApproval={requireAppointmentApproval}
      salonClosures={salonClosures}
    />
  );
}
