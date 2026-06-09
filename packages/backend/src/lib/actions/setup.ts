'use server';

import { createServiceRoleClient } from '@/lib/supabase/server';
import { SALON_ID, ADMIN_STAFF_ID } from '@/lib/setup/check-setup';
import {
  adminSchema,
  salonSchema,
  openingHoursSchema,
  servicesStepSchema,
  generateSlug,
  type AdminInput,
  type SalonInput,
  type OpeningHoursInput,
  type ServicesStepInput,
} from '@/lib/setup/schemas';

// ============================================
// TYPES
// ============================================

interface ActionResult {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

// ============================================
// RESET SETUP (delete existing data)
// ============================================

export async function resetSetup(): Promise<ActionResult> {
  const supabase = createServiceRoleClient() as any;

  if (!supabase) {
    return { success: false, error: 'Datenbankverbindung nicht verfügbar' };
  }

  // Security check: only allow reset if wizard is enabled AND setup is not complete
  const wizardEnabled = process.env.ENABLE_WIZARD === 'true';
  if (!wizardEnabled) {
    return { success: false, error: 'Setup-Wizard ist deaktiviert' };
  }

  // Check if setup was already completed
  const { data: setupSetting } = await supabase
    .from('settings')
    .select('value')
    .eq('salon_id', SALON_ID)
    .eq('key', 'admin_setup_completed')
    .single();

  if (setupSetting?.value === true || setupSetting?.value === 'true') {
    return { success: false, error: 'Setup wurde bereits abgeschlossen. Reset nicht erlaubt.' };
  }

  try {
    // Delete in reverse dependency order
    await supabase.from('staff_service_skills').delete().eq('staff_id', ADMIN_STAFF_ID);
    await supabase.from('services').delete().eq('salon_id', SALON_ID);
    await supabase.from('service_categories').delete().eq('salon_id', SALON_ID);
    await supabase.from('opening_hours').delete().eq('salon_id', SALON_ID);
    await supabase.from('user_roles').delete().eq('salon_id', SALON_ID);
    await supabase.from('staff').delete().eq('salon_id', SALON_ID);
    await supabase.from('settings').delete().eq('salon_id', SALON_ID);
    await supabase.from('salons').delete().eq('id', SALON_ID);

    // Delete all auth users (except service accounts)
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    if (existingUsers?.users) {
      for (const user of existingUsers.users) {
        // Delete profile first
        await supabase.from('profiles').delete().eq('id', user.id);
        // Then delete auth user
        await supabase.auth.admin.deleteUser(user.id);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('[resetSetup] Error:', error);
    return { success: false, error: 'Fehler beim Zurücksetzen des Setups' };
  }
}

// ============================================
// STEP 1: CREATE ADMIN USER
// ============================================

export async function createAdminUser(input: AdminInput): Promise<ActionResult> {
  // Validate input
  const parsed = adminSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { email, password, firstName, lastName } = parsed.data;

  const supabase = createServiceRoleClient() as any;
  if (!supabase) {
    return { success: false, error: 'Datenbankverbindung nicht verfügbar' };
  }

  try {
    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    if (existingUser) {
      // User exists - update their metadata and return success to allow continuing setup
      await supabase.auth.admin.updateUserById(existingUser.id, {
        password,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
        },
      });

      // Update profile
      await supabase.from('profiles').upsert({
        id: existingUser.id,
        email,
        first_name: firstName,
        last_name: lastName,
      });

      return { success: true, data: { userId: existingUser.id } };
    }

    // Create auth user using admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (authError) {
      console.error('[createAdminUser] Auth error:', authError);
      return { success: false, error: authError.message };
    }

    const userId = authData.user.id;

    // Create profile
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      email,
      first_name: firstName,
      last_name: lastName,
    });

    if (profileError) {
      console.error('[createAdminUser] Profile error:', profileError);
      // Don't fail - profile might be auto-created by trigger
    }

    return { success: true, data: { userId } };
  } catch (error) {
    console.error('[createAdminUser] Unexpected error:', error);
    return { success: false, error: 'Unerwarteter Fehler beim Erstellen des Administrators' };
  }
}

// ============================================
// STEP 2: CREATE SALON
// ============================================

export async function createSalon(input: SalonInput): Promise<ActionResult> {
  // Validate input
  const parsed = salonSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const salon = parsed.data;
  // Auto-generate slug from name
  const slug = generateSlug(salon.name);
  const supabase = createServiceRoleClient() as any;

  if (!supabase) {
    return { success: false, error: 'Datenbankverbindung nicht verfügbar' };
  }

  try {
    // Check if salon already exists
    const { data: existingSalon } = await supabase
      .from('salons')
      .select('id')
      .eq('id', SALON_ID)
      .single();

    if (existingSalon) {
      // Update existing salon
      const { error: updateError } = await supabase
        .from('salons')
        .update({
          name: salon.name,
          company_name: salon.companyName || null,
          slug,
          address: salon.address,
          zip_code: salon.zipCode,
          city: salon.city,
          country: salon.country,
          phone: salon.phone,
          email: salon.email,
          timezone: salon.timezone,
          currency: salon.currency,
          default_vat_rate: salon.vatRate,
          is_active: true,
          locale: 'de-CH',
        })
        .eq('id', SALON_ID);

      if (updateError) {
        console.error('[createSalon] Update error:', updateError);
        return { success: false, error: updateError.message };
      }
    } else {
      // Insert new salon
      const { error: insertError } = await supabase.from('salons').insert({
        id: SALON_ID,
        name: salon.name,
        company_name: salon.companyName || null,
        slug,
        address: salon.address,
        zip_code: salon.zipCode,
        city: salon.city,
        country: salon.country,
        phone: salon.phone,
        email: salon.email,
        timezone: salon.timezone,
        currency: salon.currency,
        default_vat_rate: salon.vatRate,
        is_active: true,
        locale: 'de-CH',
      });

      if (insertError) {
        console.error('[createSalon] Insert error:', insertError);
        return { success: false, error: insertError.message };
      }
    }

    return { success: true, data: { salonId: SALON_ID } };
  } catch (error) {
    console.error('[createSalon] Unexpected error:', error);
    return { success: false, error: 'Unerwarteter Fehler beim Erstellen des Salons' };
  }
}

// ============================================
// STEP 3: CREATE OPENING HOURS
// ============================================

export async function createOpeningHours(input: OpeningHoursInput): Promise<ActionResult> {
  // Validate input
  const parsed = openingHoursSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const hours = parsed.data;
  const supabase = createServiceRoleClient() as any;

  if (!supabase) {
    return { success: false, error: 'Datenbankverbindung nicht verfügbar' };
  }

  try {
    // Delete existing opening hours for this salon
    await supabase
      .from('opening_hours')
      .delete()
      .eq('salon_id', SALON_ID);

    // Insert new opening hours
    const openingHoursData = hours.map((hour) => ({
      salon_id: SALON_ID,
      day_of_week: hour.dayOfWeek,
      is_open: hour.isOpen,
      open_time: hour.isOpen ? hour.openTime : null,
      close_time: hour.isOpen ? hour.closeTime : null,
      has_lunch_break: hour.hasLunchBreak,
      lunch_start: hour.hasLunchBreak ? hour.lunchStart : null,
      lunch_end: hour.hasLunchBreak ? hour.lunchEnd : null,
    }));

    const { error: insertError } = await supabase
      .from('opening_hours')
      .insert(openingHoursData);

    if (insertError) {
      console.error('[createOpeningHours] Insert error:', insertError);
      return { success: false, error: insertError.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[createOpeningHours] Unexpected error:', error);
    return { success: false, error: 'Unerwarteter Fehler beim Speichern der Öffnungszeiten' };
  }
}

// ============================================
// STEP 4: CREATE SERVICES AND CATEGORIES
// ============================================

export async function createServicesAndCategories(
  input: ServicesStepInput,
  adminUserId: string,
  adminName: { firstName: string; lastName: string }
): Promise<ActionResult> {
  // Validate input
  const parsed = servicesStepSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { categories } = parsed.data;
  const supabase = createServiceRoleClient() as any;

  if (!supabase) {
    return { success: false, error: 'Datenbankverbindung nicht verfügbar' };
  }

  try {
    // Create staff record for admin first (if not exists)
    const { error: staffError } = await supabase.from('staff').upsert({
      id: ADMIN_STAFF_ID,
      salon_id: SALON_ID,
      profile_id: adminUserId,
      display_name: `${adminName.firstName} ${adminName.lastName}`,
      job_title: 'Inhaber/in',
      role: 'admin',
      is_bookable: true,
      is_active: true,
      sort_order: 1,
    });

    if (staffError) {
      console.error('[createServicesAndCategories] Staff error:', staffError);
    }

    // Create admin role in user_roles
    await supabase.from('user_roles').upsert({
      profile_id: adminUserId,
      salon_id: SALON_ID,
      role_name: 'admin',
    }, {
      onConflict: 'profile_id,salon_id,role_name',
    });

    const createdServiceIds: string[] = [];

    // Create categories and services
    for (let catIndex = 0; catIndex < categories.length; catIndex++) {
      const category = categories[catIndex];
      const categoryId = crypto.randomUUID();

      // Create category
      const { error: catError } = await supabase.from('service_categories').insert({
        id: categoryId,
        salon_id: SALON_ID,
        name: category.name,
        slug: category.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        sort_order: catIndex + 1,
      });

      if (catError) {
        console.error('[createServicesAndCategories] Category error:', catError);
        return { success: false, error: `Fehler beim Erstellen der Kategorie "${category.name}"` };
      }

      // Create services for this category
      for (let svcIndex = 0; svcIndex < category.services.length; svcIndex++) {
        const service = category.services[svcIndex];
        const serviceId = crypto.randomUUID();

        const { error: svcError } = await supabase.from('services').insert({
          id: serviceId,
          salon_id: SALON_ID,
          category_id: categoryId,
          name: service.name,
          slug: service.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          description: service.description || null,
          duration_minutes: service.durationMinutes,
          price_cents: service.priceCents,
          is_bookable_online: true,
          sort_order: svcIndex + 1,
        });

        if (svcError) {
          console.error('[createServicesAndCategories] Service error:', svcError);
          return { success: false, error: `Fehler beim Erstellen des Services "${service.name}"` };
        }

        createdServiceIds.push(serviceId);
      }
    }

    // Create staff service skills (admin can perform all services)
    const staffSkills = createdServiceIds.map((serviceId) => ({
      staff_id: ADMIN_STAFF_ID,
      service_id: serviceId,
    }));

    if (staffSkills.length > 0) {
      const { error: skillsError } = await supabase
        .from('staff_service_skills')
        .insert(staffSkills);

      if (skillsError) {
        console.error('[createServicesAndCategories] Skills error:', skillsError);
        // Don't fail - skills can be added later
      }
    }

    return { success: true, data: { serviceCount: createdServiceIds.length } };
  } catch (error) {
    console.error('[createServicesAndCategories] Unexpected error:', error);
    return { success: false, error: 'Unerwarteter Fehler beim Erstellen der Services' };
  }
}

// ============================================
// MARK SETUP COMPLETE
// ============================================

export async function markSetupComplete(): Promise<ActionResult> {
  const supabase = createServiceRoleClient() as any;

  if (!supabase) {
    return { success: false, error: 'Datenbankverbindung nicht verfügbar' };
  }

  try {
    // Insert setup completed marker
    const { error: markerError } = await supabase.from('settings').upsert({
      salon_id: SALON_ID,
      key: 'admin_setup_completed',
      value: true,
      category: 'system',
      description: 'Marker indicating initial setup wizard completed',
      is_public: false,
    }, {
      onConflict: 'salon_id,key',
    });

    if (markerError) {
      console.error('[markSetupComplete] Marker error:', markerError);
      return { success: false, error: markerError.message };
    }

    // Create default settings
    const defaultSettings = [
      { key: 'booking_lead_time_hours', value: 1, category: 'booking', description: 'Minimum hours before appointment can be booked' },
      { key: 'booking_horizon_days', value: 90, category: 'booking', description: 'How many days in advance appointments can be booked' },
      { key: 'cancellation_cutoff_hours', value: 24, category: 'booking', description: 'Hours before appointment that cancellation is allowed' },
      { key: 'reservation_timeout_minutes', value: 15, category: 'booking', description: 'Minutes before a reservation expires' },
    ];

    for (const setting of defaultSettings) {
      await supabase.from('settings').upsert({
        salon_id: SALON_ID,
        key: setting.key,
        value: setting.value,
        category: setting.category,
        description: setting.description,
        is_public: false,
      }, {
        onConflict: 'salon_id,key',
      });
    }

    return { success: true };
  } catch (error) {
    console.error('[markSetupComplete] Unexpected error:', error);
    return { success: false, error: 'Unerwarteter Fehler beim Abschliessen des Setups' };
  }
}
