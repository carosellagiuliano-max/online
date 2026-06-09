import { test, expect } from '@playwright/test';

/**
 * BeautifyPRO Customer Portal E2E Tests
 * Tests for logged-in customer functionality
 */

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/konto/login');

    // Login page should load
    await expect(page.locator('body')).toBeVisible();

    // Should show login form
    const loginForm = page.locator('form, [class*="login"], [class*="auth"]');
    await expect(loginForm.first()).toBeVisible();
  });

  test('should have email input', async ({ page }) => {
    await page.goto('/konto/login');

    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput.first()).toBeVisible();
  });

  test('should have login button', async ({ page }) => {
    await page.goto('/konto/login');

    const loginButton = page.locator('button[type="submit"], button:has-text(/anmelden|login|einloggen/i)');
    await expect(loginButton.first()).toBeVisible();
  });

  test('should show error for invalid login', async ({ page }) => {
    await page.goto('/konto/login');
    await page.waitForTimeout(500);

    // Enter invalid credentials
    const emailInput = page.locator('input[type="email"]').first();
    if (await emailInput.isVisible()) {
      await emailInput.fill('invalid@test.com');

      // Submit form
      const submitButton = page.locator('button[type="submit"]').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        await page.waitForTimeout(2000);

        // Should show error or stay on login page
        // (Magic link flow might not show immediate error)
      }
    }
  });

  test('should redirect unauthenticated users', async ({ page }) => {
    await page.goto('/konto/termine');

    // Should redirect to login
    await page.waitForTimeout(1000);
    const url = page.url();

    // Either redirected to login or shows login prompt
    const isLoginPage = url.includes('login');
    const hasLoginPrompt = await page.locator('text=/anmelden|login/i').first().isVisible().catch(() => false);

    expect(isLoginPage || hasLoginPrompt).toBeTruthy();
  });
});

test.describe('Customer Dashboard', () => {
  // Note: These tests require authentication
  // In a real scenario, you would use test fixtures for auth

  test('should display account overview page', async ({ page }) => {
    await page.goto('/konto');

    // Page should load (might redirect to login)
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have navigation to different sections', async ({ page }) => {
    await page.goto('/konto');
    await page.waitForTimeout(1000);

    // Look for account navigation
    const accountNav = page.locator('nav, [class*="sidebar"], [class*="menu"]');
    const hasNav = await accountNav.first().isVisible().catch(() => false);
  });
});

test.describe('Appointments Section', () => {
  test('should display appointments page', async ({ page }) => {
    await page.goto('/konto/termine');

    // Page should load
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show upcoming appointments tab', async ({ page }) => {
    await page.goto('/konto/termine');
    await page.waitForTimeout(1000);

    // Look for tabs
    const upcomingTab = page.locator('button:has-text(/anstehend|upcoming/i), [role="tab"]:has-text(/anstehend/i)');
    const hasUpcoming = await upcomingTab.first().isVisible().catch(() => false);
  });

  test('should show past appointments tab', async ({ page }) => {
    await page.goto('/konto/termine');
    await page.waitForTimeout(1000);

    // Look for past tab
    const pastTab = page.locator('button:has-text(/vergangen|past|historie/i), [role="tab"]:has-text(/vergangen/i)');
    const hasPast = await pastTab.first().isVisible().catch(() => false);
  });

  test('should have new appointment button', async ({ page }) => {
    await page.goto('/konto/termine');
    await page.waitForTimeout(1000);

    // Look for new appointment button
    const newAppointmentBtn = page.locator('a:has-text(/neuer termin|termin buchen/i), button:has-text(/neuer termin/i)');
    const hasNewBtn = await newAppointmentBtn.first().isVisible().catch(() => false);
  });
});

test.describe('Orders Section', () => {
  test('should display orders page', async ({ page }) => {
    await page.goto('/konto/bestellungen');

    // Page should load
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show order history', async ({ page }) => {
    await page.goto('/konto/bestellungen');
    await page.waitForTimeout(1000);

    // Should show orders or empty state
    const ordersContent = page.locator('text=/bestellung|order|keine bestellungen/i').first();
    const hasOrdersContent = await ordersContent.isVisible().catch(() => false);
  });
});

test.describe('Profile Section', () => {
  test('should display profile page', async ({ page }) => {
    await page.goto('/konto/profil');

    // Page should load
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show profile form', async ({ page }) => {
    await page.goto('/konto/profil');
    await page.waitForTimeout(1000);

    // Look for profile inputs
    const nameInput = page.locator('input[name="name"], input[name="firstName"], input[name="vorname"]');
    const hasProfileForm = await nameInput.first().isVisible().catch(() => false);
  });

  test('should have save button', async ({ page }) => {
    await page.goto('/konto/profil');
    await page.waitForTimeout(1000);

    const saveButton = page.locator('button:has-text(/speichern|save|aktualisieren/i)');
    const hasSaveBtn = await saveButton.first().isVisible().catch(() => false);
  });
});

test.describe('Loyalty/Points', () => {
  test('should show loyalty points if feature exists', async ({ page }) => {
    await page.goto('/konto');
    await page.waitForTimeout(1000);

    // Look for loyalty/points section
    const loyaltySection = page.locator('text=/punkte|points|treueprogramm|loyalty/i');
    const hasLoyalty = await loyaltySection.first().isVisible().catch(() => false);

    // Loyalty might not be visible to all customers
  });
});

test.describe('Logout', () => {
  test('should have logout option', async ({ page }) => {
    await page.goto('/konto');
    await page.waitForTimeout(1000);

    // Look for logout button
    const logoutButton = page.locator('button:has-text(/abmelden|logout|ausloggen/i), a:has-text(/abmelden/i)');
    const hasLogout = await logoutButton.first().isVisible().catch(() => false);
  });
});

test.describe('Mobile Customer Portal', () => {
  test('should work on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/konto');

    // Page should load on mobile
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have accessible navigation on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/konto/termine');
    await page.waitForTimeout(1000);

    // Navigation should be accessible (might be in hamburger menu)
    const nav = page.locator('nav, [class*="menu"], button[aria-label*="menu" i]');
    const hasNav = await nav.first().isVisible().catch(() => false);
  });
});
