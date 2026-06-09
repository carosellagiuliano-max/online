// ============================================
// BeautifyPRO - Order Domain Types
// ============================================

// ============================================
// ENUMS
// ============================================

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type PaymentMethod =
  | 'stripe_card'
  | 'stripe_twint'
  | 'cash'
  | 'terminal'
  | 'voucher'
  | 'pay_at_venue';

export type ShippingMethodType = 'standard' | 'express' | 'pickup' | 'none';

export type OrderItemType = 'product' | 'voucher' | 'service';

// ============================================
// ORDER ITEM
// ============================================

export interface OrderItem {
  id: string;
  orderId: string;
  itemType: OrderItemType;
  productId?: string;
  variantId?: string;
  itemName: string;
  itemSku?: string;
  itemDescription?: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  totalCents: number;
  taxRate?: number;
  taxCents: number;
  // Voucher-specific fields
  voucherId?: string;
  voucherType?: 'value' | 'service';
  recipientEmail?: string;
  recipientName?: string;
  personalMessage?: string;
}

export interface CreateOrderItemInput {
  itemType: OrderItemType;
  productId?: string;
  variantId?: string;
  itemName: string;
  itemSku?: string;
  itemDescription?: string;
  quantity: number;
  unitPriceCents: number;
  discountCents?: number;
  taxRate?: number;
  // Voucher-specific
  voucherType?: 'value' | 'service';
  recipientEmail?: string;
  recipientName?: string;
  personalMessage?: string;
}

// ============================================
// SHIPPING ADDRESS
// ============================================

export interface ShippingAddress {
  name: string;
  company?: string;
  street: string;
  street2?: string;
  zip: string;
  city: string;
  canton?: string;
  country: string;
  phone?: string;
}

// ============================================
// ORDER
// ============================================

export interface Order {
  id: string;
  salonId: string;
  customerId?: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  // Pricing (in CHF cents)
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  taxRate?: number;
  // Voucher applied to order
  voucherId?: string;
  voucherDiscountCents: number;
  // Shipping
  shippingMethod?: ShippingMethodType;
  shippingAddress?: ShippingAddress;
  trackingNumber?: string;
  // Pickup
  pickupDate?: string;
  pickupTime?: string;
  // Customer info snapshot
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  // Notes
  customerNotes?: string;
  internalNotes?: string;
  // Stripe integration
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  // Error tracking
  paymentError?: string;
  // Refund tracking
  refundedAmountCents: number;
  // Dispute tracking
  hasDispute: boolean;
  disputeReason?: string;
  // Source
  source: 'online' | 'in_person' | 'phone';
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  refundedAt?: Date;
  // Items
  items: OrderItem[];
}

// ============================================
// INPUT TYPES
// ============================================

export interface CreateOrderInput {
  salonId: string;
  customerId?: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  shippingMethod?: ShippingMethodType;
  shippingAddress?: ShippingAddress;
  customerNotes?: string;
  paymentMethod?: PaymentMethod;
  source?: 'online' | 'in_person' | 'phone';
  items: CreateOrderItemInput[];
  /** Whether to initiate payment via Stripe (default: true) */
  initiatePayment?: boolean;
}

export interface UpdateOrderInput {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  trackingNumber?: string;
  internalNotes?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
}

export interface ApplyVoucherInput {
  voucherId: string;
  voucherCode: string;
  discountCents: number;
}

// ============================================
// ORDER TOTALS
// ============================================

export interface OrderTotals {
  subtotalCents: number;
  discountCents: number;
  voucherDiscountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
}

// ============================================
// ORDER SUMMARY (for lists)
// ============================================

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalCents: number;
  itemCount: number;
  customerEmail: string;
  customerName?: string;
  createdAt: Date;
  paidAt?: Date;
}

// ============================================
// STATUS HISTORY
// ============================================

export interface OrderStatusChange {
  id: string;
  orderId: string;
  previousStatus?: OrderStatus;
  newStatus: OrderStatus;
  changedBy?: string;
  notes?: string;
  createdAt: Date;
}

// ============================================
// VALIDATION RESULT
// ============================================

export interface OrderValidation {
  valid: boolean;
  errors: string[];
}

// ============================================
// SHIPPING OPTIONS
// ============================================

export interface ShippingOption {
  type: ShippingMethodType;
  name: string;
  description: string;
  priceCents: number;
  estimatedDays?: number;
  available: boolean;
}

// Default Swiss shipping options
export const DEFAULT_SHIPPING_OPTIONS: ShippingOption[] = [
  {
    type: 'standard',
    name: 'Standardversand',
    description: '3-5 Werktage',
    priceCents: 790, // 7.90 CHF
    estimatedDays: 5,
    available: true,
  },
  {
    type: 'express',
    name: 'Expressversand',
    description: '1-2 Werktage',
    priceCents: 1490, // 14.90 CHF
    estimatedDays: 2,
    available: true,
  },
  {
    type: 'pickup',
    name: 'Abholung im Salon',
    description: 'Kostenlos',
    priceCents: 0,
    available: true,
  },
];

// Free shipping threshold (CHF)
export const FREE_SHIPPING_THRESHOLD_CENTS = 5000; // 50 CHF
