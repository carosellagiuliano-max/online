// ============================================
// BeautifyPRO - Cleanup Expired Reservations
// Supabase Edge Function (Cron Job)
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CleanupResult {
  success: boolean;
  expiredCount: number;
  cancelledIds: string[];
  error?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authorization (for manual calls)
    const authHeader = req.headers.get('Authorization');

    // Get Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const now = new Date().toISOString();

    // Find all expired reservations
    const { data: expiredReservations, error: fetchError } = await supabase
      .from('appointments')
      .select('id, booking_number, customer_email, customer_name')
      .eq('status', 'reserved')
      .lt('reservation_expires_at', now);

    if (fetchError) {
      console.error('Error fetching expired reservations:', fetchError);
      return new Response(
        JSON.stringify({
          success: false,
          error: fetchError.message,
          expiredCount: 0,
          cancelledIds: [],
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!expiredReservations || expiredReservations.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          expiredCount: 0,
          cancelledIds: [],
          message: 'No expired reservations found',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const expiredIds = expiredReservations.map((r) => r.id);

    // Update all expired reservations to cancelled
    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_at: now,
        cancellation_reason: 'Reservierung abgelaufen (Timeout)',
      })
      .in('id', expiredIds);

    if (updateError) {
      console.error('Error cancelling reservations:', updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: updateError.message,
          expiredCount: expiredReservations.length,
          cancelledIds: [],
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Log the cleanup
    console.log(`Cleaned up ${expiredIds.length} expired reservations:`, expiredIds);

    // Optionally: Log to audit table
    await supabase.from('audit_logs').insert({
      action: 'cleanup_expired_reservations',
      entity_type: 'appointment',
      details: {
        count: expiredIds.length,
        ids: expiredIds,
        timestamp: now,
      },
    }).catch((e) => console.warn('Audit log insert failed:', e));

    const result: CleanupResult = {
      success: true,
      expiredCount: expiredReservations.length,
      cancelledIds: expiredIds,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cleanup function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        expiredCount: 0,
        cancelledIds: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
