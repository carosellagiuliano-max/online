/**
 * ============================================
 * BeautifyPRO - Cart Domain Tests
 * Unit tests for cart operations
 * ============================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEmptyCart,
  addItemToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  applyDiscount,
  removeDiscount,
  setShippingMethod,
  calculateTotals,
  isCartValidForCheckout,
  isDigitalOnlyCart,
  formatPrice,
  getItemCount,
  hasItems,
  findCartItem,
  isProductInCart,
} from '@/lib/domain/cart/cart';
import type { Cart, CartDiscount, ShippingMethod, AddToCartInput } from '@/lib/domain/cart/types';

// ============================================
// TEST FIXTURES
// ============================================

const mockProductData = {
  name: 'BeautifyPRO Shampoo',
  description: 'Premium Haarpflege',
  imageUrl: '/images/shampoo.jpg',
  priceCents: 2500,
  sku: 'SW-SHAMPOO-001',
};

const mockVoucherData = {
  name: 'Geschenkgutschein CHF 50',
  description: 'Einlösbar für alle Dienstleistungen',
  imageUrl: '/images/voucher.jpg',
  priceCents: 5000,
};

const mockShippingMethod: ShippingMethod = {
  type: 'standard',
  name: 'Standardversand',
  description: '3-5 Werktage',
  priceCents: 700,
};

const createProductInput = (overrides?: Partial<AddToCartInput>): AddToCartInput => ({
  type: 'product',
  productId: 'product-1',
  quantity: 1,
  ...overrides,
});

const createVoucherInput = (overrides?: Partial<AddToCartInput>): AddToCartInput => ({
  type: 'voucher',
  voucherId: 'voucher-1',
  quantity: 1,
  voucherValue: 5000,
  recipientEmail: 'recipient@example.com',
  recipientName: 'Max Muster',
  ...overrides,
});

// ============================================
// UNIT TESTS
// ============================================

describe('Cart Domain', () => {
  describe('createEmptyCart', () => {
    it('should create an empty cart with default values', () => {
      const cart = createEmptyCart();

      expect(cart.id).toBeDefined();
      expect(cart.id).toMatch(/^cart_/);
      expect(cart.items).toHaveLength(0);
      expect(cart.discounts).toHaveLength(0);
      expect(cart.shippingMethod).toBeUndefined();
      expect(cart.totals.itemCount).toBe(0);
      expect(cart.totals.totalCents).toBe(0);
    });

    it('should set expiration date 7 days in the future', () => {
      const cart = createEmptyCart();
      const now = new Date();
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Allow 1 second tolerance
      expect(cart.expiresAt.getTime()).toBeGreaterThan(sevenDaysLater.getTime() - 1000);
      expect(cart.expiresAt.getTime()).toBeLessThan(sevenDaysLater.getTime() + 1000);
    });
  });

  describe('addItemToCart', () => {
    let cart: Cart;

    beforeEach(() => {
      cart = createEmptyCart();
    });

    it('should add a product to empty cart', () => {
      const input = createProductInput();
      const updatedCart = addItemToCart(cart, input, mockProductData);

      expect(updatedCart.items).toHaveLength(1);
      expect(updatedCart.items[0].type).toBe('product');
      expect(updatedCart.items[0].productId).toBe('product-1');
      expect(updatedCart.items[0].quantity).toBe(1);
      expect(updatedCart.items[0].unitPriceCents).toBe(2500);
      expect(updatedCart.items[0].totalPriceCents).toBe(2500);
    });

    it('should increment quantity when same product added', () => {
      const input = createProductInput({ quantity: 2 });
      let updatedCart = addItemToCart(cart, input, mockProductData);
      updatedCart = addItemToCart(updatedCart, createProductInput({ quantity: 3 }), mockProductData);

      expect(updatedCart.items).toHaveLength(1);
      expect(updatedCart.items[0].quantity).toBe(5);
      expect(updatedCart.items[0].totalPriceCents).toBe(12500);
    });

    it('should add voucher with recipient info', () => {
      const input = createVoucherInput();
      const updatedCart = addItemToCart(cart, input, mockVoucherData);

      expect(updatedCart.items).toHaveLength(1);
      expect(updatedCart.items[0].type).toBe('voucher');
      expect(updatedCart.items[0].recipientEmail).toBe('recipient@example.com');
      expect(updatedCart.items[0].recipientName).toBe('Max Muster');
      expect(updatedCart.items[0].voucherValue).toBe(5000);
    });

    it('should create separate items for multiple vouchers', () => {
      const input1 = createVoucherInput();
      const input2 = createVoucherInput({ voucherValue: 10000 });

      let updatedCart = addItemToCart(cart, input1, mockVoucherData);
      updatedCart = addItemToCart(updatedCart, input2, { ...mockVoucherData, priceCents: 10000 });

      expect(updatedCart.items).toHaveLength(2);
    });

    it('should update cart totals when adding items', () => {
      const input = createProductInput({ quantity: 3 });
      const updatedCart = addItemToCart(cart, input, mockProductData);

      expect(updatedCart.totals.subtotalCents).toBe(7500);
      expect(updatedCart.totals.itemCount).toBe(3);
    });

    it('should update timestamps when adding items', () => {
      const originalUpdatedAt = cart.updatedAt;
      const input = createProductInput();

      // Small delay to ensure timestamp difference
      const updatedCart = addItemToCart(cart, input, mockProductData);

      expect(updatedCart.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });
  });

  describe('updateCartItem', () => {
    let cartWithItems: Cart;

    beforeEach(() => {
      let cart = createEmptyCart();
      cart = addItemToCart(cart, createProductInput({ quantity: 2 }), mockProductData);
      cartWithItems = cart;
    });

    it('should update item quantity', () => {
      const itemId = cartWithItems.items[0].id;
      const updatedCart = updateCartItem(cartWithItems, { itemId, quantity: 5 });

      expect(updatedCart.items[0].quantity).toBe(5);
      expect(updatedCart.items[0].totalPriceCents).toBe(12500);
    });

    it('should remove item when quantity set to 0', () => {
      const itemId = cartWithItems.items[0].id;
      const updatedCart = updateCartItem(cartWithItems, { itemId, quantity: 0 });

      expect(updatedCart.items).toHaveLength(0);
    });

    it('should remove item when quantity is negative', () => {
      const itemId = cartWithItems.items[0].id;
      const updatedCart = updateCartItem(cartWithItems, { itemId, quantity: -1 });

      expect(updatedCart.items).toHaveLength(0);
    });

    it('should return unchanged cart for non-existent item', () => {
      const updatedCart = updateCartItem(cartWithItems, { itemId: 'non-existent', quantity: 5 });

      expect(updatedCart).toEqual(cartWithItems);
    });

    it('should update variant if provided', () => {
      const itemId = cartWithItems.items[0].id;
      const updatedCart = updateCartItem(cartWithItems, { itemId, variant: 'large' });

      expect(updatedCart.items[0].variant).toBe('large');
    });
  });

  describe('removeCartItem', () => {
    it('should remove item from cart', () => {
      let cart = createEmptyCart();
      cart = addItemToCart(cart, createProductInput(), mockProductData);
      const itemId = cart.items[0].id;

      const updatedCart = removeCartItem(cart, itemId);

      expect(updatedCart.items).toHaveLength(0);
    });

    it('should not affect other items when removing one', () => {
      let cart = createEmptyCart();
      cart = addItemToCart(cart, createProductInput({ productId: 'product-1' }), mockProductData);
      cart = addItemToCart(cart, createProductInput({ productId: 'product-2' }), { ...mockProductData, name: 'Other Product' });

      const itemIdToRemove = cart.items[0].id;
      const updatedCart = removeCartItem(cart, itemIdToRemove);

      expect(updatedCart.items).toHaveLength(1);
      expect(updatedCart.items[0].productId).toBe('product-2');
    });

    it('should recalculate totals after removal', () => {
      let cart = createEmptyCart();
      cart = addItemToCart(cart, createProductInput({ quantity: 2 }), mockProductData);
      const itemId = cart.items[0].id;

      expect(cart.totals.subtotalCents).toBe(5000);

      const updatedCart = removeCartItem(cart, itemId);

      expect(updatedCart.totals.subtotalCents).toBe(0);
    });
  });

  describe('clearCart', () => {
    it('should remove all items from cart', () => {
      let cart = createEmptyCart();
      cart = addItemToCart(cart, createProductInput(), mockProductData);
      cart = addItemToCart(cart, createVoucherInput(), mockVoucherData);

      const clearedCart = clearCart(cart);

      expect(clearedCart.items).toHaveLength(0);
      expect(clearedCart.discounts).toHaveLength(0);
    });

    it('should keep shipping method', () => {
      let cart = createEmptyCart();
      cart = addItemToCart(cart, createProductInput(), mockProductData);
      cart = setShippingMethod(cart, mockShippingMethod);

      const clearedCart = clearCart(cart);

      expect(clearedCart.shippingMethod).toEqual(mockShippingMethod);
    });
  });

  describe('applyDiscount', () => {
    it('should apply percentage discount', () => {
      let cart = createEmptyCart();
      cart = addItemToCart(cart, createProductInput({ quantity: 4 }), mockProductData); // 10000 cents

      const discount: CartDiscount = {
        code: 'SAVE10',
        type: 'percentage',
        value: 10,
        amountCents: 0,
      };

      const updatedCart = applyDiscount(cart, discount);

      expect(updatedCart.discounts).toHaveLength(1);
      expect(updatedCart.totals.discountCents).toBe(1000); // 10% of 10000
    });

    it('should apply fixed amount discount', () => {
      let cart = createEmptyCart();
      cart = addItemToCart(cart, createProductInput({ quantity: 4 }), mockProductData); // 10000 cents

      const discount: CartDiscount = {
        code: 'FLAT500',
        type: 'fixed',
        value: 500,
        amountCents: 500,
      };

      const updatedCart = applyDiscount(cart, discount);

      expect(updatedCart.totals.discountCents).toBe(500);
    });

    it('should not apply duplicate discount codes', () => {
      let cart = createEmptyCart();
      cart = addItemToCart(cart, createProductInput(), mockProductData);

      const discount: CartDiscount = {
        code: 'SAVE10',
        type: 'percentage',
        value: 10,
        amountCents: 0,
      };

      cart = applyDiscount(cart, discount);
      const updatedCart = applyDiscount(cart, discount);

      expect(updatedCart.discounts).toHaveLength(1);
    });
  });

  describe('removeDiscount', () => {
    it('should remove discount by code', () => {
      let cart = createEmptyCart();
      cart = addItemToCart(cart, createProductInput(), mockProductData);

      const discount: CartDiscount = {
        code: 'SAVE10',
        type: 'percentage',
        value: 10,
        amountCents: 0,
      };

      cart = applyDiscount(cart, discount);
      const updatedCart = removeDiscount(cart, 'SAVE10');

      expect(updatedCart.discounts).toHaveLength(0);
      expect(updatedCart.totals.discountCents).toBe(0);
    });
  });

  describe('setShippingMethod', () => {
    it('should set shipping method and update totals', () => {
      let cart = createEmptyCart();
      cart = addItemToCart(cart, createProductInput(), mockProductData);

      const updatedCart = setShippingMethod(cart, mockShippingMethod);

      expect(updatedCart.shippingMethod).toEqual(mockShippingMethod);
      expect(updatedCart.totals.shippingCents).toBe(700);
    });
  });

  describe('calculateTotals', () => {
    it('should calculate correct subtotal', () => {
      const items = [
        { totalPriceCents: 2500, quantity: 1 },
        { totalPriceCents: 5000, quantity: 2 },
      ] as any[];

      const totals = calculateTotals(items, [], undefined);

      expect(totals.subtotalCents).toBe(7500);
    });

    it('should calculate correct item count', () => {
      const items = [
        { totalPriceCents: 2500, quantity: 3 },
        { totalPriceCents: 5000, quantity: 2 },
      ] as any[];

      const totals = calculateTotals(items, [], undefined);

      expect(totals.itemCount).toBe(5);
    });

    it('should not allow discount to exceed subtotal', () => {
      const items = [{ totalPriceCents: 1000, quantity: 1 }] as any[];
      const discounts: CartDiscount[] = [
        { code: 'BIG', type: 'fixed', value: 5000, amountCents: 5000 },
      ];

      const totals = calculateTotals(items, discounts, undefined);

      expect(totals.discountCents).toBe(1000); // Capped at subtotal
      expect(totals.totalCents).toBe(0);
    });

    it('should calculate Swiss VAT (8.1%)', () => {
      const items = [{ totalPriceCents: 10000, quantity: 1 }] as any[];

      const totals = calculateTotals(items, [], undefined);

      // VAT is already included in Swiss prices
      // taxCents = 10000 * 0.081 / 1.081 ≈ 749
      expect(totals.taxCents).toBeGreaterThan(700);
      expect(totals.taxCents).toBeLessThan(800);
    });

    it('should include shipping in total', () => {
      const items = [{ totalPriceCents: 2500, quantity: 1 }] as any[];

      const totals = calculateTotals(items, [], mockShippingMethod);

      expect(totals.totalCents).toBe(3200); // 2500 + 700
    });
  });

  describe('isCartValidForCheckout', () => {
    it('should return invalid for empty cart', () => {
      const cart = createEmptyCart();
      const result = isCartValidForCheckout(cart);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Der Warenkorb ist leer.');
    });

    it('should return invalid for voucher without email', () => {
      let cart = createEmptyCart();
      const input = createVoucherInput({ recipientEmail: undefined });
      cart = addItemToCart(cart, input, mockVoucherData);

      // Manually clear the email for test
      cart.items[0].recipientEmail = undefined;

      const result = isCartValidForCheckout(cart);

      expect(result.valid).toBe(false);
    });

    it('should return valid for cart with products', () => {
      let cart = createEmptyCart();
      cart = addItemToCart(cart, createProductInput(), mockProductData);

      const result = isCartValidForCheckout(cart);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('isDigitalOnlyCart', () => {
    it('should return true for cart with only vouchers', () => {
      let cart = createEmptyCart();
      cart = addItemToCart(cart, createVoucherInput(), mockVoucherData);

      expect(isDigitalOnlyCart(cart)).toBe(true);
    });

    it('should return false for cart with physical products', () => {
      let cart = createEmptyCart();
      cart = addItemToCart(cart, createProductInput(), mockProductData);

      expect(isDigitalOnlyCart(cart)).toBe(false);
    });

    it('should return false for mixed cart', () => {
      let cart = createEmptyCart();
      cart = addItemToCart(cart, createProductInput(), mockProductData);
      cart = addItemToCart(cart, createVoucherInput(), mockVoucherData);

      expect(isDigitalOnlyCart(cart)).toBe(false);
    });
  });

  describe('formatPrice', () => {
    it('should format price in CHF', () => {
      expect(formatPrice(2500)).toBe('CHF 25.00');
      expect(formatPrice(100)).toBe('CHF 1.00');
      expect(formatPrice(9999)).toBe('CHF 99.99');
    });
  });

  describe('getItemCount', () => {
    it('should return total quantity of all items', () => {
      let cart = createEmptyCart();
      cart = addItemToCart(cart, createProductInput({ quantity: 3 }), mockProductData);
      cart = addItemToCart(cart, createVoucherInput({ quantity: 2 }), mockVoucherData);

      expect(getItemCount(cart)).toBe(5);
    });
  });

  describe('hasItems', () => {
    it('should return false for empty cart', () => {
      const cart = createEmptyCart();
      expect(hasItems(cart)).toBe(false);
    });

    it('should return true for cart with items', () => {
      let cart = createEmptyCart();
      cart = addItemToCart(cart, createProductInput(), mockProductData);
      expect(hasItems(cart)).toBe(true);
    });
  });

  describe('findCartItem', () => {
    it('should find item by id', () => {
      let cart = createEmptyCart();
      cart = addItemToCart(cart, createProductInput(), mockProductData);
      const itemId = cart.items[0].id;

      const found = findCartItem(cart, itemId);

      expect(found).toBeDefined();
      expect(found?.id).toBe(itemId);
    });

    it('should return undefined for non-existent item', () => {
      const cart = createEmptyCart();
      expect(findCartItem(cart, 'non-existent')).toBeUndefined();
    });
  });

  describe('isProductInCart', () => {
    it('should return true if product is in cart', () => {
      let cart = createEmptyCart();
      cart = addItemToCart(cart, createProductInput({ productId: 'prod-123' }), mockProductData);

      expect(isProductInCart(cart, 'prod-123')).toBe(true);
    });

    it('should return false if product is not in cart', () => {
      let cart = createEmptyCart();
      cart = addItemToCart(cart, createProductInput({ productId: 'prod-123' }), mockProductData);

      expect(isProductInCart(cart, 'prod-456')).toBe(false);
    });

    it('should check variant when specified', () => {
      let cart = createEmptyCart();
      cart = addItemToCart(cart, createProductInput({ productId: 'prod-123', variant: 'small' }), mockProductData);

      expect(isProductInCart(cart, 'prod-123', 'small')).toBe(true);
      expect(isProductInCart(cart, 'prod-123', 'large')).toBe(false);
    });
  });
});
