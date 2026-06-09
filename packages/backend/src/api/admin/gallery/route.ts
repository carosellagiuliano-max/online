import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { requireAdminApiContext } from '@/lib/auth/admin-context';
import { createServerClient as createServiceDbClient } from '@/lib/db/client';

type ServiceDbClient = NonNullable<ReturnType<typeof createServiceDbClient>>;

const nullableText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

const httpsImageUrl = z.string().url('Ungültige Bild-URL').refine((value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}, 'Bitte verwenden Sie eine sichere HTTPS-Bild-URL');

const categoryCreateSchema = z.object({
  resource: z.literal('category'),
  name: z.string().trim().min(1, 'Name ist erforderlich').max(120),
  description: nullableText(500),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).optional(),
});

const imageCreateSchema = z.object({
  resource: z.literal('image'),
  url: httpsImageUrl,
  storage_path: z.string().nullable().optional(),
  title: nullableText(200),
  description: nullableText(700),
  alt_text: nullableText(500),
  category_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional().default(true),
  show_on_homepage: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).optional(),
});

const createSchema = z.discriminatedUnion('resource', [
  categoryCreateSchema,
  imageCreateSchema,
]);

const categoryUpdateSchema = z.object({
  resource: z.literal('category'),
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'Name ist erforderlich').max(120),
  description: nullableText(500),
  is_active: z.boolean().optional(),
});

const imageUpdateSchema = z.object({
  resource: z.literal('image'),
  id: z.string().uuid(),
  title: nullableText(200),
  description: nullableText(700),
  alt_text: nullableText(500),
  category_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
  show_on_homepage: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

const categoryOrderSchema = z.object({
  resource: z.literal('category-order'),
  category_ids: z.array(z.string().uuid()).min(1).max(100),
});

const imageOrderSchema = z.object({
  resource: z.literal('image-order'),
  category_id: z.string().uuid().nullable().optional(),
  image_ids: z.array(z.string().uuid()).min(1).max(300),
});

const updateSchema = z.discriminatedUnion('resource', [
  categoryUpdateSchema,
  imageUpdateSchema,
  categoryOrderSchema,
  imageOrderSchema,
]);

const deleteSchema = z.discriminatedUnion('resource', [
  z.object({ resource: z.literal('category'), id: z.string().uuid() }),
  z.object({ resource: z.literal('image'), id: z.string().uuid() }),
]);

function revalidateGallery() {
  revalidateTag('gallery', 'max');
  revalidatePath('/admin/galerie');
  revalidatePath('/galerie');
  revalidatePath('/');
}

function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || 'galerie';
}

async function getUniqueCategorySlug(
  db: ServiceDbClient,
  salonId: string,
  name: string,
  excludeId?: string
) {
  const baseSlug = slugifyName(name);
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    let query = db
      .from('gallery_categories')
      .select('id')
      .eq('salon_id', salonId)
      .eq('slug', slug)
      .limit(1);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      throw new Error(`Slug-Prüfung fehlgeschlagen: ${error.message}`);
    }
    if (!data) return slug;

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function assertCategoryInSalon(
  db: ServiceDbClient,
  categoryId: string | null | undefined,
  salonId: string
) {
  if (!categoryId) return true;

  const { data, error } = await db
    .from('gallery_categories')
    .select('id')
    .eq('id', categoryId)
    .eq('salon_id', salonId)
    .single();

  if (error) return false;
  return !!data;
}

async function getNextCategorySortOrder(db: ServiceDbClient, salonId: string) {
  const { data } = await db
    .from('gallery_categories')
    .select('sort_order')
    .eq('salon_id', salonId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  return ((data as { sort_order?: number } | null)?.sort_order || 0) + 1;
}

async function getNextImageSortOrder(
  db: ServiceDbClient,
  salonId: string,
  categoryId: string | null | undefined
) {
  let query = db
    .from('gallery_images')
    .select('sort_order')
    .eq('salon_id', salonId)
    .order('sort_order', { ascending: false })
    .limit(1);

  query = categoryId ? query.eq('category_id', categoryId) : query.is('category_id', null);
  const { data } = await query.maybeSingle();
  return ((data as { sort_order?: number } | null)?.sort_order || 0) + 1;
}

function cleanNullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAdminApiContext(['admin', 'manager', 'hq']);
    if ('response' in context) return context.response;

    const body = await request.json();
    const validation = createSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Ungültige Eingabedaten', details: validation.error.issues },
        { status: 400 }
      );
    }

    const payload = validation.data;

    if (payload.resource === 'category') {
      const slug = await getUniqueCategorySlug(context.db, context.salonId, payload.name);
      const sortOrder = payload.sort_order ?? (await getNextCategorySortOrder(context.db, context.salonId));

      const { data, error } = await context.db
        .from('gallery_categories')
        .insert({
          salon_id: context.salonId,
          name: payload.name,
          slug,
          description: cleanNullable(payload.description),
          is_active: payload.is_active,
          sort_order: sortOrder,
        })
        .select()
        .single();

      if (error) {
        console.error('Gallery category create error:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      revalidateGallery();
      return NextResponse.json({ success: true, data });
    }

    const categoryAllowed = await assertCategoryInSalon(
      context.db,
      payload.category_id,
      context.salonId
    );

    if (!categoryAllowed) {
      return NextResponse.json({ error: 'Kategorie nicht gefunden' }, { status: 404 });
    }

    const sortOrder = payload.sort_order ?? (await getNextImageSortOrder(
      context.db,
      context.salonId,
      payload.category_id
    ));

    const { data, error } = await context.db
      .from('gallery_images')
      .insert({
        salon_id: context.salonId,
        url: payload.url,
        storage_path: payload.storage_path || null,
        title: cleanNullable(payload.title),
        description: cleanNullable(payload.description),
        alt_text: cleanNullable(payload.alt_text),
        category_id: payload.category_id || null,
        is_active: payload.is_active,
        show_on_homepage: payload.show_on_homepage,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) {
      console.error('Gallery image create error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    revalidateGallery();
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error('Gallery API error:', error);
    const message = error instanceof Error ? error.message : 'Fehler beim Speichern';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await requireAdminApiContext(['admin', 'manager', 'hq']);
    if ('response' in context) return context.response;

    const body = await request.json();
    const validation = updateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Ungültige Eingabedaten', details: validation.error.issues },
        { status: 400 }
      );
    }

    const payload = validation.data;

    if (payload.resource === 'category-order') {
      const { data: rows, error: rowsError } = await context.db
        .from('gallery_categories')
        .select('id')
        .eq('salon_id', context.salonId)
        .in('id', payload.category_ids);

      if (rowsError || (rows || []).length !== payload.category_ids.length) {
        return NextResponse.json({ error: 'Kategorie-Reihenfolge ist ungültig' }, { status: 400 });
      }

      for (const [index, categoryId] of payload.category_ids.entries()) {
        const { error } = await context.db
          .from('gallery_categories')
          .update({ sort_order: index + 1, updated_at: new Date().toISOString() })
          .eq('id', categoryId)
          .eq('salon_id', context.salonId);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }

      revalidateGallery();
      return NextResponse.json({ success: true });
    }

    if (payload.resource === 'image-order') {
      const normalizedCategoryId = payload.category_id || null;
      let rowsQuery = context.db
        .from('gallery_images')
        .select('id, category_id')
        .eq('salon_id', context.salonId)
        .in('id', payload.image_ids);

      rowsQuery = normalizedCategoryId
        ? rowsQuery.eq('category_id', normalizedCategoryId)
        : rowsQuery.is('category_id', null);

      const { data: rows, error: rowsError } = await rowsQuery;

      if (rowsError || (rows || []).length !== payload.image_ids.length) {
        return NextResponse.json({ error: 'Bild-Reihenfolge ist ungültig' }, { status: 400 });
      }

      for (const [index, imageId] of payload.image_ids.entries()) {
        const { error } = await context.db
          .from('gallery_images')
          .update({ sort_order: index + 1, updated_at: new Date().toISOString() })
          .eq('id', imageId)
          .eq('salon_id', context.salonId);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }

      revalidateGallery();
      return NextResponse.json({ success: true });
    }

    if (payload.resource === 'category') {
      const slug = await getUniqueCategorySlug(
        context.db,
        context.salonId,
        payload.name,
        payload.id
      );

      const { data, error } = await context.db
        .from('gallery_categories')
        .update({
          name: payload.name,
          slug,
          description: cleanNullable(payload.description),
          is_active: payload.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.id)
        .eq('salon_id', context.salonId)
        .select()
        .single();

      if (error || !data) {
        console.error('Gallery category update error:', error);
        return NextResponse.json(
          { error: error?.message || 'Kategorie nicht gefunden' },
          { status: error ? 400 : 404 }
        );
      }

      revalidateGallery();
      return NextResponse.json({ success: true, data });
    }

    const categoryAllowed = await assertCategoryInSalon(
      context.db,
      payload.category_id,
      context.salonId
    );

    if (!categoryAllowed) {
      return NextResponse.json({ error: 'Kategorie nicht gefunden' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      title: cleanNullable(payload.title),
      description: cleanNullable(payload.description),
      alt_text: cleanNullable(payload.alt_text),
      is_active: payload.is_active,
      show_on_homepage: payload.show_on_homepage,
      updated_at: new Date().toISOString(),
    };

    if ('category_id' in payload) {
      updateData.category_id = payload.category_id || null;
    }

    if (typeof payload.sort_order === 'number') {
      updateData.sort_order = payload.sort_order;
    } else if ('category_id' in payload) {
      updateData.sort_order = await getNextImageSortOrder(
        context.db,
        context.salonId,
        payload.category_id
      );
    }

    const { data, error } = await context.db
      .from('gallery_images')
      .update(updateData)
      .eq('id', payload.id)
      .eq('salon_id', context.salonId)
      .select()
      .single();

    if (error || !data) {
      console.error('Gallery image update error:', error);
      return NextResponse.json(
        { error: error?.message || 'Bild nicht gefunden' },
        { status: error ? 400 : 404 }
      );
    }

    revalidateGallery();
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error('Gallery API error:', error);
    const message = error instanceof Error ? error.message : 'Fehler beim Aktualisieren';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await requireAdminApiContext(['admin', 'manager', 'hq']);
    if ('response' in context) return context.response;

    const body = await request.json();
    const validation = deleteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Ungültige Eingabedaten', details: validation.error.issues },
        { status: 400 }
      );
    }

    const payload = validation.data;

    if (payload.resource === 'category') {
      const { error } = await context.db
        .from('gallery_categories')
        .delete()
        .eq('id', payload.id)
        .eq('salon_id', context.salonId);

      if (error) {
        console.error('Gallery category delete error:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      revalidateGallery();
      return NextResponse.json({ success: true });
    }

    const { data: image, error: imageError } = await context.db
      .from('gallery_images')
      .select('id, storage_path')
      .eq('id', payload.id)
      .eq('salon_id', context.salonId)
      .single();

    if (imageError || !image) {
      return NextResponse.json({ error: 'Bild nicht gefunden' }, { status: 404 });
    }

    if (image.storage_path) {
      const { error: storageError } = await context.db.storage
        .from('gallery')
        .remove([image.storage_path]);

      if (storageError) {
        console.error('Gallery image storage delete failed:', storageError.message);
        return NextResponse.json(
          { error: `Storage-Datei konnte nicht gelöscht werden: ${storageError.message}` },
          { status: 500 }
        );
      }
    }

    const { error } = await context.db
      .from('gallery_images')
      .delete()
      .eq('id', payload.id)
      .eq('salon_id', context.salonId);

    if (error) {
      console.error('Gallery image delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    revalidateGallery();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Gallery API error:', error);
    const message = error instanceof Error ? error.message : 'Fehler beim Löschen';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
