/**
 * ============================================
 * BeautifyPRO - Order Domain Tests
 * Unit tests for order operations
 * ============================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateOrderNumberPrefix,
  createOrder,
  createOrderItem,
  updateOrder,
  applyVoucher,
  removeVoucher,
  isValidStatusTransition,
  transitionOrderStatus,
  calculateOrderTotals,
  calculateTaxFromGross,
  calculateTaxFromNet,
  getShippingCents,
  getAvailableShippingOptions,
  validateOrderInput,
  validateOrderForPayment,
  isDigitalOnlyOrder,
  hasVoucherItems,
  getVoucherItems,
  getItemCount,
  isPaid,
  canCancel,
  canRefund,
  formatPrice,
  formatDate,
  formatDateTime,
  getStatusText,
  getPaymentStatusText,
} from '@/lib/domain/order/order';
import type {
  Order,
  OrderItem,
  CreateOrderInput,
  CreateOrderItemInput,
  OrderStatus,
} from '@/lib/domain/order/types';

// ============================================
// TEST FIXTURES
// ============================================

const createMockOrderInput = (overrides?: Partial<CreateOrderInput>): CreateOrderInput => ({
  salonId: 'salon-1',
  customerEmail: 'kunde@example.com',
  customerName: 'Max Muster',
  paymentMethod: 'card',
  shippingMethod: 'standard',
  shippingAddress: {
    name: 'Max Muster',
    street: 'Bahnhofstrasse 1',
    zip: '9000',
    city: 'St. Gallen',
    country: 'Schweiz',
  },
  items: [
    {
      itemType: 'product',
      productId: 'prod-1',
      itemName: 'BeautifyPRO Shampoo',
      quantity: 2,
      unitPriceCents: 2500,
    },
  ],
  ...overrides,
});

const createMockOrderItemInput = (overrides?: Partial<CreateOrderItemInput>): CreateOrderItemInput => ({
  itemType: 'product',
  productId: 'prod-1',
  itemName: 'Test Product',
  quantity: 1,
  unitPriceCents: 1000,
  ...overrides,
});

const createMockOrder = (overrides?: Partial<Order>): Order => {
  const input = createMockOrderInput();
  const order = createOrder(input, 'SW-2024-00001');
  return { ...order, ...overrides };
};

// ============================================
// UNIT TESTS
// ============================================

describe('Order Domain', () => {
  describe('generateOrderNumberPrefix', () => {
    it('should generate prefix with current year', () => {
      const prefix = generateOrderNumberPrefix();
      const currentYear = new Date().getFullYear();

      expect(prefix).toBe(`SW-${currentYear}-`);
    });
  });

  describe('createOrder', () => {
    it('should create order with correct structure', () => {
      const input = createMockOrderInput();
      const order = createOrder(input, 'SW-2024-00001');

      expect(order.id).toBeDefined();
      expect(order.orderNumber).toBe('SW-2024-00001');
      expect(order.salonId).toBe('salon-1');
      expect(order.customerEmail).toBe('kunde@example.com');
      expect(order.status).toBe('pending');
      expect(order.paymentStatus).toBe('pending');
    });

    it('should create order items with correct prices', () => {
      const input = createMockOrderInput({
        items: [
          { itemType: 'product', productId: 'p1', itemName: 'Item 1', quantity: 2, unitPriceCents: 1000 },
          { itemType: 'product', productId: 'p2', itemName: 'Item 2', quantity: 1, unitPriceCents: 2500 },
        ],
      });
      const order = createOrder(input, 'SW-2024-00002');

      expect(order.items).toHaveLength(2);
      expect(order.items[0].totalCents).toBe(2000);
      expect(order.items[1].totalCents).toBe(2500);
    });

    it('should set default source to online', () => {
      const input = createMockOrderInput();
      const order = createOrder(input, 'SW-2024-00001');

      expect(order.source).toBe('online');
    });

    it('should set timestamps', () => {
      const input = createMockOrderInput();
      const order = createOrder(input, 'SW-2024-00001');

      expect(order.createdAt).toBeDefined();
      expect(order.updatedAt).toBeDefined();
    });
  });

  describe('createOrderItem', () => {
    it('should create item with calculated totals', () => {
      const input = createMockOrderItemInput({ quantity: 3, unitPriceCents: 1000 });
      const item = createOrderItem('order-1', input);

      expect(item.totalCents).toBe(3000);
    });

    it('should apply discount correctly', () => {
      const input = createMockOrderItemInput({
        quantity: 2,
        unitPriceCents: 1000,
        discountCents: 500,
      });
      const item = createOrderItem('order-1', input);

      expect(item.totalCents).toBe(1500); // 2000 - 500
      expect(item.discountCents).toBe(500);
    });

    it('should calculate Swiss VAT (8.1%)', () => {
      const input = createMockOrderItemInput({ unitPriceCents: 10000 });
      const item = createOrderItem('order-1', input);

      // Tax from gross: 10000 * 0.081 / 1.081 ≈ 749
      expect(item.taxCents).toBeGreaterThan(700);
      expect(item.taxCents).toBeLessThan(800);
    });

    it('should include voucher fields for voucher items', () => {
      const input = createMockOrderItemInput({
        itemType: 'voucher',
        recipientEmail: 'empfaenger@example.com',
        recipientName: 'Anna Muster',
        personalMessage: 'Alles Gute!',
        voucherType: 'gift',
      });
      const item = createOrderItem('order-1', input);

      expect(item.recipientEmail).toBe('empfaenger@example.com');
      expect(item.recipientName).toBe('Anna Muster');
      expect(item.personalMessage).toBe('Alles Gute!');
      expect(item.voucherType).toBe('gift');
    });
  });

  describe('updateOrder', () => {
    it('should update status', () => {
      const order = createMockOrder();
      const updated = updateOrder(order, { status: 'processing' });

      expect(updated.status).toBe('processing');
    });

    it('should update payment status', () => {
      const order = createMockOrder();
      const updated = updateOrder(order, { paymentStatus: 'succeeded' });

      expect(updated.paymentStatus).toBe('succeeded');
      expect(updated.paidAt).toBeDefined();
    });

    it('should set completedAt when status is completed', () => {
      const order = createMockOrder({ status: 'paid' });
      const updated = updateOrder(order, { status: 'completed' });

      expect(updated.completedAt).toBeDefined();
    });

    it('should set cancelledAt when status is cancelled', () => {
      const order = createMockOrder();
      const updated = updateOrder(order, { status: 'cancelled' });

      expect(updated.cancelledAt).toBeDefined();
    });

    it('should update tracking number', () => {
      const order = createMockOrder({ status: 'processing' });
      const updated = updateOrder(order, { trackingNumber: 'TRACK123' });

      expect(updated.trackingNumber).toBe('TRACK123');
    });
  });

  describe('applyVoucher', () => {
    it('should apply voucher discount', () => {
      const order = createMockOrder();
      const originalTotal = order.totalCents;

      const updated = applyVoucher(order, {
        voucherId: 'voucher-1',
        discountCents: 1000,
      });

      expect(updated.voucherId).toBe('voucher-1');
      expect(updated.voucherDiscountCents).toBe(1000);
      expect(updated.totalCents).toBeLessThan(originalTotal);
    });

    it('should not exceed order total', () => {
      const order = createMockOrder();
      const maxPossibleDiscount = order.subtotalCents + order.shippingCents;

      const updated = applyVoucher(order, {
        voucherId: 'voucher-big',
        discountCents: 999999, // Very large discount
      });

      expect(updated.voucherDiscountCents).toBeLessThanOrEqual(maxPossibleDiscount);
      expect(updated.totalCents).toBeGreaterThanOrEqual(0);
    });
  });

  describe('removeVoucher', () => {
    it('should remove voucher and recalculate totals', () => {
      let order = createMockOrder();
      order = applyVoucher(order, { voucherId: 'v1', discountCents: 500 });

      const updated = removeVoucher(order);

      expect(updated.voucherId).toBeUndefined();
      expect(updated.voucherDiscountCents).toBe(0);
    });
  });

  describe('isValidStatusTransition', () => {
    it('should allow pending → paid', () => {
      expect(isValidStatusTransition('pending', 'paid')).toBe(true);
    });

    it('should allow pending → cancelled', () => {
      expect(isValidStatusTransition('pending', 'cancelled')).toBe(true);
    });

    it('should not allow cancelled → paid', () => {
      expect(isValidStatusTransition('cancelled', 'paid')).toBe(false);
    });

    it('should not allow refunded → anything', () => {
      expect(isValidStatusTransition('refunded', 'pending')).toBe(false);
      expect(isValidStatusTransition('refunded', 'completed')).toBe(false);
    });

    it('should allow same status (no change)', () => {
      expect(isValidStatusTransition('pending', 'pending')).toBe(true);
      expect(isValidStatusTransition('completed', 'completed')).toBe(true);
    });

    it('should allow full flow: paid → processing → shipped → delivered → completed', () => {
      expect(isValidStatusTransition('paid', 'processing')).toBe(true);
      expect(isValidStatusTransition('processing', 'shipped')).toBe(true);
      expect(isValidStatusTransition('shipped', 'delivered')).toBe(true);
      expect(isValidStatusTransition('delivered', 'completed')).toBe(true);
    });

    it('should block fulfilment statuses until payment has been received', () => {
      expect(isValidStatusTransition('pending', 'processing')).toBe(false);
      expect(isValidStatusTransition('pending', 'shipped')).toBe(false);
      expect(isValidStatusTransition('pending', 'completed')).toBe(false);
    });

    it('should not allow completed orders to be changed afterwards', () => {
      expect(isValidStatusTransition('completed', 'cancelled')).toBe(false);
      expect(isValidStatusTransition('completed', 'refunded')).toBe(false);
      expect(isValidStatusTransition('completed', 'shipped')).toBe(false);
    });
  });

  describe('transitionOrderStatus', () => {
    it('should transition to valid status', () => {
      const order = createMockOrder({ status: 'pending' });
      const updated = transitionOrderStatus(order, 'cancelled');

      expect(updated).not.toBeNull();
      expect(updated?.status).toBe('cancelled');
    });

    it('should return null for invalid transition', () => {
      const order = createMockOrder({ status: 'cancelled' });
      const updated = transitionOrderStatus(order, 'paid');

      expect(updated).toBeNull();
    });
  });

  describe('calculateOrderTotals', () => {
    it('should calculate correct subtotal', () => {
      const items: OrderItem[] = [
        { totalCents: 2000, discountCents: 0, taxCents: 149 } as OrderItem,
        { totalCents: 3000, discountCents: 0, taxCents: 224 } as OrderItem,
      ];

      const totals = calculateOrderTotals(items);

      expect(totals.subtotalCents).toBe(5000);
    });

    it('should keep caller-provided shipping above threshold', () => {
      const items: OrderItem[] = [
        { totalCents: 6000, discountCents: 0, taxCents: 449 } as OrderItem, // CHF 60
      ];

      const totals = calculateOrderTotals(items, 0, 700);

      expect(totals.shippingCents).toBe(700);
    });

    it('should charge shipping below threshold', () => {
      const items: OrderItem[] = [
        { totalCents: 2000, discountCents: 0, taxCents: 149 } as OrderItem, // CHF 20
      ];

      const totals = calculateOrderTotals(items, 0, 700);

      expect(totals.shippingCents).toBe(700);
    });

    it('should apply voucher discount correctly', () => {
      const items: OrderItem[] = [
        { totalCents: 5000, discountCents: 0, taxCents: 374 } as OrderItem,
      ];

      const totals = calculateOrderTotals(items, 1000, 0);

      expect(totals.voucherDiscountCents).toBe(1000);
      expect(totals.totalCents).toBe(4000);
    });
  });

  describe('calculateTaxFromGross', () => {
    it('should calculate correct tax from gross amount', () => {
      // For Swiss VAT 8.1%
      // Gross: 10000, Tax = 10000 * 0.081 / 1.081 = 749.31
      const tax = calculateTaxFromGross(10000, 0.081);

      expect(tax).toBe(749);
    });
  });

  describe('calculateTaxFromNet', () => {
    it('should calculate correct tax from net amount', () => {
      // Net: 10000, Tax = 10000 * 0.081 = 810
      const tax = calculateTaxFromNet(10000, 0.081);

      expect(tax).toBe(810);
    });
  });

  describe('getShippingCents', () => {
    it('should return 0 for none/pickup', () => {
      expect(getShippingCents('none')).toBe(0);
      expect(getShippingCents('pickup')).toBe(0);
      expect(getShippingCents(undefined)).toBe(0);
    });

    it('should return correct price for standard/express', () => {
      expect(getShippingCents('standard')).toBeGreaterThan(0);
      expect(getShippingCents('express')).toBeGreaterThan(0);
    });
  });

  describe('getAvailableShippingOptions', () => {
    it('should return digital-only option for vouchers', () => {
      const options = getAvailableShippingOptions(5000, true);

      expect(options).toHaveLength(1);
      expect(options[0].type).toBe('none');
    });

    it('should return all options for physical products', () => {
      const options = getAvailableShippingOptions(2000, false);

      expect(options.length).toBeGreaterThan(1);
    });

    it('should show free shipping above threshold', () => {
      const options = getAvailableShippingOptions(6000, false); // CHF 60

      const standardOption = options.find((o) => o.type === 'standard');
      expect(standardOption?.priceCents).toBe(0);
    });
  });

  describe('validateOrderInput', () => {
    it('should return valid for complete input', () => {
      const input = createMockOrderInput();
      const result = validateOrderInput(input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require salon ID', () => {
      const input = createMockOrderInput({ salonId: '' });
      const result = validateOrderInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Salon-ID ist erforderlich');
    });

    it('should require valid email', () => {
      const input = createMockOrderInput({ customerEmail: 'invalid' });
      const result = validateOrderInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Ungültige E-Mail-Adresse');
    });

    it('should require at least one item', () => {
      const input = createMockOrderInput({ items: [] });
      const result = validateOrderInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Mindestens ein Artikel ist erforderlich');
    });

    it('should validate item quantities', () => {
      const input = createMockOrderInput({
        items: [{ ...createMockOrderItemInput(), quantity: 0 }],
      });
      const result = validateOrderInput(input);

      expect(result.valid).toBe(false);
    });

    it('should require shipping address for physical products', () => {
      const input = createMockOrderInput({
        shippingMethod: 'standard',
        shippingAddress: undefined,
      });
      const result = validateOrderInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Lieferadresse ist erforderlich');
    });

    it('should require recipient info for vouchers', () => {
      const input = createMockOrderInput({
        items: [
          {
            itemType: 'voucher',
            itemName: 'Gutschein',
            quantity: 1,
            unitPriceCents: 5000,
          },
        ],
      });
      const result = validateOrderInput(input);

      expect(result.valid).toBe(false);
    });
  });

  describe('validateOrderForPayment', () => {
    it('should allow pending orders', () => {
      const order = createMockOrder({ status: 'pending' });
      const result = validateOrderForPayment(order);

      expect(result.valid).toBe(true);
    });

    it('should reject non-pending orders', () => {
      const order = createMockOrder({ status: 'paid' });
      const result = validateOrderForPayment(order);

      expect(result.valid).toBe(false);
    });

    it('should require items', () => {
      const order = createMockOrder();
      order.items = [];
      const result = validateOrderForPayment(order);

      expect(result.valid).toBe(false);
    });

    it('should require positive total', () => {
      const order = createMockOrder();
      order.totalCents = 0;
      const result = validateOrderForPayment(order);

      expect(result.valid).toBe(false);
    });
  });

  describe('isDigitalOnlyOrder', () => {
    it('should return true for voucher-only order', () => {
      const order = createMockOrder();
      order.items = [{ itemType: 'voucher' } as OrderItem];

      expect(isDigitalOnlyOrder(order)).toBe(true);
    });

    it('should return false for mixed order', () => {
      const order = createMockOrder();
      order.items = [
        { itemType: 'voucher' } as OrderItem,
        { itemType: 'product' } as OrderItem,
      ];

      expect(isDigitalOnlyOrder(order)).toBe(false);
    });
  });

  describe('hasVoucherItems', () => {
    it('should return true if order has vouchers', () => {
      const order = createMockOrder();
      order.items = [
        { itemType: 'product' } as OrderItem,
        { itemType: 'voucher' } as OrderItem,
      ];

      expect(hasVoucherItems(order)).toBe(true);
    });

    it('should return false if no vouchers', () => {
      const order = createMockOrder();
      order.items = [{ itemType: 'product' } as OrderItem];

      expect(hasVoucherItems(order)).toBe(false);
    });
  });

  describe('getVoucherItems', () => {
    it('should return only voucher items', () => {
      const order = createMockOrder();
      order.items = [
        { itemType: 'product', id: '1' } as OrderItem,
        { itemType: 'voucher', id: '2' } as OrderItem,
        { itemType: 'voucher', id: '3' } as OrderItem,
      ];

      const vouchers = getVoucherItems(order);

      expect(vouchers).toHaveLength(2);
      expect(vouchers.every((v) => v.itemType === 'voucher')).toBe(true);
    });
  });

  describe('getItemCount', () => {
    it('should return total quantity', () => {
      const order = createMockOrder();
      order.items = [
        { quantity: 2 } as OrderItem,
        { quantity: 3 } as OrderItem,
      ];

      expect(getItemCount(order)).toBe(5);
    });
  });

  describe('isPaid', () => {
    it('should return true for succeeded payment', () => {
      const order = createMockOrder({ paymentStatus: 'succeeded' });
      expect(isPaid(order)).toBe(true);
    });

    it('should return false for pending payment', () => {
      const order = createMockOrder({ paymentStatus: 'pending' });
      expect(isPaid(order)).toBe(false);
    });
  });

  describe('canCancel', () => {
    it('should allow cancellation for pending/paid/processing', () => {
      expect(canCancel(createMockOrder({ status: 'pending' }))).toBe(true);
      expect(canCancel(createMockOrder({ status: 'paid' }))).toBe(true);
      expect(canCancel(createMockOrder({ status: 'processing' }))).toBe(true);
    });

    it('should not allow cancellation for shipped/completed', () => {
      expect(canCancel(createMockOrder({ status: 'shipped' }))).toBe(false);
      expect(canCancel(createMockOrder({ status: 'completed' }))).toBe(false);
    });
  });

  describe('canRefund', () => {
    it('should allow refund for paid orders', () => {
      const order = createMockOrder({
        paymentStatus: 'succeeded',
        totalCents: 5000,
        refundedAmountCents: 0,
      });
      expect(canRefund(order)).toBe(true);
    });

    it('should not allow refund for unpaid orders', () => {
      const order = createMockOrder({ paymentStatus: 'pending' });
      expect(canRefund(order)).toBe(false);
    });

    it('should not allow refund if fully refunded', () => {
      const order = createMockOrder({
        paymentStatus: 'succeeded',
        totalCents: 5000,
        refundedAmountCents: 5000,
      });
      expect(canRefund(order)).toBe(false);
    });
  });

  describe('formatPrice', () => {
    it('should format price in CHF', () => {
      const formatted = formatPrice(2500);
      expect(formatted).toMatch(/CHF/);
      expect(formatted).toMatch(/25/);
    });
  });

  describe('formatDate', () => {
    it('should format date in Swiss format', () => {
      const date = new Date('2024-12-25');
      const formatted = formatDate(date);
      expect(formatted).toMatch(/25/);
      expect(formatted).toMatch(/12/);
      expect(formatted).toMatch(/2024/);
    });
  });

  describe('formatDateTime', () => {
    it('should include time in format', () => {
      const date = new Date('2024-12-25T14:30:00');
      const formatted = formatDateTime(date);
      expect(formatted).toMatch(/14/);
      expect(formatted).toMatch(/30/);
    });
  });

  describe('getStatusText', () => {
    it('should return German status text', () => {
      expect(getStatusText('pending')).toBe('Ausstehend');
      expect(getStatusText('paid')).toBe('Bezahlt');
      expect(getStatusText('shipped')).toBe('Versendet');
      expect(getStatusText('completed')).toBe('Abgeschlossen');
      expect(getStatusText('cancelled')).toBe('Storniert');
    });
  });

  describe('getPaymentStatusText', () => {
    it('should return German payment status text', () => {
      expect(getPaymentStatusText('pending')).toBe('Ausstehend');
      expect(getPaymentStatusText('succeeded')).toBe('Erfolgreich');
      expect(getPaymentStatusText('failed')).toBe('Fehlgeschlagen');
      expect(getPaymentStatusText('refunded')).toBe('Erstattet');
    });
  });
});
