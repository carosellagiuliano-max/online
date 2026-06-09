// ============================================
// BeautifyPRO - Process No-Shows
// Supabase Edge Function (Cron Job - runs daily at end of business)
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NoShowResult {
  success: boolean;
  processedCount: number;
  markedNoShow: string[];
  error?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const now = new Date();
    // Consider appointments as no-show if they ended more than 30 minutes ago
    const cutoffTime = new Date(now.getTime() - 30 * 60 * 1000);

    // Find all confirmed appointments that have passed but weren't completed
    const { data: missedAppointments, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        id,
        booking_number,
        customer_email,
        customer_name,
        total_cents,
        salon_id,
        salons!inner (no_show_fee_percent, no_show_fee_flat_cents)
      `)
      .eq('status', 'confirmed')
      .lt('end_time', cutoffTime.toISOString());

    if (fetchError) {
      console.error('Error fetching missed appointments:', fetchError);
      return new Response(
        JSON.stringify({
          success: false,
          error: fetchError.message,
          processedCount: 0,
          markedNoShow: [],
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!missedAppointments || missedAppointments.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processedCount: 0,
          markedNoShow: [],
          message: 'No missed appointments to process',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const markedNoShow: string[] = [];

    for (const appointment of missedAppointments) {
      // Calculate no-show fee
      const salonSettings = appointment.salons as any;
      let noShowFeeCents = 0;

      if (salonSettings?.no_show_fee_flat_cents) {
        noShowFeeCents = salonSettings.no_show_fee_flat_cents;
      } else if (salonSettings?.no_show_fee_percent) {
        noShowFeeCents = Math.round(
          (appointment.total_cents * salonSettings.no_show_fee_percent) / 100
        );
      }

      // Update appointment to no_show status
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          status: 'no_show',
          no_show_fee_cents: noShowFeeCents,
          updated_at: now.toISOString(),
        })
        .eq('id', appointment.id);

      if (!updateError) {
        markedNoShow.push(appointment.id);

        // Create audit log entry
        await supabase
          .from('audit_logs')
          .insert({
            action: 'mark_no_show',
            entity_type: 'appointment',
            entity_id: appointment.id,
            actor_type: 'system',
            details: {
              booking_number: appointment.booking_number,
              no_show_fee_cents: noShowFeeCents,
              customer_email: appointment.customer_email,
              timestamp: now.toISOString(),
            },
          })
          .catch((e) => console.warn('Audit log insert failed:', e));

        // TODO: Optionally send no-show notification email to customer
        // TODO: Optionally charge no-show fee via Stripe (if card on file)
      } else {
        console.error(`Failed to mark appointment ${appointment.id} as no-show:`, updateError);
      }
    }

    const result: NoShowResult = {
      success: true,
      processedCount: missedAppointments.length,
      markedNoShow,
    };

    console.log(`Processed ${markedNoShow.length} no-shows`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('No-show processing error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processedCount: 0,
        markedNoShow: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
