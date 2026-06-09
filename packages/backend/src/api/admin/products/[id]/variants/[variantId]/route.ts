import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createServerClient as createAuthClient } from '@/lib/supabase/server';
import { createServerClient } from '@/lib/db/client';
import { resolveStaffSalonId } from '@/lib/auth/admin-context';

// ============================================
// Helpers
// ============================================

async function getStaffMember(authClient: Awaited<ReturnType<typeof createAuthClient>>, supabase: NonNullable<ReturnType<typeof createServerClient>>) {
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return null;

  const { data: staffMember } = await (supabase.from('staff') as any)
    .select('id, role, salon_id')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .single();

  if (!staffMember || !['admin', 'manager', 'hq'].includes(staffMember.role)) {
    return null;
  }

  return staffMember;
}

function generateSku(name: string): string {
  return name
    .toUpperCase()
    .replace(/[äÄ]/g, 'AE')
    .replace(/[öÖ]/g, 'OE')
    .replace(/[üÜ]/g, 'UE')
    .replace(/[ß]/g, 'SS')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20);
}

async function productBelongsToSalon(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  productId: string,
  salonId: string
): Promise<boolean> {
  const { data } = await (supabase.from('products') as any)
    .select('id')
    .eq('id', productId)
    .eq('salon_id', salonId)
    .single();

  return !!data;
}

function revalidateProductVariantPaths() {
  revalidateTag('shop', 'max');
  revalidateTag('products', 'max');
  revalidatePath('/shop');
  revalidatePath('/shop/produkte');
  revalidatePath('/admin/produkte');
  revalidatePath('/admin/inventar');
}

// ============================================
// PUT - Update Product Variant
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  try {
    const authClient = await createAuthClient();
    const supabase = createServerClient();

    if (!authClient || !supabase) {
      return NextResponse.json({ error: 'Service nicht verfügbar' }, { status: 503 });
    }

    const staffMember = await getStaffMember(authClient, supabase);
    if (!staffMember) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { data: { user } } = await authClient.auth.getUser();

    const { id, variantId } = await params;
    const salonId = resolveStaffSalonId(staffMember.salon_id);
    if (!(await productBelongsToSalon(supabase, id, salonId))) {
      return NextResponse.json({ error: 'Produkt nicht gefunden' }, { status: 404 });
    }
    const body = await request.json();
    const { name, sku, price_cents, compare_at_price_cents, stock_quantity, is_active, image_url } = body;
    const normalizedName = String(name || '').trim();
    const priceCents = Number(price_cents ?? 0);
    const compareAtPriceCents =
      compare_at_price_cents === undefined || compare_at_price_cents === null || compare_at_price_cents === ''
        ? null
        : Number(compare_at_price_cents);
    const newStock = Number(stock_quantity ?? 0);

    if (!normalizedName) {
      return NextResponse.json({ error: 'Name ist ein Pflichtfeld' }, { status: 400 });
    }

    if (!Number.isInteger(priceCents) || priceCents < 0) {
      return NextResponse.json({ error: 'Preis ist ungültig' }, { status: 400 });
    }

    if (compareAtPriceCents !== null && (!Number.isInteger(compareAtPriceCents) || compareAtPriceCents < 0)) {
      return NextResponse.json({ error: 'Vergleichspreis ist ungültig' }, { status: 400 });
    }

    if (!Number.isInteger(newStock) || newStock < 0) {
      return NextResponse.json({ error: 'Lagerbestand darf nicht negativ sein' }, { status: 400 });
    }

    // Auto-generate SKU from name if not provided
    const resolvedSku = sku || generateSku(normalizedName);

    // Get current variant to check if stock_quantity changed
    const { data: currentVariant, error: fetchError } = await (supabase.from('product_variants') as any)
      .select('stock_quantity')
      .eq('id', variantId)
      .eq('product_id', id)
      .single();

    if (fetchError || !currentVariant) {
      return NextResponse.json({ error: 'Variante nicht gefunden' }, { status: 404 });
    }

    const currentStock = Number(currentVariant.stock_quantity ?? 0);
    const stockChanged = currentStock !== newStock;

    // Update all fields except stock_quantity (handled via RPC if changed)
    const { data, error } = await (supabase.from('product_variants') as any)
      .update({
        name: normalizedName,
        sku: resolvedSku,
        price_cents: priceCents,
        compare_at_price_cents: compareAtPriceCents,
        ...(!stockChanged ? { stock_quantity: newStock } : {}),
        is_active: is_active ?? true,
        image_url: image_url || null,
      })
      .eq('id', variantId)
      .eq('product_id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating product variant:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If stock changed, use adjust_stock RPC to create a Lagerbewegung
    if (stockChanged) {
      const quantityChange = newStock - currentStock;
      const { error: rpcError } = await (supabase as any).rpc('adjust_stock', {
        p_product_id: id,
        p_quantity_change: quantityChange,
        p_movement_type: 'adjustment',
        p_reference_type: 'variant_edit',
        p_reference_id: null,
        p_notes: `Bestand für Variante "${normalizedName}" geändert: ${currentStock} → ${newStock}`,
        p_created_by: user?.id || null,
        p_variant_id: variantId,
      });

      if (rpcError) {
        console.error('Error creating variant stock movement:', rpcError);
        return NextResponse.json(
          { error: rpcError.message || 'Bestand konnte nicht gespeichert werden' },
          { status: 500 }
        );
      }

      // Refetch to get RPC-updated stock_quantity
      const { data: refreshed } = await (supabase.from('product_variants') as any)
        .select()
        .eq('id', variantId)
        .eq('product_id', id)
        .single();

      revalidateProductVariantPaths();
      return NextResponse.json({ success: true, variant: refreshed || data });
    }

    revalidateProductVariantPaths();
    return NextResponse.json({ success: true, variant: data });
  } catch (error: unknown) {
    console.error('Error updating product variant:', error);
    const message = error instanceof Error ? error.message : 'Interner Serverfehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ============================================
// DELETE - Delete Product Variant
// ============================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  try {
    const authClient = await createAuthClient();
    const supabase = createServerClient();

    if (!authClient || !supabase) {
      return NextResponse.json({ error: 'Service nicht verfügbar' }, { status: 503 });
    }

    const staffMember = await getStaffMember(authClient, supabase);
    if (!staffMember) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { id, variantId } = await params;
    const salonId = resolveStaffSalonId(staffMember.salon_id);
    if (!(await productBelongsToSalon(supabase, id, salonId))) {
      return NextResponse.json({ error: 'Produkt nicht gefunden' }, { status: 404 });
    }

    const { error } = await (supabase.from('product_variants') as any)
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', variantId)
      .eq('product_id', id);

    if (error) {
      console.error('Error deleting product variant:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidateProductVariantPaths();
    return NextResponse.json({
      success: true,
      message: 'Variante wurde deaktiviert und ist nicht mehr kaufbar',
    });
  } catch (error: unknown) {
    console.error('Error deleting product variant:', error);
    const message = error instanceof Error ? error.message : 'Interner Serverfehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
