import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { requireAdminApiContext } from '@/lib/auth/admin-context';

// ============================================
// TYPES
// ============================================

interface AdjustStockRequest {
  productId: string;
  quantity: number;
  movementType: string;
  notes?: string;
  variantId?: string;
}

const ALLOWED_MOVEMENT_TYPES = new Set([
  'purchase',
  'sale',
  'adjustment',
  'return',
  'damaged',
  'transfer',
]);

// ============================================
// POST - Adjust Stock
// ============================================

export async function POST(request: NextRequest) {
  try {
    const context = await requireAdminApiContext(['admin', 'manager', 'hq']);
    if ('response' in context) return context.response;

    // Parse request body
    const body: AdjustStockRequest = await request.json();
    const { productId, quantity, movementType, notes, variantId } = body;
    const quantityNumber = Number(quantity);
    const normalizedMovementType = movementType === 'damage' ? 'damaged' : movementType;

    if (!productId || quantity === undefined || !movementType) {
      return NextResponse.json(
        { error: 'Fehlende Pflichtfelder' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(quantityNumber) || quantityNumber === 0) {
      return NextResponse.json(
        { error: 'Menge muss eine ganze Zahl ungleich 0 sein' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MOVEMENT_TYPES.has(normalizedMovementType)) {
      return NextResponse.json(
        { error: 'Ungültige Bewegungsart' },
        { status: 400 }
      );
    }

    const { data: product } = await context.db
      .from('products')
      .select('id')
      .eq('id', productId)
      .eq('salon_id', context.salonId)
      .single();

    if (!product) {
      return NextResponse.json({ error: 'Produkt nicht gefunden' }, { status: 404 });
    }

    if (variantId) {
      const { data: variant } = await context.db
        .from('product_variants')
        .select('id')
        .eq('id', variantId)
        .eq('product_id', productId)
        .single();

      if (!variant) {
        return NextResponse.json({ error: 'Variante nicht gefunden' }, { status: 404 });
      }
    }

    // Call the adjust_stock function
    const { data, error } = await context.db.rpc('adjust_stock', {
      p_product_id: productId,
      p_quantity_change: quantityNumber,
      p_movement_type: normalizedMovementType,
      p_reference_type: 'manual_adjustment',
      p_reference_id: null,
      p_notes: notes || null,
      p_created_by: context.user.id,
      p_variant_id: variantId || null,
    });

    if (error) {
      console.error('Stock adjustment error:', error);
      return NextResponse.json(
        { error: error.message || 'Fehler beim Anpassen des Bestands' },
        { status: 500 }
      );
    }

    revalidateTag('shop', 'max');
    revalidateTag('products', 'max');
    revalidatePath('/shop');
    revalidatePath('/shop/produkte');
    revalidatePath('/admin/inventar');
    revalidatePath('/admin/produkte');

    return NextResponse.json({
      success: true,
      newQuantity: data,
      message: 'Bestand erfolgreich angepasst',
    });
  } catch (error) {
    console.error('Stock adjustment error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
