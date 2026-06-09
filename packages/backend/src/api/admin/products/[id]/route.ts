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

function revalidateProductPaths(productSlug?: string) {
  revalidateTag('shop', 'max');
  revalidateTag('products', 'max');
  revalidatePath('/shop');
  revalidatePath('/shop/produkte');
  if (productSlug) revalidatePath(`/shop/produkte/${productSlug}`);
  revalidatePath('/admin/produkte');
  revalidatePath('/admin/inventar');
}

// ============================================
// PUT - Update Product
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const salonId = resolveStaffSalonId(staffMember.salon_id);

    const { data: { user } } = await authClient.auth.getUser();

    const { id } = await params;
    const body = await request.json();
    const { name, description, sku, price_cents, compare_at_price_cents, stock_quantity, is_active, category_id } = body;

    if (!name || price_cents === undefined) {
      return NextResponse.json({ error: 'Name und Preis sind Pflichtfelder' }, { status: 400 });
    }

    const normalizedName = String(name).trim();
    const priceCents = Number(price_cents);
    const compareAtPriceCents =
      compare_at_price_cents === undefined || compare_at_price_cents === null || compare_at_price_cents === ''
        ? null
        : Number(compare_at_price_cents);
    const newStock = Number(stock_quantity ?? 0);

    if (!normalizedName) {
      return NextResponse.json({ error: 'Name ist ein Pflichtfeld' }, { status: 400 });
    }

    if (!Number.isInteger(priceCents) || priceCents < 0) {
      return NextResponse.json({ error: 'Preis muss eine positive Zahl sein' }, { status: 400 });
    }

    if (compareAtPriceCents !== null && (!Number.isInteger(compareAtPriceCents) || compareAtPriceCents < 0)) {
      return NextResponse.json({ error: 'Vergleichspreis ist ungültig' }, { status: 400 });
    }

    if (!Number.isInteger(newStock) || newStock < 0) {
      return NextResponse.json({ error: 'Lagerbestand darf nicht negativ sein' }, { status: 400 });
    }

    // Auto-generate SKU from name if not provided
    const resolvedSku = sku || generateSku(normalizedName);
    if (category_id) {
      const { data: category } = await (supabase.from('product_categories') as any)
        .select('id')
        .eq('id', category_id)
        .eq('salon_id', salonId)
        .single();

      if (!category) {
        return NextResponse.json({ error: 'Kategorie nicht gefunden' }, { status: 404 });
      }
    }

    // Get current product to check if stock_quantity changed
    const { data: currentProduct, error: fetchError } = await (supabase.from('products') as any)
      .select('stock_quantity, slug')
      .eq('id', id)
      .eq('salon_id', salonId)
      .single();

    if (fetchError || !currentProduct) {
      return NextResponse.json({ error: 'Produkt nicht gefunden' }, { status: 404 });
    }

    const currentStock = Number(currentProduct.stock_quantity ?? 0);
    const stockChanged = currentStock !== newStock;

    // Update all fields except stock_quantity (handled via RPC if changed)
    const { data, error } = await (supabase.from('products') as any)
      .update({
        name: normalizedName,
        description: description || null,
        sku: resolvedSku,
        price_cents: priceCents,
        compare_at_price_cents: compareAtPriceCents,
        ...(!stockChanged ? { stock_quantity: newStock } : {}),
        is_active: is_active ?? true,
        category_id: category_id || null,
      })
      .eq('id', id)
      .eq('salon_id', salonId)
      .select()
      .single();

    if (error) {
      console.error('Error updating product:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If stock changed, use adjust_stock RPC to create a Lagerbewegung
    if (stockChanged) {
      const quantityChange = newStock - currentStock;
      const { error: rpcError } = await (supabase as any).rpc('adjust_stock', {
        p_product_id: id,
        p_quantity_change: quantityChange,
        p_movement_type: 'adjustment',
        p_reference_type: 'product_edit',
        p_reference_id: null,
        p_notes: `Bestand über Produktbearbeitung geändert: ${currentStock} → ${newStock}`,
        p_created_by: user?.id || null,
        p_variant_id: null,
      });

      if (rpcError) {
        console.error('Error creating stock movement:', rpcError);
        return NextResponse.json(
          { error: rpcError.message || 'Bestand konnte nicht gespeichert werden' },
          { status: 500 }
        );
      }

      // Refetch the product to get the RPC-updated stock_quantity
      const { data: refreshed } = await (supabase.from('products') as any)
        .select()
        .eq('id', id)
        .eq('salon_id', salonId)
        .single();

      revalidateProductPaths(currentProduct.slug);
      return NextResponse.json({ success: true, product: refreshed || data });
    }

    revalidateProductPaths(currentProduct.slug);
    return NextResponse.json({ success: true, product: data });
  } catch (error: unknown) {
    console.error('Error updating product:', error);
    const message = error instanceof Error ? error.message : 'Interner Serverfehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ============================================
// DELETE - Delete Product
// ============================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const salonId = resolveStaffSalonId(staffMember.salon_id);

    const { id } = await params;

    const { data: product } = await (supabase.from('products') as any)
      .select('id, slug')
      .eq('id', id)
      .eq('salon_id', salonId)
      .single();

    if (!product) {
      return NextResponse.json({ error: 'Produkt nicht gefunden' }, { status: 404 });
    }

    const { error } = await (supabase.from('products') as any)
      .update({
        is_active: false,
        is_published: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('salon_id', salonId);

    if (error) {
      console.error('Error deleting product:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidateProductPaths(product.slug);
    return NextResponse.json({
      success: true,
      message: 'Produkt wurde deaktiviert und ist nicht mehr öffentlich kaufbar',
    });
  } catch (error: unknown) {
    console.error('Error deleting product:', error);
    const message = error instanceof Error ? error.message : 'Interner Serverfehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
