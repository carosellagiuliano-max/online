import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, Truck, Store, Package } from 'lucide-react';

// Force dynamic rendering (API not available at build time)
export const dynamic = 'force-dynamic';
const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ProductGallery } from '@/components/shop/product-gallery';
import { ProductActions } from '@/components/shop/product-actions';

// ============================================
// DATA FETCHING
// ============================================

interface ProductCategoryRow {
  id: string;
  name: string;
  slug: string;
}

interface ProductImageRow {
  id?: string;
  url: string | null;
  alt_text?: string | null;
  is_primary: boolean | null;
  sort_order?: number | null;
}

interface ProductVariantRow {
  id: string;
  name: string;
  sku: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  stock_quantity: number | null;
  image_url: string | null;
  sort_order: number | null;
  is_active: boolean | null;
}

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  stock_quantity: number | null;
  sku: string | null;
  is_active: boolean;
  product_categories: ProductCategoryRow | ProductCategoryRow[] | null;
  product_images: ProductImageRow[] | null;
  product_variants: ProductVariantRow[] | null;
}

interface RelatedProductRow {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  price_cents: number;
  product_images: ProductImageRow[] | null;
}

function getCategory(category: ProductCategoryRow | ProductCategoryRow[] | null): ProductCategoryRow | null {
  if (Array.isArray(category)) {
    return category[0] || null;
  }

  return category;
}

async function getProduct(slugOrSku: string) {
  const supabase = createServiceRoleClient();

  if (!supabase) {
    console.error('Supabase client not available');
    return null;
  }

  // Try to find by slug first, then by SKU
  let { data: product, error } = await supabase
    .from('products')
    .select(
      `
      id,
      name,
      slug,
      description,
      price_cents,
      compare_at_price_cents,
      stock_quantity,
      sku,
      is_active,
      product_categories (
        id,
        name,
        slug
      ),
      product_images (
        id,
        url,
        alt_text,
        is_primary,
        sort_order
      ),
      product_variants (
        id,
        name,
        sku,
        price_cents,
        compare_at_price_cents,
        stock_quantity,
        image_url,
        sort_order,
        is_active
      )
    `
    )
    .eq('slug', slugOrSku)
    .eq('salon_id', DEFAULT_SALON_ID)
    .eq('is_active', true)
    .eq('is_published', true)
    .single();

  // If not found by slug, try by SKU
  if (error || !product) {
    const skuResult = await supabase
      .from('products')
      .select(
        `
        id,
        name,
        slug,
        description,
        price_cents,
        compare_at_price_cents,
        stock_quantity,
        sku,
        is_active,
        product_categories (
          id,
          name,
          slug
        ),
        product_images (
          id,
          url,
          alt_text,
          is_primary,
          sort_order
        ),
        product_variants (
          id,
          name,
          sku,
          price_cents,
          compare_at_price_cents,
          stock_quantity,
          image_url,
          sort_order,
          is_active
        )
      `
      )
      .eq('sku', slugOrSku)
      .eq('salon_id', DEFAULT_SALON_ID)
      .eq('is_active', true)
      .eq('is_published', true)
      .single();

    product = skuResult.data;
    error = skuResult.error;
  }

  if (error || !product) {
    return null;
  }

  const productRow = product as ProductRow;
  const category = getCategory(productRow.product_categories);

  // Sort images, primary first
  const images = (productRow.product_images || []).sort((a, b) => {
    if (a.is_primary) return -1;
    if (b.is_primary) return 1;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  // Get active variants sorted by sort_order
  const variants = (productRow.product_variants || [])
    .filter((v) => v.is_active)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      priceCents: v.price_cents,
      compareAtPriceCents: v.compare_at_price_cents,
      stockQuantity: v.stock_quantity,
      imageUrl: v.image_url,
    }));

  return {
    id: productRow.id,
    name: productRow.name,
    slug: productRow.slug,
    description: productRow.description,
    priceCents: productRow.price_cents,
    compareAtPriceCents: productRow.compare_at_price_cents,
    stockQuantity: productRow.stock_quantity,
    sku: productRow.sku,
    category: category?.name || null,
    categoryId: category?.id || null,
    categorySlug: category?.slug || null,
    images,
    variants,
  };
}

async function getRelatedProducts(categoryId: string | null, currentId: string) {
  const supabase = createServiceRoleClient();

  if (!supabase) {
    return [];
  }

  let query = supabase
    .from('products')
    .select(
      `
      id,
      name,
      slug,
      sku,
      price_cents,
      product_images (
        url,
        is_primary
      )
    `
    )
    .eq('salon_id', DEFAULT_SALON_ID)
    .eq('is_active', true)
    .eq('is_published', true)
    .neq('id', currentId);

  // Filter by category if available
  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data } = await query.limit(4);

  return ((data || []) as RelatedProductRow[]).map((p) => {
    const images = p.product_images || [];
    const primaryImage = images.find((img) => img.is_primary) || images[0];
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      priceCents: p.price_cents,
      imageUrl: primaryImage?.url || null,
    };
  });
}

// ============================================
// METADATA
// ============================================

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return { title: 'Produkt nicht gefunden' };
  }

  return {
    title: product.name,
    description: product.description || `${product.name} im Shop`,
  };
}

// ============================================
// HELPER
// ============================================

function formatPrice(cents: number): string {
  return `CHF ${(cents / 100).toFixed(2)}`;
}

// ============================================
// PAGE COMPONENT
// ============================================

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = await getRelatedProducts(product.categoryId, product.id);
  const inStock = product.stockQuantity === null || product.stockQuantity > 0;
  const isOnSale = product.compareAtPriceCents && product.compareAtPriceCents > product.priceCents;

  return (
    <div className="py-12">
      <div className="container-wide">
        {/* Breadcrumb */}
        <nav className="flex items-center text-sm text-muted-foreground mb-8">
          <Link href="/shop" className="hover:text-foreground">
            Shop
          </Link>
          <span className="mx-2">/</span>
          <Link href="/shop/produkte" className="hover:text-foreground">
            Produkte
          </Link>
          {product.category && (
            <>
              <span className="mx-2">/</span>
              <span className="text-foreground">{product.category}</span>
            </>
          )}
        </nav>

        {/* Product Detail */}
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Images */}
          <ProductGallery
            images={product.images}
            productName={product.name}
            isOnSale={isOnSale}
          />

          {/* Product Info */}
          <div>
            {product.category && (
              <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">
                {product.category}
              </p>
            )}
            <h1 className="text-3xl font-bold mb-4">{product.name}</h1>

            {/* Price */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl font-bold text-primary">
                {formatPrice(product.priceCents)}
              </span>
              {isOnSale && (
                <span className="text-xl text-muted-foreground line-through">
                  {formatPrice(product.compareAtPriceCents!)}
                </span>
              )}
            </div>

            {/* Stock Status */}
            <div className="flex items-center gap-2 mb-6">
              {inStock ? (
                <>
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="text-green-600 font-medium">Auf Lager</span>
                </>
              ) : (
                <span className="text-destructive font-medium">Nicht auf Lager</span>
              )}
            </div>

            {/* Quantity & Add to Cart */}
            <div className="mb-8">
              <ProductActions
                product={{
                  id: product.id,
                  name: product.name,
                  description: product.description,
                  priceCents: product.priceCents,
                  imageUrl: product.images[0]?.url,
                  sku: product.sku,
                }}
                variants={product.variants}
                inStock={inStock}
                stockQuantity={product.stockQuantity}
              />
            </div>

            <Separator className="my-8" />

            {/* Description */}
            {product.description && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-3">Beschreibung</h2>
                <p className="text-muted-foreground whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            )}

            {/* Product Details */}
            {product.sku && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Artikelnummer:</span> {product.sku}
              </div>
            )}

            <Separator className="my-8" />

            {/* Shipping Info */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <Truck className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Versand</p>
                  <p className="text-xs text-muted-foreground">
                    Kostenlos ab CHF 50
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Store className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Click & Collect</p>
                  <p className="text-xs text-muted-foreground">
                    Im Salon abholen
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Rückgabe</p>
                  <p className="text-xs text-muted-foreground">
                    14 Tage Rückgaberecht
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-bold mb-8">Das könnte Ihnen auch gefallen</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {relatedProducts.map((p) => (
                <Card key={p.id} className="group overflow-hidden border-border/50">
                  <Link href={`/shop/produkte/${p.sku || p.slug}`}>
                    <div className="relative aspect-square bg-gradient-to-br from-muted to-muted/50">
                      {p.imageUrl ? (
                        <Image
                          src={p.imageUrl}
                          alt={p.name}
                          fill
                          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover"
                          unoptimized={p.imageUrl.includes('localhost') || p.imageUrl.includes('127.0.0.1')}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Package className="h-12 w-12 text-muted-foreground/20" />
                        </div>
                      )}
                    </div>
                  </Link>
                  <CardContent className="p-4">
                    <Link href={`/shop/produkte/${p.sku || p.slug}`}>
                      <h3 className="font-semibold mb-2 hover:text-primary transition-colors">
                        {p.name}
                      </h3>
                    </Link>
                    <span className="text-lg font-bold text-primary">
                      {formatPrice(p.priceCents)}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
