'use server';

import { createServerClient } from '@/lib/db/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sendCancellationEmail } from '@/lib/email';
import { requireAdminAction } from './admin-auth';
import { isMockMode } from '@/lib/mock/mock-auth';
import { MOCK_APPOINTMENTS, MOCK_CUSTOMERS, MOCK_CUSTOMER_USER } from '@/lib/mock/mock-data';
import {
  evaluateCustomerCancellation,
  getCancellationDeadlineText,
  type CancellationDisabledReason,
} from '@/lib/domain/booking/rules';

// ============================================
// CUSTOMER SERVER ACTIONS
// ============================================

const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';
const SALON_ID = process.env.NEXT_PUBLIC_SALON_ID || DEFAULT_SALON_ID;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}


function getMockCustomerAppointmentRows(): CustomerAppointment[] {
  return MOCK_APPOINTMENTS.map((appointment) => {
    const startsAt = new Date(`${appointment.date}T${appointment.start_time}:00`);
    const endsAt = new Date(`${appointment.date}T${appointment.end_time}:00`);
    const canCancel = ['reserved', 'requested', 'confirmed'].includes(appointment.status);

    return {
      id: appointment.id,
      startsAt,
      endsAt,
      status: appointment.status as CustomerAppointment['status'],
      totalPriceCents: Math.round(appointment.price * 100),
      staffName: appointment.staff ? `${appointment.staff.first_name} ${appointment.staff.last_name}` : 'BeautifyPRO Team',
      staffAvatar: undefined,
      services: [{
        name: appointment.service.name,
        durationMinutes: appointment.service.duration_minutes,
        priceCents: Math.round(appointment.service.price * 100),
      }],
      createdAt: new Date(),
      canCancel,
      cancellationDeadlineHours: 24,
      cancellationDisabledReason: canCancel ? undefined : 'status',
      cancellationDisabledMessage: canCancel ? undefined : 'Dieser Demo-Termin kann nicht storniert werden.',
    };
  });
}
function getPasswordSetupRedirectUrl(): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000';

  return `${baseUrl.replace(/\/$/, '')}/konto/passwort-aendern`;
}

function getAdminActionError(auth: Awaited<ReturnType<typeof requireAdminAction>>): string {
  return 'error' in auth ? auth.error : 'Keine Berechtigung';
}

// ============================================
// GET CUSTOMER APPOINTMENTS
// ============================================

export interface CustomerAppointment {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: 'reserved' | 'requested' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  totalPriceCents: number;
  staffName: string;
  staffAvatar?: string;
  services: {
    name: string;
    durationMinutes: number;
    priceCents: number;
  }[];
  createdAt: Date;
  canCancel: boolean;
  cancellationDeadlineHours: number;
  cancellationDisabledReason?: CancellationDisabledReason;
  cancellationDisabledMessage?: string;
}

export async function getCustomerAppointments(
  profileId: string
): Promise<CustomerAppointment[]> {
  if (isMockMode() && profileId === MOCK_CUSTOMER_USER.id) {
    return getMockCustomerAppointmentRows();
  }

  const supabase = createServerClient() as any;

  if (!supabase) {
    console.error('Error: Supabase client not available');
    return [];
  }

  // First, get the user's email from their profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', profileId)
    .single();

  if (!profile?.email) {
    console.error('Error fetching profile for appointments');
    return [];
  }

  // Get booking rules to check if customer cancellation is allowed
  const { data: bookingRules } = await supabase
    .from('booking_rules')
    .select('allow_customer_cancellation, cancellation_deadline_hours')
    .eq('salon_id', SALON_ID)
    .single();

  const allowCustomerCancellation = bookingRules?.allow_customer_cancellation ?? true;
  const cancellationDeadlineHours = bookingRules?.cancellation_deadline_hours ?? 24;

  // Query appointments by customer_email (which is stored when booking)
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id,
      start_time,
      end_time,
      status,
      total_cents,
      created_at,
      customer_id,
      staff:staff_id (display_name, avatar_url),
      appointment_services (
        service_name,
        duration_minutes,
        price_cents
      )
    `)
    .eq('salon_id', SALON_ID)
    .eq('customer_email', profile.email)
    .order('start_time', { ascending: false });

  if (error) {
    console.error('Error fetching appointments:', error);
    return [];
  }

  const now = new Date();

  return (data || []).map((a) => {
    const startsAt = new Date(a.start_time);
    const cancellation = evaluateCustomerCancellation({
      allowCustomerCancellation,
      cancellationDeadlineHours,
      startsAt,
      now,
      status: a.status,
    });

    return {
      id: a.id,
      startsAt,
      endsAt: new Date(a.end_time),
      status: a.status,
      totalPriceCents: a.total_cents,
      staffName: (a.staff as any)?.display_name || 'Unbekannt',
      staffAvatar: (a.staff as any)?.avatar_url || undefined,
      services: (a.appointment_services || []).map((s: any) => ({
        name: s.service_name,
        durationMinutes: s.duration_minutes,
        priceCents: s.price_cents,
      })),
      createdAt: new Date(a.created_at),
      canCancel: cancellation.canCancel,
      cancellationDeadlineHours,
      cancellationDisabledReason: cancellation.disabledReason,
      cancellationDisabledMessage: cancellation.disabledReason === 'not_allowed'
        ? 'Online-Stornierung ist nicht möglich. Bitte kontaktieren Sie uns telefonisch.'
        : getCancellationDeadlineText(cancellationDeadlineHours),
    };
  });
}

// ============================================
// GET UPCOMING APPOINTMENTS
// ============================================

export async function getUpcomingAppointments(
  profileId: string
): Promise<CustomerAppointment[]> {
  if (isMockMode() && profileId === MOCK_CUSTOMER_USER.id) {
    const now = new Date();
    return getMockCustomerAppointmentRows().filter((appointment) => appointment.startsAt > now);
  }

  const supabase = createServerClient() as any;

  if (!supabase) {
    console.error('Error: Supabase client not available');
    return [];
  }

  const now = new Date().toISOString();

  // First, get the user's email from their profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', profileId)
    .single();

  if (!profile?.email) {
    console.error('Error fetching profile for upcoming appointments');
    return [];
  }

  // Get booking rules to check if customer cancellation is allowed
  const { data: bookingRules } = await supabase
    .from('booking_rules')
    .select('allow_customer_cancellation, cancellation_deadline_hours')
    .eq('salon_id', SALON_ID)
    .single();

  const allowCustomerCancellation = bookingRules?.allow_customer_cancellation ?? true;
  const cancellationDeadlineHours = bookingRules?.cancellation_deadline_hours ?? 24;

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id,
      start_time,
      end_time,
      status,
      total_cents,
      created_at,
      customer_id,
      staff:staff_id (display_name, avatar_url),
      appointment_services (
        service_name,
        duration_minutes,
        price_cents
      )
    `)
    .eq('salon_id', SALON_ID)
    .eq('customer_email', profile.email)
    .gte('start_time', now)
    .in('status', ['reserved', 'requested', 'confirmed'])
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching upcoming appointments:', error);
    return [];
  }

  return (data || []).map((a) => {
    const startsAt = new Date(a.start_time);
    const cancellation = evaluateCustomerCancellation({
      allowCustomerCancellation,
      cancellationDeadlineHours,
      startsAt,
      status: a.status,
    });

    return {
      id: a.id,
      startsAt,
      endsAt: new Date(a.end_time),
      status: a.status,
      totalPriceCents: a.total_cents,
      staffName: (a.staff as any)?.display_name || 'Unbekannt',
      staffAvatar: (a.staff as any)?.avatar_url || undefined,
      services: (a.appointment_services || []).map((s: any) => ({
        name: s.service_name,
        durationMinutes: s.duration_minutes,
        priceCents: s.price_cents,
      })),
      createdAt: new Date(a.created_at),
      canCancel: cancellation.canCancel,
      cancellationDeadlineHours,
      cancellationDisabledReason: cancellation.disabledReason,
      cancellationDisabledMessage: cancellation.disabledReason === 'not_allowed'
        ? 'Online-Stornierung ist nicht möglich. Bitte kontaktieren Sie uns telefonisch.'
        : getCancellationDeadlineText(cancellationDeadlineHours),
    };
  });
}

// ============================================
// CANCEL APPOINTMENT
// ============================================

export type CancelResult = {
  success: boolean;
  error?: string;
};

export async function cancelAppointment(
  appointmentId: string,
  profileId: string
): Promise<CancelResult> {
  if (isMockMode() && profileId === MOCK_CUSTOMER_USER.id) {
    return { success: true };
  }

  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar.' };
  }

  try {
    // First, get the user's email from their profile for ownership verification
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', profileId)
      .single();

    if (!profile?.email) {
      return { success: false, error: 'Profil nicht gefunden.' };
    }

    // Get appointment with full details for email
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        id,
        start_time,
        status,
        customer_id,
        customer_name,
        customer_email,
        booking_number,
        salon_id,
        staff:staff_id (display_name),
        appointment_services (service_name)
      `)
      .eq('id', appointmentId)
      .eq('salon_id', SALON_ID)
      .single();

    if (fetchError || !appointment) {
      return { success: false, error: 'Termin nicht gefunden.' };
    }

    const { data: bookingRules } = await supabase
      .from('booking_rules')
      .select('allow_customer_cancellation, cancellation_deadline_hours')
      .eq('salon_id', appointment.salon_id)
      .single();

    const allowCustomerCancellation = bookingRules?.allow_customer_cancellation ?? true;
    const cancellationDeadlineHours = bookingRules?.cancellation_deadline_hours ?? 24;

    if (!allowCustomerCancellation) {
      return {
        success: false,
        error: 'Online-Stornierung ist nicht möglich. Bitte kontaktieren Sie uns telefonisch.',
      };
    }

    // Verify ownership by email
    if (appointment.customer_email !== profile.email) {
      return { success: false, error: 'Keine Berechtigung.' };
    }

    // Check status
    if (!['reserved', 'requested', 'confirmed'].includes(appointment.status)) {
      return { success: false, error: 'Termin kann nicht mehr storniert werden.' };
    }

    // Check cancellation deadline
    const startsAt = new Date(appointment.start_time);
    const cancellation = evaluateCustomerCancellation({
      allowCustomerCancellation,
      cancellationDeadlineHours,
      startsAt,
      status: appointment.status,
    });

    if (!cancellation.canCancel) {
      return {
        success: false,
        error: cancellation.disabledReason === 'not_allowed'
          ? 'Online-Stornierung ist nicht möglich. Bitte kontaktieren Sie uns telefonisch.'
          : getCancellationDeadlineText(cancellationDeadlineHours),
      };
    }

    // Cancel appointment
    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: 'Kunde hat storniert',
      })
      .eq('id', appointmentId);

    if (updateError) {
      console.error('Error cancelling appointment:', updateError);
      return { success: false, error: 'Fehler beim Stornieren.' };
    }

    // Create admin notification for customer cancellation
    const serviceNames = (appointment.appointment_services || [])
      .map((s: any) => s.service_name)
      .join(', ');

    await supabase.from('admin_notifications').insert({
      salon_id: appointment.salon_id,
      type: 'appointment_cancelled',
      title: 'Termin storniert',
      message: `${appointment.customer_name || 'Kunde'} hat den Termin${serviceNames ? ` (${serviceNames})` : ''} am ${startsAt.toLocaleDateString('de-CH')} um ${startsAt.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })} Uhr storniert`,
      reference_type: 'appointment',
      reference_id: appointmentId,
      link: '/admin/kalender',
    }).catch((err) => {
      console.error('[customer] Failed to create admin notification:', err);
    });

    // Send cancellation email
    if (appointment.customer_email) {
      const { data: salon } = await supabase
        .from('salons')
        .select('name, address, zip_code, city, phone')
        .eq('id', appointment.salon_id)
        .single();

      if (salon) {
        await sendCancellationEmail({
          customerName: appointment.customer_name || 'Kunde',
          customerEmail: appointment.customer_email,
          bookingNumber: appointment.booking_number || appointmentId.slice(0, 8).toUpperCase(),
          startsAt,
          staffName: (appointment.staff as any)?.display_name || 'Ihr Stylist',
          services: (appointment.appointment_services || []).map((s: any) => ({
            name: s.service_name,
          })),
          salonName: salon.name,
          salonAddress: `${salon.address}, ${salon.zip_code} ${salon.city}`,
          salonPhone: salon.phone || '+41 71 222 81 82',
          cancelledBy: 'customer',
          reason: 'Stornierung durch Kunde',
        }).catch((err) => {
          console.error('Failed to send cancellation email:', err);
        });
      }
    }

    revalidatePath('/konto/termine');
    return { success: true };
  } catch (error) {
    console.error('Cancel error:', error);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

// ============================================
// GET CUSTOMER PROFILE
// ============================================

export interface CustomerProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  createdAt: Date;
}

export async function getCustomerProfile(
  userId: string
): Promise<CustomerProfile | null> {
  if (isMockMode() && userId === MOCK_CUSTOMER_USER.id) {
    const customer = MOCK_CUSTOMERS.find((entry) => entry.profile_id === MOCK_CUSTOMER_USER.id);
    if (!customer) return null;
    return {
      id: MOCK_CUSTOMER_USER.id,
      email: MOCK_CUSTOMER_USER.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
      phone: customer.phone,
      createdAt: new Date(customer.created_at),
    };
  }

  const supabase = createServerClient() as any;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    firstName: data.first_name || '',
    lastName: data.last_name || '',
    phone: data.phone || undefined,
    avatarUrl: data.avatar_url || undefined,
    createdAt: new Date(data.created_at),
  };
}

// ============================================
// UPDATE CUSTOMER PROFILE
// ============================================

const updateProfileSchema = z.object({
  firstName: z.string().min(2, 'Vorname muss mindestens 2 Zeichen lang sein'),
  lastName: z.string().min(2, 'Nachname muss mindestens 2 Zeichen lang sein'),
  phone: z.string().optional(),
});

export type UpdateProfileResult = {
  success: boolean;
  error?: string;
};

export async function updateCustomerProfile(
  userId: string,
  formData: FormData
): Promise<UpdateProfileResult> {
  if (isMockMode() && userId === MOCK_CUSTOMER_USER.id) {
    return { success: true };
  }

  const supabase = createServerClient() as any;

  try {
    const validatedFields = updateProfileSchema.safeParse({
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      phone: formData.get('phone'),
    });

    if (!validatedFields.success) {
      const errors = validatedFields.error.flatten().fieldErrors;
      const firstError = Object.values(errors)[0]?.[0] || 'Validierungsfehler';
      return { success: false, error: firstError };
    }

    const { firstName, lastName, phone } = validatedFields.data;

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating profile:', error);
      return { success: false, error: 'Profil konnte nicht aktualisiert werden.' };
    }

    revalidatePath('/konto/profil');
    return { success: true };
  } catch (error) {
    console.error('Update profile error:', error);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

// ============================================
// ADMIN: CREATE CUSTOMER
// ============================================

export interface AdminCreateCustomerInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  salonId?: string;
  createAccount?: boolean;
}

export type AdminCreateCustomerResult = {
  success: boolean;
  customerId?: string;
  accountStatus?: 'contact' | 'invited' | 'linked';
  error?: string;
};

export async function adminCreateCustomer(
  input: AdminCreateCustomerInput
): Promise<AdminCreateCustomerResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  if (!input.email) {
    return { success: false, error: 'E-Mail ist erforderlich' };
  }

  try {
    const salonId = input.salonId || DEFAULT_SALON_ID;
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const email = normalizeEmail(input.email);
    const phone = input.phone?.trim() || null;
    const createAccount = input.createAccount ?? true;

    if (!firstName || !lastName) {
      return { success: false, error: 'Vorname und Nachname sind erforderlich' };
    }

    const auth = await requireAdminAction(supabase, { salonId });
    if (!auth.success) {
      return { success: false, error: getAdminActionError(auth) };
    }

    let profileId: string | null = null;
    let accountStatus: AdminCreateCustomerResult['accountStatus'] = createAccount
      ? 'invited'
      : 'contact';

    if (createAccount) {
      const { data: existingProfile, error: profileLookupError } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', email)
        .maybeSingle();

      if (profileLookupError) {
        console.error('[adminCreateCustomer] Profile lookup error:', profileLookupError);
        return { success: false, error: 'Konto konnte nicht geprüft werden' };
      }

      if (existingProfile?.id) {
        profileId = existingProfile.id;
        accountStatus = 'linked';
      } else {
        const { data: inviteData, error: inviteError } =
          await supabase.auth.admin.inviteUserByEmail(email, {
            data: {
              first_name: firstName,
              last_name: lastName,
            },
            redirectTo: getPasswordSetupRedirectUrl(),
          });

        if (inviteError || !inviteData.user?.id) {
          console.error('[adminCreateCustomer] Invite error:', inviteError);
          return {
            success: false,
            error: 'Konto-Einladung konnte nicht gesendet werden',
          };
        }

        profileId = inviteData.user.id;

        const { error: profileError } = await supabase.from('profiles').upsert({
          id: profileId,
          email,
          first_name: firstName,
          last_name: lastName,
          phone,
        });

        if (profileError) {
          console.error('[adminCreateCustomer] Profile upsert error:', profileError);
          return { success: false, error: 'Profil konnte nicht angelegt werden' };
        }
      }

      const { error: roleError } = await supabase.from('user_roles').upsert(
        {
          profile_id: profileId,
          salon_id: salonId,
          role_name: 'kunde',
        },
        { onConflict: 'profile_id,salon_id,role_name' }
      );

      if (roleError) {
        console.error('[adminCreateCustomer] Role upsert error:', roleError);
        return { success: false, error: 'Kundenrolle konnte nicht gesetzt werden' };
      }
    }

    const { data: matchingCustomers, error: customerLookupError } = await supabase
      .from('customers')
      .select('id, profile_id')
      .eq('salon_id', salonId)
      .ilike('email', email)
      .limit(2);

    if (customerLookupError) {
      console.error('[adminCreateCustomer] Customer lookup error:', customerLookupError);
      return { success: false, error: 'Kunde konnte nicht geprüft werden' };
    }

    if ((matchingCustomers || []).length > 1) {
      return {
        success: false,
        error: 'Es gibt mehrere Kundendatensätze mit dieser E-Mail. Bitte zuerst bereinigen.',
      };
    }

    const existingCustomer = matchingCustomers?.[0] || null;

    if (existingCustomer) {
      if (
        profileId &&
        existingCustomer.profile_id &&
        existingCustomer.profile_id !== profileId
      ) {
        return {
          success: false,
          error: 'Diese E-Mail ist bereits mit einem anderen Kundenkonto verknüpft',
        };
      }

      const updateData: Record<string, unknown> = {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        is_active: true,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      };

      if (profileId) {
        updateData.profile_id = profileId;
      }

      const { error: updateError } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', existingCustomer.id);

      if (updateError) {
        console.error('[adminCreateCustomer] Customer update error:', updateError);
        return { success: false, error: updateError.message };
      }

      revalidatePath('/admin/kunden');
      return { success: true, customerId: existingCustomer.id, accountStatus };
    }

    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
        salon_id: salonId,
        profile_id: profileId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        is_active: true,
        deleted_at: null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[adminCreateCustomer] Error:', error);
      if (error.code === '23505' || error.message?.includes('unique_customer_email_per_salon')) {
        return { success: false, error: 'Ein Kunde mit dieser E-Mail existiert bereits' };
      }
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/kunden');
    return { success: true, customerId: customer.id, accountStatus };
  } catch (err) {
    console.error('[adminCreateCustomer] Exception:', err);
    return { success: false, error: 'Unbekannter Fehler' };
  }
}

// ============================================
// ADMIN: ARCHIVE CUSTOMER
// ============================================

export type AdminDeleteCustomerResult = {
  success: boolean;
  error?: string;
};

export async function adminDeleteCustomer(
  customerId: string
): Promise<AdminDeleteCustomerResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('salon_id')
      .eq('id', customerId)
      .single();

    if (fetchError || !customer) {
      return { success: false, error: 'Kunde nicht gefunden' };
    }

    const auth = await requireAdminAction(supabase, {
      salonId: customer.salon_id,
      allowedRoles: ['admin', 'manager', 'hq'],
    });

    if (!auth.success) {
      return { success: false, error: getAdminActionError(auth) };
    }

    const { error } = await supabase
      .from('customers')
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId);

    if (error) {
      console.error('[adminDeleteCustomer] Error:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/kunden');
    return { success: true };
  } catch (err) {
    console.error('[adminDeleteCustomer] Exception:', err);
    return { success: false, error: 'Unbekannter Fehler' };
  }
}

// ============================================
// ADMIN: UPDATE CUSTOMER
// ============================================

export interface AdminUpdateCustomerInput {
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  notes?: string;
}

export type AdminUpdateCustomerResult = {
  success: boolean;
  error?: string;
};

export async function adminUpdateCustomer(
  input: AdminUpdateCustomerInput
): Promise<AdminUpdateCustomerResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('salon_id')
      .eq('id', input.customerId)
      .single();

    if (fetchError || !customer) {
      return { success: false, error: 'Kunde nicht gefunden' };
    }

    const auth = await requireAdminAction(supabase, {
      salonId: customer.salon_id,
      allowedRoles: ['admin', 'manager', 'hq'],
    });

    if (!auth.success) {
      return { success: false, error: getAdminActionError(auth) };
    }

    const { error } = await supabase
      .from('customers')
      .update({
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
        phone: input.phone || null,
        notes: input.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.customerId);

    if (error) {
      console.error('[adminUpdateCustomer] Error:', error);
      if (error.code === '23505' || error.message?.includes('unique_customer_email_per_salon')) {
        return { success: false, error: 'Ein Kunde mit dieser E-Mail existiert bereits' };
      }
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/kunden');
    revalidatePath(`/admin/kunden/${input.customerId}`);
    return { success: true };
  } catch (err) {
    console.error('[adminUpdateCustomer] Exception:', err);
    return { success: false, error: 'Unbekannter Fehler' };
  }
}

// ============================================
// CUSTOMER: DELETE OWN ACCOUNT (Archives for admin)
// ============================================

export type DeleteAccountResult = {
  success: boolean;
  error?: string;
};

export async function deleteCustomerAccount(
  profileId: string
): Promise<DeleteAccountResult> {
  const supabase = createServerClient() as any;

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    // Get profile email for customer lookup
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', profileId)
      .single();

    if (!profile?.email) {
      return { success: false, error: 'Profil nicht gefunden.' };
    }

    // Archive the customer record (set is_active to false)
    // This preserves the data for admin viewing but marks it as archived
    const { error: customerError } = await supabase
      .from('customers')
      .update({
        is_active: false,
        notes: `[ARCHIVED] Konto vom Kunden selbst gelöscht am ${new Date().toLocaleDateString('de-CH')}`,
        updated_at: new Date().toISOString(),
      })
      .eq('email', profile.email);

    if (customerError) {
      console.error('[deleteCustomerAccount] Customer archive error:', customerError);
      // Don't fail - customer record might not exist
    }

    // Mark profile as deleted (soft delete)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        // Anonymize personal data
        first_name: '[Gelöscht]',
        last_name: '',
        phone: null,
        avatar_url: null,
      })
      .eq('id', profileId);

    if (profileError) {
      console.error('[deleteCustomerAccount] Profile update error:', profileError);
      return { success: false, error: 'Profil konnte nicht gelöscht werden.' };
    }

    // Deactivate user roles
    const { error: roleError } = await supabase
      .from('user_roles')
      .update({ is_active: false })
      .eq('profile_id', profileId);

    if (roleError) {
      console.error('[deleteCustomerAccount] Role update error:', roleError);
      // Don't fail - roles might not exist
    }

    // Sign out the user by invalidating their session
    // Note: The actual sign out will happen client-side after redirect

    revalidatePath('/admin/kunden');
    return { success: true };
  } catch (err) {
    console.error('[deleteCustomerAccount] Exception:', err);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}
