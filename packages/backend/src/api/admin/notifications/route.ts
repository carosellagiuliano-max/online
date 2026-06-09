import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createAuthClient } from '@/lib/supabase/server';
import { createServerClient } from '@/lib/db/client';
import { resolveStaffSalonId } from '@/lib/auth/admin-context';
import { isMockMode, getMockUser } from '@/lib/mock/mock-auth';

// ============================================
// GET - Fetch Admin Notifications
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Mock mode: no notifications backend, return an empty inbox
    if (isMockMode()) {
      const mockUser = await getMockUser();
      if (!mockUser) {
        return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
      }
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const authClient = await createAuthClient();
    const supabase = createServerClient();

    if (!authClient || !supabase) {
      console.error('[notifications] Supabase client not available');
      return NextResponse.json({ error: 'Service nicht verfügbar' }, { status: 503 });
    }

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError) {
      console.error('[notifications] Auth error:', authError);
    }

    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    // Get staff member and salon
    const { data: staffMemberData, error: staffError } = await (supabase.from('staff') as any)
      .select('id, role, salon_id')
      .eq('profile_id', user.id)
      .eq('is_active', true)
      .single() as { data: { id: string; role: string; salon_id: string } | null; error: { message?: string } | null };

    if (staffError) {
      console.error('[notifications] Staff lookup error:', staffError);
    }

    if (!staffMemberData) {
      console.error('[notifications] No staff member found for user:', user.id);
      return NextResponse.json(
        { error: 'Keine Berechtigung' },
        { status: 403 }
      );
    }
    const salonId = resolveStaffSalonId(staffMemberData.salon_id);

    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const unreadOnly = searchParams.get('unread_only') === 'true';

    // Calculate 30 days ago for filtering
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Build query - only show notifications from last 30 days
    let query = (supabase.from('admin_notifications') as any)
      .select('*')
      .eq('salon_id', salonId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Get unread count (only from last 30 days)
    const { count: unreadCount } = await (supabase.from('admin_notifications') as any)
      .select('*', { count: 'exact', head: true })
      .eq('salon_id', salonId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .eq('is_read', false);

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount: unreadCount || 0,
    });
  } catch (error) {
    console.error('Notifications fetch error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Mark Notifications as Read
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Mock mode: nothing to mark as read, report success
    if (isMockMode()) {
      const mockUser = await getMockUser();
      if (!mockUser) {
        return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
      }
      return NextResponse.json({ success: true });
    }

    const authClient = await createAuthClient();
    const supabase = createServerClient();

    if (!authClient || !supabase) {
      return NextResponse.json({ error: 'Service nicht verfügbar' }, { status: 503 });
    }

    // Check authentication
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    // Get staff member and salon
    const { data: staffMember } = await (supabase.from('staff') as any)
      .select('id, role, salon_id')
      .eq('profile_id', user.id)
      .eq('is_active', true)
      .single() as { data: { id: string; role: string; salon_id: string } | null };

    if (!staffMember) {
      return NextResponse.json(
        { error: 'Keine Berechtigung' },
        { status: 403 }
      );
    }
    const salonId = resolveStaffSalonId(staffMember.salon_id);

    const body = await request.json();
    const { notificationIds, markAllRead } = body;

    if (markAllRead) {
      // Mark all as read
      const { error } = await (supabase.from('admin_notifications') as any)
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('salon_id', salonId)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking all as read:', error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
    } else if (notificationIds && notificationIds.length > 0) {
      // Mark specific notifications as read
      const { error } = await (supabase.from('admin_notifications') as any)
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('salon_id', salonId)
        .in('id', notificationIds);

      if (error) {
        console.error('Error marking notifications as read:', error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
