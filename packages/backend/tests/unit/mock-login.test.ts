/**
 * ============================================
 * BeautifyPRO - Mock Login Tests
 * Unit tests for the shared demo-login matcher
 * used by both the customer and admin login forms
 * ============================================
 */

import { describe, it, expect } from 'vitest';
import { matchMockUser, mockHomePath } from '@/lib/mock/mock-login';
import {
  MOCK_ADMIN_USER,
  MOCK_STAFF_USER,
  MOCK_CUSTOMER_USER,
} from '@/lib/mock/mock-data';

describe('matchMockUser', () => {
  it('matches the demo customer', () => {
    expect(
      matchMockUser(MOCK_CUSTOMER_USER.email, MOCK_CUSTOMER_USER.password)
    ).toEqual(MOCK_CUSTOMER_USER);
  });

  it('matches the demo admin', () => {
    expect(
      matchMockUser(MOCK_ADMIN_USER.email, MOCK_ADMIN_USER.password)
    ).toEqual(MOCK_ADMIN_USER);
  });

  it('matches the demo staff member', () => {
    expect(
      matchMockUser(MOCK_STAFF_USER.email, MOCK_STAFF_USER.password)
    ).toEqual(MOCK_STAFF_USER);
  });

  it('ignores case and surrounding whitespace in the email', () => {
    expect(
      matchMockUser('  Admin@BeautifyPRO.demo  ', MOCK_ADMIN_USER.password)
    ).toEqual(MOCK_ADMIN_USER);
  });

  it('rejects a wrong password', () => {
    expect(matchMockUser(MOCK_ADMIN_USER.email, 'falsch')).toBeNull();
  });

  it('rejects an unknown email', () => {
    expect(matchMockUser('wer@anders.demo', 'beauty-admin-demo')).toBeNull();
  });
});

describe('mockHomePath', () => {
  it('sends the customer to the account area', () => {
    expect(mockHomePath(MOCK_CUSTOMER_USER)).toBe('/konto');
  });

  it('sends admin and staff to the admin area', () => {
    expect(mockHomePath(MOCK_ADMIN_USER)).toBe('/admin');
    expect(mockHomePath(MOCK_STAFF_USER)).toBe('/admin');
  });
});
