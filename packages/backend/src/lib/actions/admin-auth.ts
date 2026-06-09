'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient as createAuthServerClient } from '@/lib/supabase/server';
import { isSuperadminEmail } from '@/lib/auth/superadmin';
import type { Database } from '@/lib/db/types';

const DEFAULT_ADMIN_ROLES = ['admin', 'manager', 'staff', 'hq'];

export type AdminActionContext = {
  userId: string;
  staffId: string;
  salonId: string;
  role: string;
};

export type AdminActionAuthResult =
  | { success: true; context: AdminActionContext }
  | { success: false; error: string };

export async function requireAdminAction(
  supabase: SupabaseClient<Database>,
  options: {
    salonId?: string;
    allowedRoles?: string[];
  } = {}
): Promise<AdminActionAuthResult> {
  const authClient = await createAuthServerClient();

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return { success: false, error: 'Nicht autorisiert' };
  }

  const allowedRoles = options.allowedRoles || DEFAULT_ADMIN_ROLES;

  if (isSuperadminEmail(user.email)) {
    const superadminRole = 'hq';
    if (!allowedRoles.includes(superadminRole) && !allowedRoles.includes('admin')) {
      return { success: false, error: 'Keine Berechtigung für diese Aktion' };
    }

    return {
      success: true,
      context: {
        userId: user.id,
        staffId: `superadmin-${user.id}`,
        salonId: options.salonId || 'all',
        role: superadminRole,
      },
    };
  }

  let query = (supabase.from('staff') as any)
    .select('id, salon_id, role')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .in('role', allowedRoles)
    .limit(1);

  if (options.salonId) {
    query = query.eq('salon_id', options.salonId);
  }

  const { data: staffMember, error: staffError } = await query.maybeSingle();

  if (staffError) {
    console.error('[requireAdminAction] Staff lookup error:', staffError);
    return { success: false, error: 'Berechtigung konnte nicht geprüft werden' };
  }

  if (!staffMember) {
    return { success: false, error: 'Keine Berechtigung für diese Aktion' };
  }

  return {
    success: true,
    context: {
      userId: user.id,
      staffId: staffMember.id,
      salonId: staffMember.salon_id,
      role: staffMember.role,
    },
  };
}
