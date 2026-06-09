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

function normalizeForSku(text: string): string {
  return text
    .toUpperCase()
    .replace(/[äÄ]/g, 'A')
    .replace(/[öÖ]/g, 'O')
    .replace(/[üÜ]/g, 'U')
    .replace(/[ß]/g, 'SS')
    .replace(/[^A-Z0-9]/g, '');
}

function normalizeSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function revalidateProductPaths() {
  revalidateTag('shop', 'max');
  revalidateTag('products', 'max');
  revalidatePath('/shop');
  revalidatePath('/shop/produkte');
  revalidatePath('/admin/produkte');
  revalidatePath('/admin/inventar');
}

async function generateSku(
  name: string,
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  salonId: string
): Promise<string> {
  // Split name into words
  const words = name.trim().split(/\s+/).filter(w => w.length > 0);

  // First 3 letters of first word
  const firstPart = normalizeForSku(words[0] || '').slice(0, 3).padEnd(3, 'X');

  // First 2 letters of second word (if exists)
  const secondPart = words[1] ? normalizeForSku(words[1]).slice(0, 2).padEnd(2, 'X') : null;

  // Build the prefix
  const prefix = secondPart ? `${firstPart}-${secondPart}` : firstPart;

  // Find existing SKUs with this prefix to determine the next number
  const { data: existingProducts } = await (supabase.from('products') as any)
    .select('sku')
    .eq('salon_id', salonId)
    .like('sku', `${prefix}-%`);

  // Extract numbers from existing SKUs and find the highest
  let maxNumber = 0;
  if (existingProducts && existingProducts.length > 0) {
    for (const p of existingProducts) {
      if (p.sku) {
        // Match pattern like "HAR-MA-001" or "HAR-001"
        const match = p.sku.match(/-(\d{3})$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber) {
            maxNumber = num;
          }
        }
      }
    }
  }

  // Generate next number with 3 digits
  const nextNumber = (maxNumber + 1).toString().padStart(3, '0');

  return `${prefix}-${nextNumber}`;
}

// ============================================
// POST - Create Product
// ============================================

export async function POST(request: NextRequest) {
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
    const salonId = resolveStaffSalonId(staffMember.salon_id);

    const body = await request.json();
    const { name, slug, description, sku, price_cents, compare_at_price_cents, stock_quantity, is_active, category_id } = body;

    if (!name || price_cents === undefined) {
      return NextResponse.json({ error: 'Name und Preis sind Pflichtfelder' }, { status: 400 });
    }

    const normalizedName = String(name).trim();
    const normalizedSlug = normalizeSlug(slug || normalizedName);
    const priceCents = Number(price_cents);
    const compareAtPriceCents =
      compare_at_price_cents === undefined || compare_at_price_cents === null || compare_at_price_cents === ''
        ? null
        : Number(compare_at_price_cents);
    const initialStock = Number(stock_quantity ?? 0);

    if (!normalizedName || !normalizedSlug) {
      return NextResponse.json({ error: 'Name und Slug sind Pflichtfelder' }, { status: 400 });
    }

    if (!Number.isInteger(priceCents) || priceCents < 0) {
      return NextResponse.json({ error: 'Preis muss eine positive Zahl sein' }, { status: 400 });
    }

    if (compareAtPriceCents !== null && (!Number.isInteger(compareAtPriceCents) || compareAtPriceCents < 0)) {
      return NextResponse.json({ error: 'Vergleichspreis ist ungültig' }, { status: 400 });
    }

    if (!Number.isInteger(initialStock) || initialStock < 0) {
      return NextResponse.json({ error: 'Lagerbestand darf nicht negativ sein' }, { status: 400 });
    }

    // Auto-generate SKU from name if not provided
    const resolvedSku = sku || await generateSku(normalizedName, supabase, salonId);
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

    const { data, error } = await (supabase.from('products') as any)
      .insert({
        salon_id: salonId,
        name: normalizedName,
        slug: normalizedSlug,
        description: description || null,
        sku: resolvedSku,
        price_cents: priceCents,
        compare_at_price_cents: compareAtPriceCents,
        stock_quantity: 0,
        is_active: is_active ?? true,
        category_id: category_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating product:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If stock > 0, use adjust_stock RPC to create an initial Lagerbewegung
    if (initialStock > 0 && data) {
      const { error: rpcError } = await (supabase as any).rpc('adjust_stock', {
        p_product_id: data.id,
        p_quantity_change: initialStock,
        p_movement_type: 'purchase',
        p_reference_type: 'product_create',
        p_reference_id: null,
        p_notes: `Anfangsbestand bei Produkterstellung: ${initialStock}`,
        p_created_by: user?.id || null,
        p_variant_id: null,
      });

      if (rpcError) {
        console.error('Error creating initial stock movement:', rpcError);
        await (supabase.from('products') as any).delete().eq('id', data.id).eq('salon_id', salonId);
        return NextResponse.json(
          { error: rpcError.message || 'Anfangsbestand konnte nicht gespeichert werden' },
          { status: 500 }
        );
      }

      // Refetch to get the updated stock_quantity from RPC
      const { data: refreshed } = await (supabase.from('products') as any)
        .select()
        .eq('id', data.id)
        .single();

      revalidateProductPaths();
      return NextResponse.json({ success: true, product: refreshed || data });
    }

    revalidateProductPaths();
    return NextResponse.json({ success: true, product: data });
  } catch (error: unknown) {
    console.error('Error creating product:', error);
    const message = error instanceof Error ? error.message : 'Interner Serverfehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
