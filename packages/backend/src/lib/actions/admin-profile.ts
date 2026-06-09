'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';

type UpdateAdminProfileInput = {
  displayName: string;
  phone: string | null;
};

function splitDisplayName(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || null;
  const lastName = parts.length > 0 ? parts.join(' ') : null;

  return { firstName, lastName };
}

export async function updateAdminProfile(input: UpdateAdminProfileInput): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const displayName = input.displayName.trim();
    const phone = input.phone?.trim() || null;

    if (displayName.length < 2) {
      return { success: false, error: 'Name ist erforderlich' };
    }

    const authClient = await createServerClient();
    const adminClient = createServiceRoleClient();

    if (!adminClient) {
      return { success: false, error: 'Service nicht verfügbar' };
    }

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Nicht autorisiert' };
    }

    const { firstName, lastName } = splitDisplayName(displayName);

    const { error: profileError } = await (adminClient.from('profiles') as any).upsert({
      id: user.id,
      email: user.email,
      first_name: firstName,
      last_name: lastName,
      phone,
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      console.error('[updateAdminProfile] Profile update error:', profileError);
      return { success: false, error: profileError.message };
    }

    const { error: staffError } = await (adminClient.from('staff') as any)
      .update({
        display_name: displayName,
        phone,
        updated_at: new Date().toISOString(),
      })
      .eq('profile_id', user.id)
      .eq('is_active', true);

    if (staffError) {
      console.error('[updateAdminProfile] Staff update error:', staffError);
      return { success: false, error: staffError.message };
    }

    revalidatePath('/admin/profil');
    revalidatePath('/admin');

    return { success: true };
  } catch (error) {
    console.error('[updateAdminProfile] Error:', error);
    return { success: false, error: 'Profil konnte nicht gespeichert werden' };
  }
}
