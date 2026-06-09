// ============================================
// BeautifyPRO - Cart Domain Types
// ============================================

/**
 * Cart item types
 */
export type CartItemType = 'product' | 'voucher' | 'service';

/**
 * A single item in the cart
 */
export interface CartItem {
  id: string; // Unique cart item ID
  type: CartItemType;
  productId?: string;
  variantId?: string;
  voucherId?: string;
  serviceId?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  // For vouchers
  voucherValue?: number;
  recipientName?: string;
  recipientEmail?: string;
  personalMessage?: string;
  // For products
  variant?: string;
  sku?: string;
}

/**
 * Applied discount/voucher
 */
export interface CartDiscount {
  code: string;
  type: 'percentage' | 'fixed' | 'voucher';
  value: number; // Percentage (0-100) or cents
  amountCents: number; // Calculated discount amount
  description: string;
}

/**
 * Shipping method
 */
export interface ShippingMethod {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  estimatedDays: string;
  isDefault: boolean;
}

/**
 * Cart totals breakdown
 */
export interface CartTotals {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  itemCount: number;
}

/**
 * Complete cart state
 */
export interface Cart {
  id: string;
  items: CartItem[];
  discounts: CartDiscount[];
  shippingMethod?: ShippingMethod;
  totals: CartTotals;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

/**
 * Cart operations input types
 */
export interface AddToCartInput {
  type: CartItemType;
  productId?: string;
  variantId?: string;
  voucherId?: string;
  serviceId?: string;
  quantity: number;
  variant?: string;
  // Voucher-specific
  voucherValue?: number;
  recipientName?: string;
  recipientEmail?: string;
  personalMessage?: string;
}

export interface UpdateCartItemInput {
  itemId: string;
  quantity?: number;
  variant?: string;
}

export interface ApplyDiscountInput {
  code: string;
}

/**
 * Customer shipping info
 */
export interface ShippingAddress {
  firstName: string;
  lastName: string;
  company?: string;
  street: string;
  streetNumber: string;
  apartment?: string;
  zipCode: string;
  city: string;
  country: string;
  phone?: string;
}

/**
 * Checkout state
 */
export interface CheckoutState {
  cart: Cart;
  customerEmail: string;
  shippingAddress?: ShippingAddress;
  billingAddress?: ShippingAddress;
  billingSameAsShipping: boolean;
  selectedShippingMethodId?: string;
  paymentMethod: 'stripe' | 'twint' | 'at_venue';
  acceptedTerms: boolean;
  newsletterOptIn: boolean;
  notes?: string;
}

/**
 * VAT rate (Switzerland)
 */
export const VAT_RATE = 0.081; // 8.1% MwSt (Standard)
export const VAT_RATE_REDUCED = 0.026; // 2.6% (reduziert)
