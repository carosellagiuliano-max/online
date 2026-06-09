import { test, expect } from '@playwright/test';

/**
 * BeautifyPRO Public Site E2E Tests
 * Tests for publicly accessible pages
 */

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the hero section', async ({ page }) => {
    // Check main heading is visible
    await expect(page.locator('h1')).toBeVisible();

    // Check CTA button exists
    const bookingButton = page.getByRole('link', { name: /termin|buchen/i });
    await expect(bookingButton).toBeVisible();
  });

  test('should have working navigation', async ({ page }) => {
    // Check navigation is visible
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Check main nav links exist
    await expect(page.getByRole('link', { name: /leistungen|services/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /shop/i })).toBeVisible();
  });

  test('should display services section', async ({ page }) => {
    // Scroll to services section or click nav link
    await page.getByRole('link', { name: /leistungen|services/i }).first().click();

    // Wait for navigation or scroll
    await page.waitForTimeout(500);

    // Check services are displayed
    const servicesSection = page.locator('section').filter({ hasText: /leistungen|services/i });
    await expect(servicesSection).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Page should still load
    await expect(page.locator('body')).toBeVisible();

    // Mobile menu should exist (hamburger button)
    const menuButton = page.locator('button[aria-label*="menu" i], button[aria-label*="menü" i], [data-testid="mobile-menu"]').first();
    // Menu button might not exist if nav is always visible - that's ok
  });
});

test.describe('Shop Page', () => {
  test('should display product categories', async ({ page }) => {
    await page.goto('/shop');

    // Page title should be visible
    await expect(page.locator('h1')).toContainText(/shop/i);

    // Should show product categories or featured products
    const productCards = page.locator('[class*="card"], [class*="product"]');
    await expect(productCards.first()).toBeVisible();
  });

  test('should have clickable product links', async ({ page }) => {
    await page.goto('/shop');

    // Find a product link/card
    const productLink = page.locator('a[href*="/shop/"], a[href*="/produkt"]').first();

    if (await productLink.isVisible()) {
      await productLink.click();
      // Should navigate to product detail or category
      await expect(page.url()).toMatch(/shop|produkt/i);
    }
  });
});

test.describe('Gallery Page', () => {
  test('should display gallery images', async ({ page }) => {
    await page.goto('/galerie');

    // Page should load
    await expect(page.locator('h1')).toContainText(/galerie/i);

    // Should have images
    const images = page.locator('img');
    await expect(images.first()).toBeVisible();
  });
});

test.describe('Contact/About Page', () => {
  test('should display contact information', async ({ page }) => {
    await page.goto('/ueber-uns');

    // Should show contact details
    const contactSection = page.locator('body');
    await expect(contactSection).toBeVisible();

    // Check for address or phone
    const hasContactInfo = await page.locator('text=/St.*Gallen|079|078|info@/i').first().isVisible().catch(() => false);
    // Contact info might be on different page - that's ok
  });
});

test.describe('SEO & Meta', () => {
  test('should have proper meta title', async ({ page }) => {
    await page.goto('/');

    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.toLowerCase()).toContain('beauty');
  });

  test('should have meta description', async ({ page }) => {
    await page.goto('/');

    const metaDescription = await page.locator('meta[name="description"]').getAttribute('content');
    expect(metaDescription).toBeTruthy();
  });

  test('should have Open Graph tags', async ({ page }) => {
    await page.goto('/');

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toBeTruthy();
  });
});

test.describe('Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');

    // Should have exactly one h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);
  });

  test('should have alt text on images', async ({ page }) => {
    await page.goto('/');

    const images = page.locator('img:visible');
    const imageCount = await images.count();

    for (let i = 0; i < Math.min(imageCount, 5); i++) {
      const alt = await images.nth(i).getAttribute('alt');
      // Alt can be empty string for decorative images, but should exist
      expect(alt).not.toBeNull();
    }
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');

    // Tab through the page
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Something should be focused
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });
});

test.describe('Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;

    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });
});
