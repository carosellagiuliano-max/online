import { BaseService, ServiceResult, ServiceListResult } from './base';
import type {
  Product,
  ProductCategory,
  ProductVariant,
  StockMovement,
  InsertTables,
} from '../db/types';

// ============================================
// TYPES
// ============================================

interface ProductWithCategory extends Product {
  category?: ProductCategory | null;
}

interface ProductWithVariants extends Product {
  category?: ProductCategory | null;
  product_variants?: ProductVariant[];
}

interface ProductStock {
  productId: string;
  variantId?: string;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
}

// ============================================
// PRODUCT CATEGORY SERVICE
// ============================================

class ProductCategoryServiceClass extends BaseService<'product_categories'> {
  constructor() {
    super('product_categories');
  }

  // Get categories for salon
  async findBySalon(
    salonId: string,
    activeOnly: boolean = true
  ): Promise<ServiceListResult<ProductCategory>> {
    const filters: Record<string, unknown> = { salon_id: salonId };
    if (activeOnly) filters.is_active = true;

    return this.findMany({
      filters,
      sort: { sortBy: 'sort_order', sortOrder: 'asc' },
    });
  }

  // Get category with products
  async findWithProducts(categoryId: string): Promise<
    ServiceResult<ProductCategory & { products: Product[] }>
  > {
    const { data, error } = await this.client
      .from('product_categories')
      .select(`
        *,
        products (*)
      `)
      .eq('id', categoryId)
      .single();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data: data as ProductCategory & { products: Product[] }, error: null };
  }
}

// ============================================
// PRODUCT SERVICE
// ============================================

class ProductServiceClass extends BaseService<'products'> {
  constructor() {
    super('products');
  }

  // Get products for salon
  async findBySalon(
    salonId: string,
    options?: {
      categoryId?: string;
      activeOnly?: boolean;
      inStockOnly?: boolean;
      page?: number;
      pageSize?: number;
    }
  ): Promise<ServiceListResult<ProductWithCategory>> {
    const { categoryId, activeOnly = true, inStockOnly = false, page = 1, pageSize = 20 } =
      options || {};

    let query = this.client
      .from('products')
      .select(
        `
        *,
        category:product_categories (*)
      `,
        { count: 'exact' }
      )
      .eq('salon_id', salonId);

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (inStockOnly) {
      query = query.gt('stock_quantity', 0);
    }

    query = query
      .order('sort_order', { ascending: true })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      return { data: [], count: null, error: this.handleError(error) };
    }

    return { data: (data || []) as ProductWithCategory[], count, error: null };
  }

  // Get product with variants
  async findWithVariants(productId: string): Promise<ServiceResult<ProductWithVariants>> {
    const { data, error } = await this.client
      .from('products')
      .select(`
        *,
        category:product_categories (*),
        product_variants (*)
      `)
      .eq('id', productId)
      .single();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data: data as ProductWithVariants, error: null };
  }

  // Get products grouped by category
  async findGroupedByCategory(salonId: string): Promise<
    ServiceResult<Array<ProductCategory & { products: Product[] }>>
  > {
    const { data, error } = await this.client
      .from('product_categories')
      .select(`
        *,
        products (*)
      `)
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    // Filter active products within categories
    const result = (data || []).map((category) => ({
      ...category,
      products: ((category as ProductCategory & { products: Product[] }).products || [])
        .filter((p: Product) => p.is_active)
        .sort((a: Product, b: Product) => a.sort_order - b.sort_order),
    }));

    return { data: result, error: null };
  }

  // Get low stock products
  async findLowStock(salonId: string): Promise<ServiceListResult<Product>> {
    const { data, error, count } = await this.client
      .from('products')
      .select('*', { count: 'exact' })
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .eq('track_inventory', true)
      .not('low_stock_threshold', 'is', null)
      .filter('stock_quantity', 'lte', 'low_stock_threshold');

    if (error) {
      return { data: [], count: null, error: this.handleError(error) };
    }

    return { data: data || [], count, error: null };
  }

  // Search products
  async search(
    salonId: string,
    query: string
  ): Promise<ServiceListResult<ProductWithCategory>> {
    const { data, error, count } = await this.client
      .from('products')
      .select(
        `
        *,
        category:product_categories (*)
      `,
        { count: 'exact' }
      )
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .or(`name.ilike.%${query}%,sku.ilike.%${query}%,description.ilike.%${query}%`)
      .order('name', { ascending: true })
      .limit(20);

    if (error) {
      return { data: [], count: null, error: this.handleError(error) };
    }

    return { data: (data || []) as ProductWithCategory[], count, error: null };
  }

  // Update stock
  async updateStock(
    productId: string,
    quantityChange: number,
    reason: 'purchase' | 'sale' | 'adjustment' | 'return' | 'damage' | 'damaged' | 'other',
    notes?: string,
    orderId?: string,
    variantId?: string
  ): Promise<ServiceResult<Product>> {
    const movementType =
      reason === 'damage' ? 'damaged' :
      reason === 'other' ? 'adjustment' :
      reason;

    const { error } = await this.client.rpc('adjust_stock', {
      p_product_id: productId,
      p_quantity_change: quantityChange,
      p_movement_type: movementType,
      p_reference_type: orderId ? 'order' : 'manual_adjustment',
      p_reference_id: orderId || null,
      p_notes: notes || null,
      p_created_by: null,
      p_variant_id: variantId || null,
    });

    if (error) {
      return {
        data: null,
        error: this.handleError(error),
      };
    }

    return this.findById(productId);
  }

  // Check stock availability
  async checkAvailability(
    productId: string,
    quantity: number,
    variantId?: string
  ): Promise<ProductStock> {
    if (variantId) {
      const { data: variant } = await this.client
        .from('product_variants')
        .select('stock_quantity')
        .eq('id', variantId)
        .single();

      const currentStock = variant?.stock_quantity || 0;

      return {
        productId,
        variantId,
        currentStock,
        reservedStock: 0, // TODO: Calculate from pending orders
        availableStock: currentStock,
      };
    }

    const { data: product } = await this.findById(productId);
    const currentStock = product?.stock_quantity || 0;

    return {
      productId,
      currentStock,
      reservedStock: 0,
      availableStock: currentStock,
    };
  }

  // Get stock movements
  async getStockMovements(
    productId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<ServiceListResult<StockMovement>> {
    const { startDate, endDate, limit = 50 } = options || {};

    let query = this.client
      .from('stock_movements')
      .select('*', { count: 'exact' })
      .eq('product_id', productId);

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    query = query.order('created_at', { ascending: false }).limit(limit);

    const { data, error, count } = await query;

    if (error) {
      return { data: [], count: null, error: this.handleError(error) };
    }

    return { data: data || [], count, error: null };
  }

  // Get product price (with variant support)
  async getPrice(
    productId: string,
    variantId?: string
  ): Promise<{ priceCents: number; priceChf: number; compareAtPrice?: number }> {
    if (variantId) {
      const { data: variant } = await this.client
        .from('product_variants')
        .select('price_cents, compare_at_price_cents')
        .eq('id', variantId)
        .single();

      if (variant) {
        return {
          priceCents: variant.price_cents,
          priceChf: variant.price_cents / 100,
          compareAtPrice: variant.compare_at_price_cents || undefined,
        };
      }
    }

    const { data: product } = await this.findById(productId);
    if (!product) {
      return { priceCents: 0, priceChf: 0 };
    }

    return {
      priceCents: product.price_cents,
      priceChf: product.price_cents / 100,
      compareAtPrice: product.compare_at_price_cents || undefined,
    };
  }
}

// ============================================
// VOUCHER SERVICE
// ============================================

class VoucherServiceClass extends BaseService<'vouchers'> {
  constructor() {
    super('vouchers');
  }

  // Get voucher by code
  async findByCode(code: string, salonId: string): Promise<ServiceResult<Database['public']['Tables']['vouchers']['Row']>> {
    const { data, error } = await this.client
      .from('vouchers')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('salon_id', salonId)
      .single();

    if (error) {
      return { data: null, error: this.handleError(error) };
    }

    return { data, error: null };
  }

  // Validate voucher
  async validate(
    code: string,
    salonId: string
  ): Promise<{
    valid: boolean;
    voucher?: Database['public']['Tables']['vouchers']['Row'];
    error?: string;
  }> {
    const { data: voucher, error } = await this.findByCode(code, salonId);

    if (error || !voucher) {
      return { valid: false, error: 'Gutschein nicht gefunden.' };
    }

    if (!voucher.is_active) {
      return { valid: false, error: 'Gutschein ist nicht aktiv.' };
    }

    if (voucher.valid_until && new Date(voucher.valid_until) < new Date()) {
      return { valid: false, error: 'Gutschein ist abgelaufen.' };
    }

    if (voucher.remaining_value_cents <= 0) {
      return { valid: false, error: 'Gutschein hat kein Guthaben mehr.' };
    }

    return { valid: true, voucher };
  }

  // Use voucher
  async use(
    voucherId: string,
    amountCents: number,
    orderId: string
  ): Promise<ServiceResult<Database['public']['Tables']['vouchers']['Row']>> {
    const { data: voucher } = await this.findById(voucherId);

    if (!voucher) {
      return {
        data: null,
        error: { code: 'NOT_FOUND', message: 'Gutschein nicht gefunden.' },
      };
    }

    const actualAmount = Math.min(amountCents, voucher.remaining_balance_cents);
    const newBalance = voucher.remaining_balance_cents - actualAmount;

    return this.update(voucherId, {
      remaining_balance_cents: newBalance,
      is_active: newBalance > 0,
      redeemed_at: newBalance === 0 ? new Date().toISOString() : voucher.redeemed_at,
      redeemed_by_order_id: newBalance === 0 ? orderId : voucher.redeemed_by_order_id,
    });
  }

  // Generate voucher code
  generateCode(length: number = 8): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Create voucher
  async createVoucher(params: {
    salonId: string;
    type: 'gift' | 'discount' | 'loyalty';
    initialValueCents: number;
    purchasedById?: string;
    recipientEmail?: string;
    recipientName?: string;
    personalMessage?: string;
    expiresAt?: Date;
  }): Promise<ServiceResult<Database['public']['Tables']['vouchers']['Row']>> {
    const code = this.generateCode();

    return this.create({
      salon_id: params.salonId,
      code,
      voucher_type: params.type,
      initial_value_cents: params.initialValueCents,
      remaining_balance_cents: params.initialValueCents,
      purchased_by_id: params.purchasedById || null,
      recipient_email: params.recipientEmail || null,
      recipient_name: params.recipientName || null,
      personal_message: params.personalMessage || null,
      expires_at: params.expiresAt?.toISOString() || null,
      is_active: true,
    });
  }
}

// Import Database type for voucher
import type { Database } from '../db/types';

// Export singleton instances
export const ProductCategoryService = new ProductCategoryServiceClass();
export const ProductService = new ProductServiceClass();
export const VoucherService = new VoucherServiceClass();
