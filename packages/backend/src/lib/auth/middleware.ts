import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '../db/types';
import type { RoleName } from '../db/types';

// ============================================
// TYPES
// ============================================

export interface AuthUser {
  id: string;
  email: string;
  roles: RoleName[];
  salonIds: string[];
  profile?: {
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
}

export interface AuthResult {
  authenticated: boolean;
  user?: AuthUser;
  error?: string;
}

export interface AuthorizationResult {
  authorized: boolean;
  error?: string;
}

// ============================================
// SERVER-SIDE AUTH HELPERS
// ============================================

/**
 * Creates a Supabase client for server-side use
 */
export function createServerSupabaseClient(
  cookies: {
    get: (name: string) => string | undefined;
    set: (name: string, value: string, options: CookieOptions) => void;
    remove: (name: string, options: CookieOptions) => void;
  }
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookies.get(name);
      },
      set(name: string, value: string, options: CookieOptions) {
        cookies.set(name, value, options);
      },
      remove(name: string, options: CookieOptions) {
        cookies.remove(name, options);
      },
    },
  }) as any;
}

/**
 * Validates the current session and returns user info
 */
export async function validateSession(
  client: ReturnType<typeof createServerSupabaseClient>
): Promise<AuthResult> {
  try {
    const { data: { session }, error: sessionError } = await client.auth.getSession();

    if (sessionError || !session) {
      return {
        authenticated: false,
        error: sessionError?.message || 'Keine gültige Session',
      };
    }

    // Get user profile and roles
    const { data: profile } = await client
      .from('profiles')
      .select('first_name, last_name, avatar_url')
      .eq('id', session.user.id)
      .single();

    const { data: userRoles } = await client
      .from('user_roles')
      .select('role_name, salon_id')
      .eq('profile_id', session.user.id)
      .eq('is_active', true);

    const roles = (userRoles?.map((r: any) => r.role_name).filter(Boolean) || []) as RoleName[];
    const salonIds = [...new Set(userRoles?.map((r: any) => r.salon_id).filter(Boolean) as string[])];

    return {
      authenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email || '',
        roles,
        salonIds,
        profile: profile ? {
          firstName: profile.first_name || '',
          lastName: profile.last_name || '',
          avatarUrl: profile.avatar_url || undefined,
        } : undefined,
      },
    };
  } catch (error) {
    return {
      authenticated: false,
      error: 'Fehler bei der Session-Validierung',
    };
  }
}

/**
 * Checks if user has required role(s)
 */
export function hasRequiredRole(
  user: AuthUser,
  requiredRoles: RoleName[],
  requireAll: boolean = false
): boolean {
  if (requiredRoles.length === 0) {
    return true;
  }

  // HQ role has access to everything
  if (user.roles.includes('hq')) {
    return true;
  }

  if (requireAll) {
    return requiredRoles.every((role) => user.roles.includes(role));
  }

  return requiredRoles.some((role) => user.roles.includes(role));
}

/**
 * Checks if user has access to a specific salon
 */
export function hasSalonAccess(user: AuthUser, salonId: string): boolean {
  // HQ has access to all salons
  if (user.roles.includes('hq')) {
    return true;
  }

  return user.salonIds.includes(salonId);
}

/**
 * Comprehensive authorization check
 */
export function checkAuthorization(
  user: AuthUser,
  options: {
    requiredRoles?: RoleName[];
    requireAllRoles?: boolean;
    salonId?: string;
  } = {}
): AuthorizationResult {
  const { requiredRoles = [], requireAllRoles = false, salonId } = options;

  // Check roles
  if (!hasRequiredRole(user, requiredRoles, requireAllRoles)) {
    return {
      authorized: false,
      error: 'Keine Berechtigung für diese Aktion',
    };
  }

  // Check salon access
  if (salonId && !hasSalonAccess(user, salonId)) {
    return {
      authorized: false,
      error: 'Kein Zugriff auf diesen Salon',
    };
  }

  return { authorized: true };
}

// ============================================
// ROLE HIERARCHY & PERMISSIONS
// ============================================

const ROLE_HIERARCHY: Record<RoleName, number> = {
  kunde: 1,
  mitarbeiter: 2,
  manager: 3,
  admin: 4,
  hq: 5,
};

/**
 * Checks if user role is at least the minimum required level
 */
export function hasMinimumRole(user: AuthUser, minimumRole: RoleName): boolean {
  const minimumLevel = ROLE_HIERARCHY[minimumRole];

  return user.roles.some((role) => ROLE_HIERARCHY[role] >= minimumLevel);
}

/**
 * Gets the highest role for a user
 */
export function getHighestRole(user: AuthUser): RoleName {
  let highestRole: RoleName = 'kunde';
  let highestLevel = 0;

  for (const role of user.roles) {
    if (ROLE_HIERARCHY[role] > highestLevel) {
      highestLevel = ROLE_HIERARCHY[role];
      highestRole = role;
    }
  }

  return highestRole;
}

// ============================================
// PERMISSION DEFINITIONS
// ============================================

export type Permission =
  // Appointment permissions
  | 'appointments:view'
  | 'appointments:create'
  | 'appointments:edit'
  | 'appointments:cancel'
  | 'appointments:view_all'
  // Customer permissions
  | 'customers:view'
  | 'customers:create'
  | 'customers:edit'
  | 'customers:delete'
  // Staff permissions
  | 'staff:view'
  | 'staff:create'
  | 'staff:edit'
  | 'staff:delete'
  // Service permissions
  | 'services:view'
  | 'services:create'
  | 'services:edit'
  | 'services:delete'
  // Product permissions
  | 'products:view'
  | 'products:create'
  | 'products:edit'
  | 'products:delete'
  | 'products:manage_stock'
  // Order permissions
  | 'orders:view'
  | 'orders:create'
  | 'orders:edit'
  | 'orders:cancel'
  | 'orders:refund'
  // Payment permissions
  | 'payments:view'
  | 'payments:process'
  | 'payments:refund'
  // Settings permissions
  | 'settings:view'
  | 'settings:edit'
  // Reports permissions
  | 'reports:view'
  | 'reports:export';

const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  kunde: [
    'appointments:view',
    'appointments:create',
    'appointments:cancel',
  ],
  mitarbeiter: [
    'appointments:view',
    'appointments:create',
    'appointments:edit',
    'appointments:cancel',
    'customers:view',
    'customers:create',
    'customers:edit',
    'services:view',
    'products:view',
    'orders:view',
    'orders:create',
    'payments:view',
    'payments:process',
  ],
  manager: [
    'appointments:view',
    'appointments:create',
    'appointments:edit',
    'appointments:cancel',
    'appointments:view_all',
    'customers:view',
    'customers:create',
    'customers:edit',
    'customers:delete',
    'staff:view',
    'staff:edit',
    'services:view',
    'services:create',
    'services:edit',
    'products:view',
    'products:create',
    'products:edit',
    'products:manage_stock',
    'orders:view',
    'orders:create',
    'orders:edit',
    'orders:cancel',
    'orders:refund',
    'payments:view',
    'payments:process',
    'payments:refund',
    'reports:view',
    'settings:view',
  ],
  admin: [
    'appointments:view',
    'appointments:create',
    'appointments:edit',
    'appointments:cancel',
    'appointments:view_all',
    'customers:view',
    'customers:create',
    'customers:edit',
    'customers:delete',
    'staff:view',
    'staff:create',
    'staff:edit',
    'staff:delete',
    'services:view',
    'services:create',
    'services:edit',
    'services:delete',
    'products:view',
    'products:create',
    'products:edit',
    'products:delete',
    'products:manage_stock',
    'orders:view',
    'orders:create',
    'orders:edit',
    'orders:cancel',
    'orders:refund',
    'payments:view',
    'payments:process',
    'payments:refund',
    'settings:view',
    'settings:edit',
    'reports:view',
    'reports:export',
  ],
  hq: [
    'appointments:view',
    'appointments:create',
    'appointments:edit',
    'appointments:cancel',
    'appointments:view_all',
    'customers:view',
    'customers:create',
    'customers:edit',
    'customers:delete',
    'staff:view',
    'staff:create',
    'staff:edit',
    'staff:delete',
    'services:view',
    'services:create',
    'services:edit',
    'services:delete',
    'products:view',
    'products:create',
    'products:edit',
    'products:delete',
    'products:manage_stock',
    'orders:view',
    'orders:create',
    'orders:edit',
    'orders:cancel',
    'orders:refund',
    'payments:view',
    'payments:process',
    'payments:refund',
    'settings:view',
    'settings:edit',
    'reports:view',
    'reports:export',
  ],
};

/**
 * Checks if user has a specific permission
 */
export function hasPermission(user: AuthUser, permission: Permission): boolean {
  for (const role of user.roles) {
    if (ROLE_PERMISSIONS[role]?.includes(permission)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if user has all specified permissions
 */
export function hasAllPermissions(user: AuthUser, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(user, permission));
}

/**
 * Checks if user has any of the specified permissions
 */
export function hasAnyPermission(user: AuthUser, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(user, permission));
}

/**
 * Gets all permissions for a user based on their roles
 */
export function getUserPermissions(user: AuthUser): Permission[] {
  const permissions = new Set<Permission>();

  for (const role of user.roles) {
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    for (const permission of rolePermissions) {
      permissions.add(permission);
    }
  }

  return Array.from(permissions);
}
