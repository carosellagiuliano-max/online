/**
 * ============================================
 * BeautifyPRO - Mock Login (Demo-Modus)
 * Shared demo-login logic for the customer and
 * admin login forms. Client-safe: no server-only
 * imports, the session setter touches only
 * localStorage/document and must run in the browser.
 * ============================================
 */

import {
  MOCK_ADMIN_USER,
  MOCK_STAFF_USER,
  MOCK_CUSTOMER_USER,
} from './mock-data';

export type MockLoginUser =
  | typeof MOCK_ADMIN_USER
  | typeof MOCK_STAFF_USER
  | typeof MOCK_CUSTOMER_USER;

const MOCK_LOGIN_USERS: MockLoginUser[] = [
  MOCK_ADMIN_USER,
  MOCK_STAFF_USER,
  MOCK_CUSTOMER_USER,
];

/** Find the demo user matching the entered credentials, or null. */
export function matchMockUser(
  email: string,
  password: string
): MockLoginUser | null {
  const normalized = email.trim().toLowerCase();
  return (
    MOCK_LOGIN_USERS.find(
      (user) => user.email === normalized && user.password === password
    ) ?? null
  );
}

/** Where each demo user lands after login. */
export function mockHomePath(user: MockLoginUser): string {
  return user.role === 'kunde' ? '/konto' : '/admin';
}

/** Persist the demo session in localStorage and cookies (browser only). */
export function setMockSession(user: MockLoginUser): void {
  localStorage.setItem('mock_user', JSON.stringify(user));
  localStorage.setItem('mock_session', 'true');
  document.cookie = 'mock_session=true; path=/; max-age=86400';
  document.cookie = `mock_user=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=86400`;
}
