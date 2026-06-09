// ============================================
// BeautifyPRO - Cart Domain Service
// Pure functions for cart operations
// ============================================

import type {
  Cart,
  CartItem,
  CartDiscount,
  CartTotals,
  ShippingMethod,
  AddToCartInput,
  UpdateCartItemInput,
  VAT_RATE,
} from './types';

// ============================================
// CART CREATION
// ============================================

/**
 * Create an empty cart
 */
export function createEmptyCart(): Cart {
  const now = new Date();
  return {
    id: generateCartId(),
    items: [],
    discounts: [],
    shippingMethod: undefined,
    totals: calculateTotals([], [], undefined),
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
  };
}

/**
 * Generate unique cart ID
 */
function generateCartId(): string {
  return `cart_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generate unique cart item ID
 */
function generateItemId(): string {
  return `item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================
// CART ITEM OPERATIONS
// ============================================

/**
 * Add item to cart
 */
export function addItemToCart(
  cart: Cart,
  input: AddToCartInput,
  productData: {
    name: string;
    description?: string;
    imageUrl?: string;
    priceCents: number;
    sku?: string;
  }
): Cart {
  const existingItemIndex = cart.items.findIndex((item) => {
    if (input.type === 'product' && item.productId === input.productId) {
      // Match by variantId if present, otherwise by variant string
      if (input.variantId) {
        return item.variantId === input.variantId;
      }
      return item.variant === input.variant && !item.variantId;
    }
    // Vouchers are always unique items
    return false;
  });

  let newItems: CartItem[];

  if (existingItemIndex >= 0 && input.type === 'product') {
    // Update existing item quantity
    newItems = cart.items.map((item, index) =>
      index === existingItemIndex
        ? {
            ...item,
            quantity: item.quantity + input.quantity,
            totalPriceCents: (item.quantity + input.quantity) * item.unitPriceCents,
          }
        : item
    );
  } else {
    // Add new item
    const unitPrice = input.type === 'voucher' && input.voucherValue
      ? input.voucherValue
      : productData.priceCents;

    const newItem: CartItem = {
      id: generateItemId(),
      type: input.type,
      productId: input.productId,
      variantId: input.variantId,
      voucherId: input.voucherId,
      serviceId: input.serviceId,
      name: productData.name,
      description: productData.description,
      imageUrl: productData.imageUrl,
      quantity: input.quantity,
      unitPriceCents: unitPrice,
      totalPriceCents: unitPrice * input.quantity,
      variant: input.variant,
      sku: productData.sku,
      // Voucher fields
      voucherValue: input.voucherValue,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      personalMessage: input.personalMessage,
    };

    newItems = [...cart.items, newItem];
  }

  return {
    ...cart,
    items: newItems,
    totals: calculateTotals(newItems, cart.discounts, cart.shippingMethod),
    updatedAt: new Date(),
  };
}

/**
 * Update cart item
 */
export function updateCartItem(cart: Cart, input: UpdateCartItemInput): Cart {
  const itemIndex = cart.items.findIndex((item) => item.id === input.itemId);

  if (itemIndex < 0) {
    return cart;
  }

  let newItems: CartItem[];

  if (input.quantity !== undefined && input.quantity <= 0) {
    // Remove item if quantity is 0 or negative
    newItems = cart.items.filter((item) => item.id !== input.itemId);
  } else {
    // Update item
    newItems = cart.items.map((item) =>
      item.id === input.itemId
        ? {
            ...item,
            quantity: input.quantity ?? item.quantity,
            variant: input.variant ?? item.variant,
            totalPriceCents: (input.quantity ?? item.quantity) * item.unitPriceCents,
          }
        : item
    );
  }

  return {
    ...cart,
    items: newItems,
    totals: calculateTotals(newItems, cart.discounts, cart.shippingMethod),
    updatedAt: new Date(),
  };
}

/**
 * Remove item from cart
 */
export function removeCartItem(cart: Cart, itemId: string): Cart {
  const newItems = cart.items.filter((item) => item.id !== itemId);

  return {
    ...cart,
    items: newItems,
    totals: calculateTotals(newItems, cart.discounts, cart.shippingMethod),
    updatedAt: new Date(),
  };
}

/**
 * Clear all items from cart
 */
export function clearCart(cart: Cart): Cart {
  return {
    ...cart,
    items: [],
    discounts: [],
    totals: calculateTotals([], [], cart.shippingMethod),
    updatedAt: new Date(),
  };
}

// ============================================
// DISCOUNT OPERATIONS
// ============================================

/**
 * Apply discount to cart
 */
export function applyDiscount(cart: Cart, discount: CartDiscount): Cart {
  // Check if discount already applied
  if (cart.discounts.some((d) => d.code === discount.code)) {
    return cart;
  }

  const newDiscounts = [...cart.discounts, discount];

  return {
    ...cart,
    discounts: newDiscounts,
    totals: calculateTotals(cart.items, newDiscounts, cart.shippingMethod),
    updatedAt: new Date(),
  };
}

/**
 * Remove discount from cart
 */
export function removeDiscount(cart: Cart, code: string): Cart {
  const newDiscounts = cart.discounts.filter((d) => d.code !== code);

  return {
    ...cart,
    discounts: newDiscounts,
    totals: calculateTotals(cart.items, newDiscounts, cart.shippingMethod),
    updatedAt: new Date(),
  };
}

// ============================================
// SHIPPING OPERATIONS
// ============================================

/**
 * Set shipping method
 */
export function setShippingMethod(cart: Cart, shippingMethod: ShippingMethod): Cart {
  return {
    ...cart,
    shippingMethod,
    totals: calculateTotals(cart.items, cart.discounts, shippingMethod),
    updatedAt: new Date(),
  };
}

// ============================================
// TOTALS CALCULATION
// ============================================

/**
 * Calculate cart totals
 */
export function calculateTotals(
  items: CartItem[],
  discounts: CartDiscount[],
  shippingMethod?: ShippingMethod
): CartTotals {
  // Subtotal (sum of all items)
  const subtotalCents = items.reduce((sum, item) => sum + item.totalPriceCents, 0);

  // Calculate discounts
  let discountCents = 0;
  for (const discount of discounts) {
    if (discount.type === 'percentage') {
      discountCents += Math.round((subtotalCents * discount.value) / 100);
    } else {
      discountCents += discount.amountCents;
    }
  }

  // Ensure discount doesn't exceed subtotal
  discountCents = Math.min(discountCents, subtotalCents);

  // Shipping
  const shippingCents = shippingMethod?.priceCents ?? 0;

  // Calculate taxable amount (after discount, before shipping)
  const taxableAmount = subtotalCents - discountCents;

  // VAT (8.1% in Switzerland) - already included in prices
  // For display purposes, we calculate the included VAT
  const taxCents = Math.round(taxableAmount * 0.081 / 1.081);

  // Total
  const totalCents = subtotalCents - discountCents + shippingCents;

  // Item count
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    subtotalCents,
    discountCents,
    shippingCents,
    taxCents,
    totalCents,
    itemCount,
  };
}

// ============================================
// VALIDATION
// ============================================

/**
 * Check if cart is valid for checkout
 */
export function isCartValidForCheckout(cart: Cart): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (cart.items.length === 0) {
    errors.push('Der Warenkorb ist leer.');
  }

  // Check for invalid quantities
  for (const item of cart.items) {
    if (item.quantity <= 0) {
      errors.push(`Ungültige Menge für ${item.name}.`);
    }
  }

  // Check voucher items have required fields
  for (const item of cart.items) {
    if (item.type === 'voucher') {
      if (!item.recipientEmail) {
        errors.push(`Bitte geben Sie eine E-Mail-Adresse für den Gutschein "${item.name}" an.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if cart contains only digital items (no shipping needed)
 */
export function isDigitalOnlyCart(cart: Cart): boolean {
  return cart.items.every((item) => item.type === 'voucher' || item.type === 'service');
}

// ============================================
// UTILITIES
// ============================================

/**
 * Format price for display (CHF)
 */
export function formatPrice(cents: number): string {
  return `CHF ${(cents / 100).toFixed(2)}`;
}

/**
 * Get cart item count
 */
export function getItemCount(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Check if cart has items
 */
export function hasItems(cart: Cart): boolean {
  return cart.items.length > 0;
}

/**
 * Find item in cart
 */
export function findCartItem(cart: Cart, itemId: string): CartItem | undefined {
  return cart.items.find((item) => item.id === itemId);
}

/**
 * Check if product is in cart
 */
export function isProductInCart(cart: Cart, productId: string, variant?: string): boolean {
  return cart.items.some(
    (item) =>
      item.type === 'product' &&
      item.productId === productId &&
      (variant === undefined || item.variant === variant)
  );
}
