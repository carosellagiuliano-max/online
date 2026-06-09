import type { SupabaseClient } from '@supabase/supabase-js';
import { sendBookingConfirmationEmail } from '@/lib/email';
import type { Database } from '@/lib/db/types';

type DbClient = SupabaseClient<Database>;

function getLinkedProfile(record: any) {
  return Array.isArray(record?.profiles) ? record.profiles[0] : record?.profiles;
}

export function getAppointmentRecipient(appointment: any): { name: string; email: string | null } {
  const customer = appointment?.customer || appointment?.customers || null;
  const profile = getLinkedProfile(customer);
  const name =
    appointment?.customer_name ||
    [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') ||
    'Kunde';
  const email = appointment?.customer_email || customer?.email || profile?.email || null;

  return { name, email };
}

export async function sendAdminAppointmentConfirmationEmail(
  supabase: DbClient,
  appointmentId: string,
  logPrefix = 'adminAppointmentConfirmation'
): Promise<boolean> {
  const { data: appointmentData, error: appointmentError } = await (supabase.from('appointments') as any)
    .select(`
      id,
      salon_id,
      start_time,
      end_time,
      booking_number,
      customer_name,
      customer_email,
      total_cents,
      customer:customers (
        first_name,
        last_name,
        email,
        phone,
        profiles (email, phone)
      ),
      staff:staff_id (
        display_name
      ),
      appointment_services (
        service_name,
        duration_minutes,
        price_cents
      )
    `)
    .eq('id', appointmentId)
    .single();

  if (appointmentError || !appointmentData) {
    console.error(`[${logPrefix}] Confirmation fetch error:`, appointmentError);
    return false;
  }

  const appointment = appointmentData as any;
  const recipient = getAppointmentRecipient(appointment);

  if (!recipient.email || !appointment.booking_number) {
    return false;
  }

  const { data: salonData } = await (supabase.from('salons') as any)
    .select('name, address, zip_code, city, phone')
    .eq('id', appointment.salon_id)
    .single();

  if (!salonData) {
    return false;
  }

  const salon = salonData as {
    name: string;
    address: string | null;
    zip_code: string | null;
    city: string | null;
    phone: string | null;
  };
  const services = (appointment.appointment_services || []).map((service: any) => ({
    name: service.service_name,
    durationMinutes: service.duration_minutes,
    priceCents: service.price_cents,
  }));

  try {
    const result = await sendBookingConfirmationEmail({
      customerName: recipient.name,
      customerEmail: recipient.email,
      bookingNumber: appointment.booking_number,
      appointmentId: appointment.id,
      startsAt: new Date(appointment.start_time),
      endsAt: new Date(appointment.end_time),
      staffName: (appointment.staff as any)?.display_name || 'Ihr Stylist',
      services,
      totalPriceCents: appointment.total_cents,
      salonName: salon.name,
      salonAddress: `${salon.address || ''}, ${salon.zip_code || ''} ${salon.city || ''}`.trim(),
      salonPhone: salon.phone || '+41 71 222 81 82',
    });

    if (!result.success) {
      console.error(`[${logPrefix}] Confirmation email failed:`, result.error);
      return false;
    }

    return true;
  } catch (emailError) {
    console.error(`[${logPrefix}] Confirmation email error:`, emailError);
    return false;
  }
}
