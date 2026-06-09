import { createServerClient } from '../db/client';
import { cookies } from 'next/headers';
import type { Database } from '../db/types';

// Get current session from cookies (server-side)
export async function getSession() {
  const cookieStore = await cookies();
  const supabase = createServerClient();

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    return null;
  }

  return session;
}

// Get current user with profile
export async function getCurrentUser() {
  const session = await getSession();

  if (!session?.user) {
    return null;
  }

  const supabase = createServerClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  return {
    ...session.user,
    profile,
  };
}

// Role type for return
type UserRole = {
  role_name: Database['public']['Enums']['role_name'];
  salon_id: string | null;
};

// Get user roles for a salon
export async function getUserRoles(userId: string, salonId?: string): Promise<UserRole[]> {
  const supabase = createServerClient();

  let query = supabase.from('user_roles').select('role_name, salon_id').eq('profile_id', userId);

  if (salonId) {
    query = query.eq('salon_id', salonId);
  }

  const { data: roles, error } = await query;

  if (error || !roles) {
    return [];
  }

  return roles as UserRole[];
}

// Check if user has a specific role
export async function hasRole(
  userId: string,
  roleName: Database['public']['Enums']['role_name'],
  salonId?: string
): Promise<boolean> {
  const roles = await getUserRoles(userId, salonId);
  return roles.some((r) => r.role_name === roleName);
}

// Check if user is admin for salon
export async function isAdmin(userId: string, salonId: string): Promise<boolean> {
  return hasRole(userId, 'admin', salonId);
}

// Check if user is staff (admin, manager, or mitarbeiter)
export async function isStaff(userId: string, salonId: string): Promise<boolean> {
  const roles = await getUserRoles(userId, salonId);
  return roles.some((r) => ['admin', 'manager', 'mitarbeiter'].includes(r.role_name));
}
