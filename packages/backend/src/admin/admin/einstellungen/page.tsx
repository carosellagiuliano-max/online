import type { Metadata } from 'next';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { protectManagerPage } from '@/lib/auth/rbac';
import { AdminSettingsView } from '@/components/admin/admin-settings-view';

// Force dynamic rendering (API not available at build time)
export const dynamic = 'force-dynamic';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Einstellungen',
};

// ============================================
// DATA FETCHING
// ============================================

const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';

type OpeningHourRow = {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_open: boolean | null;
  has_lunch_break: boolean | null;
  lunch_start: string | null;
  lunch_end: string | null;
};

async function getSettingsData() {
  const currentStaff = await protectManagerPage();
  const salonId = currentStaff?.salon_id === 'all'
    ? DEFAULT_SALON_ID
    : currentStaff.salon_id;
  const supabase = createServiceRoleClient();

  if (!supabase) {
    console.error('Supabase client not available');
    return {
      salon: null,
      services: [],
      categories: [],
      openingHours: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        openTime: '09:00',
        closeTime: '18:00',
        isOpen: dayOfWeek !== 0,
        hasLunchBreak: false,
        lunchStart: null,
        lunchEnd: null,
      })),
      socialLinks: [],
    };
  }

  // Get salon settings
  const { data: salonData } = await supabase
    .from('salons')
    .select(`
      id,
      name,
      slug,
      email,
      phone,
      address,
      city,
      postal_code,
      website,
      description,
      opening_hours,
      is_active,
      logo_url,
      tagline,
      footer_description,
      hero_tagline,
      hero_headline,
      hero_headline_accent,
      hero_description,
      hero_image_url,
      about_hero_tagline,
      about_hero_headline,
      about_hero_description,
      about_hero_image_url,
      show_values_section,
      show_milestones_section,
      team_hero_headline,
      team_hero_description,
      team_hero_benefits,
      team_hero_image_url
    `)
    .eq('id', salonId)
    .single();
  const salon = salonData as { id: string } | null;
  const effectiveSalonId = salon?.id || salonId;

  // Get opening hours (including lunch break)
  const { data: openingHoursData } = await supabase
    .from('opening_hours')
    .select('day_of_week, open_time, close_time, is_open, has_lunch_break, lunch_start, lunch_end')
    .eq('salon_id', effectiveSalonId)
    .order('day_of_week');

  // Get salon closures (Betriebsferien)
  const { data: salonClosuresData } = await supabase
    .from('blocked_times')
    .select('id, start_time, end_time, reason, created_at')
    .eq('salon_id', effectiveSalonId)
    .order('start_time', { ascending: true });

  // Get services with category info
  const { data: servicesData } = await supabase
    .from('services')
    .select(`
      id,
      name,
      slug,
      description,
      category_id,
      duration_minutes,
      price_cents,
      price_from,
      has_length_variants,
      is_bookable_online,
      is_active,
      sort_order,
      service_categories (
        id,
        name
      )
    `)
    .eq('salon_id', effectiveSalonId)
    .order('sort_order', { ascending: true });

  // Get categories for dropdown
  const { data: categoriesData } = await supabase
    .from('service_categories')
    .select('id, name, slug, description, sort_order')
    .eq('salon_id', effectiveSalonId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const serviceIds = (servicesData || []).map((service: { id: string }) => service.id);
  const { data: serviceSkillsData } = serviceIds.length > 0
    ? await supabase
        .from('staff_service_skills')
        .select(`
          service_id,
          staff!inner (
            salon_id,
            is_active,
            is_bookable
          )
        `)
        .in('service_id', serviceIds)
        .eq('staff.salon_id', effectiveSalonId)
        .eq('staff.is_active', true)
        .eq('staff.is_bookable', true)
    : { data: [] };

  const serviceStaffCountById = new Map<string, number>();
  (serviceSkillsData || []).forEach((skill: { service_id: string }) => {
    serviceStaffCountById.set(
      skill.service_id,
      (serviceStaffCountById.get(skill.service_id) || 0) + 1
    );
  });

  // Get social links
  const { data: socialLinksData } = await supabase
    .from('social_links')
    .select('id, platform, url, is_enabled, sort_order')
    .eq('salon_id', effectiveSalonId)
    .order('sort_order', { ascending: true });

  // Get booking rules
  const { data: bookingRulesData } = await supabase
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
    .eq('salon_id', effectiveSalonId)
    .single();

  // Get about values
  const { data: aboutValuesData } = await supabase
    .from('about_values')
    .select('*')
    .eq('salon_id', effectiveSalonId)
    .order('sort_order', { ascending: true });

  // Get about milestones
  const { data: aboutMilestonesData } = await supabase
    .from('about_milestones')
    .select('*')
    .eq('salon_id', effectiveSalonId)
    .order('sort_order', { ascending: true });

  // Transform services data
  const services = (servicesData || []).map((svc: any) => ({
    id: svc.id,
    name: svc.name,
    slug: svc.slug,
    description: svc.description,
    categoryId: svc.category_id,
    categoryName: svc.service_categories?.name || null,
    durationMinutes: svc.duration_minutes,
    priceCents: svc.price_cents,
    priceFrom: svc.price_from || false,
    hasLengthVariants: svc.has_length_variants || false,
    isBookableOnline: svc.is_bookable_online,
    isActive: svc.is_active,
    sortOrder: svc.sort_order,
    assignedStaffCount: serviceStaffCountById.get(svc.id) || 0,
  }));

  // Transform categories data
  const categories = (categoriesData || []).map((cat: any) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    sortOrder: cat.sort_order,
  }));

  // Transform opening hours - create default if not found
  const openingHoursRows = (openingHoursData || []) as OpeningHourRow[];
  const openingHours = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
    const found = openingHoursRows.find((oh) => oh.day_of_week === dayOfWeek);
    return {
      dayOfWeek,
      openTime: found?.open_time?.substring(0, 5) || '09:00',
      closeTime: found?.close_time?.substring(0, 5) || '18:00',
      isOpen: found?.is_open ?? (dayOfWeek !== 0), // Sunday closed by default
      hasLunchBreak: found?.has_lunch_break ?? false,
      lunchStart: found?.lunch_start?.substring(0, 5) || null,
      lunchEnd: found?.lunch_end?.substring(0, 5) || null,
    };
  });

  // Transform salon closures
  const salonClosures = (salonClosuresData || []).map((closure: any) => ({
    id: closure.id,
    startTime: closure.start_time,
    endTime: closure.end_time,
    reason: closure.reason,
    createdAt: closure.created_at,
  }));

  // Transform social links data
  const socialLinks = (socialLinksData || []).map((link: any) => ({
    id: link.id,
    platform: link.platform,
    url: link.url,
    isEnabled: link.is_enabled,
    sortOrder: link.sort_order,
  }));

  // Transform booking rules
  const bookingRulesRow = bookingRulesData as any | null;
  const bookingRules = bookingRulesRow ? {
    requireAppointmentApproval: bookingRulesRow.require_appointment_approval ?? false,
    minNoticeHours: bookingRulesRow.min_notice_hours ?? 24,
    maxAdvanceDays: bookingRulesRow.max_advance_days ?? 90,
    bufferMinutes: bookingRulesRow.buffer_minutes ?? 15,
    allowSameDayBooking: bookingRulesRow.allow_same_day_booking ?? false,
    requirePhoneForBooking: bookingRulesRow.require_phone_for_booking ?? true,
    allowCustomerCancellation: bookingRulesRow.allow_customer_cancellation ?? true,
    cancellationDeadlineHours: bookingRulesRow.cancellation_deadline_hours ?? 24,
  } : undefined;

  // Transform about values
  const aboutValues = (aboutValuesData || []).map((value: any) => ({
    id: value.id,
    title: value.title,
    description: value.description,
    icon: value.icon,
    sortOrder: value.sort_order,
    isActive: value.is_active,
  }));

  // Transform about milestones
  const aboutMilestones = (aboutMilestonesData || []).map((milestone: any) => ({
    id: milestone.id,
    year: milestone.year,
    title: milestone.title,
    description: milestone.description,
    sortOrder: milestone.sort_order,
    isActive: milestone.is_active,
  }));

  return {
    salon,
    services,
    categories,
    openingHours,
    socialLinks,
    bookingRules,
    salonClosures,
    aboutValues,
    aboutMilestones,
  };
}

// ============================================
// ADMIN SETTINGS PAGE
// ============================================

export default async function AdminSettingsPage() {
  const { salon, services, categories, openingHours, socialLinks, bookingRules, salonClosures, aboutValues, aboutMilestones } = await getSettingsData();

  return (
    <AdminSettingsView
      salon={salon}
      services={services}
      categories={categories}
      openingHours={openingHours}
      socialLinks={socialLinks}
      bookingRulesData={bookingRules}
      salonClosures={salonClosures}
      aboutValues={aboutValues}
      aboutMilestones={aboutMilestones}
    />
  );
}
