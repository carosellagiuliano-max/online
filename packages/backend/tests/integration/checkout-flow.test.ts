/**
 * ============================================
 * BeautifyPRO - Checkout Flow Integration Tests
 * Tests the complete checkout flow from cart to order
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
} from '@/lib/domain/cart/cart';
import {
  createOrder,
  createOrderItem,
  updateOrder,
  applyVoucher,
  calculateOrderTotals,
  calculateTaxFromGross,
  getShippingCents,
  validateOrderInput,
  validateOrderForPayment,
  isValidStatusTransition,
  transitionOrderStatus,
  isDigitalOnlyOrder,
  canCancel,
  canRefund,
  getStatusText,
} from '@/lib/domain/order/order';
import type { Cart, CartItem, AddToCartInput, CartDiscount } from '@/lib/domain/cart/types';
import type { Order, OrderItem, CreateOrderInput, CreateOrderItemInput } from '@/lib/domain/order/types';

// ============================================
// CART DOMAIN TESTS
// ============================================

describe('Cart Domain Service', () => {
  let cart: Cart;

  beforeEach(() => {
    cart = createEmptyCart();
  });

  describe('createEmptyCart', () => {
    it('should create an empty cart with defaults', () => {
      expect(cart.id).toMatch(/^cart_/);
      expect(cart.items).toHaveLength(0);
      expect(cart.discounts).toHaveLength(0);
      expect(cart.shippingMethod).toBeUndefined();
      expect(cart.totals.totalCents).toBe(0);
      expect(cart.totals.itemCount).toBe(0);
    });

    it('should set expiration date 7 days in the future', () => {
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Allow 1 minute tolerance
      expect(cart.expiresAt.getTime()).toBeGreaterThan(sevenDaysFromNow.getTime() - 60000);
      expect(cart.expiresAt.getTime()).toBeLessThan(sevenDaysFromNow.getTime() + 60000);
    });
  });

  describe('addItemToCart', () => {
    const productInput: AddToCartInput = {
      type: 'product',
      productId: 'prod-1',
      quantity: 1,
    };

    const productData = {
      name: 'Shampoo Premium',
      description: 'Hochwertiges Shampoo',
      priceCents: 2500,
      sku: 'SH-001',
    };

    it('should add a product to empty cart', () => {
      const updatedCart = addItemToCart(cart, productInput, productData);

      expect(updatedCart.items).toHaveLength(1);
      expect(updatedCart.items[0].name).toBe('Shampoo Premium');
      expect(updatedCart.items[0].unitPriceCents).toBe(2500);
      expect(updatedCart.items[0].quantity).toBe(1);
      expect(updatedCart.items[0].totalPriceCents).toBe(2500);
    });

    it('should increase quantity for existing product', () => {
      let updatedCart = addItemToCart(cart, productInput, productData);
      updatedCart = addItemToCart(updatedCart, productInput, productData);

      expect(updatedCart.items).toHaveLength(1);
      expect(updatedCart.items[0].quantity).toBe(2);
      expect(updatedCart.items[0].totalPriceCents).toBe(5000);
    });

    it('should add voucher as separate item', () => {
      const voucherInput: AddToCartInput = {
        type: 'voucher',
        productId: 'voucher-1',
        quantity: 1,
        voucherValue: 5000,
        recipientEmail: 'gift@example.ch',
        recipientName: 'Anna',
        personalMessage: 'Viel Spass!',
      };

      const voucherData = {
        name: 'Geschenkgutschein CHF 50',
        priceCents: 5000,
      };

      const updatedCart = addItemToCart(cart, voucherInput, voucherData);

      expect(updatedCart.items).toHaveLength(1);
      expect(updatedCart.items[0].type).toBe('voucher');
      expect(updatedCart.items[0].recipientEmail).toBe('gift@example.ch');
      expect(updatedCart.items[0].personalMessage).toBe('Viel Spass!');
    });

    it('should not merge voucher items', () => {
      const voucherInput: AddToCartInput = {
        type: 'voucher',
        productId: 'voucher-1',
        quantity: 1,
        voucherValue: 5000,
        recipientEmail: 'gift@example.ch',
      };

      const voucherData = {
        name: 'Geschenkgutschein CHF 50',
        priceCents: 5000,
      };

      let updatedCart = addItemToCart(cart, voucherInput, voucherData);
      updatedCart = addItemToCart(updatedCart, voucherInput, voucherData);

      expect(updatedCart.items).toHaveLength(2);
    });
  });

  describe('updateCartItem', () => {
    it('should update item quantity', () => {
      const productInput: AddToCartInput = {
        type: 'product',
        productId: 'prod-1',
        quantity: 1,
      };

      let updatedCart = addItemToCart(cart, productInput, {
        name: 'Test Product',
        priceCents: 1000,
      });

      const itemId = updatedCart.items[0].id;
      updatedCart = updateCartItem(updatedCart, { itemId, quantity: 5 });

      expect(updatedCart.items[0].quantity).toBe(5);
      expect(updatedCart.items[0].totalPriceCents).toBe(5000);
    });

    it('should remove item when quantity is 0', () => {
      const productInput: AddToCartInput = {
        type: 'product',
        productId: 'prod-1',
        quantity: 2,
      };

      let updatedCart = addItemToCart(cart, productInput, {
        name: 'Test Product',
        priceCents: 1000,
      });

      const itemId = updatedCart.items[0].id;
      updatedCart = updateCartItem(updatedCart, { itemId, quantity: 0 });

      expect(updatedCart.items).toHaveLength(0);
    });

    it('should return unchanged cart for non-existent item', () => {
      const updatedCart = updateCartItem(cart, { itemId: 'nonexistent', quantity: 5 });
      expect(updatedCart).toBe(cart);
    });
  });

  describe('removeCartItem', () => {
    it('should remove specific item from cart', () => {
      let updatedCart = addItemToCart(cart, { type: 'product', productId: 'prod-1', quantity: 1 }, { name: 'Product 1', priceCents: 1000 });
      updatedCart = addItemToCart(updatedCart, { type: 'product', productId: 'prod-2', quantity: 1 }, { name: 'Product 2', priceCents: 2000 });

      const itemId = updatedCart.items[0].id;
      updatedCart = removeCartItem(updatedCart, itemId);

      expect(updatedCart.items).toHaveLength(1);
      expect(updatedCart.items[0].name).toBe('Product 2');
    });
  });

  describe('clearCart', () => {
    it('should remove all items and discounts', () => {
      let updatedCart = addItemToCart(cart, { type: 'product', productId: 'prod-1', quantity: 3 }, { name: 'Product', priceCents: 1000 });
      updatedCart = applyDiscount(updatedCart, { code: 'TEST10', type: 'percentage', value: 10, amountCents: 0 });
      updatedCart = clearCart(updatedCart);

      expect(updatedCart.items).toHaveLength(0);
      expect(updatedCart.discounts).toHaveLength(0);
      expect(updatedCart.totals.totalCents).toBe(0);
    });
  });

  describe('calculateTotals', () => {
    it('should calculate correct totals', () => {
      const items: CartItem[] = [
        {
          id: '1',
          type: 'product',
          name: 'Product 1',
          quantity: 2,
          unitPriceCents: 1000,
          totalPriceCents: 2000,
        } as CartItem,
        {
          id: '2',
          type: 'product',
          name: 'Product 2',
          quantity: 1,
          unitPriceCents: 3000,
          totalPriceCents: 3000,
        } as CartItem,
      ];

      const totals = calculateTotals(items, [], undefined);

      expect(totals.subtotalCents).toBe(5000);
      expect(totals.itemCount).toBe(3);
      expect(totals.totalCents).toBe(5000);
    });

    it('should apply percentage discount', () => {
      const items: CartItem[] = [
        { id: '1', type: 'product', name: 'Product', quantity: 1, unitPriceCents: 10000, totalPriceCents: 10000 } as CartItem,
      ];

      const discounts: CartDiscount[] = [
        { code: 'SAVE10', type: 'percentage', value: 10, amountCents: 0 },
      ];

      const totals = calculateTotals(items, discounts, undefined);

      expect(totals.discountCents).toBe(1000);
      expect(totals.totalCents).toBe(9000);
    });

    it('should apply fixed discount', () => {
      const items: CartItem[] = [
        { id: '1', type: 'product', name: 'Product', quantity: 1, unitPriceCents: 10000, totalPriceCents: 10000 } as CartItem,
      ];

      const discounts: CartDiscount[] = [
        { code: 'SAVE500', type: 'fixed', value: 0, amountCents: 500 },
      ];

      const totals = calculateTotals(items, discounts, undefined);

      expect(totals.discountCents).toBe(500);
      expect(totals.totalCents).toBe(9500);
    });

    it('should not exceed subtotal with discount', () => {
      const items: CartItem[] = [
        { id: '1', type: 'product', name: 'Product', quantity: 1, unitPriceCents: 1000, totalPriceCents: 1000 } as CartItem,
      ];

      const discounts: CartDiscount[] = [
        { code: 'HUGE', type: 'fixed', value: 0, amountCents: 5000 },
      ];

      const totals = calculateTotals(items, discounts, undefined);

      expect(totals.discountCents).toBe(1000);
      expect(totals.totalCents).toBe(0);
    });

    it('should add shipping costs', () => {
      const items: CartItem[] = [
        { id: '1', type: 'product', name: 'Product', quantity: 1, unitPriceCents: 2000, totalPriceCents: 2000 } as CartItem,
      ];

      const shippingMethod = { type: 'standard' as const, name: 'Standard', priceCents: 790 };

      const totals = calculateTotals(items, [], shippingMethod);

      expect(totals.shippingCents).toBe(790);
      expect(totals.totalCents).toBe(2790);
    });

    it('should calculate Swiss VAT (8.1%)', () => {
      const items: CartItem[] = [
        { id: '1', type: 'product', name: 'Product', quantity: 1, unitPriceCents: 10810, totalPriceCents: 10810 } as CartItem,
      ];

      const totals = calculateTotals(items, [], undefined);

      // VAT should be approximately 810 (8.1% included in 10810)
      expect(totals.taxCents).toBeGreaterThan(0);
      expect(totals.taxCents).toBeLessThan(1000);
    });
  });

  describe('isCartValidForCheckout', () => {
    it('should reject empty cart', () => {
      const validation = isCartValidForCheckout(cart);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Der Warenkorb ist leer.');
    });

    it('should accept cart with items', () => {
      const updatedCart = addItemToCart(cart, { type: 'product', productId: 'prod-1', quantity: 1 }, { name: 'Product', priceCents: 1000 });

      const validation = isCartValidForCheckout(updatedCart);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should require recipient email for vouchers', () => {
      const voucherInput: AddToCartInput = {
        type: 'voucher',
        productId: 'voucher-1',
        quantity: 1,
        voucherValue: 5000,
        // Missing recipientEmail
      };

      const updatedCart = addItemToCart(cart, voucherInput, { name: 'Gutschein', priceCents: 5000 });

      const validation = isCartValidForCheckout(updatedCart);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('E-Mail-Adresse'))).toBe(true);
    });
  });

  describe('isDigitalOnlyCart', () => {
    it('should return true for voucher-only cart', () => {
      const voucherInput: AddToCartInput = {
        type: 'voucher',
        productId: 'voucher-1',
        quantity: 1,
        voucherValue: 5000,
        recipientEmail: 'test@example.ch',
      };

      const updatedCart = addItemToCart(cart, voucherInput, { name: 'Gutschein', priceCents: 5000 });

      expect(isDigitalOnlyCart(updatedCart)).toBe(true);
    });

    it('should return false for cart with physical products', () => {
      let updatedCart = addItemToCart(cart, { type: 'product', productId: 'prod-1', quantity: 1 }, { name: 'Shampoo', priceCents: 2500 });
      updatedCart = addItemToCart(updatedCart, { type: 'voucher', productId: 'voucher-1', quantity: 1, voucherValue: 5000, recipientEmail: 'test@example.ch' }, { name: 'Gutschein', priceCents: 5000 });

      expect(isDigitalOnlyCart(updatedCart)).toBe(false);
    });
  });

  describe('formatPrice', () => {
    it('should format price in CHF', () => {
      expect(formatPrice(2500)).toBe('CHF 25.00');
      expect(formatPrice(100)).toBe('CHF 1.00');
      expect(formatPrice(12345)).toBe('CHF 123.45');
    });
  });
});

// ============================================
// ORDER DOMAIN TESTS
// ============================================

describe('Order Domain Service', () => {
  const mockOrderInput: CreateOrderInput = {
    salonId: 'salon-1',
    customerEmail: 'customer@example.ch',
    customerName: 'Anna Müller',
    customerPhone: '+41 79 123 45 67',
    shippingMethod: 'standard',
    shippingAddress: {
      name: 'Anna Müller',
      street: 'Musterstrasse 123',
      zip: '9000',
      city: 'St. Gallen',
      country: 'Schweiz',
    },
    items: [
      {
        itemType: 'product',
        productId: 'prod-1',
        itemName: 'Shampoo Premium',
        quantity: 2,
        unitPriceCents: 2500,
      },
    ],
  };

  describe('createOrder', () => {
    it('should create order with calculated totals', () => {
      const order = createOrder(mockOrderInput, 'SW-2024-00001');

      expect(order.orderNumber).toBe('SW-2024-00001');
      expect(order.status).toBe('pending');
      expect(order.paymentStatus).toBe('pending');
      expect(order.items).toHaveLength(1);
      expect(order.items[0].quantity).toBe(2);
      expect(order.items[0].totalCents).toBe(5000);
    });

    it('should include shipping address', () => {
      const order = createOrder(mockOrderInput, 'SW-2024-00001');

      expect(order.shippingAddress?.city).toBe('St. Gallen');
      expect(order.shippingMethod).toBe('standard');
    });

    it('should preserve customer info', () => {
      const order = createOrder(mockOrderInput, 'SW-2024-00001');

      expect(order.customerEmail).toBe('customer@example.ch');
      expect(order.customerName).toBe('Anna Müller');
      expect(order.customerPhone).toBe('+41 79 123 45 67');
    });
  });

  describe('createOrderItem', () => {
    it('should calculate item totals with tax', () => {
      const itemInput: CreateOrderItemInput = {
        itemType: 'product',
        itemName: 'Test Product',
        quantity: 3,
        unitPriceCents: 1000,
      };

      const item = createOrderItem('order-1', itemInput);

      expect(item.totalCents).toBe(3000);
      expect(item.taxRate).toBe(0.081);
      expect(item.taxCents).toBeGreaterThan(0);
    });

    it('should apply item discount', () => {
      const itemInput: CreateOrderItemInput = {
        itemType: 'product',
        itemName: 'Test Product',
        quantity: 1,
        unitPriceCents: 1000,
        discountCents: 200,
      };

      const item = createOrderItem('order-1', itemInput);

      expect(item.totalCents).toBe(800);
      expect(item.discountCents).toBe(200);
    });
  });

  describe('calculateOrderTotals', () => {
    it('should calculate totals correctly', () => {
      const items: OrderItem[] = [
        {
          id: '1',
          orderId: 'order-1',
          itemType: 'product',
          itemName: 'Product 1',
          quantity: 2,
          unitPriceCents: 2500,
          discountCents: 0,
          totalCents: 5000,
          taxCents: 375,
        } as OrderItem,
      ];

      const totals = calculateOrderTotals(items, 0, 790);

      expect(totals.subtotalCents).toBe(5000);
      expect(totals.shippingCents).toBe(790);
      expect(totals.totalCents).toBe(5790);
    });

    it('should keep caller-provided shipping above threshold', () => {
      const items: OrderItem[] = [
        {
          id: '1',
          orderId: 'order-1',
          itemType: 'product',
          itemName: 'Expensive Product',
          quantity: 1,
          unitPriceCents: 10000, // CHF 100
          discountCents: 0,
          totalCents: 10000,
          taxCents: 750,
        } as OrderItem,
      ];

      const totals = calculateOrderTotals(items, 0, 790);

      expect(totals.shippingCents).toBe(790);
    });

    it('should charge shipping below threshold', () => {
      const items: OrderItem[] = [
        {
          id: '1',
          orderId: 'order-1',
          itemType: 'product',
          itemName: 'Cheap Product',
          quantity: 1,
          unitPriceCents: 2000, // CHF 20
          discountCents: 0,
          totalCents: 2000,
          taxCents: 150,
        } as OrderItem,
      ];

      const totals = calculateOrderTotals(items, 0, 790);

      expect(totals.shippingCents).toBe(790);
      expect(totals.totalCents).toBe(2790);
    });

    it('should apply voucher discount', () => {
      const items: OrderItem[] = [
        {
          id: '1',
          orderId: 'order-1',
          itemType: 'product',
          itemName: 'Product',
          quantity: 1,
          unitPriceCents: 10000,
          discountCents: 0,
          totalCents: 10000,
          taxCents: 750,
        } as OrderItem,
      ];

      const totals = calculateOrderTotals(items, 2000, 0);

      expect(totals.voucherDiscountCents).toBe(2000);
      expect(totals.totalCents).toBe(8000);
    });
  });

  describe('calculateTaxFromGross', () => {
    it('should calculate Swiss VAT correctly', () => {
      // For CHF 108.10 gross, tax should be CHF 8.10
      const tax = calculateTaxFromGross(10810, 0.081);
      expect(tax).toBe(810);
    });

    it('should handle zero amount', () => {
      const tax = calculateTaxFromGross(0, 0.081);
      expect(tax).toBe(0);
    });
  });

  describe('getShippingCents', () => {
    it('should return correct shipping costs', () => {
      expect(getShippingCents('standard')).toBe(790);
      expect(getShippingCents('express')).toBe(1490);
      expect(getShippingCents('pickup')).toBe(0);
      expect(getShippingCents('none')).toBe(0);
      expect(getShippingCents(undefined)).toBe(0);
    });
  });

  describe('validateOrderInput', () => {
    it('should accept valid input', () => {
      const validation = validateOrderInput(mockOrderInput);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject missing salon ID', () => {
      const invalid = { ...mockOrderInput, salonId: '' };
      const validation = validateOrderInput(invalid);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Salon-ID ist erforderlich');
    });

    it('should reject invalid email', () => {
      const invalid = { ...mockOrderInput, customerEmail: 'invalid-email' };
      const validation = validateOrderInput(invalid);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Ungültige E-Mail-Adresse');
    });

    it('should reject empty items', () => {
      const invalid = { ...mockOrderInput, items: [] };
      const validation = validateOrderInput(invalid);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Mindestens ein Artikel ist erforderlich');
    });

    it('should require shipping for physical products', () => {
      const invalid = { ...mockOrderInput, shippingMethod: undefined };
      const validation = validateOrderInput(invalid);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Versandart ist erforderlich');
    });

    it('should require address for non-pickup shipping', () => {
      const invalid = { ...mockOrderInput, shippingAddress: undefined };
      const validation = validateOrderInput(invalid);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Lieferadresse ist erforderlich');
    });

    it('should require recipient info for vouchers', () => {
      const voucherInput: CreateOrderInput = {
        ...mockOrderInput,
        shippingMethod: 'none',
        shippingAddress: undefined,
        items: [
          {
            itemType: 'voucher',
            itemName: 'Gutschein',
            quantity: 1,
            unitPriceCents: 5000,
            // Missing recipientEmail and recipientName
          },
        ],
      };

      const validation = validateOrderInput(voucherInput);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Empfänger'))).toBe(true);
    });
  });

  describe('isValidStatusTransition', () => {
    it('should allow valid transitions', () => {
      expect(isValidStatusTransition('pending', 'paid')).toBe(true);
      expect(isValidStatusTransition('paid', 'processing')).toBe(true);
      expect(isValidStatusTransition('processing', 'shipped')).toBe(true);
      expect(isValidStatusTransition('shipped', 'delivered')).toBe(true);
      expect(isValidStatusTransition('delivered', 'completed')).toBe(true);
    });

    it('should allow same status', () => {
      expect(isValidStatusTransition('pending', 'pending')).toBe(true);
      expect(isValidStatusTransition('completed', 'completed')).toBe(true);
    });

    it('should reject invalid transitions', () => {
      expect(isValidStatusTransition('completed', 'pending')).toBe(false);
      expect(isValidStatusTransition('cancelled', 'paid')).toBe(false);
      expect(isValidStatusTransition('refunded', 'shipped')).toBe(false);
    });

    it('should allow cancellation from most states', () => {
      expect(isValidStatusTransition('pending', 'cancelled')).toBe(true);
      expect(isValidStatusTransition('paid', 'cancelled')).toBe(true);
      expect(isValidStatusTransition('processing', 'cancelled')).toBe(true);
    });
  });

  describe('canCancel', () => {
    it('should allow cancellation for pending orders', () => {
      const order = createOrder(mockOrderInput, 'SW-2024-00001');
      expect(canCancel(order)).toBe(true);
    });

    it('should not allow cancellation for shipped orders', () => {
      const order = createOrder(mockOrderInput, 'SW-2024-00001');
      const shippedOrder = updateOrder(order, { status: 'shipped' });
      expect(canCancel(shippedOrder)).toBe(false);
    });
  });

  describe('getStatusText', () => {
    it('should return German status texts', () => {
      expect(getStatusText('pending')).toBe('Ausstehend');
      expect(getStatusText('paid')).toBe('Bezahlt');
      expect(getStatusText('processing')).toBe('In Bearbeitung');
      expect(getStatusText('shipped')).toBe('Versendet');
      expect(getStatusText('delivered')).toBe('Zugestellt');
      expect(getStatusText('completed')).toBe('Abgeschlossen');
      expect(getStatusText('cancelled')).toBe('Storniert');
      expect(getStatusText('refunded')).toBe('Erstattet');
    });
  });

  describe('isDigitalOnlyOrder', () => {
    it('should return true for voucher-only orders', () => {
      const voucherInput: CreateOrderInput = {
        ...mockOrderInput,
        shippingMethod: 'none',
        shippingAddress: undefined,
        items: [
          {
            itemType: 'voucher',
            itemName: 'Gutschein CHF 50',
            quantity: 1,
            unitPriceCents: 5000,
            recipientEmail: 'gift@example.ch',
          },
        ],
      };

      const order = createOrder(voucherInput, 'SW-2024-00001');
      expect(isDigitalOnlyOrder(order)).toBe(true);
    });

    it('should return false for orders with products', () => {
      const order = createOrder(mockOrderInput, 'SW-2024-00001');
      expect(isDigitalOnlyOrder(order)).toBe(false);
    });
  });
});

// ============================================
// CHECKOUT FLOW INTEGRATION TESTS
// ============================================

describe('Checkout Flow Integration', () => {
  describe('Cart to Order Transformation', () => {
    it('should transform cart items to order items correctly', () => {
      // Simulate cart items
      const cartItems = [
        {
          id: 'item-1',
          type: 'product' as const,
          productId: 'prod-1',
          name: 'Shampoo',
          quantity: 2,
          unitPriceCents: 2500,
          totalPriceCents: 5000,
        },
        {
          id: 'item-2',
          type: 'voucher' as const,
          productId: 'voucher-1',
          name: 'Gutschein',
          quantity: 1,
          unitPriceCents: 5000,
          totalPriceCents: 5000,
          recipientEmail: 'gift@example.ch',
          recipientName: 'Anna',
          personalMessage: 'Alles Gute!',
        },
      ];

      // Transform to order items format
      const orderItemInputs: CreateOrderItemInput[] = cartItems.map(item => ({
        itemType: item.type === 'voucher' ? 'voucher' : 'product',
        productId: item.productId,
        itemName: item.name,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        recipientEmail: item.recipientEmail,
        recipientName: item.recipientName,
        personalMessage: item.personalMessage,
      }));

      expect(orderItemInputs).toHaveLength(2);
      expect(orderItemInputs[0].itemType).toBe('product');
      expect(orderItemInputs[1].itemType).toBe('voucher');
      expect(orderItemInputs[1].recipientEmail).toBe('gift@example.ch');
    });
  });

  describe('Price Consistency', () => {
    it('should maintain price consistency between cart and order', () => {
      // Create cart with items
      let cart = createEmptyCart();
      cart = addItemToCart(cart, { type: 'product', productId: 'prod-1', quantity: 2 }, { name: 'Product', priceCents: 2500 });

      // Set shipping
      cart = setShippingMethod(cart, { type: 'standard', name: 'Standard', priceCents: 790 });

      // Create order from cart
      const orderInput: CreateOrderInput = {
        salonId: 'salon-1',
        customerEmail: 'test@example.ch',
        shippingMethod: 'standard',
        shippingAddress: {
          name: 'Test',
          street: 'Test Street 1',
          zip: '9000',
          city: 'St. Gallen',
          country: 'Schweiz',
        },
        items: cart.items.map(item => ({
          itemType: 'product' as const,
          productId: item.productId || '',
          itemName: item.name,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        })),
      };

      const order = createOrder(orderInput, 'SW-2024-00001');

      // Verify totals match (excluding shipping calculation differences)
      expect(order.subtotalCents).toBe(cart.totals.subtotalCents);
    });
  });

  describe('Pay-at-Venue Flow', () => {
    it('should handle pay-at-venue orders without payment', () => {
      const orderInput: CreateOrderInput = {
        salonId: 'salon-1',
        customerEmail: 'test@example.ch',
        customerName: 'Test User',
        shippingMethod: 'pickup',
        paymentMethod: 'pay_at_venue',
        items: [
          {
            itemType: 'product',
            itemName: 'Product',
            quantity: 1,
            unitPriceCents: 2500,
          },
        ],
      };

      const order = createOrder(orderInput, 'SW-2024-00001');

      expect(order.paymentMethod).toBe('pay_at_venue');
      expect(order.shippingMethod).toBe('pickup');
      expect(order.status).toBe('pending');
    });
  });

  describe('Voucher Redemption', () => {
    it('should apply voucher discount correctly', () => {
      const order = createOrder(mockOrderInput, 'SW-2024-00001');

      const voucherInput = {
        voucherId: 'voucher-123',
        voucherCode: 'GIFT50',
        discountCents: 2000,
      };

      const updatedOrder = applyVoucher(order, voucherInput);

      expect(updatedOrder.voucherId).toBe('voucher-123');
      expect(updatedOrder.voucherDiscountCents).toBe(2000);
      expect(updatedOrder.totalCents).toBeLessThan(order.totalCents);
    });

    it('should not allow voucher to exceed order total', () => {
      const smallOrderInput: CreateOrderInput = {
        ...mockOrderInput,
        items: [
          {
            itemType: 'product',
            itemName: 'Small Item',
            quantity: 1,
            unitPriceCents: 1000, // CHF 10
          },
        ],
      };

      const order = createOrder(smallOrderInput, 'SW-2024-00001');

      const voucherInput = {
        voucherId: 'voucher-123',
        voucherCode: 'GIFT50',
        discountCents: 5000, // CHF 50 - more than order total
      };

      const updatedOrder = applyVoucher(order, voucherInput);

      // Voucher should be capped at order total
      expect(updatedOrder.voucherDiscountCents).toBeLessThanOrEqual(order.subtotalCents + order.shippingCents);
    });
  });
});

// ============================================
// DATA INVARIANTS
// ============================================

describe('Checkout Data Invariants', () => {
  it('INVARIANT: Total should never be negative', () => {
    const items: CartItem[] = [
      { id: '1', type: 'product', name: 'Product', quantity: 1, unitPriceCents: 1000, totalPriceCents: 1000 } as CartItem,
    ];

    const discounts: CartDiscount[] = [
      { code: 'HUGE', type: 'fixed', value: 0, amountCents: 10000 }, // Bigger than total
    ];

    const totals = calculateTotals(items, discounts, undefined);

    expect(totals.totalCents).toBeGreaterThanOrEqual(0);
  });

  it('INVARIANT: Item count should match sum of quantities', () => {
    let cart = createEmptyCart();
    cart = addItemToCart(cart, { type: 'product', productId: 'p1', quantity: 3 }, { name: 'P1', priceCents: 1000 });
    cart = addItemToCart(cart, { type: 'product', productId: 'p2', quantity: 2 }, { name: 'P2', priceCents: 2000 });

    const expectedCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    expect(cart.totals.itemCount).toBe(expectedCount);
    expect(getItemCount(cart)).toBe(5);
  });

  it('INVARIANT: Subtotal should equal sum of item totals', () => {
    let cart = createEmptyCart();
    cart = addItemToCart(cart, { type: 'product', productId: 'p1', quantity: 2 }, { name: 'P1', priceCents: 1500 });
    cart = addItemToCart(cart, { type: 'product', productId: 'p2', quantity: 1 }, { name: 'P2', priceCents: 3000 });

    const expectedSubtotal = cart.items.reduce((sum, item) => sum + item.totalPriceCents, 0);

    expect(cart.totals.subtotalCents).toBe(expectedSubtotal);
    expect(cart.totals.subtotalCents).toBe(6000); // 2*1500 + 1*3000
  });

  it('INVARIANT: Order items should preserve original quantities', () => {
    const mockOrderInput: CreateOrderInput = {
      salonId: 'salon-1',
      customerEmail: 'test@example.ch',
      items: [
        { itemType: 'product', itemName: 'P1', quantity: 5, unitPriceCents: 1000 },
        { itemType: 'product', itemName: 'P2', quantity: 3, unitPriceCents: 2000 },
      ],
    };

    const order = createOrder(mockOrderInput, 'SW-2024-00001');

    expect(order.items[0].quantity).toBe(5);
    expect(order.items[1].quantity).toBe(3);
  });

  it('INVARIANT: Tax should be approximately 8.1% of total', () => {
    const items: CartItem[] = [
      { id: '1', type: 'product', name: 'Product', quantity: 1, unitPriceCents: 10000, totalPriceCents: 10000 } as CartItem,
    ];

    const totals = calculateTotals(items, [], undefined);

    // Tax should be within reasonable range of 8.1%
    const expectedTax = Math.round(10000 * 0.081 / 1.081);
    expect(Math.abs(totals.taxCents - expectedTax)).toBeLessThan(10); // Allow small rounding diff
  });
});

const mockOrderInput: CreateOrderInput = {
  salonId: 'salon-1',
  customerEmail: 'customer@example.ch',
  customerName: 'Anna Müller',
  customerPhone: '+41 79 123 45 67',
  shippingMethod: 'standard',
  shippingAddress: {
    name: 'Anna Müller',
    street: 'Musterstrasse 123',
    zip: '9000',
    city: 'St. Gallen',
    country: 'Schweiz',
  },
  items: [
    {
      itemType: 'product',
      productId: 'prod-1',
      itemName: 'Shampoo Premium',
      quantity: 2,
      unitPriceCents: 2500,
    },
  ],
};
