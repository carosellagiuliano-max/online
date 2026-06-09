'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type {
  Cart,
  CartDiscount,
  ShippingMethod,
  AddToCartInput,
} from '@/lib/domain/cart/types';
import {
  createEmptyCart,
  addItemToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  applyDiscount,
  removeDiscount,
  setShippingMethod,
  formatPrice,
  getItemCount,
  hasItems,
  isDigitalOnlyCart,
  isCartValidForCheckout,
} from '@/lib/domain/cart/cart';

// ============================================
// CART CONTEXT TYPES
// ============================================

interface ShippingConfig {
  standardShippingCents: number;
  freeShippingThresholdCents: number;
  enableFreeShipping: boolean;
}

interface CartContextValue {
  // State
  cart: Cart;
  isLoading: boolean;
  isOpen: boolean;

  // Actions
  addItem: (
    input: AddToCartInput,
    productData: {
      name: string;
      description?: string;
      imageUrl?: string;
      priceCents: number;
      sku?: string;
    }
  ) => void;
  updateItem: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  clear: () => void;
  applyDiscountCode: (discount: CartDiscount) => void;
  removeDiscountCode: (code: string) => void;
  selectShipping: (method: ShippingMethod) => void;

  // UI Actions
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;

  // Computed
  itemCount: number;
  isEmpty: boolean;
  isDigitalOnly: boolean;
  validation: { valid: boolean; errors: string[] };

  // Helpers
  formatPrice: (cents: number) => string;
}

// ============================================
// CONTEXT
// ============================================

const CartContext = createContext<CartContextValue | undefined>(undefined);

const CART_STORAGE_KEY = 'beautifypro_demo_cart';

// Default shipping configuration (used until API config is loaded)
const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  standardShippingCents: 900, // CHF 9.00
  freeShippingThresholdCents: 5000, // CHF 50.00
  enableFreeShipping: true,
};

/**
 * Calculate shipping based on cart subtotal and config
 */
function calculateShipping(
  subtotalCents: number,
  isDigitalOnly: boolean,
  config: ShippingConfig
): ShippingMethod | undefined {
  // No shipping for digital-only carts
  if (isDigitalOnly) {
    return undefined;
  }

  // Free shipping above threshold (if enabled)
  if (config.enableFreeShipping && subtotalCents >= config.freeShippingThresholdCents) {
    return {
      id: 'free',
      name: 'Kostenloser Versand',
      description: `Kostenloser Versand ab CHF ${(config.freeShippingThresholdCents / 100).toFixed(0)}`,
      priceCents: 0,
      estimatedDays: '2-4',
      isDefault: false,
    };
  }

  // Standard shipping
  return {
    id: 'standard',
    name: 'Standardversand',
    description: 'Lieferung innerhalb von 2-4 Werktagen',
    priceCents: config.standardShippingCents,
    estimatedDays: '2-4',
    isDefault: true,
  };
}

// ============================================
// PROVIDER
// ============================================

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(createEmptyCart);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  // Shipping config from API (use ref so callbacks always have latest value)
  const shippingConfigRef = useRef<ShippingConfig>(DEFAULT_SHIPPING_CONFIG);

  // Load shipping config from API
  useEffect(() => {
    async function loadShippingConfig() {
      try {
        const response = await fetch('/api/shop/config');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.shipping) {
            shippingConfigRef.current = data.data.shipping;
            // Recalculate shipping with new config if cart has items
            setCart((prev) => {
              if (prev.items.length === 0) return prev;
              const digitalOnly = isDigitalOnlyCart(prev);
              const shipping = calculateShipping(
                prev.totals.subtotalCents,
                digitalOnly,
                data.data.shipping
              );
              if (shipping) {
                return setShippingMethod(prev, shipping);
              }
              return prev;
            });
          }
        }
      } catch (error) {
        console.error('Error loading shipping config:', error);
        // Keep using defaults
      }
    }
    loadShippingConfig();
  }, []);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Restore dates
        parsed.createdAt = new Date(parsed.createdAt);
        parsed.updatedAt = new Date(parsed.updatedAt);
        if (parsed.expiresAt) {
          parsed.expiresAt = new Date(parsed.expiresAt);
        }

        // Check if cart is expired
        if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
          // Cart expired, create new one
          setCart(createEmptyCart());
        } else {
          // Calculate shipping for loaded cart
          const digitalOnly = isDigitalOnlyCart(parsed);
          const shipping = calculateShipping(
            parsed.totals?.subtotalCents || 0,
            digitalOnly,
            shippingConfigRef.current
          );
          if (shipping && parsed.items?.length > 0) {
            setCart(setShippingMethod(parsed, shipping));
          } else {
            setCart(parsed);
          }
        }
      }
    } catch (error) {
      console.error('Error loading cart from storage:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      } catch (error) {
        console.error('Error saving cart to storage:', error);
      }
    }
  }, [cart, isLoading]);

  // ============================================
  // ACTIONS
  // ============================================

  const addItem = useCallback(
    (
      input: AddToCartInput,
      productData: {
        name: string;
        description?: string;
        imageUrl?: string;
        priceCents: number;
        sku?: string;
      }
    ) => {
      setCart((prev) => {
        const updated = addItemToCart(prev, input, productData);
        // Auto-calculate shipping based on new cart state
        const digitalOnly = isDigitalOnlyCart(updated);
        const shipping = calculateShipping(
          updated.totals.subtotalCents,
          digitalOnly,
          shippingConfigRef.current
        );
        if (shipping) {
          return setShippingMethod(updated, shipping);
        }
        return updated;
      });
      // Open cart drawer when item is added
      setIsOpen(true);
    },
    []
  );

  const updateItem = useCallback((itemId: string, quantity: number) => {
    setCart((prev) => {
      const updated = updateCartItem(prev, { itemId, quantity });
      // Recalculate shipping
      const digitalOnly = isDigitalOnlyCart(updated);
      const shipping = calculateShipping(
        updated.totals.subtotalCents,
        digitalOnly,
        shippingConfigRef.current
      );
      if (shipping) {
        return setShippingMethod(updated, shipping);
      }
      return { ...updated, shippingMethod: undefined };
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setCart((prev) => {
      const updated = removeCartItem(prev, itemId);
      // Recalculate shipping
      const digitalOnly = isDigitalOnlyCart(updated);
      const shipping = calculateShipping(
        updated.totals.subtotalCents,
        digitalOnly,
        shippingConfigRef.current
      );
      if (shipping) {
        return setShippingMethod(updated, shipping);
      }
      return { ...updated, shippingMethod: undefined };
    });
  }, []);

  const clear = useCallback(() => {
    setCart((prev) => clearCart(prev));
  }, []);

  const applyDiscountCode = useCallback((discount: CartDiscount) => {
    setCart((prev) => applyDiscount(prev, discount));
  }, []);

  const removeDiscountCode = useCallback((code: string) => {
    setCart((prev) => removeDiscount(prev, code));
  }, []);

  const selectShipping = useCallback((method: ShippingMethod) => {
    setCart((prev) => setShippingMethod(prev, method));
  }, []);

  // ============================================
  // UI ACTIONS
  // ============================================

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const toggleCart = useCallback(() => setIsOpen((prev) => !prev), []);

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const itemCount = getItemCount(cart);
  const isEmpty = !hasItems(cart);
  const isDigitalOnly = isDigitalOnlyCart(cart);
  const validation = isCartValidForCheckout(cart);

  // ============================================
  // CONTEXT VALUE
  // ============================================

  const value: CartContextValue = {
    cart,
    isLoading,
    isOpen,
    addItem,
    updateItem,
    removeItem,
    clear,
    applyDiscountCode,
    removeDiscountCode,
    selectShipping,
    openCart,
    closeCart,
    toggleCart,
    itemCount,
    isEmpty,
    isDigitalOnly,
    validation,
    formatPrice,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// ============================================
// HOOK
// ============================================

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

// ============================================
// UTILITIES
// ============================================

/**
 * Clear cart from localStorage (for logout, etc.)
 */
export function clearCartStorage() {
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing cart storage:', error);
  }
}
