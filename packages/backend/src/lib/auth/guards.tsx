'use client';

import React from 'react';
import { useAuth } from './context';
import type { RoleName } from '../db/types';
import type { Permission } from './middleware';
import { hasPermission, hasAllPermissions, hasAnyPermission } from './middleware';

// ============================================
// TYPES
// ============================================

interface GuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onUnauthorized?: () => void;
}

interface RoleGuardProps extends GuardProps {
  roles: RoleName[];
  requireAll?: boolean;
}

interface PermissionGuardProps extends GuardProps {
  permissions: Permission[];
  requireAll?: boolean;
}

interface SalonGuardProps extends GuardProps {
  salonId: string;
}

// ============================================
// LOADING COMPONENT
// ============================================

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

// ============================================
// AUTH GUARD
// Requires user to be authenticated
// ============================================

export function AuthGuard({ children, fallback, onUnauthorized }: GuardProps) {
  const { isAuthenticated, isLoading } = useAuth();

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated && onUnauthorized) {
      onUnauthorized();
    }
  }, [isLoading, isAuthenticated, onUnauthorized]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return fallback ?? null;
  }

  return <>{children}</>;
}

// ============================================
// ROLE GUARD
// Requires user to have specific role(s)
// ============================================

export function RoleGuard({
  children,
  fallback,
  onUnauthorized,
  roles,
  requireAll = false,
}: RoleGuardProps) {
  const { isAuthenticated, isLoading, hasRole } = useAuth();

  const isAuthorized = React.useMemo(() => {
    if (!isAuthenticated) return false;

    if (requireAll) {
      return roles.every((role) => hasRole(role));
    }
    return roles.some((role) => hasRole(role));
  }, [isAuthenticated, roles, requireAll, hasRole]);

  React.useEffect(() => {
    if (!isLoading && !isAuthorized && onUnauthorized) {
      onUnauthorized();
    }
  }, [isLoading, isAuthorized, onUnauthorized]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthorized) {
    return fallback ?? null;
  }

  return <>{children}</>;
}

// ============================================
// PERMISSION GUARD
// Requires user to have specific permission(s)
// ============================================

export function PermissionGuard({
  children,
  fallback,
  onUnauthorized,
  permissions,
  requireAll = false,
}: PermissionGuardProps) {
  const { isAuthenticated, isLoading, user, roles } = useAuth();

  const isAuthorized = React.useMemo(() => {
    if (!isAuthenticated || !user) return false;
    const roleNames = roles.map((role) => role.role_name);

    const authUser = {
      id: user.id,
      email: user.email || '',
      roles: roleNames,
      salonIds: [], // Will be populated from context if needed
    };

    if (requireAll) {
      return hasAllPermissions(authUser, permissions);
    }
    return hasAnyPermission(authUser, permissions);
  }, [isAuthenticated, user, roles, permissions, requireAll]);

  React.useEffect(() => {
    if (!isLoading && !isAuthorized && onUnauthorized) {
      onUnauthorized();
    }
  }, [isLoading, isAuthorized, onUnauthorized]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthorized) {
    return fallback ?? null;
  }

  return <>{children}</>;
}

// ============================================
// SALON GUARD
// Requires user to have access to specific salon
// ============================================

export function SalonGuard({
  children,
  fallback,
  onUnauthorized,
  salonId,
}: SalonGuardProps) {
  const { isAuthenticated, isLoading, hasRole, roles } = useAuth();

  const isAuthorized = React.useMemo(() => {
    if (!isAuthenticated) return false;

    // HQ has access to all salons
    if (hasRole('hq')) return true;

    return roles.some((role) => role.salon_id === salonId);
  }, [isAuthenticated, hasRole, roles, salonId]);

  React.useEffect(() => {
    if (!isLoading && !isAuthorized && onUnauthorized) {
      onUnauthorized();
    }
  }, [isLoading, isAuthorized, onUnauthorized]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthorized) {
    return fallback ?? null;
  }

  return <>{children}</>;
}

// ============================================
// ADMIN GUARD
// Requires admin or higher role
// ============================================

export function AdminGuard({ children, fallback, onUnauthorized }: GuardProps) {
  return (
    <RoleGuard
      roles={['admin', 'hq']}
      fallback={fallback}
      onUnauthorized={onUnauthorized}
    >
      {children}
    </RoleGuard>
  );
}

// ============================================
// STAFF GUARD
// Requires staff or higher role
// ============================================

export function StaffGuard({ children, fallback, onUnauthorized }: GuardProps) {
  return (
    <RoleGuard
      roles={['mitarbeiter', 'manager', 'admin', 'hq']}
      fallback={fallback}
      onUnauthorized={onUnauthorized}
    >
      {children}
    </RoleGuard>
  );
}

// ============================================
// MANAGER GUARD
// Requires manager or higher role
// ============================================

export function ManagerGuard({ children, fallback, onUnauthorized }: GuardProps) {
  return (
    <RoleGuard
      roles={['manager', 'admin', 'hq']}
      fallback={fallback}
      onUnauthorized={onUnauthorized}
    >
      {children}
    </RoleGuard>
  );
}

// ============================================
// CUSTOMER GUARD
// Requires customer role
// ============================================

export function CustomerGuard({ children, fallback, onUnauthorized }: GuardProps) {
  return (
    <RoleGuard
      roles={['kunde']}
      fallback={fallback}
      onUnauthorized={onUnauthorized}
    >
      {children}
    </RoleGuard>
  );
}

// ============================================
// HOOKS
// ============================================

/**
 * Hook to check if user has specific permission
 */
export function usePermission(permission: Permission): boolean {
  const { user, roles, isAuthenticated } = useAuth();

  return React.useMemo(() => {
    if (!isAuthenticated || !user) return false;
    const roleNames = roles.map((role) => role.role_name);

    const authUser = {
      id: user.id,
      email: user.email || '',
      roles: roleNames,
      salonIds: [],
    };

    return hasPermission(authUser, permission);
  }, [isAuthenticated, user, roles, permission]);
}

/**
 * Hook to check if user has multiple permissions
 */
export function usePermissions(
  permissions: Permission[],
  requireAll: boolean = false
): boolean {
  const { user, roles, isAuthenticated } = useAuth();

  return React.useMemo(() => {
    if (!isAuthenticated || !user) return false;
    const roleNames = roles.map((role) => role.role_name);

    const authUser = {
      id: user.id,
      email: user.email || '',
      roles: roleNames,
      salonIds: [],
    };

    if (requireAll) {
      return hasAllPermissions(authUser, permissions);
    }
    return hasAnyPermission(authUser, permissions);
  }, [isAuthenticated, user, roles, permissions, requireAll]);
}

/**
 * Hook to check salon access
 */
export function useSalonAccess(salonId: string): boolean {
  const { isAuthenticated, hasRole, roles } = useAuth();

  return React.useMemo(() => {
    if (!isAuthenticated) return false;
    if (hasRole('hq')) return true;
    return roles.some((role) => role.salon_id === salonId);
  }, [isAuthenticated, hasRole, roles, salonId]);
}

// ============================================
// CONDITIONAL RENDERING HELPERS
// ============================================

interface ShowIfProps {
  condition: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ShowIf({ condition, children, fallback }: ShowIfProps) {
  if (condition) {
    return <>{children}</>;
  }
  return fallback ?? null;
}

interface ShowForRolesProps {
  roles: RoleName[];
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ShowForRoles({
  roles,
  requireAll = false,
  children,
  fallback,
}: ShowForRolesProps) {
  const { hasRole } = useAuth();

  const isAuthorized = React.useMemo(() => {
    if (requireAll) {
      return roles.every((role) => hasRole(role));
    }
    return roles.some((role) => hasRole(role));
  }, [roles, requireAll, hasRole]);

  return <ShowIf condition={isAuthorized} fallback={fallback}>{children}</ShowIf>;
}

interface ShowWithPermissionProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ShowWithPermission({
  permission,
  children,
  fallback,
}: ShowWithPermissionProps) {
  const hasPermissionValue = usePermission(permission);

  return <ShowIf condition={hasPermissionValue} fallback={fallback}>{children}</ShowIf>;
}
