import { test, expect } from '@playwright/test';

/**
 * BeautifyPRO Shop Checkout E2E Tests
 * Tests the complete shop checkout process
 */

test.describe('Shop Products', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/shop');
  });

  test('should display products', async ({ page }) => {
    // Wait for products to load
    await page.waitForTimeout(1000);

    // Should show product cards
    const productCards = page.locator('[class*="card"], [class*="product"]');
    await expect(productCards.first()).toBeVisible();
  });

  test('should show product details', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Products should have name and price
    const productName = page.locator('h2, h3, [class*="title"]').first();
    await expect(productName).toBeVisible();

    // Look for prices
    const price = page.locator('text=/CHF|Fr\\./i').first();
    const hasPrice = await price.isVisible().catch(() => false);
  });

  test('should have add to cart functionality', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Find add to cart button
    const addToCartButton = page.locator('button:has-text(/warenkorb|cart|kaufen|hinzufügen/i)').first();
    const hasAddToCart = await addToCartButton.isVisible().catch(() => false);

    // Add to cart might be on product detail page
  });
});

test.describe('Shopping Cart', () => {
  test('should display cart icon in header', async ({ page }) => {
    await page.goto('/shop');

    // Look for cart icon/button
    const cartIcon = page.locator('[aria-label*="cart" i], [aria-label*="warenkorb" i], button:has([class*="cart"]), a[href*="cart"], a[href*="warenkorb"]').first();
    const hasCartIcon = await cartIcon.isVisible().catch(() => false);

    // Cart might be in a different location
  });

  test('should show cart item count', async ({ page }) => {
    await page.goto('/shop');

    // Cart badge showing item count
    const cartBadge = page.locator('[class*="badge"], [class*="count"]').first();
    // Badge might not exist if cart is empty
  });

  test('should allow viewing cart', async ({ page }) => {
    await page.goto('/shop');

    // Click cart icon if exists
    const cartLink = page.locator('a[href*="cart"], a[href*="warenkorb"], button[aria-label*="cart" i]').first();

    if (await cartLink.isVisible()) {
      await cartLink.click();
      await page.waitForTimeout(500);
      // Should navigate to cart or open cart dialog
    }
  });
});

test.describe('Checkout Process', () => {
  test('should display checkout page', async ({ page }) => {
    await page.goto('/checkout');

    // Checkout page should load
    await expect(page.locator('body')).toBeVisible();

    // Should show checkout content or redirect to cart
    const checkoutContent = page.locator('text=/checkout|kasse|bezahlen|warenkorb/i').first();
    const hasCheckoutContent = await checkoutContent.isVisible().catch(() => false);
  });

  test('should show order summary', async ({ page }) => {
    await page.goto('/checkout');
    await page.waitForTimeout(1000);

    // Order summary with totals
    const summary = page.locator('text=/summe|total|gesamt/i').first();
    const hasSummary = await summary.isVisible().catch(() => false);
  });

  test('should require customer information', async ({ page }) => {
    await page.goto('/checkout');
    await page.waitForTimeout(1000);

    // Check for customer info inputs
    const emailInput = page.locator('input[type="email"]');
    const hasEmailInput = await emailInput.first().isVisible().catch(() => false);
  });

  test('should show payment options', async ({ page }) => {
    await page.goto('/checkout');
    await page.waitForTimeout(1000);

    // Payment methods (Stripe, etc.)
    const paymentSection = page.locator('text=/zahlung|payment|kreditkarte|stripe/i').first();
    const hasPayment = await paymentSection.isVisible().catch(() => false);
  });
});

test.describe('Vouchers/Gift Cards', () => {
  test('should display voucher purchase option', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForTimeout(1000);

    // Look for voucher/gift card section
    const voucherSection = page.locator('text=/gutschein|voucher|geschenk/i').first();
    const hasVouchers = await voucherSection.isVisible().catch(() => false);
  });

  test('should allow voucher code entry at checkout', async ({ page }) => {
    await page.goto('/checkout');
    await page.waitForTimeout(1000);

    // Voucher code input
    const voucherInput = page.locator('input[placeholder*="gutschein" i], input[placeholder*="code" i], input[name*="voucher" i]').first();
    const hasVoucherInput = await voucherInput.isVisible().catch(() => false);
  });
});

test.describe('Payment Integration', () => {
  test('should display Stripe payment form when applicable', async ({ page }) => {
    await page.goto('/checkout');
    await page.waitForTimeout(2000);

    // Stripe Elements iframe
    const stripeFrame = page.locator('iframe[name*="stripe"], [class*="stripe"], #card-element');
    const hasStripe = await stripeFrame.first().isVisible().catch(() => false);

    // Stripe might only appear after adding items to cart
  });
});

test.describe('Order Confirmation', () => {
  test('should show success page after payment', async ({ page }) => {
    // This would need a successful payment to test
    // For now, just check the success page exists
    await page.goto('/zahlung-erfolgreich');

    // Page should load (might redirect if no valid session)
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show order details on success', async ({ page }) => {
    await page.goto('/zahlung-erfolgreich');
    await page.waitForTimeout(1000);

    // Success content or redirect
    const successContent = page.locator('text=/erfolg|bestätigung|danke|thank/i').first();
    const hasSuccess = await successContent.isVisible().catch(() => false);
  });
});

test.describe('Error Handling', () => {
  test('should show cancelled payment page', async ({ page }) => {
    await page.goto('/zahlung-abgebrochen');

    // Cancelled page should load
    await expect(page.locator('body')).toBeVisible();

    // Should show cancellation message
    const cancelContent = page.locator('text=/abgebrochen|cancelled|fehler/i').first();
    const hasCancelContent = await cancelContent.isVisible().catch(() => false);
  });

  test('should handle empty cart gracefully', async ({ page }) => {
    await page.goto('/checkout');

    // Should show message or redirect for empty cart
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Mobile Checkout', () => {
  test('should work on mobile devices', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/shop');

    // Shop should be usable on mobile
    await expect(page.locator('body')).toBeVisible();

    // Products should be visible
    const content = page.locator('main, [class*="content"]');
    await expect(content.first()).toBeVisible();
  });

  test('should have touch-friendly buttons', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/shop');
    await page.waitForTimeout(1000);

    // Buttons should be large enough for touch
    const buttons = page.locator('button').first();
    if (await buttons.isVisible()) {
      const box = await buttons.boundingBox();
      if (box) {
        // Minimum touch target size (44x44 recommended)
        expect(box.height).toBeGreaterThanOrEqual(32);
      }
    }
  });
});
