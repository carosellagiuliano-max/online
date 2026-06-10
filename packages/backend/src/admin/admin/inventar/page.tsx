import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getCurrentStaffMember } from '@/lib/auth/rbac';
import { resolveStaffSalonId } from '@/lib/auth/admin-context';
import { isMockMode, MOCK_PRODUCTS } from '@/lib/mock/mock-data';
import { AdminInventoryView } from '@/components/admin/admin-inventory-view';

// Force dynamic rendering (API not available at build time)
export const dynamic = 'force-dynamic';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Inventar',
};

// ============================================
// TYPES
// ============================================

interface InventoryProduct {
  id: string;
  name: string;
  sku: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  priceCents: number;
  categoryName: string | null;
  isActive: boolean;
  isLowStock: boolean;
  variants: InventoryVariant[];
}

interface InventoryVariant {
  id: string;
  productId: string;
  productName: string;
  name: string;
  sku: string | null;
  stockQuantity: number;
  priceCents: number;
  isActive: boolean;
}

interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  movementType: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface InventoryStats {
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
}

// Supabase row types
interface ProductDbRow {
  id: string;
  name: string;
  sku: string | null;
  stock_quantity: number | null;
  low_stock_threshold: number | null;
  track_inventory: boolean | null;
  price_cents: number;
  cost_price_cents: number | null;
  is_active: boolean;
  product_categories: {
    name: string;
  } | null;
}

interface VariantDbRow {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  stock_quantity: number | null;
  price_cents: number | null;
  is_active: boolean;
  products: {
    name: string;
  } | null;
}

interface StockMovementDbRow {
  id: string;
  product_id: string;
  variant_id: string | null;
  movement_type: string;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  notes: string | null;
  created_at: string;
  products: {
    name: string;
  } | null;
  product_variants: {
    name: string;
  } | null;
  profiles: {
    display_name: string;
  } | null;
}

// ============================================
// MOCK DATA (Demo-Modus ohne Datenbank)
// ============================================

function getMockInventoryData() {
  const products: InventoryProduct[] = MOCK_PRODUCTS.map((p, index) => ({
    id: p.id,
    name: p.name,
    sku: `BP-DEMO-${String(index + 1).padStart(3, '0')}`,
    stockQuantity: p.stock_quantity,
    lowStockThreshold: 5,
    trackInventory: true,
    priceCents: Math.round(p.price * 100),
    categoryName: 'Demo',
    isActive: p.is_active,
    isLowStock: p.stock_quantity <= 5,
    variants: [],
  })).sort((a, b) => a.stockQuantity - b.stockQuantity);

  const productName = (id: string) =>
    MOCK_PRODUCTS.find((p) => p.id === id)?.name ?? 'Unbekannt';
  const hoursAgo = (hours: number) =>
    new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const movements: StockMovement[] = [
    {
      id: 'mock-mov-003',
      productId: 'prod-003',
      productName: productName('prod-003'),
      variantId: null,
      variantName: null,
      movementType: 'sale',
      quantity: -1,
      previousQuantity: 3,
      newQuantity: 3 - 1,
      notes: 'Verkauf im Salon',
      createdBy: 'Demo Admin',
      createdAt: hoursAgo(5),
    },
    {
      id: 'mock-mov-002',
      productId: 'prod-002',
      productName: productName('prod-002'),
      variantId: null,
      variantName: null,
      movementType: 'sale',
      quantity: -2,
      previousQuantity: 10,
      newQuantity: 10 - 2,
      notes: 'Verkauf nach Behandlung',
      createdBy: 'Demo Admin',
      createdAt: hoursAgo(26),
    },
    {
      id: 'mock-mov-001',
      productId: 'prod-002',
      productName: productName('prod-002'),
      variantId: null,
      variantName: null,
      movementType: 'purchase',
      quantity: 10,
      previousQuantity: 0,
      newQuantity: 10,
      notes: 'Wareneingang Lieferung',
      createdBy: 'Demo Admin',
      createdAt: hoursAgo(72),
    },
  ];

  const stats: InventoryStats = {
    totalProducts: products.length,
    lowStockCount: products.filter((p) => p.stockQuantity > 0 && p.isLowStock).length,
    outOfStockCount: products.filter((p) => p.stockQuantity <= 0).length,
    totalValue: products.reduce((sum, p) => sum + p.stockQuantity * p.priceCents, 0),
  };

  return { products, movements, stats };
}

// ============================================
// DATA FETCHING
// ============================================

async function getInventoryData() {
  const staffMember = await getCurrentStaffMember();
  if (!staffMember) {
    redirect('/admin/login');
  }

  // Demo-Modus: Inventar aus Mock-Daten aufbauen (keine Datenbank)
  if (isMockMode()) {
    return getMockInventoryData();
  }

  const salonId = resolveStaffSalonId(staffMember.salon_id);
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return { products: [], movements: [], stats: { totalProducts: 0, lowStockCount: 0, outOfStockCount: 0, totalValue: 0 } };
  }

  // Get products with inventory data
  const { data: productsData } = await supabase
    .from('products')
    .select(`
      id,
      name,
      sku,
      stock_quantity,
      low_stock_threshold,
      track_inventory,
      price_cents,
      cost_price_cents,
      is_active,
      product_categories (
        name
      )
    `)
    .eq('salon_id', salonId)
    .eq('is_active', true)
    .order('stock_quantity', { ascending: true }) as { data: ProductDbRow[] | null };

  // Get all active product variants
  const { data: variantsData } = await supabase
    .from('product_variants')
    .select(`
      id,
      product_id,
      name,
      sku,
      stock_quantity,
      price_cents,
      is_active,
      products (
        name,
        salon_id
      )
    `)
    .eq('products.salon_id', salonId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true }) as { data: VariantDbRow[] | null };

  // Get recent stock movements (including variant info)
  const { data: movementsData } = await supabase
    .from('stock_movements')
    .select(`
      id,
      product_id,
      variant_id,
      movement_type,
      quantity,
      previous_quantity,
      new_quantity,
      notes,
      created_at,
      products (
        name
      ),
      product_variants (
        name
      ),
      profiles (
        display_name
      )
    `)
    .eq('salon_id', salonId)
    .order('created_at', { ascending: false })
    .limit(50) as { data: StockMovementDbRow[] | null };

  // Group variants by product_id
  const variantsByProduct: Record<string, InventoryVariant[]> = {};
  (variantsData || []).forEach((v) => {
    const variant: InventoryVariant = {
      id: v.id,
      productId: v.product_id,
      productName: v.products?.name || 'Unbekannt',
      name: v.name,
      sku: v.sku,
      stockQuantity: v.stock_quantity || 0,
      priceCents: v.price_cents || 0,
      isActive: v.is_active,
    };
    if (!variantsByProduct[v.product_id]) {
      variantsByProduct[v.product_id] = [];
    }
    variantsByProduct[v.product_id].push(variant);
  });

  // Transform products
  const products: InventoryProduct[] = (productsData || []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    stockQuantity: p.stock_quantity || 0,
    lowStockThreshold: p.low_stock_threshold || 5,
    trackInventory: p.track_inventory ?? true,
    priceCents: p.price_cents,
    categoryName: p.product_categories?.name || null,
    isActive: p.is_active,
    isLowStock: (p.stock_quantity || 0) <= (p.low_stock_threshold || 5),
    variants: variantsByProduct[p.id] || [],
  }));

  // Transform movements
  const movements: StockMovement[] = (movementsData || []).map((m) => ({
    id: m.id,
    productId: m.product_id,
    productName: m.products?.name || 'Unbekannt',
    variantId: m.variant_id,
    variantName: m.product_variants?.name || null,
    movementType: m.movement_type,
    quantity: m.quantity,
    previousQuantity: m.previous_quantity,
    newQuantity: m.new_quantity,
    notes: m.notes,
    createdBy: m.profiles?.display_name || null,
    createdAt: m.created_at,
  }));

  // Calculate total inventory value (at cost price or sale price) - including variants
  let totalValue = 0;
  (productsData || []).forEach((p) => {
    const productVariants = variantsByProduct[p.id] || [];
    if (productVariants.length > 0) {
      // If product has variants, sum variant values
      productVariants.forEach((v) => {
        const price = p.cost_price_cents || v.priceCents || p.price_cents || 0;
        totalValue += v.stockQuantity * price;
      });
    } else {
      // No variants, use product stock
      const qty = p.stock_quantity || 0;
      const price = p.cost_price_cents || p.price_cents || 0;
      totalValue += qty * price;
    }
  });

  // Calculate low stock and out of stock counts (respecting variants)
  let lowStockCount = 0;
  let outOfStockCount = 0;

  products.forEach((p) => {
    if (p.variants.length > 0) {
      // Check variants for stock status
      const hasOutOfStock = p.variants.some((v) => v.stockQuantity <= 0);
      const hasLowStock = p.variants.some((v) => v.stockQuantity > 0 && v.stockQuantity <= p.lowStockThreshold);

      if (hasOutOfStock) {
        outOfStockCount++;
      } else if (hasLowStock) {
        lowStockCount++;
      }
    } else {
      // No variants, check product stock
      if (p.stockQuantity <= 0) {
        outOfStockCount++;
      } else if (p.isLowStock) {
        lowStockCount++;
      }
    }
  });

  const stats: InventoryStats = {
    totalProducts: products.length,
    lowStockCount,
    outOfStockCount,
    totalValue,
  };

  return {
    products,
    movements,
    stats,
  };
}

// ============================================
// INVENTORY PAGE
// ============================================

export default async function InventoryPage() {
  const { products, movements, stats } = await getInventoryData();

  return (
    <AdminInventoryView
      products={products}
      movements={movements}
      stats={stats}
    />
  );
}
