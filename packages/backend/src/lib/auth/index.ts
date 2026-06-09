// ============================================
// BeautifyPRO AUTH MODULE
// ============================================

// Context & Provider
export { AuthProvider, useAuth } from './context';

// Guards
export {
  AuthGuard,
  RoleGuard,
  PermissionGuard,
  SalonGuard,
  AdminGuard,
  StaffGuard,
  ManagerGuard,
  CustomerGuard,
  ShowIf,
  ShowForRoles,
  ShowWithPermission,
  usePermission,
  usePermissions,
  useSalonAccess,
} from './guards';

// Middleware & Helpers
export {
  createServerSupabaseClient,
  validateSession,
  hasRequiredRole,
  hasSalonAccess,
  checkAuthorization,
  hasMinimumRole,
  getHighestRole,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getUserPermissions,
  type AuthUser,
  type AuthResult,
  type AuthorizationResult,
  type Permission,
} from './middleware';
