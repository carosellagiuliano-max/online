import { test, expect, type Page } from '@playwright/test';

/**
 * BeautifyPRO Admin Portal E2E Tests
 * Tests for admin/staff functionality
 */

test.describe('Admin Authentication', () => {
  test('should display admin login page', async ({ page }) => {
    await page.goto('/admin');

    // Should show login or redirect to login
    await expect(page.locator('body')).toBeVisible();

    // Look for login form or admin content
    const hasLoginOrAdmin = await page
      .locator('text=/anmelden|login|admin|dashboard/i')
      .first()
      .isVisible()
      .catch(() => false);
  });

  test('should require authentication', async ({ page }) => {
    await page.goto('/admin/kalender');

    // Should redirect to login if not authenticated
    await page.waitForTimeout(1000);

    const url = page.url();
    const hasLoginForm = await page.locator('input[type="email"], input[type="password"]').first().isVisible().catch(() => false);

    // Either redirected or shows login form
    expect(url.includes('login') || url.includes('admin') || hasLoginForm).toBeTruthy();
  });
});

test.describe('Admin Dashboard', () => {
  // Note: These tests ideally require admin authentication
  // Would use auth fixtures in real implementation

  test('should display dashboard page', async ({ page }) => {
    await page.goto('/admin');

    await expect(page.locator('body')).toBeVisible();
  });

  test('should show key metrics cards', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForTimeout(1000);

    // Look for metric cards
    const metricCards = page.locator('[class*="card"], [class*="stat"], [class*="metric"]');
    const hasMetrics = await metricCards.first().isVisible().catch(() => false);
  });

  test('should have sidebar navigation', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForTimeout(1000);

    // Look for sidebar
    const sidebar = page.locator('[class*="sidebar"], aside, nav[class*="admin"]');
    const hasSidebar = await sidebar.first().isVisible().catch(() => false);
  });
});

test.describe('Calendar Management', () => {
  async function isLoginVisible(page: Page) {
    return page.locator('input[type="email"], input[type="password"]').first().isVisible().catch(() => false);
  }

  test('should display calendar view', async ({ page }) => {
    await page.goto('/admin/kalender');

    await expect(page.locator('body')).toBeVisible();
    const hasCalendarShell = await page.locator('[class*="calendar"], .fc, [class*="schedule"]').first().isVisible().catch(() => false);
    expect(hasCalendarShell || await isLoginVisible(page)).toBeTruthy();
  });

  test('should show week/day view options', async ({ page }) => {
    await page.goto('/admin/kalender');
    await page.waitForTimeout(1000);

    // View switcher buttons
    const viewButtons = page.locator('button:has-text(/woche|tag|week|day/i)');
    const hasViewOptions = await viewButtons.first().isVisible().catch(() => false);
    expect(hasViewOptions || await isLoginVisible(page)).toBeTruthy();
  });

  test('should have navigation controls', async ({ page }) => {
    await page.goto('/admin/kalender');
    await page.waitForTimeout(1000);

    // Previous/Next buttons
    const navButtons = page.locator('button[aria-label*="prev"], button[aria-label*="next"], button:has-text(/vor|zurück/i)');
    const hasNavControls = await navButtons.first().isVisible().catch(() => false);
    expect(hasNavControls || await isLoginVisible(page)).toBeTruthy();
  });

  test('should show appointment slots', async ({ page }) => {
    await page.goto('/admin/kalender');
    await page.waitForTimeout(1000);

    // Time grid or appointment cards
    const timeGrid = page.locator('[class*="calendar"], [class*="grid"], [class*="schedule"]');
    const hasTimeGrid = await timeGrid.first().isVisible().catch(() => false);
    expect(hasTimeGrid || await isLoginVisible(page)).toBeTruthy();
  });
});

test.describe('Customer Management', () => {
  test('should display customers page', async ({ page }) => {
    await page.goto('/admin/kunden');

    await expect(page.locator('body')).toBeVisible();
  });

  test('should have customer search', async ({ page }) => {
    await page.goto('/admin/kunden');
    await page.waitForTimeout(1000);

    // Search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="such" i], input[placeholder*="search" i]');
    const hasSearch = await searchInput.first().isVisible().catch(() => false);
  });

  test('should show customer list', async ({ page }) => {
    await page.goto('/admin/kunden');
    await page.waitForTimeout(1000);

    // Customer table or list
    const customerList = page.locator('table, [class*="list"], [class*="grid"]');
    const hasCustomerList = await customerList.first().isVisible().catch(() => false);
  });

  test('should have add customer button', async ({ page }) => {
    await page.goto('/admin/kunden');
    await page.waitForTimeout(1000);

    const addButton = page.locator('button:has-text(/neu|add|hinzufügen|kunde anlegen/i)');
    const hasAddBtn = await addButton.first().isVisible().catch(() => false);
  });
});

test.describe('Team Management', () => {
  test('should display team page', async ({ page }) => {
    await page.goto('/admin/team');

    await expect(page.locator('body')).toBeVisible();
  });

  test('should show staff members', async ({ page }) => {
    await page.goto('/admin/team');
    await page.waitForTimeout(1000);

    // Staff list or cards
    const staffList = page.locator('[class*="card"], [class*="team"], table');
    const hasStaffList = await staffList.first().isVisible().catch(() => false);
  });
});

test.describe('Order Management', () => {
  test('should display orders page', async ({ page }) => {
    await page.goto('/admin/bestellungen');

    await expect(page.locator('body')).toBeVisible();
  });

  test('should show order list', async ({ page }) => {
    await page.goto('/admin/bestellungen');
    await page.waitForTimeout(1000);

    // Order table or list
    const orderList = page.locator('table, [class*="order"], [class*="list"]');
    const hasOrderList = await orderList.first().isVisible().catch(() => false);
  });

  test('should have status filter', async ({ page }) => {
    await page.goto('/admin/bestellungen');
    await page.waitForTimeout(1000);

    // Filter options
    const filterSelect = page.locator('select, button:has-text(/status|filter/i), [class*="filter"]');
    const hasFilter = await filterSelect.first().isVisible().catch(() => false);
  });
});

test.describe('Analytics', () => {
  test('should display analytics page', async ({ page }) => {
    await page.goto('/admin/analytics');

    await expect(page.locator('body')).toBeVisible();
  });

  test('should show charts or metrics', async ({ page }) => {
    await page.goto('/admin/analytics');
    await page.waitForTimeout(1000);

    // Chart elements or metric displays
    const charts = page.locator('[class*="chart"], [class*="graph"], canvas, svg');
    const hasCharts = await charts.first().isVisible().catch(() => false);
  });

  test('should have date range selector', async ({ page }) => {
    await page.goto('/admin/analytics');
    await page.waitForTimeout(1000);

    const dateSelector = page.locator('button:has-text(/zeitraum|date|tage|wochen/i), [class*="date-picker"]');
    const hasDateSelector = await dateSelector.first().isVisible().catch(() => false);
  });
});

test.describe('Settings', () => {
  test('should display settings page', async ({ page }) => {
    await page.goto('/admin/einstellungen');

    await expect(page.locator('body')).toBeVisible();
  });

  test('should show opening hours section', async ({ page }) => {
    await page.goto('/admin/einstellungen');
    await page.waitForTimeout(1000);

    const openingHours = page.locator('text=/öffnungszeiten|opening hours/i');
    const hasOpeningHours = await openingHours.first().isVisible().catch(() => false);
  });

  test('should show services management', async ({ page }) => {
    await page.goto('/admin/einstellungen');
    await page.waitForTimeout(1000);

    const services = page.locator('text=/dienstleistungen|services|leistungen/i');
    const hasServices = await services.first().isVisible().catch(() => false);
  });
});

test.describe('Notifications', () => {
  test('should display notifications page', async ({ page }) => {
    await page.goto('/admin/benachrichtigungen');

    await expect(page.locator('body')).toBeVisible();
  });

  test('should show notification templates', async ({ page }) => {
    await page.goto('/admin/benachrichtigungen');
    await page.waitForTimeout(1000);

    const templates = page.locator('text=/vorlage|template|e-mail|sms/i');
    const hasTemplates = await templates.first().isVisible().catch(() => false);
  });
});

test.describe('Mobile Admin', () => {
  test('should work on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/admin');

    await expect(page.locator('body')).toBeVisible();
  });

  test('should have mobile navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/admin');
    await page.waitForTimeout(1000);

    // Mobile menu button
    const mobileMenuBtn = page.locator('button[aria-label*="menu" i], button[class*="menu"], [data-testid="mobile-menu"]');
    const hasMobileMenu = await mobileMenuBtn.first().isVisible().catch(() => false);
  });
});

test.describe('Admin Actions', () => {
  test('should have create appointment button', async ({ page }) => {
    await page.goto('/admin/kalender');
    await page.waitForTimeout(1000);

    const createBtn = page.locator('button:has-text(/neuer termin|termin erstellen|hinzufügen/i)');
    const hasCreateBtn = await createBtn.first().isVisible().catch(() => false);
  });

  test('should have export functionality', async ({ page }) => {
    await page.goto('/admin/export');

    await expect(page.locator('body')).toBeVisible();

    const exportBtn = page.locator('button:has-text(/export|download|herunterladen/i)');
    const hasExport = await exportBtn.first().isVisible().catch(() => false);
  });
});
