import { NextRequest, NextResponse } from 'next/server';
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

// ============================================
// PUT - Update Product Category
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

    const { id } = await params;
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name ist ein Pflichtfeld' }, { status: 400 });
    }

    const { data, error } = await (supabase.from('product_categories') as any)
      .update({
        name,
        description: description || null,
      })
      .eq('id', id)
      .eq('salon_id', salonId)
      .select()
      .single();

    if (error) {
      console.error('Error updating product category:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, category: data });
  } catch (error: unknown) {
    console.error('Error updating product category:', error);
    const message = error instanceof Error ? error.message : 'Interner Serverfehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ============================================
// DELETE - Delete Product Category
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

    // Set category_id = null on all products referencing this category
    await (supabase.from('products') as any)
      .update({ category_id: null })
      .eq('category_id', id)
      .eq('salon_id', salonId);

    // Delete the category
    const { error } = await (supabase.from('product_categories') as any)
      .delete()
      .eq('id', id)
      .eq('salon_id', salonId);

    if (error) {
      console.error('Error deleting product category:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting product category:', error);
    const message = error instanceof Error ? error.message : 'Interner Serverfehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
