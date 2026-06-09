// ============================================
// BeautifyPRO - Order Domain Service
// Pure functions for order management
// ============================================

import type {
  Order,
  OrderItem,
  OrderTotals,
  OrderStatus,
  PaymentStatus,
  CreateOrderInput,
  CreateOrderItemInput,
  UpdateOrderInput,
  ApplyVoucherInput,
  OrderValidation,
  ShippingOption,
  ShippingMethodType,
} from './types';
import {
  DEFAULT_SHIPPING_OPTIONS,
  FREE_SHIPPING_THRESHOLD_CENTS,
} from './types';

// Swiss VAT rate (8.1%)
const SWISS_VAT_RATE = 0.081;

// ============================================
// ORDER NUMBER GENERATION
// ============================================

/**
 * Generate order number prefix based on current date
 * Format: SW-YYYY-NNNNN
 */
export function generateOrderNumberPrefix(): string {
  const year = new Date().getFullYear();
  return `SW-${year}-`;
}

// ============================================
// CREATE ORDER
// ============================================

/**
 * Creates a new order from input
 */
export function createOrder(
  input: CreateOrderInput,
  orderNumber: string
): Order {
  const id = crypto.randomUUID();
  const now = new Date();

  // Create order items
  const items = input.items.map((item) => createOrderItem(id, item));

  // Calculate totals
  const totals = calculateOrderTotals(items, 0, getShippingCents(input.shippingMethod));

  return {
    id,
    salonId: input.salonId,
    customerId: input.customerId,
    orderNumber,
    status: 'pending',
    paymentStatus: 'pending',
    paymentMethod: input.paymentMethod,
    subtotalCents: totals.subtotalCents,
    discountCents: totals.discountCents,
    shippingCents: totals.shippingCents,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
    voucherDiscountCents: 0,
    shippingMethod: input.shippingMethod,
    shippingAddress: input.shippingAddress,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerNotes: input.customerNotes,
    refundedAmountCents: 0,
    hasDispute: false,
    source: input.source || 'online',
    createdAt: now,
    updatedAt: now,
    items,
  };
}

/**
 * Creates an order item from input
 */
export function createOrderItem(
  orderId: string,
  input: CreateOrderItemInput
): OrderItem {
  const id = crypto.randomUUID();
  const discountCents = input.discountCents || 0;
  const totalCents = input.unitPriceCents * input.quantity - discountCents;
  const taxRate = input.taxRate ?? SWISS_VAT_RATE;
  const taxCents = calculateTaxFromGross(totalCents, taxRate);

  return {
    id,
    orderId,
    itemType: input.itemType,
    productId: input.productId,
    variantId: input.variantId,
    itemName: input.itemName,
    itemSku: input.itemSku,
    itemDescription: input.itemDescription,
    quantity: input.quantity,
    unitPriceCents: input.unitPriceCents,
    discountCents,
    totalCents,
    taxRate,
    taxCents,
    voucherType: input.voucherType,
    recipientEmail: input.recipientEmail,
    recipientName: input.recipientName,
    personalMessage: input.personalMessage,
  };
}

// ============================================
// UPDATE ORDER
// ============================================

/**
 * Updates an order with new values
 */
export function updateOrder(order: Order, input: UpdateOrderInput): Order {
  const now = new Date();

  return {
    ...order,
    status: input.status ?? order.status,
    paymentStatus: input.paymentStatus ?? order.paymentStatus,
    trackingNumber: input.trackingNumber ?? order.trackingNumber,
    internalNotes: input.internalNotes ?? order.internalNotes,
    shippedAt: input.shippedAt ?? order.shippedAt,
    deliveredAt: input.deliveredAt ?? order.deliveredAt,
    updatedAt: now,
    // Auto-set timestamps based on status
    completedAt: input.status === 'completed' ? now : order.completedAt,
    cancelledAt: input.status === 'cancelled' ? now : order.cancelledAt,
    paidAt: input.paymentStatus === 'succeeded' ? now : order.paidAt,
    refundedAt: input.paymentStatus === 'refunded' ? now : order.refundedAt,
  };
}

/**
 * Apply voucher discount to order
 */
export function applyVoucher(order: Order, voucher: ApplyVoucherInput): Order {
  const maxDiscount = order.subtotalCents + order.shippingCents - order.discountCents;
  const discountToApply = Math.min(voucher.discountCents, maxDiscount);

  const totals = calculateOrderTotals(
    order.items,
    discountToApply,
    order.shippingCents
  );

  return {
    ...order,
    voucherId: voucher.voucherId,
    voucherDiscountCents: discountToApply,
    totalCents: totals.totalCents,
    taxCents: totals.taxCents,
    updatedAt: new Date(),
  };
}

/**
 * Remove voucher from order
 */
export function removeVoucher(order: Order): Order {
  const totals = calculateOrderTotals(
    order.items,
    0,
    order.shippingCents
  );

  return {
    ...order,
    voucherId: undefined,
    voucherDiscountCents: 0,
    totalCents: totals.totalCents,
    taxCents: totals.taxCents,
    updatedAt: new Date(),
  };
}

// ============================================
// STATUS TRANSITIONS
// ============================================

/**
 * Valid status transitions
 */
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled', 'refunded'],
  processing: ['shipped', 'completed', 'cancelled'],
  shipped: ['delivered', 'completed', 'cancelled'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
  refunded: [],
};

/**
 * Check if status transition is valid
 */
export function isValidStatusTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus
): boolean {
  if (currentStatus === newStatus) return true;
  return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * Transition order to new status
 */
export function transitionOrderStatus(
  order: Order,
  newStatus: OrderStatus
): Order | null {
  if (!isValidStatusTransition(order.status, newStatus)) {
    return null;
  }

  return updateOrder(order, { status: newStatus });
}

// ============================================
// CALCULATIONS
// ============================================

/**
 * Calculate order totals from items
 */
export function calculateOrderTotals(
  items: OrderItem[],
  voucherDiscountCents: number = 0,
  shippingCents: number = 0
): OrderTotals {
  const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
  const discountCents = items.reduce((sum, item) => sum + item.discountCents, 0);

  // Total before voucher
  const totalBeforeVoucher = subtotalCents + shippingCents;

  // Apply voucher (max of voucher value or total)
  const actualVoucherDiscount = Math.min(voucherDiscountCents, totalBeforeVoucher);

  // Final total
  const totalCents = totalBeforeVoucher - actualVoucherDiscount;

  // Recalculate tax based on discounted amount
  const taxCents = calculateTaxFromGross(totalCents, SWISS_VAT_RATE);

  return {
    subtotalCents,
    discountCents,
    voucherDiscountCents: actualVoucherDiscount,
    shippingCents,
    taxCents,
    totalCents,
  };
}

/**
 * Calculate tax from gross amount (tax included)
 */
export function calculateTaxFromGross(grossCents: number, rate: number): number {
  return Math.round(grossCents * (rate / (1 + rate)));
}

/**
 * Calculate tax to add to net amount
 */
export function calculateTaxFromNet(netCents: number, rate: number): number {
  return Math.round(netCents * rate);
}

/**
 * Get shipping cost for method
 */
export function getShippingCents(method?: ShippingMethodType): number {
  if (!method || method === 'none') return 0;

  const option = DEFAULT_SHIPPING_OPTIONS.find((opt) => opt.type === method);
  return option?.priceCents ?? 0;
}

/**
 * Get available shipping options based on order
 */
export function getAvailableShippingOptions(
  subtotalCents: number,
  isDigitalOnly: boolean
): ShippingOption[] {
  if (isDigitalOnly) {
    return [{
      type: 'none',
      name: 'Kein Versand',
      description: 'Digitale Produkte',
      priceCents: 0,
      available: true,
    }];
  }

  return DEFAULT_SHIPPING_OPTIONS.map((option) => ({
    ...option,
    // Free shipping above threshold
    priceCents:
      option.type !== 'pickup' && subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS
        ? 0
        : option.priceCents,
    description:
      option.type !== 'pickup' && subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS
        ? 'Kostenlos (ab CHF 50)'
        : option.description,
  }));
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate order before creation
 */
export function validateOrderInput(input: CreateOrderInput): OrderValidation {
  const errors: string[] = [];

  // Check required fields
  if (!input.salonId) {
    errors.push('Salon-ID ist erforderlich');
  }

  if (!input.customerEmail) {
    errors.push('E-Mail-Adresse ist erforderlich');
  } else if (!isValidEmail(input.customerEmail)) {
    errors.push('Ungültige E-Mail-Adresse');
  }

  if (!input.items || input.items.length === 0) {
    errors.push('Mindestens ein Artikel ist erforderlich');
  }

  // Validate items
  input.items?.forEach((item, index) => {
    if (!item.itemName) {
      errors.push(`Artikel ${index + 1}: Name ist erforderlich`);
    }
    if (item.quantity < 1) {
      errors.push(`Artikel ${index + 1}: Menge muss mindestens 1 sein`);
    }
    if (item.unitPriceCents < 0) {
      errors.push(`Artikel ${index + 1}: Preis darf nicht negativ sein`);
    }

    // Voucher validation
    if (item.itemType === 'voucher') {
      if (!item.recipientEmail && !item.recipientName) {
        errors.push(`Artikel ${index + 1}: Empfänger-Info für Gutschein erforderlich`);
      }
    }
  });

  // Validate shipping for physical products
  const hasPhysicalProducts = input.items?.some(
    (item) => item.itemType === 'product'
  );
  if (hasPhysicalProducts) {
    if (!input.shippingMethod) {
      errors.push('Versandart ist erforderlich');
    }
    if (input.shippingMethod !== 'pickup' && !input.shippingAddress) {
      errors.push('Lieferadresse ist erforderlich');
    }
    if (input.shippingAddress) {
      const addr = input.shippingAddress;
      if (!addr.name) errors.push('Name in Lieferadresse erforderlich');
      if (!addr.street) errors.push('Strasse in Lieferadresse erforderlich');
      if (!addr.zip) errors.push('PLZ in Lieferadresse erforderlich');
      if (!addr.city) errors.push('Ort in Lieferadresse erforderlich');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate order for payment
 */
export function validateOrderForPayment(order: Order): OrderValidation {
  const errors: string[] = [];

  if (order.status !== 'pending') {
    errors.push('Bestellung ist nicht im Status "ausstehend"');
  }

  if (order.items.length === 0) {
    errors.push('Bestellung enthält keine Artikel');
  }

  if (order.totalCents <= 0) {
    errors.push('Bestellwert muss grösser als 0 sein');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// QUERIES
// ============================================

/**
 * Check if order contains only digital items
 */
export function isDigitalOnlyOrder(order: Order): boolean {
  return order.items.every((item) => item.itemType === 'voucher');
}

/**
 * Check if order contains vouchers
 */
export function hasVoucherItems(order: Order): boolean {
  return order.items.some((item) => item.itemType === 'voucher');
}

/**
 * Get voucher items from order
 */
export function getVoucherItems(order: Order): OrderItem[] {
  return order.items.filter((item) => item.itemType === 'voucher');
}

/**
 * Get total item count
 */
export function getItemCount(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Check if order is paid
 */
export function isPaid(order: Order): boolean {
  return order.paymentStatus === 'succeeded';
}

/**
 * Check if order can be cancelled
 */
export function canCancel(order: Order): boolean {
  return ['pending', 'paid', 'processing'].includes(order.status);
}

/**
 * Check if order can be refunded
 */
export function canRefund(order: Order): boolean {
  return (
    order.paymentStatus === 'succeeded' &&
    order.refundedAmountCents < order.totalCents
  );
}

// ============================================
// PRICE FORMATTING
// ============================================

/**
 * Format price in Swiss Francs
 */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(cents / 100);
}

/**
 * Format date for Swiss locale
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Format datetime for Swiss locale
 */
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// ============================================
// HELPERS
// ============================================

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Get status display text (German)
 */
export function getStatusText(status: OrderStatus): string {
  const statusTexts: Record<OrderStatus, string> = {
    pending: 'Ausstehend',
    paid: 'Bezahlt',
    processing: 'In Bearbeitung',
    shipped: 'Versendet',
    delivered: 'Zugestellt',
    completed: 'Abgeschlossen',
    cancelled: 'Storniert',
    refunded: 'Erstattet',
  };
  return statusTexts[status] || status;
}

/**
 * Get payment status display text (German)
 */
export function getPaymentStatusText(status: PaymentStatus): string {
  const statusTexts: Record<PaymentStatus, string> = {
    pending: 'Ausstehend',
    processing: 'Wird verarbeitet',
    succeeded: 'Erfolgreich',
    failed: 'Fehlgeschlagen',
    refunded: 'Erstattet',
    partially_refunded: 'Teilweise erstattet',
  };
  return statusTexts[status] || status;
}
