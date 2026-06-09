import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createAuthClient, createServiceRoleClient } from '@/lib/supabase/server';
import { resolveStaffSalonId } from '@/lib/auth/admin-context';

// ============================================
// Types
// ============================================

interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt_text: string | null;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
}

interface StaffMember {
  id: string;
  role: string;
  salon_id: string;
}

// ============================================
// Helpers
// ============================================

async function getStaffMember(supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>) {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return null;

  const { data: staffMemberData } = await supabase
    .from('staff')
    .select('id, role, salon_id')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .single();

  const staffMember = staffMemberData as StaffMember | null;

  if (!staffMember || !['admin', 'manager', 'hq'].includes(staffMember.role)) {
    return null;
  }

  return staffMember;
}

async function productBelongsToSalon(
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  productId: string,
  salonId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('salon_id', salonId)
    .single();

  return !!data;
}

// ============================================
// GET - Fetch product images
// ============================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const staffMember = await getStaffMember(supabase);

    if (!staffMember) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const salonId = resolveStaffSalonId(staffMember.salon_id);
    if (!(await productBelongsToSalon(supabase, productId, salonId))) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Get product images
    const { data: images, error } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching product images:', error);
      return NextResponse.json(
        { error: 'Failed to fetch images' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      images: (images as ProductImage[]) || [],
    });
  } catch (error) {
    console.error('Error fetching product images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Add new product image
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const staffMember = await getStaffMember(supabase);

    if (!staffMember) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const salonId = resolveStaffSalonId(staffMember.salon_id);
    if (!(await productBelongsToSalon(supabase, productId, salonId))) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const body = await request.json();
    const { url, alt_text, is_primary } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Get current max sort_order
    const { data: existingImages } = await supabase
      .from('product_images')
      .select('sort_order, is_primary')
      .eq('product_id', productId)
      .order('sort_order', { ascending: false })
      .limit(1);

    const typedExisting = existingImages as { sort_order: number; is_primary: boolean }[] | null;
    const nextSortOrder = typedExisting && typedExisting.length > 0
      ? (typedExisting[0].sort_order || 0) + 1
      : 0;

    // If this is the first image or marked as primary, update other images
    const shouldBePrimary = is_primary || !typedExisting || typedExisting.length === 0;

    if (shouldBePrimary) {
      // Unset primary on other images
      await supabase
        .from('product_images')
        .update({ is_primary: false } as never)
        .eq('product_id', productId);
    }

    // Insert new image
    const { data: newImage, error } = await supabase
      .from('product_images')
      .insert({
        product_id: productId,
        url,
        alt_text: alt_text || null,
        is_primary: shouldBePrimary,
        sort_order: nextSortOrder,
      } as never)
      .select()
      .single();

    if (error) {
      console.error('Error adding product image:', error);
      return NextResponse.json(
        { error: 'Failed to add image' },
        { status: 500 }
      );
    }

    // Update product's primary image_url if this is the primary image
    if (shouldBePrimary) {
      await supabase
        .from('products')
        .update({ image_url: url } as never)
        .eq('id', productId)
        .eq('salon_id', salonId);
    }

    return NextResponse.json({
      success: true,
      image: newImage as ProductImage,
    });
  } catch (error) {
    console.error('Error adding product image:', error);
    return NextResponse.json(
      { error: 'Failed to add image' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - Update image (set primary, reorder)
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const staffMember = await getStaffMember(supabase);

    if (!staffMember) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const salonId = resolveStaffSalonId(staffMember.salon_id);
    if (!(await productBelongsToSalon(supabase, productId, salonId))) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const body = await request.json();
    const { imageId, is_primary, imageOrder } = body;

    // Handle reordering
    if (imageOrder && Array.isArray(imageOrder)) {
      for (let i = 0; i < imageOrder.length; i++) {
        await supabase
          .from('product_images')
          .update({ sort_order: i } as never)
          .eq('id', imageOrder[i])
          .eq('product_id', productId);
      }

      return NextResponse.json({ success: true });
    }

    // Handle setting primary image
    if (imageId && is_primary) {
      // Unset primary on all images
      await supabase
        .from('product_images')
        .update({ is_primary: false } as never)
        .eq('product_id', productId);

      // Set new primary
      const { data: updatedImage } = await supabase
        .from('product_images')
        .update({ is_primary: true } as never)
        .eq('id', imageId)
        .eq('product_id', productId)
        .select()
        .single();

      const typedUpdated = updatedImage as ProductImage | null;

      // Update product's image_url
      if (typedUpdated) {
        await supabase
          .from('products')
          .update({ image_url: typedUpdated.url } as never)
          .eq('id', productId)
          .eq('salon_id', salonId);
      }

      return NextResponse.json({
        success: true,
        image: typedUpdated,
      });
    }

    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating product image:', error);
    return NextResponse.json(
      { error: 'Failed to update image' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Remove product image
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get('imageId');

    if (!imageId) {
      return NextResponse.json(
        { error: 'Image ID is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const staffMember = await getStaffMember(supabase);

    if (!staffMember) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const salonId = resolveStaffSalonId(staffMember.salon_id);
    if (!(await productBelongsToSalon(supabase, productId, salonId))) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Get image to delete
    const { data: imageToDeleteData } = await supabase
      .from('product_images')
      .select('*')
      .eq('id', imageId)
      .eq('product_id', productId)
      .single();

    const imageToDelete = imageToDeleteData as ProductImage | null;

    if (!imageToDelete) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    // Delete from database
    const { error } = await supabase
      .from('product_images')
      .delete()
      .eq('id', imageId)
      .eq('product_id', productId);

    if (error) {
      console.error('Error deleting product image:', error);
      return NextResponse.json(
        { error: 'Failed to delete image' },
        { status: 500 }
      );
    }

    // Delete from storage if it's a supabase storage URL
    if (imageToDelete.url.includes('/storage/v1/object/public/product-images/')) {
      try {
        const path = imageToDelete.url.split('/storage/v1/object/public/product-images/')[1];
        if (path) {
          await supabase.storage.from('product-images').remove([path]);
        }
      } catch (storageError) {
        console.error('Error deleting from storage:', storageError);
        // Continue even if storage delete fails
      }
    }

    // If this was the primary image, set a new one
    if (imageToDelete.is_primary) {
      const { data: remainingImagesData } = await supabase
        .from('product_images')
        .select('id, url')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true })
        .limit(1);

      const remainingImages = remainingImagesData as { id: string; url: string }[] | null;

      if (remainingImages && remainingImages.length > 0) {
        await supabase
          .from('product_images')
          .update({ is_primary: true } as never)
          .eq('id', remainingImages[0].id);

        await supabase
          .from('products')
          .update({ image_url: remainingImages[0].url } as never)
          .eq('id', productId)
          .eq('salon_id', salonId);
      } else {
        // No images left, clear product image_url
        await supabase
          .from('products')
          .update({ image_url: null } as never)
          .eq('id', productId)
          .eq('salon_id', salonId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting product image:', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}
