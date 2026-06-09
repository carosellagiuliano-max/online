import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getCurrentStaffMember } from '@/lib/auth/rbac';
import { resolveStaffSalonId } from '@/lib/auth/admin-context';
import { AdminCustomerList } from '@/components/admin/admin-customer-list';

// Force dynamic rendering (API not available at build time)
export const dynamic = 'force-dynamic';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Kundenverwaltung',
};

// ============================================
// DATA FETCHING
// ============================================

function sanitizeSearchTerm(value: string): string {
  return value.replace(/[,%()]/g, ' ').trim();
}

type CustomerListRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  profile: {
    email: string | null;
    phone: string | null;
    is_deleted?: boolean | null;
  } | null;
  created_at: string;
  is_active: boolean;
};

type CustomerStats = {
  totalCustomers: number;
  activeCustomers: number;
  withAccount: number;
  withoutAccount: number;
  totalAppointments: number;
};

type AppointmentServiceOption = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
};

type AppointmentStaffOption = {
  id: string;
  display_name: string;
  salon_id: string;
  color: string | null;
};

type AppointmentStaffSkill = {
  staff_id: string;
  service_id: string;
};

type AppointmentStaffWorkingHour = {
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type OpeningHourOption = {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isOpen: boolean;
  hasLunchBreak: boolean;
  lunchStart: string | null;
  lunchEnd: string | null;
};

type CustomerAppointmentOptions = {
  salonTimeZone: string;
  services: AppointmentServiceOption[];
  staff: AppointmentStaffOption[];
  staffSkills: AppointmentStaffSkill[];
  staffWorkingHours: AppointmentStaffWorkingHour[];
  openingHours: OpeningHourOption[];
};

async function getCustomersData(searchParams: {
  search?: string;
  page?: string;
  limit?: string;
}) {
  const staffMember = await getCurrentStaffMember();
  if (!staffMember) {
    redirect('/admin/login');
  }

  const salonId = resolveStaffSalonId(staffMember.salon_id);
  const supabase = createServiceRoleClient();

  if (!supabase) {
    console.error('Error: Database client not available');
    return {
      salonId,
      customers: [],
      total: 0,
      page: 1,
      limit: 20,
      stats: {
        totalCustomers: 0,
        activeCustomers: 0,
        withAccount: 0,
        withoutAccount: 0,
        totalAppointments: 0,
      },
      appointmentOptions: {
        salonTimeZone: 'Europe/Zurich',
        services: [],
        staff: [],
        staffSkills: [],
        staffWorkingHours: [],
        openingHours: [],
      },
    };
  }

  const page = parseInt(searchParams.page || '1');
  const limit = parseInt(searchParams.limit || '20');
  const offset = (page - 1) * limit;
  const search = sanitizeSearchTerm(searchParams.search || '');

  let profileIds: string[] = [];
  if (search) {
    const { data: matchingProfiles, error: profileSearchError } = await (supabase.from('profiles') as any)
      .select('id')
      .ilike('email', `%${search}%`)
      .limit(100) as { data: { id: string }[] | null; error: { message?: string } | null };

    if (profileSearchError) {
      console.error('Error searching customer profiles:', profileSearchError);
    } else {
      profileIds = (matchingProfiles || []).map((profile) => profile.id);
    }
  }

  // First get customers
  let query = (supabase.from('customers') as any)
    .select(
      `
      id,
      first_name,
      last_name,
      email,
      phone,
      created_at,
      is_active,
      profile:profiles!profile_id (
        email,
        phone,
        is_deleted
      )
    `,
      { count: 'exact' }
    )
    .eq('salon_id', salonId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    const filters = [
      `first_name.ilike.%${search}%`,
      `last_name.ilike.%${search}%`,
      `email.ilike.%${search}%`,
    ];

    if (profileIds.length > 0) {
      filters.push(`profile_id.in.(${profileIds.join(',')})`);
    }

    query = query.or(filters.join(','));
  }

  const { data, count, error } = await query as {
    data: CustomerListRow[] | null;
    count: number | null;
    error: { message?: string } | null;
  };

  if (error) {
    console.error('Error fetching customers:', error);
    return {
      salonId,
      customers: [],
      total: 0,
      page,
      limit,
      stats: {
        totalCustomers: 0,
        activeCustomers: 0,
        withAccount: 0,
        withoutAccount: 0,
        totalAppointments: 0,
      },
      appointmentOptions: {
        salonTimeZone: 'Europe/Zurich',
        services: [],
        staff: [],
        staffSkills: [],
        staffWorkingHours: [],
        openingHours: [],
      },
    };
  }

  // Get appointment counts - exclude cancelled appointments (matches detail page logic)
  const customerIds = (data || []).map((c) => c.id);

  let appointmentCounts: Record<string, number> = {};
  if (customerIds.length > 0) {
    const { data: countData } = await (supabase.from('appointments') as any)
      .select('customer_id, status')
      .eq('salon_id', salonId)
      .in('customer_id', customerIds)
      .neq('status', 'cancelled') as { data: { customer_id: string | null }[] | null };

    // Count appointments per customer
    if (countData) {
      appointmentCounts = countData.reduce((acc, apt) => {
        if (apt.customer_id) {
          acc[apt.customer_id] = (acc[apt.customer_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
    }
  }

  // Add appointment counts to customer data
  const customersWithCounts = (data || []).map((customer) => ({
    ...customer,
    appointments: [{ count: appointmentCounts[customer.id] || 0 }],
  }));

  const [
    { count: totalCustomers },
    { count: activeCustomers },
    { count: withAccount },
    { count: totalAppointments },
    { data: salonData },
    { data: servicesData },
    { data: staffData },
    { data: openingHoursData },
  ] = await Promise.all([
    (supabase.from('customers') as any)
      .select('id', { count: 'exact', head: true })
      .eq('salon_id', salonId)
      .is('deleted_at', null),
    (supabase.from('customers') as any)
      .select('id', { count: 'exact', head: true })
      .eq('salon_id', salonId)
      .is('deleted_at', null)
      .eq('is_active', true),
    (supabase.from('customers') as any)
      .select('id', { count: 'exact', head: true })
      .eq('salon_id', salonId)
      .is('deleted_at', null)
      .not('profile_id', 'is', null),
    (supabase.from('appointments') as any)
      .select('id', { count: 'exact', head: true })
      .eq('salon_id', salonId)
      .neq('status', 'cancelled'),
    (supabase.from('salons') as any)
      .select('timezone')
      .eq('id', salonId)
      .maybeSingle(),
    (supabase.from('services') as any)
      .select('id, name, duration_minutes, price_cents')
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .order('name'),
    (supabase.from('staff') as any)
      .select('id, display_name, salon_id, color')
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .eq('is_bookable', true)
      .order('display_name'),
    (supabase.from('opening_hours') as any)
      .select('day_of_week, open_time, close_time, is_open, has_lunch_break, lunch_start, lunch_end')
      .eq('salon_id', salonId)
      .order('day_of_week'),
  ]);

  const appointmentStaff = (staffData || []) as AppointmentStaffOption[];
  const appointmentStaffIds = appointmentStaff.map((staff) => staff.id);

  const [{ data: staffSkillsData }, { data: staffWorkingHoursData }] = appointmentStaffIds.length > 0
    ? await Promise.all([
        (supabase.from('staff_service_skills') as any)
          .select('staff_id, service_id')
          .in('staff_id', appointmentStaffIds),
        (supabase.from('staff_working_hours') as any)
          .select('staff_id, day_of_week, start_time, end_time')
          .in('staff_id', appointmentStaffIds),
      ])
    : [{ data: [] }, { data: [] }];

  const stats: CustomerStats = {
    totalCustomers: totalCustomers || 0,
    activeCustomers: activeCustomers || 0,
    withAccount: withAccount || 0,
    withoutAccount: Math.max(0, (totalCustomers || 0) - (withAccount || 0)),
    totalAppointments: totalAppointments || 0,
  };

  const appointmentOptions: CustomerAppointmentOptions = {
    salonTimeZone: (salonData as { timezone?: string } | null)?.timezone || 'Europe/Zurich',
    services: (servicesData || []) as AppointmentServiceOption[],
    staff: appointmentStaff,
    staffSkills: (staffSkillsData || []) as AppointmentStaffSkill[],
    staffWorkingHours: (staffWorkingHoursData || []) as AppointmentStaffWorkingHour[],
    openingHours: (openingHoursData || []).map((hours: any) => ({
      dayOfWeek: hours.day_of_week,
      openTime: hours.open_time?.substring(0, 5) || null,
      closeTime: hours.close_time?.substring(0, 5) || null,
      isOpen: Boolean(hours.is_open),
      hasLunchBreak: Boolean(hours.has_lunch_break),
      lunchStart: hours.lunch_start?.substring(0, 5) || null,
      lunchEnd: hours.lunch_end?.substring(0, 5) || null,
    })),
  };

  return {
    salonId,
    customers: customersWithCounts,
    total: count || 0,
    page,
    limit,
    stats,
    appointmentOptions,
  };
}

// ============================================
// ADMIN CUSTOMERS PAGE
// ============================================

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; limit?: string }>;
}) {
  const params = await searchParams;
  const { customers, total, page, limit, stats, appointmentOptions } = await getCustomersData(params);

  return (
    <AdminCustomerList
      customers={customers}
      total={total}
      page={page}
      limit={limit}
      initialSearch={params.search || ''}
      stats={stats}
      appointmentOptions={appointmentOptions}
    />
  );
}
