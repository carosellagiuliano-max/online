/**
 * BeautifyPRO - Mock Auth Helper for Server Components
 * Reads mock session from cookies (set by client on login)
 */

import { cookies } from 'next/headers';
import { MOCK_ADMIN_USER, MOCK_STAFF_USER, MOCK_STAFF, MOCK_SALON } from './mock-data';

export interface MockUser {
  id: string;
  email: string;
  role: string;
}

export interface MockStaffMember {
  id: string;
  role: string;
  display_name: string;
  salon_id: string;
}

/**
 * Check if mock mode is enabled
 */
export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_MOCK_MODE === 'true';
}

/**
 * Get mock user from cookie (server-side)
 */
export async function getMockUser(): Promise<MockUser | null> {
  if (!isMockMode()) return null;

  try {
    const cookieStore = await cookies();
    const mockSession = cookieStore.get('mock_session');
    const mockUserCookie = cookieStore.get('mock_user');

    if (mockSession?.value === 'true' && mockUserCookie?.value) {
      return JSON.parse(mockUserCookie.value);
    }
  } catch {
    // Cookie parsing failed
  }

  return null;
}

/**
 * Get mock staff member data
 */
export async function getMockStaffMember(userId: string): Promise<MockStaffMember | null> {
  if (!isMockMode()) return null;

  // Find matching staff member
  if (userId === MOCK_ADMIN_USER.id) {
    const staff = MOCK_STAFF[0];
    return {
      id: staff.id,
      role: staff.role,
      display_name: `${staff.first_name} ${staff.last_name}`,
      salon_id: staff.salon_id,
    };
  }

  if (userId === MOCK_STAFF_USER.id) {
    const staff = MOCK_STAFF[1];
    return {
      id: staff.id,
      role: staff.role,
      display_name: `${staff.first_name} ${staff.last_name}`,
      salon_id: staff.salon_id,
    };
  }

  return null;
}

/**
 * Get mock salon data
 */
export function getMockSalon() {
  return MOCK_SALON;
}
