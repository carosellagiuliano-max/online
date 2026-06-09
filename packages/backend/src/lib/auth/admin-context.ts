import { NextResponse } from 'next/server';
import { createServerClient as createAuthClient } from '@/lib/supabase/server';
import { createServerClient as createServiceDbClient } from '@/lib/db/client';
import { createSuperadminStaffMember, isSuperadminEmail } from './superadmin';
import type { StaffMember, StaffRole } from './rbac';

export const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';

export function resolveStaffSalonId(salonId: string | null | undefined): string {
  return !salonId || salonId === 'all' ? DEFAULT_SALON_ID : salonId;
}

export type AdminApiContext = {
  authClient: Awaited<ReturnType<typeof createAuthClient>>;
  // Service-role routes intentionally bypass stale generated Supabase types in this repo.
  db: any;
  user: { id: string; email?: string | null };
  staffMember: StaffMember;
  salonId: string;
};

export type AdminApiContextResult = AdminApiContext | { response: NextResponse };

export async function requireAdminApiContext(
  allowedRoles: StaffRole[] = ['admin', 'manager', 'hq']
): Promise<AdminApiContextResult> {
  const authClient = await createAuthClient();
  const db = createServiceDbClient();

  if (!authClient || !db) {
    return {
      response: NextResponse.json({ error: 'Service nicht verfügbar' }, { status: 503 }),
    };
  }

  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return {
      response: NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 }),
    };
  }

  const { data: staffRow } = await db
    .from('staff')
    .select('id, role, salon_id, display_name')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .single();

  const staffMember = staffRow
    ? (staffRow as StaffMember)
    : isSuperadminEmail(user.email)
      ? createSuperadminStaffMember(user.id)
      : null;

  if (!staffMember || !allowedRoles.includes(staffMember.role)) {
    return {
      response: NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 }),
    };
  }

  return {
    authClient,
    db,
    user,
    staffMember,
    salonId: resolveStaffSalonId(staffMember.salon_id),
  };
}
