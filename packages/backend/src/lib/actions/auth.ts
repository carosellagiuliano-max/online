'use server';

import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { isMockMode, getMockUser } from '@/lib/mock/mock-auth';
import { MOCK_CUSTOMERS, MOCK_SALON } from '@/lib/mock/mock-data';

// ============================================
// AUTH SERVER ACTIONS
// ============================================

const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ============================================
// SCHEMAS
// ============================================

const registerSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen lang sein'),
  firstName: z.string().min(2, 'Vorname muss mindestens 2 Zeichen lang sein'),
  lastName: z.string().min(2, 'Nachname muss mindestens 2 Zeichen lang sein'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(1, 'Passwort ist erforderlich'),
});

// ============================================
// REGISTER CUSTOMER
// ============================================

export type RegisterResult = {
  success: boolean;
  error?: string;
  userId?: string;
};

export async function registerCustomer(formData: FormData): Promise<RegisterResult> {
  const supabase = await createServerClient() as any;

  try {
    // Validate input
    const validatedFields = registerSchema.safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      phone: formData.get('phone'),
    });

    if (!validatedFields.success) {
      const errors = validatedFields.error.flatten().fieldErrors;
      const firstError = Object.values(errors)[0]?.[0] || 'Validierungsfehler';
      return { success: false, error: firstError };
    }

    const { password, firstName, lastName, phone } = validatedFields.data;
    const email = normalizeEmail(validatedFields.data.email);
    const adminClient = createServiceRoleClient() as any;

    if (!adminClient) {
      return { success: false, error: 'Registrierung ist momentan nicht verfügbar.' };
    }

    // Check if user already exists
    const { data: existingUser } = await adminClient
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (existingUser) {
      return { success: false, error: 'Diese E-Mail-Adresse ist bereits registriert.' };
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/konto/verifiziert`,
      },
    });

    if (authError) {
      console.error('Auth error:', authError);
      if (authError.message.includes('already registered')) {
        return { success: false, error: 'Diese E-Mail-Adresse ist bereits registriert.' };
      }
      return { success: false, error: 'Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.' };
    }

    if (!authData.user) {
      return { success: false, error: 'Benutzer konnte nicht erstellt werden.' };
    }

    // Create profile (should be handled by trigger, but ensure it exists)
    const { error: profileError } = await adminClient.from('profiles').upsert({
      id: authData.user.id,
      email,
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
    });

    if (profileError) {
      console.error('Profile error:', profileError);
      // Don't fail - profile might be created by trigger
    }

    // Assign customer role
    const { error: roleError } = await adminClient.from('user_roles').upsert(
      {
        profile_id: authData.user.id,
        salon_id: DEFAULT_SALON_ID,
        role_name: 'kunde',
      },
      { onConflict: 'profile_id,salon_id,role_name' }
    );

    if (roleError) {
      console.error('Role error:', roleError);
      // Don't fail - might already exist
    }

    // Link an existing CRM contact by email, otherwise create a new customer record.
    const { data: matchingCustomers, error: customerLookupError } = await adminClient
      .from('customers')
      .select('id, profile_id')
      .eq('salon_id', DEFAULT_SALON_ID)
      .ilike('email', email)
      .limit(2);

    if (customerLookupError) {
      console.error('Customer lookup error:', customerLookupError);
      return { success: false, error: 'Kundendaten konnten nicht geprüft werden.' };
    }

    if ((matchingCustomers || []).length > 1) {
      return {
        success: false,
        error: 'Es gibt mehrere Kundendatensätze mit dieser E-Mail. Bitte kontaktieren Sie den Salon.',
      };
    }

    const existingCustomer = matchingCustomers?.[0] || null;

    if (existingCustomer) {
      if (
        existingCustomer.profile_id &&
        existingCustomer.profile_id !== authData.user.id
      ) {
        return {
          success: false,
          error: 'Diese E-Mail-Adresse ist bereits mit einem anderen Kundenkonto verknüpft.',
        };
      }

      const { error: customerUpdateError } = await adminClient
        .from('customers')
        .update({
          profile_id: authData.user.id,
          first_name: firstName,
          last_name: lastName,
          email,
          phone: phone || null,
          is_active: true,
          deleted_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingCustomer.id);

      if (customerUpdateError) {
        console.error('Customer link error:', customerUpdateError);
        return { success: false, error: 'Kundendaten konnten nicht verknüpft werden.' };
      }
    } else {
      const { error: customerError } = await adminClient.from('customers').insert({
        salon_id: DEFAULT_SALON_ID,
        profile_id: authData.user.id,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
        is_active: true,
        deleted_at: null,
      });

      if (customerError) {
        console.error('Customer creation error:', customerError);
        return { success: false, error: 'Kundendaten konnten nicht angelegt werden.' };
      }
    }

    return {
      success: true,
      userId: authData.user.id,
    };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

// ============================================
// LOGIN
// ============================================

export type LoginResult = {
  success: boolean;
  error?: string;
  redirectTo?: string;
};

export async function loginCustomer(formData: FormData): Promise<LoginResult> {
  const supabase = await createServerClient() as any;

  try {
    const validatedFields = loginSchema.safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    if (!validatedFields.success) {
      const errors = validatedFields.error.flatten().fieldErrors;
      const firstError = Object.values(errors)[0]?.[0] || 'Validierungsfehler';
      return { success: false, error: firstError };
    }

    const { email, password } = validatedFields.data;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        return { success: false, error: 'E-Mail oder Passwort ist falsch.' };
      }
      if (error.message.includes('Email not confirmed')) {
        return { success: false, error: 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.' };
      }
      return { success: false, error: 'Anmeldung fehlgeschlagen.' };
    }

    if (!data.user) {
      return { success: false, error: 'Anmeldung fehlgeschlagen.' };
    }

    // Get user roles to determine redirect
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role_name')
      .eq('profile_id', data.user.id);

    const roleNames = roles?.map((r) => r.role_name) || [];

    // Determine redirect based on role
    let redirectTo = '/konto';
    if (roleNames.includes('admin') || roleNames.includes('manager')) {
      redirectTo = '/admin';
    } else if (roleNames.includes('mitarbeiter')) {
      redirectTo = '/admin/kalender';
    }

    return {
      success: true,
      redirectTo,
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

// ============================================
// PASSWORD RESET REQUEST
// ============================================

export type PasswordResetResult = {
  success: boolean;
  error?: string;
};

export async function requestPasswordReset(formData: FormData): Promise<PasswordResetResult> {
  const supabase = await createServerClient() as any;

  try {
    const email = formData.get('email') as string;
    const redirectPath = formData.get('redirectTo') as string | null;
    const safeRedirectPath =
      redirectPath === '/admin/passwort-aendern'
        ? '/admin/passwort-aendern'
        : '/konto/passwort-aendern';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '';

    if (!email || !z.string().email().safeParse(email).success) {
      return { success: false, error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}${safeRedirectPath}`,
    });

    if (error) {
      console.error('Password reset error:', error);
      // Don't reveal if email exists or not
    }

    // Always return success to prevent email enumeration
    return { success: true };
  } catch (error) {
    console.error('Password reset error:', error);
    return { success: true }; // Still return success
  }
}

// ============================================
// UPDATE PASSWORD
// ============================================

export async function updatePassword(formData: FormData): Promise<PasswordResetResult> {
  const supabase = await createServerClient() as any;

  try {
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!password || password.length < 8) {
      return { success: false, error: 'Passwort muss mindestens 8 Zeichen lang sein.' };
    }

    if (password !== confirmPassword) {
      return { success: false, error: 'Passwörter stimmen nicht überein.' };
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      console.error('Update password error:', error);
      return { success: false, error: 'Passwort konnte nicht geändert werden.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Update password error:', error);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

// ============================================
// GET CURRENT USER
// ============================================

export async function getCurrentUser() {
  if (isMockMode()) {
    const mockUser = await getMockUser();
    if (!mockUser) return null;

    const mockCustomer = MOCK_CUSTOMERS.find((customer) => customer.profile_id === mockUser.id) || null;
    const roleName = mockUser.role === 'admin' ? 'admin' : mockUser.role === 'staff' ? 'mitarbeiter' : 'kunde';

    return {
      id: mockUser.id,
      email: mockUser.email,
      profile: {
        id: mockUser.id,
        email: mockUser.email,
        first_name: mockCustomer?.first_name || (mockUser.role === 'admin' ? 'Alex' : 'Demo'),
        last_name: mockCustomer?.last_name || (mockUser.role === 'admin' ? 'Berger' : 'User'),
        phone: mockCustomer?.phone || null,
      },
      customer: mockCustomer,
      roles: [{ role_name: roleName, salon_id: MOCK_SALON.id }],
    };
  }

  const supabase = await createServerClient() as any;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Get roles
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role_name, salon_id')
    .eq('profile_id', user.id);

  // Get customer record (has name even if profile doesn't)
  const { data: customer } = await supabase
    .from('customers')
    .select('id, first_name, last_name')
    .eq('profile_id', user.id)
    .single();

  return {
    id: user.id,
    email: user.email,
    profile,
    customer,
    roles: roles || [],
  };
}

// ============================================
// LOGOUT
// ============================================

export async function logout() {
  // Mock mode: clear the mock session cookies, no Supabase available
  if (isMockMode()) {
    const cookieStore = await cookies();
    cookieStore.delete('mock_session');
    cookieStore.delete('mock_user');
    return;
  }

  const supabase = await createServerClient() as any;
  await supabase.auth.signOut();
}
