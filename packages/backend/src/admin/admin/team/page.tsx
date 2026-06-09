import type { Metadata } from 'next';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { protectManagerPage, type StaffMember as CurrentStaffMember } from '@/lib/auth/rbac';
import { AdminTeamView } from '@/components/admin/admin-team-view';
import { getAdminStaffAbsences } from '@/lib/actions/staff';

// Force dynamic rendering (API not available at build time)
export const dynamic = 'force-dynamic';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Team & Mitarbeiter',
};

// ============================================
// TYPES
// ============================================

interface StaffSkill {
  staff_id: string;
  service_id: string;
  skill_level: number | null;
}

interface WorkingHour {
  id: string;
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

// ============================================
// DATA FETCHING
// ============================================

const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';

async function getTeamData(currentStaff: CurrentStaffMember) {
  const salonId = currentStaff?.salon_id === 'all'
    ? DEFAULT_SALON_ID
    : currentStaff?.salon_id || DEFAULT_SALON_ID;
  const supabase = createServiceRoleClient();

  if (!supabase) {
    console.error('Supabase client not available');
    return { staff: [], services: [], absences: [], skills: [] as StaffSkill[], workingHours: [] as WorkingHour[] };
  }

  // Fetch staff members
  const { data: staffData, error } = await supabase
    .from('staff')
    .select(
      `
      id,
      salon_id,
      profile_id,
      display_name,
      email,
      phone,
      role,
      color,
      is_active,
      created_at,
      default_schedule,
      employment_type,
      hire_date,
      bio,
      specializations,
      avatar_url
    `
    )
    .eq('salon_id', salonId)
    .order('display_name');

  if (error) {
    console.error('Error fetching staff:', error);
    return { staff: [], services: [], absences: [], skills: [] as StaffSkill[], workingHours: [] as WorkingHour[] };
  }

  // Fetch services for skills
  const { data: servicesData } = await supabase
    .from('services')
    .select('id, name, duration_minutes')
    .eq('salon_id', salonId)
    .eq('is_active', true)
    .order('name');

  const absencesResult = await getAdminStaffAbsences(salonId);
  const absencesData = absencesResult.success ? absencesResult.data : [];

  const staffIds = (staffData || []).map((member: { id: string }) => member.id);

  // Fetch staff skills
  const { data: skillsData } = staffIds.length > 0
    ? await supabase
        .from('staff_service_skills')
        .select('staff_id, service_id, skill_level')
        .in('staff_id', staffIds) as { data: StaffSkill[] | null }
    : { data: [] as StaffSkill[] };

  // Fetch working hours
  const { data: workingHoursData } = staffIds.length > 0
    ? await supabase
        .from('staff_working_hours')
        .select('*')
        .in('staff_id', staffIds) as { data: WorkingHour[] | null }
    : { data: [] as WorkingHour[] };

  return {
    staff: staffData || [],
    services: servicesData || [],
    absences: absencesData || [],
    skills: (skillsData || []) as StaffSkill[],
    workingHours: (workingHoursData || []) as WorkingHour[],
  };
}

// ============================================
// ADMIN TEAM PAGE
// ============================================

export default async function AdminTeamPage() {
  const currentStaff = await protectManagerPage();
  const { staff, services, absences, skills, workingHours } = await getTeamData(currentStaff);

  return (
    <AdminTeamView
      staff={staff}
      services={services}
      absences={absences}
      skills={skills}
      workingHours={workingHours}
    />
  );
}
