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

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ============================================
// GET - List Product Categories
// ============================================

export async function GET() {
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

    const { data, error } = await (supabase.from('product_categories') as any)
      .select('*')
      .eq('salon_id', salonId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error loading product categories:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ categories: data || [] });
  } catch (error: unknown) {
    console.error('Error loading product categories:', error);
    const message = error instanceof Error ? error.message : 'Interner Serverfehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ============================================
// POST - Create Product Category
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

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name ist ein Pflichtfeld' }, { status: 400 });
    }

    const salonId = resolveStaffSalonId(staffMember.salon_id);
    const slug = generateSlug(name) + '-' + Date.now();

    // Get next sort_order
    const { data: existing } = await (supabase.from('product_categories') as any)
      .select('sort_order')
      .eq('salon_id', salonId)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextSortOrder = existing && existing.length > 0 ? (existing[0].sort_order || 0) + 1 : 0;

    const { data, error } = await (supabase.from('product_categories') as any)
      .insert({
        salon_id: salonId,
        name,
        slug,
        description: description || null,
        sort_order: nextSortOrder,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating product category:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, category: data });
  } catch (error: unknown) {
    console.error('Error creating product category:', error);
    const message = error instanceof Error ? error.message : 'Interner Serverfehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
