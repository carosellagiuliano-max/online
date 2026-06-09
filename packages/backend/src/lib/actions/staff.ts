'use server';

import { createServerClient } from '@/lib/db/client';
import { revalidatePath, revalidateTag } from 'next/cache';
import { requireAdminAction } from './admin-auth';
import { z } from 'zod';

// ============================================
// STAFF DATA SERVER ACTIONS
// ============================================

// Default salon ID for BeautifyPRO (from seed data)
const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';
const STAFF_ADMIN_ROLES = ['admin', 'manager', 'hq'];
const STAFF_ROLES = ['admin', 'manager', 'staff'] as const;
const ABSENCE_TYPES = ['vacation', 'sick', 'personal', 'training', 'other'] as const;
const ABSENCE_STATUSES = ['pending', 'approved', 'rejected'] as const;
const ACTIVE_APPOINTMENT_STATUSES = ['reserved', 'requested', 'confirmed'];

type DbClient = NonNullable<ReturnType<typeof createServerClient>>;

export type StaffMember = {
  id: string;
  displayName: string;
  jobTitle: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isBookable: boolean;
  sortOrder: number;
  specialties: string[];
};

export type StaffWorkingHours = {
  staffId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type StaffAbsence = {
  staffId: string;
  startDate: string;
  endDate: string;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
};

export type StaffAbsenceConflict = {
  appointmentId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  customerName?: string;
};

export type StaffMutationResult<T = boolean> =
  | {
      success: true;
      data: T;
      error?: never;
      fieldErrors?: never;
      conflicts?: never;
    }
  | {
      success: false;
      data?: never;
      error: string;
      fieldErrors?: Record<string, string>;
      conflicts?: StaffAbsenceConflict[];
    };

export type AdminStaffInput = {
  displayName: string;
  email?: string | null;
  phone?: string | null;
  role: 'admin' | 'manager' | 'staff';
  color?: string | null;
  employmentType?: 'full_time' | 'part_time' | 'contractor' | 'apprentice';
};

export type AdminWorkingHourInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

export type AdminAbsenceInput = {
  staffId: string;
  startDate: string;
  endDate: string;
  absenceType: 'vacation' | 'sick' | 'personal' | 'training' | 'other';
  notes?: string | null;
  status?: 'pending' | 'approved' | 'rejected';
};

export type AdminStaffAbsenceRecord = {
  id: string;
  staff_id: string;
  start_date: string;
  end_date: string;
  absence_type: 'vacation' | 'sick' | 'personal' | 'training' | 'other';
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
};

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Bitte ein gültiges Datum angeben');

const absenceInputSchema = z
  .object({
    staffId: z.string().uuid('Ungültige Mitarbeiter-ID'),
    startDate: dateOnlySchema,
    endDate: dateOnlySchema,
    absenceType: z.enum(ABSENCE_TYPES),
    status: z.enum(ABSENCE_STATUSES).default('approved'),
    notes: z
      .string()
      .trim()
      .max(500, 'Notizen dürfen maximal 500 Zeichen lang sein')
      .optional()
      .nullable(),
  })
  .refine((input) => input.endDate >= input.startDate, {
    path: ['endDate'],
    message: 'Enddatum darf nicht vor dem Startdatum liegen',
  });

// ============================================
// GET STAFF MEMBERS (Fresh - no caching)
// ============================================

interface StaffRow {
  id: string;
  display_name: string;
  job_title: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_bookable: boolean;
  sort_order: number;
  specialties: string[] | null;
}

export async function getStaffMembers(salonId: string = DEFAULT_SALON_ID): Promise<StaffMember[]> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('staff') as any)
    .select(`
      id,
      display_name,
      job_title,
      bio,
      avatar_url,
      is_bookable,
      sort_order,
      specialties
    `)
    .eq('salon_id', salonId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error || !data) {
    console.error('Error fetching staff:', error);
    return [];
  }

  return (data as StaffRow[]).map((member) => ({
    id: member.id,
    displayName: member.display_name,
    jobTitle: member.job_title,
    bio: member.bio,
    avatarUrl: member.avatar_url,
    isBookable: member.is_bookable,
    sortOrder: member.sort_order,
    specialties: member.specialties || [],
  }));
}

// ============================================
// GET BOOKABLE STAFF (for booking flow)
// ============================================

export async function getBookableStaff(salonId: string = DEFAULT_SALON_ID): Promise<StaffMember[]> {
  const allStaff = await getStaffMembers(salonId);
  return allStaff.filter((member) => member.isBookable);
}

// ============================================
// GET STAFF WORKING HOURS
// ============================================

interface WorkingHoursRow {
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export async function getStaffWorkingHours(salonId: string = DEFAULT_SALON_ID): Promise<StaffWorkingHours[]> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('staff_working_hours') as any)
    .select(`
      staff_id,
      day_of_week,
      start_time,
      end_time,
      staff!inner(salon_id)
    `)
    .eq('staff.salon_id', salonId);

  if (error || !data) {
    console.error('Error fetching staff working hours:', error);
    return [];
  }

  return (data as WorkingHoursRow[]).map((row) => ({
    staffId: row.staff_id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
  }));
}

// ============================================
// GET STAFF ABSENCES (for date range)
// ============================================

interface AbsenceRow {
  staff_id: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
}

export async function getStaffAbsences(
  salonId: string = DEFAULT_SALON_ID,
  startDate: string,
  endDate: string
): Promise<StaffAbsence[]> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('staff_absences') as any)
    .select(`
      staff_id,
      start_date,
      end_date,
      notes,
      status
    `)
    .eq('salon_id', salonId)
    .eq('status', 'approved')
    .lte('start_date', endDate)
    .gte('end_date', startDate);

  if (error || !data) {
    console.error('Error fetching staff absences:', error);
    return [];
  }

  return (data as AbsenceRow[]).map((row) => ({
    staffId: row.staff_id,
    startDate: row.start_date,
    endDate: row.end_date,
    notes: row.notes,
    status: row.status,
  }));
}

// ============================================
// GET STAFF SKILLS (services they can perform)
// ============================================

interface SkillRow {
  staff_id: string;
  service_id: string;
}

export async function getStaffSkills(salonId: string = DEFAULT_SALON_ID): Promise<Map<string, string[]>> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('staff_service_skills') as any)
    .select(`
      staff_id,
      service_id,
      staff!inner(salon_id)
    `)
    .eq('staff.salon_id', salonId);

  if (error || !data) {
    console.error('Error fetching staff skills:', error);
    return new Map();
  }

  const skillsMap = new Map<string, string[]>();

  (data as SkillRow[]).forEach((row) => {
    const existing = skillsMap.get(row.staff_id) || [];
    existing.push(row.service_id);
    skillsMap.set(row.staff_id, existing);
  });

  return skillsMap;
}

// ============================================
// ADMIN STAFF MUTATIONS
// ============================================

function getEffectiveSalonId(salonId: string | null | undefined): string {
  return !salonId || salonId === 'all' ? DEFAULT_SALON_ID : salonId;
}

function normalizeOptionalText(value?: string | null): string | null {
  return value?.trim() || null;
}

function normalizeOptionalEmail(value?: string | null): string | null {
  return value?.trim().toLowerCase() || null;
}

function isValidTime(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value);
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function validateStaffInput(input: AdminStaffInput): string | null {
  if (!input.displayName?.trim()) return 'Bitte geben Sie einen Namen ein';
  if (!STAFF_ROLES.includes(input.role)) return 'Ungültige Rolle';
  if (
    input.employmentType &&
    !['full_time', 'part_time', 'contractor', 'apprentice'].includes(input.employmentType)
  ) {
    return 'Ungültige Anstellungsart';
  }
  return null;
}

function validateWorkingHours(hours: AdminWorkingHourInput[]): string | null {
  const seenDays = new Set<number>();

  for (const hour of hours) {
    if (!Number.isInteger(hour.dayOfWeek) || hour.dayOfWeek < 0 || hour.dayOfWeek > 6) {
      return 'Ungültiger Wochentag';
    }
    if (seenDays.has(hour.dayOfWeek)) {
      return 'Arbeitszeiten enthalten doppelte Wochentage';
    }
    seenDays.add(hour.dayOfWeek);

    if (!isValidTime(hour.startTime) || !isValidTime(hour.endTime)) {
      return 'Ungültiges Zeitformat';
    }
    if (hour.isActive && hour.endTime <= hour.startTime) {
      return 'Endzeit muss nach Startzeit liegen';
    }
  }

  return null;
}

function validateAbsenceInput(input: AdminAbsenceInput): string | null {
  const parsed = absenceInputSchema.safeParse(input);
  return parsed.success ? null : parsed.error.issues[0]?.message || 'Ungültige Abwesenheit';
}

async function getStaffForAdmin(supabase: DbClient, staffId: string) {
  const { data, error } = await (supabase.from('staff') as any)
    .select('id, salon_id, profile_id, role')
    .eq('id', staffId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as { id: string; salon_id: string; profile_id: string | null; role: string | null };
}

async function requireStaffManager(
  supabase: DbClient,
  salonId?: string
): Promise<StaffMutationResult<{ userId: string; staffId: string; salonId: string; role: string }>> {
  const auth = await requireAdminAction(supabase, {
    salonId,
    allowedRoles: STAFF_ADMIN_ROLES,
  });

  if (!auth.success) {
    return { success: false, error: 'error' in auth ? auth.error : 'Keine Berechtigung für diese Aktion' };
  }

  return {
    success: true,
    data: {
      userId: auth.context.userId,
      staffId: auth.context.staffId,
      salonId: getEffectiveSalonId(auth.context.salonId),
      role: auth.context.role,
    },
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getApprovalStaffId(staffId: string): string | null {
  return isUuid(staffId) ? staffId : null;
}

function canAssignRole(actorRole: string, targetRole: AdminStaffInput['role']): boolean {
  if (actorRole === 'hq' || actorRole === 'admin') return true;
  return targetRole !== 'admin';
}

function canManageTargetRole(actorRole: string, targetRole: string | null): boolean {
  if (actorRole === 'hq') return true;
  if (targetRole === 'hq') return false;
  if (actorRole === 'admin') return true;
  return targetRole !== 'admin';
}

function parseDateOnlyForSalon(dateString: string, boundary: 'start' | 'endExclusive'): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return boundary === 'start'
    ? new Date(year, month - 1, day, 0, 0, 0, 0)
    : new Date(year, month - 1, day + 1, 0, 0, 0, 0);
}

function normalizeAbsenceInput(input: AdminAbsenceInput): z.infer<typeof absenceInputSchema> | null {
  const parsed = absenceInputSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

async function findApprovedAbsenceAppointmentConflicts(
  supabase: DbClient,
  input: z.infer<typeof absenceInputSchema>,
  salonId: string
): Promise<StaffAbsenceConflict[]> {
  const absenceStart = parseDateOnlyForSalon(input.startDate, 'start');
  const absenceEndExclusive = parseDateOnlyForSalon(input.endDate, 'endExclusive');

  const { data, error } = await (supabase.from('appointments') as any)
    .select(`
      id,
      start_time,
      end_time,
      status,
      customers (
        first_name,
        last_name,
        email
      )
    `)
    .eq('salon_id', salonId)
    .eq('staff_id', input.staffId)
    .in('status', ACTIVE_APPOINTMENT_STATUSES)
    .lt('start_time', absenceEndExclusive.toISOString())
    .gt('end_time', absenceStart.toISOString())
    .order('start_time', { ascending: true });

  if (error) {
    console.error('[findApprovedAbsenceAppointmentConflicts] Error:', error);
    return [
      {
        appointmentId: 'unknown',
        startsAt: absenceStart.toISOString(),
        endsAt: absenceEndExclusive.toISOString(),
        status: 'unknown',
      },
    ];
  }

  return (data || []).map((row: any) => {
    const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
    const customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ');

    return {
      appointmentId: row.id,
      startsAt: row.start_time,
      endsAt: row.end_time,
      status: row.status,
      customerName: customerName || customer?.email || undefined,
    };
  });
}

async function assertNoApprovedAbsenceConflicts(
  supabase: DbClient,
  input: z.infer<typeof absenceInputSchema>,
  salonId: string
): Promise<StaffMutationResult> {
  if (input.status !== 'approved') return { success: true, data: true };

  const conflicts = await findApprovedAbsenceAppointmentConflicts(supabase, input, salonId);
  if (conflicts.length > 0) {
    return {
      success: false,
      error: 'Im Abwesenheitszeitraum existieren bereits aktive Termine. Bitte Termine zuerst verschieben oder stornieren.',
      conflicts,
    };
  }

  return { success: true, data: true };
}

async function syncLinkedUserRole(
  supabase: DbClient,
  staff: { profile_id: string | null; salon_id: string },
  role: string
) {
  if (!staff.profile_id) return;

  const roleName = role === 'staff' ? 'mitarbeiter' : role;
  if (!['admin', 'manager', 'mitarbeiter', 'hq'].includes(roleName)) return;

  await (supabase.from('user_roles') as any)
    .delete()
    .eq('profile_id', staff.profile_id)
    .eq('salon_id', staff.salon_id)
    .in('role_name', ['admin', 'manager', 'mitarbeiter', 'hq']);

  await (supabase.from('user_roles') as any).upsert(
    {
      profile_id: staff.profile_id,
      salon_id: staff.salon_id,
      role_name: roleName,
    },
    { onConflict: 'profile_id,salon_id,role_name' }
  );
}

function revalidateStaffAdminPaths() {
  revalidateTag('staff', 'max');
  revalidateTag('booking', 'max');
  revalidatePath('/admin/team');
  revalidatePath('/admin/kalender');
  revalidatePath('/termin-buchen');
}

export async function getAdminStaffAbsences(
  salonId?: string
): Promise<StaffMutationResult<AdminStaffAbsenceRecord[]>> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: 'Datenbankverbindung nicht verfügbar' };

  const auth = await requireStaffManager(supabase, salonId);
  if (!auth.success || !auth.data) {
    return { success: false, error: auth.error || 'Keine Berechtigung für diese Aktion' };
  }

  const effectiveSalonId = getEffectiveSalonId(salonId || auth.data.salonId);

  const { data, error } = await (supabase.from('staff_absences') as any)
    .select(`
      id,
      staff_id,
      start_date,
      end_date,
      absence_type,
      status,
      notes,
      approved_by,
      approved_at
    `)
    .eq('salon_id', effectiveSalonId)
    .gte('end_date', new Date().toISOString().slice(0, 10))
    .order('start_date', { ascending: true });

  if (error) {
    console.error('[getAdminStaffAbsences] Error:', error);
    return { success: false, error: 'Abwesenheiten konnten nicht geladen werden' };
  }

  return { success: true, data: (data || []) as AdminStaffAbsenceRecord[] };
}

export async function adminCreateStaff(
  input: AdminStaffInput,
  salonId?: string
): Promise<StaffMutationResult<{ id: string }>> {
  const validationError = validateStaffInput(input);
  if (validationError) return { success: false, error: validationError };

  const supabase = createServerClient();
  if (!supabase) return { success: false, error: 'Datenbankverbindung nicht verfügbar' };

  const auth = await requireStaffManager(supabase, salonId);
  if (!auth.success || !auth.data) {
    return { success: false, error: auth.error || 'Keine Berechtigung für diese Aktion' };
  }

  if (!canAssignRole(auth.data.role, input.role)) {
    return { success: false, error: 'Sie dürfen diese Rolle nicht vergeben' };
  }

  const effectiveSalonId = getEffectiveSalonId(salonId || auth.data.salonId);

  const { data: maxSort } = await (supabase.from('staff') as any)
    .select('sort_order')
    .eq('salon_id', effectiveSalonId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await (supabase.from('staff') as any)
    .insert({
      salon_id: effectiveSalonId,
      display_name: input.displayName.trim(),
      email: normalizeOptionalEmail(input.email),
      phone: normalizeOptionalText(input.phone),
      role: input.role,
      color: normalizeOptionalText(input.color) || '#3b82f6',
      employment_type: input.employmentType || 'full_time',
      is_active: true,
      is_bookable: true,
      sort_order: ((maxSort as { sort_order?: number } | null)?.sort_order || 0) + 1,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[adminCreateStaff] Error:', error);
    return { success: false, error: 'Mitarbeiter konnte nicht angelegt werden' };
  }

  revalidateStaffAdminPaths();
  return { success: true, data: { id: data.id } };
}

export async function adminUpdateStaff(
  staffId: string,
  input: AdminStaffInput
): Promise<StaffMutationResult> {
  const validationError = validateStaffInput(input);
  if (validationError) return { success: false, error: validationError };

  const supabase = createServerClient();
  if (!supabase) return { success: false, error: 'Datenbankverbindung nicht verfügbar' };

  const staff = await getStaffForAdmin(supabase, staffId);
  if (!staff) return { success: false, error: 'Mitarbeiter nicht gefunden' };

  const auth = await requireStaffManager(supabase, staff.salon_id);
  if (!auth.success || !auth.data) {
    return { success: false, error: auth.error || 'Keine Berechtigung für diese Aktion' };
  }

  if (!canManageTargetRole(auth.data.role, staff.role)) {
    return { success: false, error: 'Sie dürfen diesen Mitarbeiter nicht bearbeiten' };
  }

  if (!canAssignRole(auth.data.role, input.role)) {
    return { success: false, error: 'Sie dürfen diese Rolle nicht vergeben' };
  }

  const { error } = await (supabase.from('staff') as any)
    .update({
      display_name: input.displayName.trim(),
      email: normalizeOptionalEmail(input.email),
      phone: normalizeOptionalText(input.phone),
      role: input.role,
      color: normalizeOptionalText(input.color) || '#3b82f6',
      employment_type: input.employmentType || 'full_time',
      updated_at: new Date().toISOString(),
    })
    .eq('id', staffId);

  if (error) {
    console.error('[adminUpdateStaff] Error:', error);
    return { success: false, error: 'Mitarbeiter konnte nicht aktualisiert werden' };
  }

  await syncLinkedUserRole(supabase, staff, input.role);
  revalidateStaffAdminPaths();
  return { success: true, data: true };
}

export async function adminSetStaffActive(
  staffId: string,
  isActive: boolean
): Promise<StaffMutationResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: 'Datenbankverbindung nicht verfügbar' };

  const staff = await getStaffForAdmin(supabase, staffId);
  if (!staff) return { success: false, error: 'Mitarbeiter nicht gefunden' };

  const auth = await requireStaffManager(supabase, staff.salon_id);
  if (!auth.success || !auth.data) {
    return { success: false, error: auth.error || 'Keine Berechtigung für diese Aktion' };
  }

  if (!canManageTargetRole(auth.data.role, staff.role)) {
    return { success: false, error: 'Sie dürfen diesen Mitarbeiter nicht deaktivieren' };
  }

  if (!isActive && staff.profile_id === auth.data.userId) {
    return { success: false, error: 'Sie können Ihren eigenen Zugang nicht deaktivieren' };
  }

  const { error } = await (supabase.from('staff') as any)
    .update({
      is_active: isActive,
      is_bookable: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', staffId);

  if (error) {
    console.error('[adminSetStaffActive] Error:', error);
    return { success: false, error: isActive ? 'Mitarbeiter konnte nicht aktiviert werden' : 'Mitarbeiter konnte nicht deaktiviert werden' };
  }

  revalidateStaffAdminPaths();
  return { success: true, data: true };
}

export async function adminUpdateStaffAvatar(
  staffId: string,
  avatarUrl: string | null
): Promise<StaffMutationResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: 'Datenbankverbindung nicht verfügbar' };

  const staff = await getStaffForAdmin(supabase, staffId);
  if (!staff) return { success: false, error: 'Mitarbeiter nicht gefunden' };

  const auth = await requireStaffManager(supabase, staff.salon_id);
  if (!auth.success || !auth.data) {
    return { success: false, error: auth.error || 'Keine Berechtigung für diese Aktion' };
  }

  if (!canManageTargetRole(auth.data.role, staff.role)) {
    return { success: false, error: 'Sie dürfen diesen Mitarbeiter nicht bearbeiten' };
  }

  const { error } = await (supabase.from('staff') as any)
    .update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', staffId);

  if (error) {
    console.error('[adminUpdateStaffAvatar] Error:', error);
    return { success: false, error: 'Mitarbeiterbild konnte nicht gespeichert werden' };
  }

  revalidateStaffAdminPaths();
  return { success: true, data: true };
}

export async function adminSaveStaffWorkingHours(
  staffId: string,
  hours: AdminWorkingHourInput[]
): Promise<StaffMutationResult> {
  const validationError = validateWorkingHours(hours);
  if (validationError) return { success: false, error: validationError };

  const supabase = createServerClient();
  if (!supabase) return { success: false, error: 'Datenbankverbindung nicht verfügbar' };

  const staff = await getStaffForAdmin(supabase, staffId);
  if (!staff) return { success: false, error: 'Mitarbeiter nicht gefunden' };

  const auth = await requireStaffManager(supabase, staff.salon_id);
  if (!auth.success || !auth.data) {
    return { success: false, error: auth.error || 'Keine Berechtigung für diese Aktion' };
  }

  if (!canManageTargetRole(auth.data.role, staff.role)) {
    return { success: false, error: 'Sie dürfen die Arbeitszeiten dieses Mitarbeiters nicht bearbeiten' };
  }

  const rows = hours.map((hour) => ({
    staff_id: staffId,
    day_of_week: hour.dayOfWeek,
    start_time: hour.startTime,
    end_time: hour.endTime,
    is_active: hour.isActive,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await (supabase.from('staff_working_hours') as any)
    .upsert(rows, { onConflict: 'staff_id,day_of_week' });

  if (error) {
    console.error('[adminSaveStaffWorkingHours] Error:', error);
    return { success: false, error: 'Arbeitszeiten konnten nicht gespeichert werden' };
  }

  revalidateStaffAdminPaths();
  return { success: true, data: true };
}

export async function adminSaveStaffServiceAssignments(
  staffId: string,
  serviceIds: string[]
): Promise<StaffMutationResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: 'Datenbankverbindung nicht verfügbar' };

  const staff = await getStaffForAdmin(supabase, staffId);
  if (!staff) return { success: false, error: 'Mitarbeiter nicht gefunden' };

  const auth = await requireStaffManager(supabase, staff.salon_id);
  if (!auth.success || !auth.data) {
    return { success: false, error: auth.error || 'Keine Berechtigung für diese Aktion' };
  }

  if (!canManageTargetRole(auth.data.role, staff.role)) {
    return { success: false, error: 'Sie dürfen die Leistungen dieses Mitarbeiters nicht bearbeiten' };
  }

  const uniqueServiceIds = Array.from(new Set(serviceIds.filter(Boolean)));

  if (uniqueServiceIds.length > 0) {
    const { data: services, error: serviceError } = await (supabase.from('services') as any)
      .select('id')
      .eq('salon_id', staff.salon_id)
      .in('id', uniqueServiceIds);

    if (serviceError || (services || []).length !== uniqueServiceIds.length) {
      return { success: false, error: 'Eine oder mehrere Leistungen gehören nicht zu diesem Salon' };
    }
  }

  const { data: existingSkills, error: existingSkillsError } = await (supabase
    .from('staff_service_skills') as any)
    .select('service_id')
    .eq('staff_id', staffId);

  if (existingSkillsError) {
    console.error('[adminSaveStaffServiceAssignments] Existing skills error:', existingSkillsError);
    return { success: false, error: 'Bestehende Leistungszuordnung konnte nicht gelesen werden' };
  }

  const existingSkillRows = (existingSkills || []) as Array<{ service_id: string }>;
  const existingServiceIds = new Set<string>(existingSkillRows.map((row) => row.service_id));
  const targetServiceIds = new Set(uniqueServiceIds);
  const serviceIdsToInsert = uniqueServiceIds.filter((serviceId) => !existingServiceIds.has(serviceId));
  const serviceIdsToDelete = Array.from(existingServiceIds).filter((serviceId) => !targetServiceIds.has(serviceId));

  if (serviceIdsToInsert.length > 0) {
    const { error: insertError } = await (supabase.from('staff_service_skills') as any)
      .insert(serviceIdsToInsert.map((serviceId) => ({
        staff_id: staffId,
        service_id: serviceId,
        skill_level: 3,
      })));

    if (insertError) {
      console.error('[adminSaveStaffServiceAssignments] Insert error:', insertError);
      return { success: false, error: 'Leistungen konnten nicht zugeordnet werden' };
    }
  }

  if (serviceIdsToDelete.length > 0) {
    const { error: deleteError } = await (supabase.from('staff_service_skills') as any)
      .delete()
      .eq('staff_id', staffId)
      .in('service_id', serviceIdsToDelete);

    if (deleteError) {
      console.error('[adminSaveStaffServiceAssignments] Delete error:', deleteError);
      return { success: false, error: 'Nicht mehr benötigte Leistungszuordnungen konnten nicht entfernt werden' };
    }
  }

  revalidateStaffAdminPaths();
  return { success: true, data: true };
}

export async function adminCreateStaffAbsence(
  input: AdminAbsenceInput
): Promise<StaffMutationResult<{ id: string }>> {
  const validationError = validateAbsenceInput(input);
  if (validationError) return { success: false, error: validationError };
  const normalizedInput = normalizeAbsenceInput(input);
  if (!normalizedInput) return { success: false, error: 'Ungültige Abwesenheit' };

  const supabase = createServerClient();
  if (!supabase) return { success: false, error: 'Datenbankverbindung nicht verfügbar' };

  const staff = await getStaffForAdmin(supabase, input.staffId);
  if (!staff) return { success: false, error: 'Mitarbeiter nicht gefunden' };

  const auth = await requireStaffManager(supabase, staff.salon_id);
  if (!auth.success || !auth.data) {
    return { success: false, error: auth.error || 'Keine Berechtigung für diese Aktion' };
  }

  if (!canManageTargetRole(auth.data.role, staff.role)) {
    return { success: false, error: 'Sie dürfen für diesen Mitarbeiter keine Abwesenheit erfassen' };
  }

  const conflictResult = await assertNoApprovedAbsenceConflicts(
    supabase,
    normalizedInput,
    staff.salon_id
  );
  if (!conflictResult.success) {
    return {
      success: false,
      error: conflictResult.error,
      conflicts: conflictResult.conflicts,
    };
  }

  const status = normalizedInput.status;
  const approvalStaffId = status === 'approved' ? getApprovalStaffId(auth.data.staffId) : null;
  const { data, error } = await (supabase.from('staff_absences') as any)
    .insert({
      salon_id: staff.salon_id,
      staff_id: normalizedInput.staffId,
      start_date: normalizedInput.startDate,
      end_date: normalizedInput.endDate,
      absence_type: normalizedInput.absenceType,
      notes: normalizeOptionalText(normalizedInput.notes),
      status,
      approved_by: approvalStaffId,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[adminCreateStaffAbsence] Error:', error);
    return { success: false, error: 'Abwesenheit konnte nicht gespeichert werden' };
  }

  revalidateStaffAdminPaths();
  return { success: true, data: { id: data.id } };
}

export async function adminUpdateStaffAbsence(
  absenceId: string,
  input: AdminAbsenceInput
): Promise<StaffMutationResult> {
  const validationError = validateAbsenceInput(input);
  if (validationError) return { success: false, error: validationError };
  const normalizedInput = normalizeAbsenceInput(input);
  if (!normalizedInput) return { success: false, error: 'Ungültige Abwesenheit' };

  const supabase = createServerClient();
  if (!supabase) return { success: false, error: 'Datenbankverbindung nicht verfügbar' };

  const { data: existingAbsence, error: existingError } = await (supabase.from('staff_absences') as any)
    .select('id, salon_id, staff_id, status, approved_by, approved_at')
    .eq('id', absenceId)
    .single();

  if (existingError || !existingAbsence) {
    return { success: false, error: 'Abwesenheit nicht gefunden' };
  }

  const staff = await getStaffForAdmin(supabase, normalizedInput.staffId);
  if (!staff) return { success: false, error: 'Mitarbeiter nicht gefunden' };
  if (staff.salon_id !== existingAbsence.salon_id) {
    return { success: false, error: 'Mitarbeiter und Abwesenheit gehören nicht zum gleichen Salon' };
  }

  const auth = await requireStaffManager(supabase, existingAbsence.salon_id);
  if (!auth.success || !auth.data) {
    return { success: false, error: auth.error || 'Keine Berechtigung für diese Aktion' };
  }

  if (!canManageTargetRole(auth.data.role, staff.role)) {
    return { success: false, error: 'Sie dürfen diese Abwesenheit nicht bearbeiten' };
  }

  const conflictResult = await assertNoApprovedAbsenceConflicts(
    supabase,
    normalizedInput,
    existingAbsence.salon_id
  );
  if (!conflictResult.success) {
    return {
      success: false,
      error: conflictResult.error,
      conflicts: conflictResult.conflicts,
    };
  }

  const status = normalizedInput.status;
  const approvalUpdate =
    status === 'approved' && existingAbsence.status !== 'approved'
      ? {
          approved_by: getApprovalStaffId(auth.data.staffId),
          approved_at: new Date().toISOString(),
        }
      : status === 'approved'
        ? {
            approved_by: existingAbsence.approved_by,
            approved_at: existingAbsence.approved_at,
          }
        : {
            approved_by: null,
            approved_at: null,
          };

  const { error } = await (supabase.from('staff_absences') as any)
    .update({
      staff_id: normalizedInput.staffId,
      start_date: normalizedInput.startDate,
      end_date: normalizedInput.endDate,
      absence_type: normalizedInput.absenceType,
      notes: normalizeOptionalText(normalizedInput.notes),
      status,
      ...approvalUpdate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', absenceId);

  if (error) {
    console.error('[adminUpdateStaffAbsence] Error:', error);
    return { success: false, error: 'Abwesenheit konnte nicht aktualisiert werden' };
  }

  revalidateStaffAdminPaths();
  return { success: true, data: true };
}

export async function adminDeleteStaffAbsence(
  absenceId: string
): Promise<StaffMutationResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: 'Datenbankverbindung nicht verfügbar' };

  const { data: absence, error: fetchError } = await (supabase.from('staff_absences') as any)
    .select('id, salon_id, staff_id')
    .eq('id', absenceId)
    .single();

  if (fetchError || !absence) {
    return { success: false, error: 'Abwesenheit nicht gefunden' };
  }

  const auth = await requireStaffManager(supabase, absence.salon_id);
  if (!auth.success || !auth.data) {
    return { success: false, error: auth.error || 'Keine Berechtigung für diese Aktion' };
  }

  const staff = await getStaffForAdmin(supabase, absence.staff_id);
  if (!staff || staff.salon_id !== absence.salon_id) {
    return { success: false, error: 'Abwesenheit ist keinem gültigen Mitarbeiter zugeordnet' };
  }

  if (!canManageTargetRole(auth.data.role, staff.role)) {
    return { success: false, error: 'Sie dürfen diese Abwesenheit nicht löschen' };
  }

  const { error } = await (supabase.from('staff_absences') as any)
    .delete()
    .eq('id', absenceId);

  if (error) {
    console.error('[adminDeleteStaffAbsence] Error:', error);
    return { success: false, error: 'Abwesenheit konnte nicht gelöscht werden' };
  }

  revalidateStaffAdminPaths();
  return { success: true, data: true };
}

export async function adminApproveStaffAbsence(absenceId: string): Promise<StaffMutationResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: 'Datenbankverbindung nicht verfügbar' };

  const { data: absence, error } = await (supabase.from('staff_absences') as any)
    .select('id, staff_id, start_date, end_date, absence_type, notes, status')
    .eq('id', absenceId)
    .single();

  if (error || !absence) {
    return { success: false, error: 'Abwesenheit nicht gefunden' };
  }

  return adminUpdateStaffAbsence(absenceId, {
    staffId: absence.staff_id,
    startDate: absence.start_date,
    endDate: absence.end_date,
    absenceType: absence.absence_type,
    notes: absence.notes,
    status: 'approved',
  });
}

export async function adminRejectStaffAbsence(absenceId: string): Promise<StaffMutationResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: 'Datenbankverbindung nicht verfügbar' };

  const { data: absence, error } = await (supabase.from('staff_absences') as any)
    .select('id, staff_id, start_date, end_date, absence_type, notes, status')
    .eq('id', absenceId)
    .single();

  if (error || !absence) {
    return { success: false, error: 'Abwesenheit nicht gefunden' };
  }

  return adminUpdateStaffAbsence(absenceId, {
    staffId: absence.staff_id,
    startDate: absence.start_date,
    endDate: absence.end_date,
    absenceType: absence.absence_type,
    notes: absence.notes,
    status: 'rejected',
  });
}
