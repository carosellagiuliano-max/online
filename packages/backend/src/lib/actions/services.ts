'use server';

import { createServerClient } from '@/lib/db/client';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { requireAdminAction } from './admin-auth';

// ============================================
// SERVICE MANAGEMENT SERVER ACTIONS
// ============================================

// Default salon ID for BeautifyPRO (from seed data)
const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';
const SERVICE_ADMIN_ROLES = ['admin', 'manager', 'hq'];

type DbClient = NonNullable<ReturnType<typeof createServerClient>>;

// ============================================
// TYPES
// ============================================

export type ServiceCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
};

export type ServiceForAdmin = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  durationMinutes: number;
  priceCents: number;
  priceFrom: boolean;
  hasLengthVariants: boolean;
  isBookableOnline: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type CreateServiceInput = {
  name: string;
  description?: string;
  categoryId?: string;
  durationMinutes: number;
  priceCents: number;
  priceFrom?: boolean;
  isBookableOnline?: boolean;
};

export type UpdateServiceInput = {
  id: string;
  name?: string;
  description?: string;
  categoryId?: string | null;
  durationMinutes?: number;
  priceCents?: number;
  priceFrom?: boolean;
  isBookableOnline?: boolean;
  isActive?: boolean;
  sortOrder?: number;
};

export type ServiceResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
};

type ServiceRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  duration_minutes: number;
  price_cents: number;
  price_from: boolean | null;
  has_length_variants: boolean | null;
  is_bookable_online: boolean | null;
  is_active: boolean;
  sort_order: number | null;
  service_categories?: { name: string | null } | { name: string | null }[] | null;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number | null;
};

type VariantRow = {
  id: string;
  service_id: string;
  name: string;
  description: string | null;
  duration_minutes: number | null;
  price_cents: number;
  sort_order: number | null;
};

const optionalTrimmedText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.string().max(max).optional()
  );

const nullableTrimmedText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.string().max(max).nullable().optional()
  );

const createServiceSchema = z.object({
  name: z.string().trim().min(2, 'Name muss mindestens 2 Zeichen haben').max(120, 'Name ist zu lang'),
  description: optionalTrimmedText(700),
  categoryId: z.string().uuid('Ungültige Kategorie').optional().nullable(),
  durationMinutes: z.number().int().min(5, 'Dauer muss mindestens 5 Minuten sein').max(480, 'Dauer darf maximal 8 Stunden sein'),
  priceCents: z.number().int().min(0, 'Preis darf nicht negativ sein').max(500000, 'Preis ist zu hoch'),
  priceFrom: z.boolean().optional(),
  isBookableOnline: z.boolean().optional(),
});

const updateServiceSchema = z.object({
  id: z.string().uuid('Ungültige Leistung'),
  name: z.string().trim().min(2, 'Name muss mindestens 2 Zeichen haben').max(120, 'Name ist zu lang').optional(),
  description: nullableTrimmedText(700),
  categoryId: z.string().uuid('Ungültige Kategorie').nullable().optional(),
  durationMinutes: z.number().int().min(5, 'Dauer muss mindestens 5 Minuten sein').max(480, 'Dauer darf maximal 8 Stunden sein').optional(),
  priceCents: z.number().int().min(0, 'Preis darf nicht negativ sein').max(500000, 'Preis ist zu hoch').optional(),
  priceFrom: z.boolean().optional(),
  isBookableOnline: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

const categoryCreateSchema = z.object({
  name: z.string().trim().min(2, 'Name muss mindestens 2 Zeichen haben').max(100, 'Name ist zu lang'),
  description: optionalTrimmedText(500),
});

const categoryUpdateSchema = z.object({
  name: z.string().trim().min(2, 'Name muss mindestens 2 Zeichen haben').max(100, 'Name ist zu lang').optional(),
  description: nullableTrimmedText(500),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

const createVariantSchema = z.object({
  serviceId: z.string().uuid('Ungültige Leistung'),
  name: z.string().trim().min(2, 'Name muss mindestens 2 Zeichen haben').max(100, 'Name ist zu lang'),
  description: optionalTrimmedText(500),
  durationMinutes: z.number().int().min(5, 'Dauer muss mindestens 5 Minuten sein').max(480, 'Dauer darf maximal 8 Stunden sein').optional(),
  priceCents: z.number().int().min(0, 'Preis darf nicht negativ sein').max(500000, 'Preis ist zu hoch'),
});

const updateVariantSchema = z.object({
  name: z.string().trim().min(2, 'Name muss mindestens 2 Zeichen haben').max(100, 'Name ist zu lang').optional(),
  description: nullableTrimmedText(500),
  durationMinutes: z.number().int().min(5, 'Dauer muss mindestens 5 Minuten sein').max(480, 'Dauer darf maximal 8 Stunden sein').nullable().optional(),
  priceCents: z.number().int().min(0, 'Preis darf nicht negativ sein').max(500000, 'Preis ist zu hoch').optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

function parseInput<T>(
  schema: z.ZodType<T>,
  input: unknown
): ServiceResult<T> {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join('.') || 'form';
    fieldErrors[key] = issue.message;
  }

  return {
    success: false,
    error: Object.values(fieldErrors)[0] || 'Ungültige Eingabe',
    fieldErrors,
  };
}

function toActionError<T>(result: ServiceResult<unknown>): ServiceResult<T> {
  return {
    success: false,
    error: result.error || 'Ungültige Eingabe',
    fieldErrors: result.fieldErrors,
  };
}

// ============================================
// GET SERVICE CATEGORIES (for dropdown)
// ============================================

export async function getServiceCategories(
  salonId: string = DEFAULT_SALON_ID
): Promise<ServiceCategory[]> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('service_categories') as any)
    .select('id, name, slug, description, sort_order')
    .eq('salon_id', salonId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error || !data) {
    console.error('Error fetching service categories:', error);
    return [];
  }

  return data.map((cat: any) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    sortOrder: cat.sort_order,
  }));
}

// ============================================
// GET ALL SERVICES FOR ADMIN (including inactive)
// ============================================

export async function getAllServicesForAdmin(
  salonId: string = DEFAULT_SALON_ID
): Promise<ServiceForAdmin[]> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('services') as any)
    .select(`
      id,
      name,
      slug,
      description,
      category_id,
      duration_minutes,
      price_cents,
      price_from,
      has_length_variants,
      is_bookable_online,
      is_active,
      sort_order,
      service_categories (
        name
      )
    `)
    .eq('salon_id', salonId)
    .order('sort_order', { ascending: true });

  if (error || !data) {
    console.error('Error fetching services for admin:', error);
    return [];
  }

  return data.map((svc: any) => ({
    id: svc.id,
    name: svc.name,
    slug: svc.slug,
    description: svc.description,
    categoryId: svc.category_id,
    categoryName: svc.service_categories?.name || null,
    durationMinutes: svc.duration_minutes,
    priceCents: svc.price_cents,
    priceFrom: svc.price_from || false,
    hasLengthVariants: svc.has_length_variants || false,
    isBookableOnline: svc.is_bookable_online,
    isActive: svc.is_active,
    sortOrder: svc.sort_order,
  }));
}

// ============================================
// CREATE SERVICE
// ============================================

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[äöüß]/g, (match) => {
      const map: Record<string, string> = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
      return map[match] || match;
    })
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function generateUniqueSlug(
  supabase: DbClient,
  table: 'services' | 'service_categories',
  salonId: string,
  name: string,
  excludeId?: string
): Promise<string> {
  const baseSlug = generateSlug(name) || 'eintrag';
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    let query = (supabase.from(table) as any)
      .select('id')
      .eq('salon_id', salonId)
      .eq('slug', slug)
      .limit(1);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      console.error('[services] Slug lookup failed:', error);
      return `${baseSlug}-${Date.now()}`;
    }

    if (!data) return slug;

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function getEffectiveSalonId(salonId: string | null | undefined): string {
  return !salonId || salonId === 'all' ? DEFAULT_SALON_ID : salonId;
}

async function requireServiceAdmin(
  supabase: DbClient,
  salonId?: string
): Promise<ServiceResult<{ salonId: string }>> {
  const auth = await requireAdminAction(supabase, {
    salonId,
    allowedRoles: SERVICE_ADMIN_ROLES,
  });

  if (!auth.success) {
    return { success: false, error: 'error' in auth ? auth.error : 'Keine Berechtigung für diese Aktion' };
  }

  return {
    success: true,
    data: { salonId: getEffectiveSalonId(auth.context.salonId) },
  };
}

async function getServiceSalonId(supabase: DbClient, serviceId: string): Promise<string | null> {
  const { data, error } = await (supabase.from('services') as any)
    .select('salon_id')
    .eq('id', serviceId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.salon_id;
}

async function getCategorySalonId(supabase: DbClient, categoryId: string): Promise<string | null> {
  const { data, error } = await (supabase.from('service_categories') as any)
    .select('salon_id')
    .eq('id', categoryId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.salon_id;
}

async function assertCategoryBelongsToSalon(
  supabase: DbClient,
  categoryId: string | null | undefined,
  salonId: string
): Promise<ServiceResult<true>> {
  if (!categoryId) {
    return { success: true, data: true };
  }

  const categorySalonId = await getCategorySalonId(supabase, categoryId);
  if (!categorySalonId || categorySalonId !== salonId) {
    return { success: false, error: 'Kategorie gehört nicht zu diesem Salon' };
  }

  return { success: true, data: true };
}

function revalidateServiceAdminPaths() {
  revalidateTag('services', 'max');
  revalidateTag('booking', 'max');
  revalidateTag('homepage', 'max');
  revalidatePath('/admin/einstellungen');
  revalidatePath('/admin/team');
  revalidatePath('/admin/kalender');
  revalidatePath('/leistungen');
  revalidatePath('/termin-buchen');
  revalidatePath('/');
}

function getCategoryName(row: ServiceRow): string | null {
  const relation = row.service_categories;
  if (Array.isArray(relation)) {
    return relation[0]?.name || null;
  }
  return relation?.name || null;
}

function mapServiceRow(row: ServiceRow): ServiceForAdmin {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    categoryId: row.category_id,
    categoryName: getCategoryName(row),
    durationMinutes: row.duration_minutes,
    priceCents: row.price_cents,
    priceFrom: row.price_from || false,
    hasLengthVariants: row.has_length_variants || false,
    isBookableOnline: row.is_bookable_online !== false,
    isActive: row.is_active,
    sortOrder: row.sort_order || 0,
  };
}

function mapCategoryRow(row: CategoryRow): ServiceCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sort_order || 0,
  };
}

function mapVariantRow(row: VariantRow): ServiceVariant {
  return {
    id: row.id,
    serviceId: row.service_id,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    priceCents: row.price_cents,
    sortOrder: row.sort_order || 0,
  };
}

export async function createService(
  input: CreateServiceInput,
  salonId?: string
): Promise<ServiceResult<ServiceForAdmin>> {
  const supabase = createServerClient();
  if (!supabase) {
    return { success: false, error: 'Datenbankverbindung nicht verfügbar' };
  }

  const auth = await requireServiceAdmin(supabase, salonId);
  if (!auth.success || !auth.data) {
    return { success: false, error: auth.error || 'Keine Berechtigung für diese Aktion' };
  }

  const effectiveSalonId = getEffectiveSalonId(salonId || auth.data.salonId);
  const parsed = parseInput(createServiceSchema, input);
  if (!parsed.success || !parsed.data) {
    return toActionError<ServiceForAdmin>(parsed);
  }

  const categoryCheck = await assertCategoryBelongsToSalon(supabase, parsed.data.categoryId, effectiveSalonId);
  if (!categoryCheck.success) {
    return toActionError<ServiceForAdmin>(categoryCheck);
  }

  const slug = await generateUniqueSlug(supabase, 'services', effectiveSalonId, parsed.data.name);

  // Get max sort_order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxSort } = await (supabase
    .from('services') as any)
    .select('sort_order')
    .eq('salon_id', effectiveSalonId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextSortOrder = (maxSort?.sort_order || 0) + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('services') as any)
    .insert({
      salon_id: effectiveSalonId,
      name: parsed.data.name,
      slug,
      description: parsed.data.description || null,
      category_id: parsed.data.categoryId || null,
      duration_minutes: parsed.data.durationMinutes,
      price_cents: parsed.data.priceCents,
      price_from: parsed.data.priceFrom || false,
      is_bookable_online: parsed.data.isBookableOnline !== false,
      is_active: true,
      sort_order: nextSortOrder,
    })
    .select(`
      id,
      name,
      slug,
      description,
      category_id,
      duration_minutes,
      price_cents,
      price_from,
      has_length_variants,
      is_bookable_online,
      is_active,
      sort_order,
      service_categories (
        name
      )
    `)
    .single();

  if (error) {
    console.error('Error creating service:', error);
    return { success: false, error: 'Fehler beim Erstellen der Leistung' };
  }

  revalidateServiceAdminPaths();

  return {
    success: true,
    data: {
      ...mapServiceRow(data),
    },
  };
}

// ============================================
// UPDATE SERVICE
// ============================================

export async function updateService(
  input: UpdateServiceInput
): Promise<ServiceResult<ServiceForAdmin>> {
  const supabase = createServerClient();
  if (!supabase) {
    return { success: false, error: 'Datenbankverbindung nicht verfügbar' };
  }

  const parsed = parseInput(updateServiceSchema, input);
  if (!parsed.success || !parsed.data) {
    return toActionError<ServiceForAdmin>(parsed);
  }

  const salonId = await getServiceSalonId(supabase, parsed.data.id);
  if (!salonId) {
    return { success: false, error: 'Leistung nicht gefunden' };
  }

  const auth = await requireServiceAdmin(supabase, salonId);
  if (!auth.success) {
    return { success: false, error: auth.error || 'Keine Berechtigung für diese Aktion' };
  }

  const categoryCheck = await assertCategoryBelongsToSalon(supabase, parsed.data.categoryId, salonId);
  if (!categoryCheck.success) {
    return toActionError<ServiceForAdmin>(categoryCheck);
  }

  const updateData: Record<string, unknown> = {};

  if (parsed.data.name !== undefined) {
    updateData.name = parsed.data.name;
    updateData.slug = await generateUniqueSlug(supabase, 'services', salonId, parsed.data.name, parsed.data.id);
  }
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description || null;
  if (parsed.data.categoryId !== undefined) updateData.category_id = parsed.data.categoryId || null;
  if (parsed.data.durationMinutes !== undefined) updateData.duration_minutes = parsed.data.durationMinutes;
  if (parsed.data.priceCents !== undefined) updateData.price_cents = parsed.data.priceCents;
  if (parsed.data.priceFrom !== undefined) updateData.price_from = parsed.data.priceFrom;
  if (parsed.data.isBookableOnline !== undefined) updateData.is_bookable_online = parsed.data.isBookableOnline;
  if (parsed.data.isActive !== undefined) updateData.is_active = parsed.data.isActive;
  if (parsed.data.sortOrder !== undefined) updateData.sort_order = parsed.data.sortOrder;

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: 'Keine Änderungen zum Speichern' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('services') as any)
    .update(updateData)
    .eq('id', parsed.data.id)
    .eq('salon_id', salonId)
    .select(`
      id,
      name,
      slug,
      description,
      category_id,
      duration_minutes,
      price_cents,
      price_from,
      has_length_variants,
      is_bookable_online,
      is_active,
      sort_order,
      service_categories (
        name
      )
    `)
    .single();

  if (error) {
    console.error('Error updating service:', error);
    return { success: false, error: 'Fehler beim Aktualisieren der Leistung' };
  }

  revalidateServiceAdminPaths();

  return {
    success: true,
    data: {
      ...mapServiceRow(data),
    },
  };
}

// ============================================
// DELETE SERVICE (soft delete)
// ============================================

export async function deleteService(
  serviceId: string
): Promise<ServiceResult<boolean>> {
  const supabase = createServerClient();
  if (!supabase) {
    return { success: false, error: 'Datenbankverbindung nicht verfügbar' };
  }

  const salonId = await getServiceSalonId(supabase, serviceId);
  if (!salonId) {
    return { success: false, error: 'Leistung nicht gefunden' };
  }

  const auth = await requireServiceAdmin(supabase, salonId);
  if (!auth.success) {
    return { success: false, error: auth.error || 'Keine Berechtigung für diese Aktion' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase
    .from('services') as any)
    .update({ is_active: false })
    .eq('id', serviceId)
    .eq('salon_id', salonId);

  if (error) {
    console.error('Error deleting service:', error);
    return { success: false, error: 'Fehler beim Löschen der Leistung' };
  }

  revalidateServiceAdminPaths();

  return { success: true, data: true };
}

// ============================================
// RESTORE SERVICE (undo soft delete)
// ============================================

export async function restoreService(
  serviceId: string
): Promise<ServiceResult<boolean>> {
  const supabase = createServerClient();
  if (!supabase) {
    return { success: false, error: 'Datenbankverbindung nicht verfügbar' };
  }

  const salonId = await getServiceSalonId(supabase, serviceId);
  if (!salonId) {
    return { success: false, error: 'Leistung nicht gefunden' };
  }

  const auth = await requireServiceAdmin(supabase, salonId);
  if (!auth.success) {
    return { success: false, error: auth.error || 'Keine Berechtigung für diese Aktion' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase
    .from('services') as any)
    .update({ is_active: true })
    .eq('id', serviceId)
    .eq('salon_id', salonId);

  if (error) {
    console.error('Error restoring service:', error);
    return { success: false, error: 'Fehler beim Wiederherstellen der Leistung' };
  }

  revalidateServiceAdminPaths();

  return { success: true, data: true };
}

// ============================================
// CATEGORY MANAGEMENT
// ============================================

export type CreateCategoryInput = {
  name: string;
  description?: string;
};

export type UpdateCategoryInput = {
  name?: string;
  description?: string;
  sortOrder?: number;
};

// Create category
export async function createCategory(
  input: CreateCategoryInput
): Promise<ServiceResult<ServiceCategory>> {
  const supabase = createServerClient();

  if (!supabase) {
    console.error('createCategory: Supabase client not available');
    return { success: false, error: 'Datenbankverbindung nicht verfügbar' };
  }

  const auth = await requireServiceAdmin(supabase);
  if (!auth.success || !auth.data) {
    return { success: false, error: auth.error || 'Keine Berechtigung für diese Aktion' };
  }

  const parsed = parseInput(categoryCreateSchema, input);
  if (!parsed.success || !parsed.data) {
    return toActionError<ServiceCategory>(parsed);
  }

  const salonId = auth.data.salonId;
  const slug = await generateUniqueSlug(supabase, 'service_categories', salonId, parsed.data.name);

  // Get max sort order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxOrderData } = await (supabase
    .from('service_categories') as any)
    .select('sort_order')
    .eq('salon_id', salonId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextSortOrder = (maxOrderData?.sort_order || 0) + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('service_categories') as any)
    .insert({
      salon_id: salonId,
      name: parsed.data.name,
      slug,
      description: parsed.data.description || null,
      sort_order: nextSortOrder,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating category:', error);
    return { success: false, error: 'Fehler beim Erstellen der Kategorie' };
  }

  revalidateServiceAdminPaths();

  return {
    success: true,
    data: {
      ...mapCategoryRow(data),
    },
  };
}

// Update category
export async function updateCategory(
  categoryId: string,
  input: UpdateCategoryInput
): Promise<ServiceResult<ServiceCategory>> {
  const supabase = createServerClient();

  if (!supabase) {
    console.error('updateCategory: Supabase client not available');
    return { success: false, error: 'Datenbankverbindung nicht verfügbar' };
  }

  const salonId = await getCategorySalonId(supabase, categoryId);
  if (!salonId) {
    return { success: false, error: 'Kategorie nicht gefunden' };
  }

  const auth = await requireServiceAdmin(supabase, salonId);
  if (!auth.success) {
    return { success: false, error: auth.error || 'Keine Berechtigung für diese Aktion' };
  }

  const parsed = parseInput(categoryUpdateSchema, input);
  if (!parsed.success || !parsed.data) {
    return toActionError<ServiceCategory>(parsed);
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name) {
    updateData.name = parsed.data.name;
    updateData.slug = await generateUniqueSlug(
      supabase,
      'service_categories',
      salonId,
      parsed.data.name,
      categoryId
    );
  }
  if (parsed.data.description !== undefined) {
    updateData.description = parsed.data.description || null;
  }
  if (parsed.data.sortOrder !== undefined) {
    updateData.sort_order = parsed.data.sortOrder;
  }

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: 'Keine Änderungen zum Speichern' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('service_categories') as any)
    .update(updateData)
    .eq('id', categoryId)
    .eq('salon_id', salonId)
    .select()
    .single();

  if (error) {
    console.error('Error updating category:', error);
    return { success: false, error: 'Fehler beim Aktualisieren der Kategorie' };
  }

  revalidateServiceAdminPaths();

  return {
    success: true,
    data: {
      ...mapCategoryRow(data),
    },
  };
}

// Delete category
export async function deleteCategory(
  categoryId: string
): Promise<ServiceResult<boolean>> {
  const supabase = createServerClient();

  if (!supabase) {
    console.error('deleteCategory: Supabase client not available');
    return { success: false, error: 'Datenbankverbindung nicht verfügbar' };
  }

  const salonId = await getCategorySalonId(supabase, categoryId);
  if (!salonId) {
    return { success: false, error: 'Kategorie nicht gefunden' };
  }

  const auth = await requireServiceAdmin(supabase, salonId);
  if (!auth.success) {
    return { success: false, error: auth.error || 'Keine Berechtigung für diese Aktion' };
  }

  // First, remove category from all services that use it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: unlinkError } = await (supabase
    .from('services') as any)
    .update({ category_id: null })
    .eq('category_id', categoryId)
    .eq('salon_id', salonId);

  if (unlinkError) {
    console.error('Error unlinking category services:', unlinkError);
    return { success: false, error: 'Fehler beim Entfernen der Kategoriezuordnung' };
  }

  // Then delete the category
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase
    .from('service_categories') as any)
    .delete()
    .eq('id', categoryId)
    .eq('salon_id', salonId);

  if (error) {
    console.error('Error deleting category:', error);
    return { success: false, error: 'Fehler beim Löschen der Kategorie' };
  }

  revalidateServiceAdminPaths();

  return { success: true, data: true };
}

// Reorder categories
export async function reorderCategories(
  categoryIds: string[]
): Promise<ServiceResult<boolean>> {
  const supabase = createServerClient();

  if (!supabase) {
    console.error('reorderCategories: Supabase client not available');
    return { success: false, error: 'Datenbankverbindung nicht verfügbar' };
  }

  if (categoryIds.length === 0) {
    return { success: true, data: true };
  }

  const { data: categoriesForAuth, error: categoryAuthError } = await (supabase
    .from('service_categories') as any)
    .select('id, salon_id')
    .in('id', categoryIds);

  if (categoryAuthError || !categoriesForAuth || categoriesForAuth.length !== categoryIds.length) {
    return { success: false, error: 'Eine oder mehrere Kategorien wurden nicht gefunden' };
  }

  const salonIds = Array.from(
    new Set<string>(categoriesForAuth.map((category: { salon_id: string }) => category.salon_id))
  );
  if (salonIds.length !== 1) {
    return { success: false, error: 'Kategorien aus verschiedenen Salons können nicht gemeinsam sortiert werden' };
  }

  const auth = await requireServiceAdmin(supabase, salonIds[0]);
  if (!auth.success) {
    return { success: false, error: auth.error || 'Keine Berechtigung für diese Aktion' };
  }

  try {
    // Update each category's sort_order based on its position in the array
    for (let i = 0; i < categoryIds.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase
        .from('service_categories') as any)
        .update({ sort_order: i })
        .eq('id', categoryIds[i])
        .eq('salon_id', salonIds[0]);

      if (error) {
        console.error('Error updating category order:', error);
        return { success: false, error: 'Fehler beim Aktualisieren der Reihenfolge' };
      }
    }

    revalidateServiceAdminPaths();

    return { success: true, data: true };
  } catch (error) {
    console.error('Error reordering categories:', error);
    return { success: false, error: 'Fehler beim Aktualisieren der Reihenfolge' };
  }
}

// ============================================
// SERVICE VARIANTS (Sub-services)
// ============================================

export type ServiceVariant = {
  id: string;
  serviceId: string;
  name: string;
  description: string | null;
  durationMinutes: number | null;
  priceCents: number;
  sortOrder: number;
};

export type CreateVariantInput = {
  serviceId: string;
  name: string;
  description?: string;
  durationMinutes?: number;
  priceCents: number;
};

export type UpdateVariantInput = {
  name?: string;
  description?: string;
  durationMinutes?: number | null;
  priceCents?: number;
  sortOrder?: number;
};

// Get variants for a service
export async function getServiceVariants(
  serviceId: string
): Promise<ServiceVariant[]> {
  const supabase = createServerClient();

  if (!supabase) {
    console.error('getServiceVariants: Supabase client not available');
    return [];
  }

  const serviceIdResult = z.string().uuid().safeParse(serviceId);
  if (!serviceIdResult.success) {
    return [];
  }

  const salonId = await getServiceSalonId(supabase, serviceIdResult.data);
  if (!salonId) {
    return [];
  }

  const auth = await requireServiceAdmin(supabase, salonId);
  if (!auth.success) {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('service_length_variants') as any)
    .select('id, service_id, name, description, duration_minutes, price_cents, sort_order')
    .eq('service_id', serviceIdResult.data)
    .order('sort_order', { ascending: true });

  if (error || !data) {
    console.error('Error fetching service variants:', error);
    return [];
  }

  return (data as VariantRow[]).map(mapVariantRow);
}

// Helper: Sync service price from minimum variant price
async function syncServicePriceFromVariants(
  supabase: ReturnType<typeof createServerClient>,
  serviceId: string
): Promise<number | null> {
  if (!supabase) return null;

  // Get all variants for this service
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: variants, error: variantsError } = await (supabase
    .from('service_length_variants') as any)
    .select('price_cents')
    .eq('service_id', serviceId);

  if (variantsError) {
    console.error('Error syncing variant price:', variantsError);
    return null;
  }

  if (!variants || variants.length === 0) {
    return null;
  }

  // Find minimum price
  const minPrice = Math.min(...variants.map((v: { price_cents: number }) => v.price_cents));

  // Update service with minimum price
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase
    .from('services') as any)
    .update({
      price_cents: minPrice,
      has_length_variants: true,
      price_from: true
    })
    .eq('id', serviceId);

  if (updateError) {
    console.error('Error updating service variant price:', updateError);
    return null;
  }

  return minPrice;
}

// Create variant
export async function createVariant(
  input: CreateVariantInput
): Promise<ServiceResult<ServiceVariant>> {
  const supabase = createServerClient();

  if (!supabase) {
    console.error('createVariant: Supabase client not available');
    return { success: false, error: 'Datenbankverbindung nicht verfügbar' };
  }

  const parsed = parseInput(createVariantSchema, input);
  if (!parsed.success || !parsed.data) {
    return toActionError<ServiceVariant>(parsed);
  }

  const salonId = await getServiceSalonId(supabase, parsed.data.serviceId);
  if (!salonId) {
    return { success: false, error: 'Leistung nicht gefunden' };
  }

  const auth = await requireServiceAdmin(supabase, salonId);
  if (!auth.success) {
    return { success: false, error: auth.error || 'Keine Berechtigung für diese Aktion' };
  }

  // Get max sort order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxOrderData } = await (supabase
    .from('service_length_variants') as any)
    .select('sort_order')
    .eq('service_id', parsed.data.serviceId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextSortOrder = (maxOrderData?.sort_order || 0) + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('service_length_variants') as any)
    .insert({
      service_id: parsed.data.serviceId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      duration_minutes: parsed.data.durationMinutes || null,
      price_cents: parsed.data.priceCents,
      sort_order: nextSortOrder,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating variant:', error);
    return { success: false, error: 'Fehler beim Erstellen der Variante' };
  }

  // Sync service price from variants (sets min price and flags)
  await syncServicePriceFromVariants(supabase, parsed.data.serviceId);

  revalidateServiceAdminPaths();

  return {
    success: true,
    data: {
      ...mapVariantRow(data),
    },
  };
}

// Update variant
export async function updateVariant(
  variantId: string,
  input: UpdateVariantInput
): Promise<ServiceResult<ServiceVariant>> {
  const supabase = createServerClient();

  if (!supabase) {
    console.error('updateVariant: Supabase client not available');
    return { success: false, error: 'Datenbankverbindung nicht verfügbar' };
  }

  const variantIdResult = z.string().uuid('Ungültige Variante').safeParse(variantId);
  if (!variantIdResult.success) {
    return { success: false, error: 'Ungültige Variante' };
  }

  const parsed = parseInput(updateVariantSchema, input);
  if (!parsed.success || !parsed.data) {
    return toActionError<ServiceVariant>(parsed);
  }

  const { data: existingVariant, error: variantFetchError } = await (supabase
    .from('service_length_variants') as any)
    .select('id, service_id')
    .eq('id', variantIdResult.data)
    .single();

  if (variantFetchError || !existingVariant) {
    return { success: false, error: 'Variante nicht gefunden' };
  }

  const salonId = await getServiceSalonId(supabase, existingVariant.service_id);
  if (!salonId) {
    return { success: false, error: 'Leistung nicht gefunden' };
  }

  const auth = await requireServiceAdmin(supabase, salonId);
  if (!auth.success) {
    return { success: false, error: auth.error || 'Keine Berechtigung für diese Aktion' };
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description || null;
  if (parsed.data.durationMinutes !== undefined) updateData.duration_minutes = parsed.data.durationMinutes;
  if (parsed.data.priceCents !== undefined) updateData.price_cents = parsed.data.priceCents;
  if (parsed.data.sortOrder !== undefined) updateData.sort_order = parsed.data.sortOrder;

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: 'Keine Änderungen zum Speichern' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('service_length_variants') as any)
    .update(updateData)
    .eq('id', variantIdResult.data)
    .select()
    .single();

  if (error) {
    console.error('Error updating variant:', error);
    return { success: false, error: 'Fehler beim Aktualisieren der Variante' };
  }

  // Sync service price from variants if price was changed
  if (parsed.data.priceCents !== undefined) {
    await syncServicePriceFromVariants(supabase, data.service_id);
  }

  revalidateServiceAdminPaths();

  return {
    success: true,
    data: {
      ...mapVariantRow(data),
    },
  };
}

// Delete variant
export async function deleteVariant(
  variantId: string,
  serviceId: string
): Promise<ServiceResult<boolean>> {
  const supabase = createServerClient();

  if (!supabase) {
    console.error('deleteVariant: Supabase client not available');
    return { success: false, error: 'Datenbankverbindung nicht verfügbar' };
  }

  const variantIdResult = z.string().uuid('Ungültige Variante').safeParse(variantId);
  const serviceIdResult = z.string().uuid('Ungültige Leistung').safeParse(serviceId);
  if (!variantIdResult.success || !serviceIdResult.success) {
    return { success: false, error: 'Ungültige Variante' };
  }

  const { data: existingVariant, error: variantFetchError } = await (supabase
    .from('service_length_variants') as any)
    .select('id, service_id')
    .eq('id', variantIdResult.data)
    .eq('service_id', serviceIdResult.data)
    .maybeSingle();

  if (variantFetchError || !existingVariant) {
    return { success: false, error: 'Variante nicht gefunden' };
  }

  const salonId = await getServiceSalonId(supabase, existingVariant.service_id);
  if (!salonId) {
    return { success: false, error: 'Leistung nicht gefunden' };
  }

  const auth = await requireServiceAdmin(supabase, salonId);
  if (!auth.success) {
    return { success: false, error: auth.error || 'Keine Berechtigung für diese Aktion' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase
    .from('service_length_variants') as any)
    .delete()
    .eq('id', variantIdResult.data)
    .eq('service_id', existingVariant.service_id);

  if (error) {
    console.error('Error deleting variant:', error);
    return { success: false, error: 'Fehler beim Löschen der Variante' };
  }

  // Check if there are remaining variants and sync price
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: remainingVariants } = await (supabase
    .from('service_length_variants') as any)
    .select('id, price_cents')
    .eq('service_id', existingVariant.service_id);

  if (!remainingVariants || remainingVariants.length === 0) {
    // No variants left - reset flags (keep existing price)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase
      .from('services') as any)
      .update({ has_length_variants: false, price_from: false })
      .eq('id', existingVariant.service_id)
      .eq('salon_id', salonId);
  } else {
    // Sync price from remaining variants
    await syncServicePriceFromVariants(supabase, existingVariant.service_id);
  }

  revalidateServiceAdminPaths();

  return { success: true, data: true };
}
