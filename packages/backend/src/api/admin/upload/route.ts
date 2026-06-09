import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { requireAdminApiContext } from '@/lib/auth/admin-context';

// ============================================
// SECURITY CONFIGURATION
// ============================================

// Allowed file types (MIME types)
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
];

const GALLERY_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Max file size in bytes (5 MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed buckets (whitelist)
const ALLOWED_BUCKETS = [
  'gallery',
  'avatars',
  'staff-avatars',
  'salon-assets',
  'salon-logos',
  'hero-images',
  'about-images',
  'team-images',
  'product-images',
];

// ============================================
// HELPER: Validate file type by magic bytes
// ============================================

function getFileMagicType(buffer: Buffer): string | null {
  // Check magic bytes for common image types
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif';
  }
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    // Could be WebP (RIFF header)
    if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return 'image/webp';
    }
  }
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf';
  }
  // SVG starts with < (text-based)
  if (buffer[0] === 0x3C) {
    const text = buffer.toString('utf8', 0, 100);
    if (text.includes('<svg') || text.includes('<?xml')) {
      return 'image/svg+xml';
    }
  }
  return null;
}

// ============================================
// HELPER: Sanitize file path
// ============================================

function sanitizePath(path: string): string {
  // Remove any directory traversal attempts
  return path
    .replace(/\.\./g, '')
    .replace(/\/\//g, '/')
    .replace(/^\//, '');
}

function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/svg+xml':
      return 'svg';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'bin';
  }
}

function sanitizeFilename(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  return base || `upload-${Date.now()}`;
}

const galleryInsertSchema = z.object({
  table: z.literal('gallery_images'),
  data: z.object({
    title: z.string().trim().max(200).nullable().optional(),
    description: z.string().trim().max(700).nullable().optional(),
    alt_text: z.string().trim().max(500).nullable().optional(),
    category_id: z.string().uuid().nullable().optional(),
    is_active: z.boolean().optional().default(true),
    show_on_homepage: z.boolean().optional().default(true),
    sort_order: z.number().int().min(0).optional().default(0),
  }),
});

function revalidateGallery() {
  revalidateTag('gallery', 'max');
  revalidatePath('/admin/galerie');
  revalidatePath('/galerie');
  revalidatePath('/');
}

// ============================================
// POST /api/admin/upload - Upload file to storage
// ============================================

export async function POST(request: NextRequest) {
  try {
    // ========================================
    // 1. AUTHENTICATION CHECK
    // ========================================
    const context = await requireAdminApiContext(['admin', 'manager', 'hq']);
    if ('response' in context) return context.response;

    // ========================================
    // 2. PARSE AND VALIDATE INPUT
    // ========================================
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const bucket = formData.get('bucket') as string | null;
    const path = formData.get('path') as string | null;
    const dbInsertJson = formData.get('dbInsert') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Keine Datei angegeben' }, { status: 400 });
    }

    if (!bucket) {
      return NextResponse.json({ error: 'Kein Bucket angegeben' }, { status: 400 });
    }

    if (!path) {
      return NextResponse.json({ error: 'Kein Pfad angegeben' }, { status: 400 });
    }

    // ========================================
    // 3. SECURITY VALIDATIONS
    // ========================================

    // Validate bucket (whitelist)
    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return NextResponse.json({ error: 'Ungültiger Bucket' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `Datei zu gross. Maximum: ${MAX_FILE_SIZE / 1024 / 1024} MB`
      }, { status: 400 });
    }

    const allowedTypesForBucket = bucket === 'gallery' ? GALLERY_FILE_TYPES : ALLOWED_FILE_TYPES;

    // Validate MIME type
    if (!allowedTypesForBucket.includes(file.type)) {
      return NextResponse.json({
        error: bucket === 'gallery'
          ? 'Ungültiger Dateityp. Für die Galerie sind JPG, PNG und WebP erlaubt.'
          : 'Ungültiger Dateityp. Erlaubt: JPG, PNG, WebP, GIF, SVG, PDF'
      }, { status: 400 });
    }

    // Convert file to buffer for magic byte check
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate file content (magic bytes)
    const magicType = getFileMagicType(buffer);
    if (!magicType) {
      return NextResponse.json({
        error: 'Dateiinhalt konnte nicht als erlaubtes Format erkannt werden'
      }, { status: 400 });
    }

    if (magicType && magicType !== file.type) {
      // Allow some flexibility for SVG (text-based)
      if (!(file.type === 'image/svg+xml' && magicType === 'image/svg+xml')) {
        console.warn(`File type mismatch: claimed ${file.type}, actual ${magicType}`);
        return NextResponse.json({
          error: 'Dateityp stimmt nicht mit Inhalt überein'
        }, { status: 400 });
      }
    }

    // Sanitize path
    let sanitizedPath = sanitizePath(path);
    const pathParts = sanitizedPath.split('/');
    const requestedFilename = pathParts[pathParts.length - 1] || file.name;
    const safeFilename = `${sanitizeFilename(requestedFilename)}.${extensionForMime(magicType)}`;
    if (!sanitizedPath.startsWith(`${context.salonId}/`)) {
      sanitizedPath = `${context.salonId}/${safeFilename}`;
    } else {
      sanitizedPath = `${context.salonId}/${safeFilename}`;
    }
    if (sanitizedPath !== path) {
      console.warn(`Path sanitized: ${path} -> ${sanitizedPath}`);
    }

    // ========================================
    // 4. UPLOAD FILE
    // ========================================
    const supabase = context.db;

    // Ensure bucket exists (create if needed)
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === bucket);

    if (!bucketExists) {
      const { error: createError } = await supabase.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE,
      });
      if (createError && !createError.message.includes('already exists')) {
        console.error('Failed to create bucket:', createError);
        return NextResponse.json({ error: `Bucket konnte nicht erstellt werden: ${createError.message}` }, { status: 500 });
      }
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(sanitizedPath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('Storage upload error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Get public URL
    const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
    const publicUrl = `${publicSupabaseUrl}/storage/v1/object/public/${bucket}/${sanitizedPath}`;

    // ========================================
    // 5. OPTIONAL: DATABASE INSERT
    // ========================================
    let dbRecord = null;
    if (dbInsertJson) {
      try {
        const dbInsert = JSON.parse(dbInsertJson);
        const { table, data: insertData } = dbInsert;

        // Whitelist allowed tables
        const allowedTables = ['gallery_images', 'product_images'];
        if (!allowedTables.includes(table)) {
          console.warn(`Attempted insert to non-allowed table: ${table}`);
        } else if (table === 'gallery_images') {
          if (bucket !== 'gallery') {
            await supabase.storage.from(bucket).remove([sanitizedPath]);
            return NextResponse.json({ error: 'Galeriebilder müssen im gallery-Bucket liegen' }, { status: 400 });
          }

          const validation = galleryInsertSchema.safeParse(dbInsert);
          if (!validation.success) {
            await supabase.storage.from(bucket).remove([sanitizedPath]);
            return NextResponse.json(
              { error: 'Ungültige Galerie-Metadaten', details: validation.error.issues },
              { status: 400 }
            );
          }

          const galleryData = validation.data.data;

          if (galleryData.category_id) {
            const { data: category } = await supabase
              .from('gallery_categories')
              .select('id')
              .eq('id', galleryData.category_id)
              .eq('salon_id', context.salonId)
              .single();

            if (!category) {
              await supabase.storage.from(bucket).remove([sanitizedPath]);
              return NextResponse.json({ error: 'Kategorie nicht gefunden' }, { status: 404 });
            }
          }

          const { data: dbData, error: dbError } = await supabase
            .from('gallery_images')
            .insert({
              salon_id: context.salonId,
              url: publicUrl,
              storage_path: sanitizedPath,
              title: galleryData.title?.trim() || null,
              description: galleryData.description?.trim() || null,
              alt_text: galleryData.alt_text?.trim() || null,
              category_id: galleryData.category_id || null,
              is_active: galleryData.is_active,
              show_on_homepage: galleryData.show_on_homepage,
              sort_order: galleryData.sort_order,
            })
            .select()
            .single();

          if (dbError) {
            console.error('Database insert error:', dbError);
            await supabase.storage.from(bucket).remove([sanitizedPath]);
            return NextResponse.json({ error: `Datenbankfehler: ${dbError.message}` }, { status: 400 });
          }

          dbRecord = dbData;
          revalidateGallery();
        } else if (table && insertData) {
          const fullInsertData = {
            ...insertData,
            url: publicUrl,
            storage_path: sanitizedPath,
            salon_id: context.salonId,
          };

          const { data: dbData, error: dbError } = await supabase
            .from(table)
            .insert(fullInsertData)
            .select()
            .single();

          if (dbError) {
            console.error('Database insert error:', dbError);
            await supabase.storage.from(bucket).remove([sanitizedPath]);
            return NextResponse.json({ error: `Datenbankfehler: ${dbError.message}` }, { status: 400 });
          }

          dbRecord = dbData;
        }
      } catch (parseError) {
        console.error('Failed to parse dbInsert JSON:', parseError);
        await supabase.storage.from(bucket).remove([sanitizedPath]);
        return NextResponse.json({ error: 'Upload-Metadaten sind ungültig' }, { status: 400 });
      }
    }

    return NextResponse.json({
      success: true,
      path: data.path,
      url: publicUrl,
      dbRecord,
    });
  } catch (error: unknown) {
    console.error('Upload API error:', error);
    const message = error instanceof Error ? error.message : 'Upload fehlgeschlagen';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
