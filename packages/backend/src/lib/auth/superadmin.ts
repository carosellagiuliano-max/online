// ============================================
// SUPERADMIN SUPPORT ACCOUNT
// ============================================
// This module handles the BeautifyPro support account
// which can access /admin without being in the staff table.
// The superadmin is NOT visible in staff lists or booking.

import type { StaffMember, StaffRole } from './rbac';

// ============================================
// CONFIGURATION
// ============================================

/**
 * Check if superadmin feature is enabled
 */
export function isSuperadminEnabled(): boolean {
  return process.env.SUPERADMIN_ENABLED === 'true';
}

/**
 * Get superadmin email from environment
 */
export function getSuperadminEmail(): string | undefined {
  return process.env.SUPERADMIN_EMAIL;
}

// ============================================
// SUPERADMIN CHECK
// ============================================

/**
 * Check if given email is the superadmin support account
 */
export function isSuperadminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  if (!isSuperadminEnabled()) return false;

  const superadminEmail = getSuperadminEmail();
  if (!superadminEmail) return false;

  return email.toLowerCase() === superadminEmail.toLowerCase();
}

/**
 * Create a virtual staff member for the superadmin
 * This allows the superadmin to use the admin panel with admin privileges
 * without being stored in the database
 */
export function createSuperadminStaffMember(userId: string): StaffMember {
  return {
    id: `superadmin-${userId}`,
    role: 'admin' as StaffRole,
    salon_id: 'all', // Special value indicating access to all salons
    display_name: 'BeautifyPro Support',
  };
}

/**
 * Check if a staff member ID indicates a superadmin
 */
export function isSuperadminStaffId(staffId: string): boolean {
  return staffId.startsWith('superadmin-');
}
