import { BaseService, ServiceResult, ServiceListResult } from './base';
import type {
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  InsertTables,
  Database,
} from '../db/types';
import { ProductService } from './products';

// ============================================
// TYPES
// ============================================

interface OrderWithItems extends Order {
  order_items?: OrderItem[];
  customer?: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
  };
}

interface CreateOrderParams {
  salonId: string;
  customerId?: string;
  appointmentId?: string;
  items: Array<{
    type: 'product' | 'service' | 'voucher';
    productId?: string;
    serviceId?: string;
    voucherId?: string;
    variantId?: string;
    quantity: number;
    unitPriceCents: number;
    name: string;
    discountCents?: number;
  }>;
  discountCents?: number;
  discountReason?: string;
  voucherCode?: string;
  notes?: string;
}

interface OrderSummary {
  subtotalCents: number;
  discountCents: number;
  voucherAmountCents: number;
  taxCents: number;
  totalCents: number;
  taxRate: number;
}

// ============================================
// ORDER SERVICE
// ============================================

class OrderServiceClass extends BaseService<'orders'> {
  private readonly TAX_RATE = 0.081; // 8.1% Swiss VAT

  constructor() {
    super('orders');
  }

  // Get order with items
  async findWithItems(orderId: string): Promise<ServiceResult<OrderWithItems>> {
    const { data, error } = await this.client
      .from('orders')
      .select(`
        *,
        order_items (*),
        customer:customers (id, first_name, last_name, email)
      `)
      .eq('id', orderId)
      .single();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data: data as OrderWithItems, error: null };
  }

  // Get orders for salon
  async findBySalon(
    salonId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      status?: OrderStatus[];
      customerId?: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<ServiceListResult<OrderWithItems>> {
    const { startDate, endDate, status, customerId, page = 1, pageSize = 20 } =
      options || {};

    let query = this.client
      .from('orders')
      .select(
        `
        *,
        order_items (*),
        customer:customers (id, first_name, last_name)
      `,
        { count: 'exact' }
      )
      .eq('salon_id', salonId);

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    if (status && status.length > 0) {
      query = query.in('status', status);
    }

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    query = query
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      return { data: [], count: null, error: this.handleError(error) };
    }

    return { data: (data || []) as OrderWithItems[], count, error: null };
  }

  // Get orders for customer
  async findByCustomer(
    customerId: string,
    options?: {
      status?: OrderStatus[];
      limit?: number;
    }
  ): Promise<ServiceListResult<OrderWithItems>> {
    const { status, limit = 10 } = options || {};

    let query = this.client
      .from('orders')
      .select(
        `
        *,
        order_items (*)
      `,
        { count: 'exact' }
      )
      .eq('customer_id', customerId);

    if (status && status.length > 0) {
      query = query.in('status', status);
    }

    query = query.order('created_at', { ascending: false }).limit(limit);

    const { data, error, count } = await query;

    if (error) {
      return { data: [], count: null, error: this.handleError(error) };
    }

    return { data: (data || []) as OrderWithItems[], count, error: null };
  }

  // Get today's orders
  async findToday(salonId: string): Promise<ServiceListResult<OrderWithItems>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.findBySalon(salonId, {
      startDate: today,
      endDate: tomorrow,
    });
  }

  // Calculate order summary
  calculateSummary(items: CreateOrderParams['items'], discountCents: number = 0): OrderSummary {
    const subtotalCents = items.reduce((sum, item) => {
      const itemTotal = item.unitPriceCents * item.quantity;
      const itemDiscount = item.discountCents || 0;
      return sum + (itemTotal - itemDiscount);
    }, 0);

    const afterDiscount = subtotalCents - discountCents;
    const taxCents = Math.round(afterDiscount * this.TAX_RATE);
    const totalCents = afterDiscount + taxCents;

    return {
      subtotalCents,
      discountCents,
      voucherAmountCents: 0, // Set separately when voucher is applied
      taxCents,
      totalCents,
      taxRate: this.TAX_RATE,
    };
  }

  // Create order
  async createOrder(params: CreateOrderParams): Promise<ServiceResult<Order>> {
    const {
      salonId,
      customerId,
      appointmentId,
      items,
      discountCents = 0,
      discountReason,
      voucherCode,
      notes,
    } = params;

    // Calculate totals
    const summary = this.calculateSummary(items, discountCents);

    // Generate order number
    const orderNumber = await this.generateOrderNumber(salonId);

    // Create order
    const { data: order, error: orderError } = await this.client
      .from('orders')
      .insert({
        salon_id: salonId,
        customer_id: customerId || null,
        appointment_id: appointmentId || null,
        order_number: orderNumber,
        status: 'pending',
        subtotal_cents: summary.subtotalCents,
        discount_cents: summary.discountCents,
        discount_reason: discountReason || null,
        voucher_amount_cents: summary.voucherAmountCents,
        tax_cents: summary.taxCents,
        tax_rate: summary.taxRate,
        total_cents: summary.totalCents,
        currency: 'CHF',
        notes: notes || null,
      })
      .select()
      .single();

    if (orderError) {
      return { data: null, error: this.handleError(orderError) };
    }

    // Create order items
    const orderItems = items.map((item, index) => ({
      order_id: order.id,
      item_type: item.type,
      product_id: item.productId || null,
      service_id: item.serviceId || null,
      voucher_id: item.voucherId || null,
      variant_id: item.variantId || null,
      name: item.name,
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents,
      discount_cents: item.discountCents || 0,
      total_cents: item.unitPriceCents * item.quantity - (item.discountCents || 0),
      sort_order: index,
    }));

    const { error: itemsError } = await this.client
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      // Rollback order if items fail
      await this.delete(order.id);
      return { data: null, error: this.handleError(itemsError) };
    }

    // Update product stock for product items
    for (const item of items) {
      if (item.type === 'product' && item.productId) {
        await ProductService.updateStock(
          item.productId,
          -item.quantity,
          'sale',
          `Bestellung ${orderNumber}`,
          order.id,
          item.variantId
        );
      }
    }

    // Record status history
    await this.recordStatusChange(order.id, 'pending', 'Bestellung erstellt');

    return { data: order, error: null };
  }

  // Update order status
  async updateStatus(
    orderId: string,
    newStatus: OrderStatus,
    notes?: string
  ): Promise<ServiceResult<Order>> {
    const result = await this.update(orderId, { status: newStatus });

    if (result.data) {
      await this.recordStatusChange(orderId, newStatus, notes);
    }

    return result;
  }

  // Mark as paid
  async markPaid(
    orderId: string,
    paymentMethod: PaymentMethod,
    paymentId?: string
  ): Promise<ServiceResult<Order>> {
    return this.update(orderId, {
      status: 'paid',
      payment_method: paymentMethod,
      payment_id: paymentId || null,
      paid_at: new Date().toISOString(),
    });
  }

  // Complete order
  async complete(orderId: string): Promise<ServiceResult<Order>> {
    return this.updateStatus(orderId, 'completed', 'Bestellung abgeschlossen');
  }

  // Cancel order
  async cancel(orderId: string, reason?: string): Promise<ServiceResult<Order>> {
    const { data: order } = await this.findWithItems(orderId);

    if (!order) {
      return {
        data: null,
        error: { code: 'NOT_FOUND', message: 'Bestellung nicht gefunden.' },
      };
    }

    // Restore product stock
    if (order.order_items) {
      for (const item of order.order_items) {
        if (item.item_type === 'product' && item.product_id) {
          await ProductService.updateStock(
            item.product_id,
            item.quantity,
            'return',
            `Stornierung Bestellung ${order.order_number}`,
            orderId,
            item.variant_id || undefined
          );
        }
      }
    }

    return this.update(orderId, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason || null,
    });
  }

  // Refund order
  async refund(
    orderId: string,
    amountCents: number,
    reason: string
  ): Promise<ServiceResult<Order>> {
    const { data: order } = await this.findById(orderId);

    if (!order) {
      return {
        data: null,
        error: { code: 'NOT_FOUND', message: 'Bestellung nicht gefunden.' },
      };
    }

    const newRefundedAmount = (order.refunded_cents || 0) + amountCents;
    const isFullyRefunded = newRefundedAmount >= order.total_cents;

    return this.update(orderId, {
      refunded_cents: newRefundedAmount,
      status: isFullyRefunded ? 'refunded' : order.status,
    });
  }

  // Generate order number
  private async generateOrderNumber(salonId: string): Promise<string> {
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');

    // Get count of orders today
    const { count } = await this.client
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('salon_id', salonId)
      .gte('created_at', new Date(today.setHours(0, 0, 0, 0)).toISOString());

    const sequence = String((count || 0) + 1).padStart(4, '0');
    return `ORD-${datePrefix}-${sequence}`;
  }

  // Record status change
  private async recordStatusChange(
    orderId: string,
    status: OrderStatus,
    notes?: string
  ): Promise<void> {
    await this.client.from('order_status_history').insert({
      order_id: orderId,
      status,
      notes: notes || null,
    });
  }

  // Get sales statistics
  async getSalesStats(
    salonId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    productsSold: number;
    servicesSold: number;
  }> {
    const { data: orders } = await this.client
      .from('orders')
      .select(`
        total_cents,
        order_items (item_type, quantity)
      `)
      .eq('salon_id', salonId)
      .in('status', ['paid', 'completed'])
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (!orders || orders.length === 0) {
      return {
        totalOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        productsSold: 0,
        servicesSold: 0,
      };
    }

    const totalRevenue = orders.reduce((sum, o) => sum + o.total_cents, 0);
    let productsSold = 0;
    let servicesSold = 0;

    for (const order of orders) {
      const items = (order as unknown as { order_items: OrderItem[] }).order_items || [];
      for (const item of items) {
        if (item.item_type === 'product') {
          productsSold += item.quantity;
        } else if (item.item_type === 'service') {
          servicesSold += item.quantity;
        }
      }
    }

    return {
      totalOrders: orders.length,
      totalRevenue,
      averageOrderValue: Math.round(totalRevenue / orders.length),
      productsSold,
      servicesSold,
    };
  }
}

// Export singleton instance
export const OrderService = new OrderServiceClass();
