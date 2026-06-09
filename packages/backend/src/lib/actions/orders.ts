'use server';

// ============================================
// BeautifyPRO - Order Server Actions
// ============================================

import { createServerClient } from '@/lib/db/client';
import { revalidatePath, revalidateTag } from 'next/cache';
import type {
  Order,
  OrderItem,
  OrderSummary,
  OrderStatus,
  CreateOrderInput,
  CreateOrderItemInput,
  UpdateOrderInput,
  OrderValidation,
  ShippingAddress,
  ShippingMethodType,
} from '@/lib/domain/order/types';
import {
  validateOrderInput,
  validateOrderForPayment,
  calculateOrderTotals,
  isValidStatusTransition,
} from '@/lib/domain/order/order';
import { createCheckoutSession } from '@/lib/payments';
import { isMockMode } from '@/lib/mock/mock-auth';
import {
  MOCK_CUSTOMER_USER,
  MOCK_ORDERS,
  MOCK_PRODUCTS,
  MOCK_SALON,
} from '@/lib/mock/mock-data';

// ============================================
// TYPES
// ============================================

interface ActionResult<T> {
  data: T | null;
  error: string | null;
}

interface CreateOrderResult {
  order: Order | null;
  checkoutUrl?: string;
  error: string | null;
}

const SHIPPING_SETTINGS_KEY = 'shop.shipping';
const DEFAULT_SHIPPING_SETTINGS = {
  standardShippingCents: 900,
  freeShippingThresholdCents: 5000,
  enableFreeShipping: true,
  expressEnabled: true,
  expressShippingCents: 1490,
  expressEstimatedDays: '1-2',
  standardEstimatedDays: '3-5',
  pickupEnabled: true,
};

type DbClient = NonNullable<ReturnType<typeof createServerClient>>;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeOptionalText(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizeTaxRateFraction(rate?: number | null): number {
  if (rate === undefined || rate === null) return 0.081;
  const numeric = Number(rate);
  if (!Number.isFinite(numeric) || numeric < 0) return 0.081;
  return numeric > 1 ? numeric / 100 : numeric;
}

function normalizeTaxRatePercent(rate?: number | null): number {
  return Math.round(normalizeTaxRateFraction(rate) * 10000) / 100;
}

function toCustomerFacingStockError(message?: string): string {
  if (!message) return 'Ein Produkt ist aktuell nicht in der gewünschten Menge verfügbar.';
  if (message.toLowerCase().includes('insufficient stock')) {
    return 'Ein Produkt ist aktuell nicht in der gewünschten Menge verfügbar. Bitte prüfen Sie den Warenkorb.';
  }
  if (message.toLowerCase().includes('not available')) {
    return 'Ein Produkt ist nicht mehr verfügbar. Bitte entfernen Sie es aus dem Warenkorb.';
  }
  return message;
}

function revalidateShopOrderPaths(orderId?: string) {
  revalidateTag('shop', 'max');
  revalidateTag('products', 'max');
  revalidatePath('/shop');
  revalidatePath('/shop/produkte');
  revalidatePath('/admin/bestellungen');
  revalidatePath('/admin/produkte');
  revalidatePath('/admin/inventar');
  revalidatePath('/konto/bestellungen');
  if (orderId) {
    revalidatePath(`/admin/bestellungen/${orderId}`);
    revalidatePath(`/konto/bestellungen/${orderId}`);
  }
}

type MockOrder = (typeof MOCK_ORDERS)[number];

function getMockProduct(productId: string) {
  return MOCK_PRODUCTS.find((product) => product.id === productId);
}

function getMockOrderNumber(order: MockOrder): string {
  return `BP-DEMO-${order.id.replace(/\D/g, '').padStart(4, '0')}`;
}

function toMockDbOrderItems(order: MockOrder) {
  return order.items.map((item, index) => {
    const product = getMockProduct(item.product_id);
    const unitPriceCents = Math.round(item.price * 100);
    const totalCents = unitPriceCents * item.quantity;

    return {
      id: `${order.id}-item-${index + 1}`,
      order_id: order.id,
      item_type: 'product',
      product_id: item.product_id,
      item_name: product?.name || 'Demo-Produkt',
      item_description: product?.description || undefined,
      quantity: item.quantity,
      unit_price_cents: unitPriceCents,
      discount_cents: 0,
      total_cents: totalCents,
      tax_rate: 8.1,
      tax_cents: Math.round(totalCents - totalCents / 1.081),
    };
  });
}

function toMockDbOrder(order: MockOrder) {
  const items = toMockDbOrderItems(order);
  const subtotalCents = items.reduce((sum, item) => sum + item.total_cents, 0);
  const isCompleted = order.status === 'completed';

  return {
    id: order.id,
    salon_id: order.salon_id,
    customer_id: order.customer_id,
    order_number: getMockOrderNumber(order),
    status: order.status,
    payment_status: isCompleted ? 'succeeded' : 'pending',
    payment_method: 'pay_at_venue',
    subtotal_cents: subtotalCents,
    discount_cents: 0,
    shipping_cents: 0,
    tax_cents: Math.round(subtotalCents - subtotalCents / 1.081),
    total_cents: Math.round(order.total * 100),
    shipping_method: 'pickup',
    shipping_address: null,
    customer_email: order.customer.email,
    customer_name: `${order.customer.first_name} ${order.customer.last_name}`,
    customer_phone: order.customer.phone,
    customer_notes: 'Demo-Bestellung fuer Praesentation',
    internal_notes: 'Mockdaten, keine echte Zahlung.',
    refunded_amount_cents: 0,
    has_dispute: false,
    source: 'online',
    created_at: order.created_at,
    updated_at: order.created_at,
    paid_at: isCompleted ? order.created_at : null,
  };
}

function toMockOrder(order: MockOrder): Order {
  return transformDbOrder(toMockDbOrder(order), toMockDbOrderItems(order));
}

function toMockOrderSummary(order: MockOrder): OrderSummary {
  const transformed = toMockOrder(order);
  return {
    id: transformed.id,
    orderNumber: transformed.orderNumber,
    status: transformed.status,
    paymentStatus: transformed.paymentStatus,
    totalCents: transformed.totalCents,
    itemCount: transformed.items.reduce((sum, item) => sum + item.quantity, 0),
    customerEmail: transformed.customerEmail,
    customerName: transformed.customerName,
    createdAt: transformed.createdAt,
    paidAt: transformed.paidAt,
  };
}

function getMockOrderSummaries(options: {
  customerId?: string;
  email?: string;
  status?: OrderStatus;
  limit?: number;
  offset?: number;
} = {}): OrderSummary[] {
  const { customerId, email, status, limit = 20, offset = 0 } = options;
  const normalizedEmail = email ? normalizeEmail(email) : undefined;

  return MOCK_ORDERS
    .filter((order) => {
      if (customerId && order.customer_id !== customerId) return false;
      if (normalizedEmail && normalizeEmail(order.customer.email) !== normalizedEmail) return false;
      if (status && order.status !== status) return false;
      return true;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(offset, offset + limit)
    .map(toMockOrderSummary);
}

function createMockCheckoutOrder(input: CreateOrderInput): Order {
  const createdAt = new Date().toISOString();
  const items = input.items.map((item, index) => ({
    id: `mock-checkout-item-${index + 1}`,
    order_id: 'mock-checkout-order',
    item_type: item.itemType,
    product_id: item.productId,
    variant_id: item.variantId,
    item_name: item.itemName,
    item_sku: item.itemSku,
    item_description: item.itemDescription,
    quantity: item.quantity,
    unit_price_cents: item.unitPriceCents,
    discount_cents: item.discountCents || 0,
    total_cents: item.unitPriceCents * item.quantity - (item.discountCents || 0),
    tax_rate: 8.1,
    tax_cents: Math.round(
      (item.unitPriceCents * item.quantity - (item.discountCents || 0)) -
        (item.unitPriceCents * item.quantity - (item.discountCents || 0)) / 1.081
    ),
    voucher_type: item.voucherType,
    recipient_email: item.recipientEmail,
    recipient_name: item.recipientName,
    personal_message: item.personalMessage,
  }));
  const subtotalCents = items.reduce((sum, item) => sum + item.total_cents, 0);

  return transformDbOrder(
    {
      id: `mock-checkout-${Date.now()}`,
      salon_id: input.salonId || MOCK_SALON.id,
      customer_id: input.customerId || undefined,
      order_number: `BP-DEMO-${new Date().toISOString().replace(/\D/g, '').slice(0, 12)}`,
      status: 'completed',
      payment_status: 'succeeded',
      payment_method: input.paymentMethod || 'pay_at_venue',
      subtotal_cents: subtotalCents,
      discount_cents: 0,
      shipping_cents: input.shippingMethod === 'standard' ? 900 : 0,
      tax_cents: Math.round(subtotalCents - subtotalCents / 1.081),
      total_cents: subtotalCents + (input.shippingMethod === 'standard' ? 900 : 0),
      shipping_method: input.shippingMethod || 'pickup',
      shipping_address: input.shippingAddress,
      customer_email: normalizeEmail(input.customerEmail),
      customer_name: normalizeOptionalText(input.customerName),
      customer_phone: normalizeOptionalText(input.customerPhone),
      customer_notes: normalizeOptionalText(input.customerNotes),
      internal_notes: 'Demo-Checkout, keine echte Zahlung.',
      refunded_amount_cents: 0,
      has_dispute: false,
      source: input.source || 'online',
      created_at: createdAt,
      updated_at: createdAt,
      paid_at: createdAt,
    },
    items
  );
}

async function getShopShippingSettings(supabase: any, salonId: string) {
  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('salon_id', salonId)
    .eq('key', SHIPPING_SETTINGS_KEY)
    .eq('is_public', true)
    .single();

  return { ...DEFAULT_SHIPPING_SETTINGS, ...(setting?.value || {}) };
}

function getConfiguredShippingCents(
  method: ShippingMethodType | undefined,
  subtotalCents: number,
  isDigitalOnly: boolean,
  settings: typeof DEFAULT_SHIPPING_SETTINGS
): { shippingCents: number; error?: string } {
  if (isDigitalOnly) {
    return { shippingCents: 0 };
  }

  const selectedMethod = method || 'standard';

  if (selectedMethod === 'none') {
    return { shippingCents: 0, error: 'Für physische Produkte muss eine Versandart gewählt werden.' };
  }

  if (selectedMethod === 'pickup') {
    if (settings.pickupEnabled === false) {
      return { shippingCents: 0, error: 'Abholung im Salon ist derzeit nicht verfügbar.' };
    }
    return { shippingCents: 0 };
  }

  if (
    settings.enableFreeShipping &&
    subtotalCents >= settings.freeShippingThresholdCents
  ) {
    return { shippingCents: 0 };
  }

  if (selectedMethod === 'express') {
    if (!settings.expressEnabled) {
      return { shippingCents: 0, error: 'Expressversand ist derzeit nicht verfügbar.' };
    }
    return { shippingCents: settings.expressShippingCents };
  }

  return { shippingCents: settings.standardShippingCents };
}

async function resolveOrderItemsFromCatalog(
  supabase: DbClient,
  salonId: string,
  inputItems: CreateOrderItemInput[]
): Promise<{ items: CreateOrderItemInput[]; error?: string }> {
  const resolvedItems: CreateOrderItemInput[] = [];

  for (const [index, item] of inputItems.entries()) {
    if (item.quantity < 1 || item.quantity > 99) {
      return { items: [], error: `Artikel ${index + 1}: Menge muss zwischen 1 und 99 liegen.` };
    }

    if (item.itemType !== 'product') {
      const voucherAmount = Number(item.unitPriceCents);
      if (!Number.isFinite(voucherAmount) || voucherAmount <= 0) {
        return { items: [], error: `Artikel ${index + 1}: Gutscheinwert ist ungültig.` };
      }

      resolvedItems.push({
        ...item,
        itemName: normalizeOptionalText(item.itemName) || 'Gutschein',
        itemDescription: normalizeOptionalText(item.itemDescription),
        unitPriceCents: Math.round(voucherAmount),
        discountCents: 0,
        recipientEmail: normalizeOptionalText(item.recipientEmail),
        recipientName: normalizeOptionalText(item.recipientName),
        personalMessage: normalizeOptionalText(item.personalMessage),
      });
      continue;
    }

    if (!item.productId) {
      return { items: [], error: `Artikel ${index + 1}: Produktreferenz fehlt.` };
    }

    const { data: product, error: productError } = await (supabase.from('products') as any)
      .select(`
        id,
        salon_id,
        name,
        description,
        sku,
        price_cents,
        vat_rate,
        is_active,
        is_published,
        track_inventory,
        stock_quantity,
        allow_backorder
      `)
      .eq('id', item.productId)
      .eq('salon_id', salonId)
      .single();

    if (productError || !product) {
      return { items: [], error: `Artikel ${index + 1}: Produkt wurde nicht gefunden.` };
    }

    if (!product.is_active || !product.is_published) {
      return { items: [], error: `${product.name} ist nicht mehr verfügbar.` };
    }

    let itemName = product.name;
    let itemSku = product.sku || undefined;
    let unitPriceCents = Number(product.price_cents);
    let stockQuantity = product.stock_quantity as number | null;

    if (item.variantId) {
      const { data: variant, error: variantError } = await (supabase.from('product_variants') as any)
        .select('id, product_id, name, sku, price_cents, stock_quantity, is_active')
        .eq('id', item.variantId)
        .eq('product_id', item.productId)
        .single();

      if (variantError || !variant) {
        return { items: [], error: `Artikel ${index + 1}: Variante wurde nicht gefunden.` };
      }

      if (!variant.is_active) {
        return { items: [], error: `${product.name} - ${variant.name} ist nicht mehr verfügbar.` };
      }

      itemName = `${product.name} - ${variant.name}`;
      itemSku = variant.sku || product.sku || undefined;
      unitPriceCents = Number(variant.price_cents ?? product.price_cents);
      stockQuantity = variant.stock_quantity as number | null;
    }

    if (!Number.isFinite(unitPriceCents) || unitPriceCents < 0) {
      return { items: [], error: `${itemName} hat einen ungültigen Preis.` };
    }

    if (
      product.track_inventory &&
      !product.allow_backorder &&
      (stockQuantity ?? 0) < item.quantity
    ) {
      return {
        items: [],
        error: `${itemName} ist nur noch ${Math.max(0, stockQuantity ?? 0)}x verfügbar.`,
      };
    }

    resolvedItems.push({
      itemType: 'product',
      productId: product.id,
      variantId: item.variantId,
      itemName,
      itemSku,
      itemDescription: product.description || undefined,
      quantity: item.quantity,
      unitPriceCents: Math.round(unitPriceCents),
      discountCents: 0,
      taxRate: normalizeTaxRateFraction(product.vat_rate),
    });
  }

  return { items: resolvedItems };
}

// ============================================
// CREATE ORDER
// ============================================

/**
 * Creates a new order and optionally initiates Stripe checkout
 */
export async function createOrder(
  input: CreateOrderInput & {
    initiatePayment?: boolean;
    profileId?: string;
    saveCustomerData?: boolean;
  }
): Promise<CreateOrderResult> {
  const initiatePayment = input.initiatePayment ?? true;
  try {
    // Validate input
    const validation = validateOrderInput(input);
    if (!validation.valid) {
      return {
        order: null,
        error: validation.errors.join(', '),
      };
    }

    if (isMockMode()) {
      const order = createMockCheckoutOrder({
        ...input,
        salonId: input.salonId || MOCK_SALON.id,
        customerId:
          input.customerId ||
          (input.profileId === MOCK_CUSTOMER_USER.id ? 'cust-001' : undefined),
      });

      return { order, error: null };
    }

    const supabase = createServerClient() as any;
    if (!supabase) {
      return { order: null, error: 'Datenbankverbindung nicht verfügbar' };
    }

    const normalizedCustomerEmail = normalizeEmail(input.customerEmail);
    const normalizedCustomerName = normalizeOptionalText(input.customerName);
    const normalizedCustomerPhone = normalizeOptionalText(input.customerPhone);
    const catalogResult = await resolveOrderItemsFromCatalog(
      supabase,
      input.salonId,
      input.items
    );

    if (catalogResult.error) {
      return { order: null, error: catalogResult.error };
    }

    const resolvedItems = catalogResult.items;

    // Find or create customer record
    let customerId = input.customerId;

    if (input.profileId) {
      // Check if customer exists for this profile in this salon
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('salon_id', input.salonId)
        .eq('profile_id', input.profileId)
        .single();

      if (existingCustomer) {
        customerId = existingCustomer.id;

        // Update customer data if saveCustomerData is true
        if (input.saveCustomerData) {
          const nameParts = (normalizedCustomerName || '').split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';

          await supabase
            .from('customers')
            .update({
              first_name: firstName,
              last_name: lastName,
              phone: normalizedCustomerPhone || null,
              updated_at: new Date().toISOString(),
              ...(input.shippingAddress ? {
                street: input.shippingAddress.street || null,
                street2: input.shippingAddress.street2 || null,
                zip: input.shippingAddress.zip || null,
                city: input.shippingAddress.city || null,
                country: input.shippingAddress.country || null,
              } : {}),
            } as any)
            .eq('id', customerId);
        }
      } else {
        // Create new customer linked to profile
          const nameParts = (normalizedCustomerName || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            salon_id: input.salonId,
            profile_id: input.profileId,
            first_name: firstName,
            last_name: lastName,
            email: normalizedCustomerEmail,
            phone: normalizedCustomerPhone || null,
            is_active: true,
            ...(input.shippingAddress ? {
              street: input.shippingAddress.street || null,
              street2: input.shippingAddress.street2 || null,
              zip: input.shippingAddress.zip || null,
              city: input.shippingAddress.city || null,
              country: input.shippingAddress.country || null,
            } : {}),
          } as any)
          .select('id')
          .single();

        if (customerError) {
          console.error('Error creating customer:', customerError);
          // Don't fail the order, just continue without customer link
        } else if (newCustomer) {
          customerId = newCustomer.id;
        }
      }
    } else if (normalizedCustomerEmail) {
      // Guest checkout - find or create customer by email
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('salon_id', input.salonId)
        .eq('email', normalizedCustomerEmail)
        .is('profile_id', null)
        .single();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        // Create guest customer
        const nameParts = (normalizedCustomerName || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            salon_id: input.salonId,
            profile_id: null,
            first_name: firstName,
            last_name: lastName,
            email: normalizedCustomerEmail,
            phone: normalizedCustomerPhone || null,
            is_active: true,
          })
          .select('id')
          .single();

        if (!customerError && newCustomer) {
          customerId = newCustomer.id;
        }
      }
    }

    // Generate order number using database function
    const { data: orderNumber, error: numError } = await supabase.rpc(
      'generate_order_number',
      { p_salon_id: input.salonId }
    );

    if (numError || !orderNumber) {
      console.error('Error generating order number:', numError);
      return { order: null, error: 'Fehler beim Erstellen der Bestellnummer' };
    }

    // Calculate totals
    const items = resolvedItems.map((item) => ({
      ...item,
      totalCents: item.unitPriceCents * item.quantity - (item.discountCents || 0),
      taxCents: Math.round(
        (item.unitPriceCents * item.quantity - (item.discountCents || 0)) *
          (normalizeTaxRateFraction(item.taxRate) / (1 + normalizeTaxRateFraction(item.taxRate)))
      ),
    }));
    const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
    const shippingSettings = await getShopShippingSettings(supabase, input.salonId);
    const shippingResult = getConfiguredShippingCents(
      input.shippingMethod,
      subtotalCents,
      resolvedItems.every((item) => item.itemType === 'voucher'),
      shippingSettings
    );

    if (shippingResult.error) {
      return { order: null, error: shippingResult.error };
    }

    const totals = calculateOrderTotals(
      items.map((item, index) => ({
        id: `temp-${index}`,
        orderId: '',
        itemType: item.itemType,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        discountCents: item.discountCents || 0,
        totalCents: item.totalCents,
        taxRate: item.taxRate,
        taxCents: item.taxCents,
      })),
      0,
      shippingResult.shippingCents
    );

    // Determine payment status based on payment method
    const isPayAtVenue = input.paymentMethod === 'pay_at_venue';
    const initialStatus = 'pending' as const;
    const initialPaymentStatus = 'pending' as const;

    // Create order in database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        salon_id: input.salonId,
        customer_id: customerId || null,
        order_number: orderNumber,
        status: initialStatus,
        payment_status: initialPaymentStatus,
        payment_method: input.paymentMethod || 'stripe_card',
        subtotal_cents: totals.subtotalCents,
        discount_cents: totals.discountCents,
        shipping_cents: totals.shippingCents,
        tax_cents: totals.taxCents,
        total_cents: totals.totalCents,
        shipping_method: input.shippingMethod,
        shipping_address: input.shippingAddress as any,
        customer_email: normalizedCustomerEmail,
        customer_name: normalizedCustomerName,
        customer_phone: normalizedCustomerPhone,
        customer_notes: normalizeOptionalText(input.customerNotes),
        source: input.source || 'online',
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Error creating order:', orderError);
      return { order: null, error: 'Fehler beim Erstellen der Bestellung' };
    }

    // Insert order items
    const orderItems = resolvedItems.map((item, index) => ({
      order_id: order.id,
      item_type: item.itemType,
      product_id: item.productId,
      variant_id: item.variantId,
      item_name: item.itemName,
      item_sku: item.itemSku,
      item_description: item.itemDescription,
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents,
      discount_cents: item.discountCents || 0,
      total_cents: items[index].totalCents,
      tax_rate: normalizeTaxRatePercent(item.taxRate),
      tax_cents: items[index].taxCents,
      voucher_type: item.voucherType,
      recipient_email: item.recipientEmail,
      recipient_name: item.recipientName,
      personal_message: item.personalMessage,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      // Rollback order
      await supabase.from('orders').delete().eq('id', order.id);
      return { order: null, error: 'Fehler beim Erstellen der Bestellpositionen' };
    }

    const { error: reserveError } = await supabase.rpc('reserve_order_inventory', {
      p_order_id: order.id,
      p_created_by: null,
    });

    if (reserveError) {
      console.error('Error reserving order inventory:', reserveError);
      await supabase.from('orders').delete().eq('id', order.id);
      return {
        order: null,
        error: toCustomerFacingStockError(reserveError.message),
      };
    }

    // Record initial status
    await supabase.from('order_status_history').insert({
      order_id: order.id,
      new_status: initialStatus,
      notes: isPayAtVenue
        ? 'Bestellung erstellt - Bezahlung bei Abholung'
        : 'Bestellung erstellt',
    });

    // Transform to Order type
    const transformedOrder = transformDbOrder(order, orderItems);

    // Initiate payment if requested
    if (initiatePayment && totals.totalCents > 0) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const { data: session, error: stripeError } = await createCheckoutSession({
        salonId: input.salonId,
        orderId: order.id,
        customerId: input.customerId,
        customerEmail: normalizedCustomerEmail,
        lineItems: resolvedItems.map((item) => ({
          name: item.itemName,
          description: item.itemDescription,
          quantity: item.quantity,
          unitAmountCents: item.unitPriceCents,
        })),
        successUrl: `${baseUrl}/checkout/success`,
        cancelUrl: `${baseUrl}/checkout/cancelled`,
        metadata: {
          order_number: orderNumber,
        },
      });

      if (stripeError || !session) {
        console.error('Error creating checkout session:', stripeError);
        await supabase.rpc('release_order_inventory', {
          p_order_id: order.id,
          p_created_by: null,
          p_notes: 'Bestandsfreigabe nach fehlgeschlagener Zahlungssession',
        });
        await supabase.from('orders').delete().eq('id', order.id);
        return {
          order: null,
          error: 'Fehler beim Erstellen der Zahlungssession',
        };
      }

      // Update order with session ID
      await supabase
        .from('orders')
        .update({ stripe_session_id: session.id })
        .eq('id', order.id);

      revalidateShopOrderPaths(order.id);

      return {
        order: { ...transformedOrder, stripeSessionId: session.id },
        checkoutUrl: session.url ?? undefined,
        error: null,
      };
    }

    revalidateShopOrderPaths(order.id);

    return { order: transformedOrder, error: null };
  } catch (error) {
    console.error('createOrder error:', error);
    return {
      order: null,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}

// ============================================
// GET ORDER
// ============================================

/**
 * Get order by ID
 */
export async function getOrder(orderId: string): Promise<ActionResult<Order>> {
  try {
    if (isMockMode()) {
      const mockOrder = MOCK_ORDERS.find(
        (order) => order.id === orderId || getMockOrderNumber(order) === orderId
      );

      if (!mockOrder) {
        return { data: null, error: 'Bestellung nicht gefunden' };
      }

      return { data: toMockOrder(mockOrder), error: null };
    }

    const supabase = createServerClient() as any;
    if (!supabase) {
      return { data: null, error: 'Datenbankverbindung nicht verfügbar' };
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return { data: null, error: 'Bestellung nicht gefunden' };
    }

    // Get order items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (itemsError) {
      return { data: null, error: 'Fehler beim Laden der Bestellpositionen' };
    }

    return { data: transformDbOrder(order, items || []), error: null };
  } catch (error) {
    console.error('getOrder error:', error);
    return { data: null, error: 'Fehler beim Laden der Bestellung' };
  }
}

/**
 * Get order by order number
 */
export async function getOrderByNumber(
  orderNumber: string
): Promise<ActionResult<Order>> {
  try {
    if (isMockMode()) {
      const mockOrder = MOCK_ORDERS.find((order) => getMockOrderNumber(order) === orderNumber);

      if (!mockOrder) {
        return { data: null, error: 'Bestellung nicht gefunden' };
      }

      return { data: toMockOrder(mockOrder), error: null };
    }

    const supabase = createServerClient() as any;
    if (!supabase) {
      return { data: null, error: 'Datenbankverbindung nicht verfügbar' };
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single();

    if (orderError || !order) {
      return { data: null, error: 'Bestellung nicht gefunden' };
    }

    // Get order items
    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    return { data: transformDbOrder(order, items || []), error: null };
  } catch (error) {
    console.error('getOrderByNumber error:', error);
    return { data: null, error: 'Fehler beim Laden der Bestellung' };
  }
}

// ============================================
// GET ORDERS
// ============================================

/**
 * Get orders for customer
 */
export async function getCustomerOrders(
  customerId: string,
  options: {
    limit?: number;
    offset?: number;
    status?: OrderStatus;
  } = {}
): Promise<ActionResult<OrderSummary[]>> {
  try {
    if (isMockMode()) {
      return {
        data: getMockOrderSummaries({
          customerId,
          status: options.status,
          limit: options.limit,
          offset: options.offset,
        }),
        error: null,
      };
    }

    const supabase = createServerClient() as any;
    if (!supabase) {
      return { data: null, error: 'Datenbankverbindung nicht verfügbar' };
    }
    const { limit = 20, offset = 0, status } = options;

    let query = supabase
      .from('orders')
      .select(
        `
        id,
        order_number,
        status,
        payment_status,
        total_cents,
        customer_email,
        customer_name,
        created_at,
        paid_at,
        order_items(count)
      `
      )
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: orders, error } = await query;

    if (error) {
      return { data: null, error: 'Fehler beim Laden der Bestellungen' };
    }

    const summaries: OrderSummary[] = (orders || []).map((order: any) => ({
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      paymentStatus: order.payment_status,
      totalCents: order.total_cents,
      itemCount: order.order_items?.[0]?.count || 0,
      customerEmail: order.customer_email,
      customerName: order.customer_name,
      createdAt: new Date(order.created_at),
      paidAt: order.paid_at ? new Date(order.paid_at) : undefined,
    }));

    return { data: summaries, error: null };
  } catch (error) {
    console.error('getCustomerOrders error:', error);
    return { data: null, error: 'Fehler beim Laden der Bestellungen' };
  }
}

/**
 * Get orders for salon (admin)
 */
export async function getSalonOrders(
  salonId: string,
  options: {
    limit?: number;
    offset?: number;
    status?: OrderStatus;
    from?: Date;
    to?: Date;
  } = {}
): Promise<ActionResult<OrderSummary[]>> {
  try {
    if (isMockMode()) {
      return {
        data: getMockOrderSummaries({
          status: options.status,
          limit: options.limit,
          offset: options.offset,
        }),
        error: null,
      };
    }

    const supabase = createServerClient() as any;
    if (!supabase) {
      return { data: null, error: 'Datenbankverbindung nicht verfügbar' };
    }
    const { limit = 50, offset = 0, status, from, to } = options;

    let query = supabase
      .from('orders')
      .select(
        `
        id,
        order_number,
        status,
        payment_status,
        total_cents,
        customer_email,
        customer_name,
        created_at,
        paid_at,
        order_items(count)
      `
      )
      .eq('salon_id', salonId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }
    if (from) {
      query = query.gte('created_at', from.toISOString());
    }
    if (to) {
      query = query.lte('created_at', to.toISOString());
    }

    const { data: orders, error } = await query;

    if (error) {
      return { data: null, error: 'Fehler beim Laden der Bestellungen' };
    }

    const summaries: OrderSummary[] = (orders || []).map((order: any) => ({
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      paymentStatus: order.payment_status,
      totalCents: order.total_cents,
      itemCount: order.order_items?.[0]?.count || 0,
      customerEmail: order.customer_email,
      customerName: order.customer_name,
      createdAt: new Date(order.created_at),
      paidAt: order.paid_at ? new Date(order.paid_at) : undefined,
    }));

    return { data: summaries, error: null };
  } catch (error) {
    console.error('getSalonOrders error:', error);
    return { data: null, error: 'Fehler beim Laden der Bestellungen' };
  }
}

// ============================================
// GET ORDERS BY EMAIL
// ============================================

/**
 * Get orders by customer email (for users whose customer record isn't linked to their profile)
 */
export async function getOrdersByEmail(
  email: string,
  options: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<ActionResult<OrderSummary[]>> {
  try {
    if (isMockMode()) {
      return {
        data: getMockOrderSummaries({
          email,
          limit: options.limit,
          offset: options.offset,
        }),
        error: null,
      };
    }

    const supabase = createServerClient() as any;
    if (!supabase) {
      return { data: null, error: 'Datenbankverbindung nicht verfügbar' };
    }
    const { limit = 20, offset = 0 } = options;

    const { data: orders, error } = await supabase
      .from('orders')
      .select(
        `
        id,
        order_number,
        status,
        payment_status,
        total_cents,
        customer_email,
        customer_name,
        created_at,
        paid_at,
        order_items(count)
      `
      )
      .eq('customer_email', email)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { data: null, error: 'Fehler beim Laden der Bestellungen' };
    }

    const summaries: OrderSummary[] = (orders || []).map((order: any) => ({
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      paymentStatus: order.payment_status,
      totalCents: order.total_cents,
      itemCount: order.order_items?.[0]?.count || 0,
      customerEmail: order.customer_email,
      customerName: order.customer_name,
      createdAt: new Date(order.created_at),
      paidAt: order.paid_at ? new Date(order.paid_at) : undefined,
    }));

    return { data: summaries, error: null };
  } catch (error) {
    console.error('getOrdersByEmail error:', error);
    return { data: null, error: 'Fehler beim Laden der Bestellungen' };
  }
}

// ============================================
// UPDATE ORDER
// ============================================

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  changedBy?: string,
  notes?: string
): Promise<ActionResult<Order>> {
  try {
    const supabase = createServerClient() as any;
    if (!supabase) {
      return { data: null, error: 'Datenbankverbindung nicht verfügbar' };
    }

    // Get current order
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();

    if (fetchError || !currentOrder) {
      return { data: null, error: 'Bestellung nicht gefunden' };
    }

    if (!isValidStatusTransition(currentOrder.status, newStatus)) {
      return {
        data: null,
        error: `Statuswechsel von ${currentOrder.status} zu ${newStatus} ist nicht erlaubt`,
      };
    }

    // Update order
    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    // Set timestamps based on status
    if (newStatus === 'shipped') {
      updateData.shipped_at = new Date().toISOString();
    } else if (newStatus === 'completed') {
      updateData.completed_at = new Date().toISOString();
    } else if (newStatus === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
    }

    const { data: order, error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (updateError || !order) {
      return { data: null, error: 'Fehler beim Aktualisieren der Bestellung' };
    }

    // Record status change
    await supabase.from('order_status_history').insert({
      order_id: orderId,
      previous_status: currentOrder.status,
      new_status: newStatus,
      changed_by: changedBy,
      notes,
    });

    if (newStatus === 'cancelled' && currentOrder.status !== 'cancelled') {
      await supabase.rpc('release_order_inventory', {
        p_order_id: orderId,
        p_created_by: changedBy || null,
        p_notes: notes || 'Bestandsfreigabe nach Stornierung',
      });
    }

    // Get items
    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    revalidateShopOrderPaths(orderId);

    return { data: transformDbOrder(order, items || []), error: null };
  } catch (error) {
    console.error('updateOrderStatus error:', error);
    return { data: null, error: 'Fehler beim Aktualisieren des Status' };
  }
}

/**
 * Add tracking number to order
 */
export async function addTrackingNumber(
  orderId: string,
  trackingNumber: string
): Promise<ActionResult<Order>> {
  try {
    const supabase = createServerClient() as any;
    if (!supabase) {
      return { data: null, error: 'Datenbankverbindung nicht verfügbar' };
    }

    const { data: order, error } = await supabase
      .from('orders')
      .update({
        tracking_number: trackingNumber,
        status: 'shipped',
        shipped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error || !order) {
      return { data: null, error: 'Fehler beim Hinzufügen der Sendungsnummer' };
    }

    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    revalidatePath('/admin/orders');

    return { data: transformDbOrder(order, items || []), error: null };
  } catch (error) {
    console.error('addTrackingNumber error:', error);
    return { data: null, error: 'Fehler beim Hinzufügen der Sendungsnummer' };
  }
}

// ============================================
// CANCEL ORDER
// ============================================

/**
 * Cancel an order
 */
export async function cancelOrder(
  orderId: string,
  reason: string
): Promise<ActionResult<Order>> {
  try {
    const supabase = createServerClient() as any;
    if (!supabase) {
      return { data: null, error: 'Datenbankverbindung nicht verfügbar' };
    }

    const { data: order, error } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .in('status', ['pending', 'paid', 'processing'])
      .select()
      .single();

    if (error || !order) {
      return {
        data: null,
        error: 'Bestellung kann nicht storniert werden',
      };
    }

    // Record cancellation
    await supabase.from('order_status_history').insert({
      order_id: orderId,
      new_status: 'cancelled',
      notes: `Storniert: ${reason}`,
    });

    await supabase.rpc('release_order_inventory', {
      p_order_id: orderId,
      p_created_by: null,
      p_notes: `Bestandsfreigabe nach Stornierung: ${reason}`,
    });

    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    revalidateShopOrderPaths(orderId);

    return { data: transformDbOrder(order, items || []), error: null };
  } catch (error) {
    console.error('cancelOrder error:', error);
    return { data: null, error: 'Fehler beim Stornieren der Bestellung' };
  }
}

// ============================================
// APPLY VOUCHER
// ============================================

/**
 * Apply voucher to order
 */
export async function applyVoucherToOrder(
  orderId: string,
  voucherCode: string
): Promise<ActionResult<{ discountCents: number }>> {
  try {
    const supabase = createServerClient() as any;
    if (!supabase) {
      return { data: null, error: 'Datenbankverbindung nicht verfügbar' };
    }

    // Get order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return { data: null, error: 'Bestellung nicht gefunden' };
    }

    // Validate voucher using database function
    const { data: voucherResult, error: voucherError } = await supabase.rpc(
      'validate_voucher',
      { p_salon_id: order.salon_id, p_code: voucherCode }
    );

    if (voucherError || !voucherResult?.[0]?.is_valid) {
      return {
        data: null,
        error: voucherResult?.[0]?.invalid_reason || 'Ungültiger Gutscheincode',
      };
    }

    const voucher = voucherResult[0];

    // Apply discount using database function
    const { data: discountResult, error: applyError } = await supabase.rpc(
      'apply_voucher_to_order',
      { p_order_id: orderId, p_voucher_code: voucherCode }
    );

    if (applyError) {
      return { data: null, error: 'Fehler beim Anwenden des Gutscheins' };
    }

    revalidatePath('/checkout');

    return { data: { discountCents: discountResult || 0 }, error: null };
  } catch (error) {
    console.error('applyVoucherToOrder error:', error);
    return { data: null, error: 'Fehler beim Anwenden des Gutscheins' };
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Transform database order to Order type
 */
function transformDbOrder(dbOrder: any, dbItems: any[]): Order {
  return {
    id: dbOrder.id,
    salonId: dbOrder.salon_id,
    customerId: dbOrder.customer_id,
    orderNumber: dbOrder.order_number,
    status: dbOrder.status,
    paymentStatus: dbOrder.payment_status || 'pending',
    paymentMethod: dbOrder.payment_method,
    subtotalCents: dbOrder.subtotal_cents,
    discountCents: dbOrder.discount_cents || 0,
    shippingCents: dbOrder.shipping_cents || 0,
    taxCents: dbOrder.tax_cents || 0,
    totalCents: dbOrder.total_cents,
    taxRate: dbOrder.tax_rate,
    voucherId: dbOrder.voucher_id,
    voucherDiscountCents: dbOrder.voucher_discount_cents || 0,
    shippingMethod: dbOrder.shipping_method,
    shippingAddress: dbOrder.shipping_address,
    trackingNumber: dbOrder.tracking_number,
    pickupDate: dbOrder.pickup_date,
    pickupTime: dbOrder.pickup_time,
    customerEmail: dbOrder.customer_email,
    customerName: dbOrder.customer_name,
    customerPhone: dbOrder.customer_phone,
    customerNotes: dbOrder.customer_notes,
    internalNotes: dbOrder.internal_notes,
    stripeSessionId: dbOrder.stripe_session_id,
    stripePaymentIntentId: dbOrder.stripe_payment_intent_id,
    stripeChargeId: dbOrder.stripe_charge_id,
    paymentError: dbOrder.payment_error,
    refundedAmountCents: dbOrder.refunded_amount_cents || 0,
    hasDispute: dbOrder.has_dispute || false,
    disputeReason: dbOrder.dispute_reason,
    source: dbOrder.source || 'online',
    createdAt: new Date(dbOrder.created_at),
    updatedAt: new Date(dbOrder.updated_at),
    paidAt: dbOrder.paid_at ? new Date(dbOrder.paid_at) : undefined,
    shippedAt: dbOrder.shipped_at ? new Date(dbOrder.shipped_at) : undefined,
    deliveredAt: dbOrder.delivered_at ? new Date(dbOrder.delivered_at) : undefined,
    completedAt: dbOrder.completed_at ? new Date(dbOrder.completed_at) : undefined,
    cancelledAt: dbOrder.cancelled_at ? new Date(dbOrder.cancelled_at) : undefined,
    refundedAt: dbOrder.refunded_at ? new Date(dbOrder.refunded_at) : undefined,
    items: dbItems.map(transformDbOrderItem),
  };
}

/**
 * Transform database order item to OrderItem type
 */
function transformDbOrderItem(dbItem: any): OrderItem {
  return {
    id: dbItem.id,
    orderId: dbItem.order_id,
    itemType: dbItem.item_type,
    productId: dbItem.product_id,
    variantId: dbItem.variant_id,
    itemName: dbItem.item_name,
    itemSku: dbItem.item_sku,
    itemDescription: dbItem.item_description,
    quantity: dbItem.quantity,
    unitPriceCents: dbItem.unit_price_cents,
    discountCents: dbItem.discount_cents || 0,
    totalCents: dbItem.total_cents,
    taxRate: dbItem.tax_rate,
    taxCents: dbItem.tax_cents || 0,
    voucherId: dbItem.voucher_id,
    voucherType: dbItem.voucher_type,
    recipientEmail: dbItem.recipient_email,
    recipientName: dbItem.recipient_name,
    personalMessage: dbItem.personal_message,
  };
}
