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
// PUT - Reorder Product Categories
// ============================================

export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const { categoryIds } = body;

    if (!Array.isArray(categoryIds)) {
      return NextResponse.json({ error: 'categoryIds muss ein Array sein' }, { status: 400 });
    }

    // Update sort_order for each category
    for (let i = 0; i < categoryIds.length; i++) {
      const { error } = await (supabase.from('product_categories') as any)
        .update({ sort_order: i })
        .eq('id', categoryIds[i])
        .eq('salon_id', salonId);

      if (error) {
        console.error('Error reordering category:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error reordering product categories:', error);
    const message = error instanceof Error ? error.message : 'Interner Serverfehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
