import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag, Gift, Truck, Star, Package, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { AddToCartButton } from '@/components/shop/add-to-cart-button';
import { PriceRangeSlider } from '@/components/shop/price-range-slider';

// Force dynamic rendering - database not available during build
export const dynamic = 'force-dynamic';
const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Shop',
  description:
    'Professionelle Haarpflegeprodukte und Geschenkgutscheine im BeautifyPRO Online-Shop.',
};

// ============================================
// DATA FETCHING
// ============================================

async function getShopData(searchParams: {
  category?: string;
  page?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  inStock?: string;
}) {
  const supabase = createServiceRoleClient();

  if (!supabase) {
    console.error('Supabase client not available');
    return { products: [], categories: [], total: 0, page: 1, limit: 12, priceRange: { min: 0, max: 0 } };
  }

  const page = parseInt(searchParams.page || '1');
  const limit = 12;
  const offset = (page - 1) * limit;
  const minPrice = searchParams.minPrice ? parseInt(searchParams.minPrice) * 100 : null;
  const maxPrice = searchParams.maxPrice ? parseInt(searchParams.maxPrice) * 100 : null;
  const sortBy = searchParams.sort || 'newest';
  const inStockOnly = searchParams.inStock === 'true';

  // Build query
  let query = supabase
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
      product_categories (
        id,
        name,
        slug
      ),
      product_images (
        url,
        is_primary
      )
    `,
      { count: 'exact' }
    )
    .eq('salon_id', DEFAULT_SALON_ID)
    .eq('is_active', true)
    .eq('is_published', true);

  // Category filter
  if (searchParams.category && searchParams.category !== 'all') {
    query = query.eq('category_id', searchParams.category);
  }

  // Price filters
  if (minPrice !== null) {
    query = query.gte('price_cents', minPrice);
  }
  if (maxPrice !== null) {
    query = query.lte('price_cents', maxPrice);
  }

  // In stock filter
  if (inStockOnly) {
    query = query.gt('stock_quantity', 0);
  }

  // Sorting
  switch (sortBy) {
    case 'price-asc':
      query = query.order('price_cents', { ascending: true });
      break;
    case 'price-desc':
      query = query.order('price_cents', { ascending: false });
      break;
    case 'name-asc':
      query = query.order('name', { ascending: true });
      break;
    case 'name-desc':
      query = query.order('name', { ascending: false });
      break;
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching products:', error);
    return { products: [], categories: [], total: 0, page, limit, priceRange: { min: 0, max: 0 } };
  }

  // Fetch categories
  const { data: categoriesData } = await supabase
    .from('product_categories')
    .select('id, name, slug')
    .eq('salon_id', DEFAULT_SALON_ID)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  // Get price range for filter
  const { data: priceData } = await supabase
    .from('products')
    .select('price_cents')
    .eq('salon_id', DEFAULT_SALON_ID)
    .eq('is_active', true)
    .eq('is_published', true)
    .order('price_cents', { ascending: true });

  const prices = (priceData || []).map((p: any) => p.price_cents);
  const priceRange = {
    min: prices.length > 0 ? Math.floor(prices[0] / 100) : 0,
    max: prices.length > 0 ? Math.ceil(prices[prices.length - 1] / 100) : 0,
  };

  const products = (data || []).map((p: any) => {
    const images = p.product_images || [];
    const primaryImage = images.find((img: any) => img.is_primary) || images[0];
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      priceCents: p.price_cents,
      compareAtPriceCents: p.compare_at_price_cents,
      stockQuantity: p.stock_quantity,
      sku: p.sku,
      category: p.product_categories?.name || null,
      categoryId: p.product_categories?.id || null,
      imageUrl: primaryImage?.url || null,
    };
  });

  return {
    products,
    categories: categoriesData || [],
    total: count || 0,
    page,
    limit,
    priceRange,
  };
}

// ============================================
// HELPER
// ============================================

function formatPrice(cents: number): string {
  return `CHF ${(cents / 100).toFixed(2)}`;
}

function buildQueryString(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== 'all') {
      searchParams.set(key, value);
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

// ============================================
// PAGE COMPONENT
// ============================================

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    page?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    inStock?: string;
  }>;
}) {
  const params = await searchParams;
  const { products, categories, total, page, limit, priceRange } = await getShopData(params);
  const totalPages = Math.ceil(total / limit);

  // Sort options
  const sortOptions = [
    { label: 'Neueste zuerst', value: 'newest' },
    { label: 'Preis aufsteigend', value: 'price-asc' },
    { label: 'Preis absteigend', value: 'price-desc' },
    { label: 'Name A-Z', value: 'name-asc' },
    { label: 'Name Z-A', value: 'name-desc' },
  ];

  return (
    <div className="py-8 md:py-12">
      {/* Main Content with Sidebar */}
      <section className="container-wide">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <aside className="lg:w-64 shrink-0">
            <div className="sticky top-24 space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <SlidersHorizontal className="h-5 w-5" />
                <h2 className="font-semibold">Filter</h2>
              </div>

              {/* Category Filter */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Kategorie</Label>
                <Select defaultValue={params.category || 'all'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alle Kategorien" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <Link href={`/shop${buildQueryString({ ...params, category: undefined, page: undefined })}`} className="block w-full">
                        Alle Kategorien
                      </Link>
                    </SelectItem>
                    {categories.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <Link
                          href={`/shop${buildQueryString({ ...params, category: cat.id, page: undefined })}`}
                          className="block w-full"
                        >
                          {cat.name}
                        </Link>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Price Filter */}
              {priceRange.max > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Preis</Label>
                  <PriceRangeSlider
                    min={priceRange.min}
                    max={priceRange.max}
                    step={5}
                    currentMin={params.minPrice ? parseInt(params.minPrice) : undefined}
                    currentMax={params.maxPrice ? parseInt(params.maxPrice) : undefined}
                  />
                </div>
              )}

              {/* In Stock Filter */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Verfügbarkeit</Label>
                <Link
                  href={`/shop${buildQueryString({
                    ...params,
                    inStock: params.inStock === 'true' ? undefined : 'true',
                    page: undefined,
                  })}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    params.inStock === 'true'
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                    params.inStock === 'true' ? 'bg-primary-foreground border-primary-foreground' : 'border-input'
                  }`}>
                    {params.inStock === 'true' && (
                      <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  Nur verfügbare Produkte
                </Link>
              </div>

              {/* Reset Filters */}
              {(params.category || params.minPrice || params.maxPrice || params.inStock || params.sort) && (
                <Link
                  href="/shop"
                  className="block text-center px-4 py-2 text-sm text-primary hover:underline"
                >
                  Filter zurücksetzen
                </Link>
              )}
            </div>
          </aside>

          {/* Products Area */}
          <div className="flex-1">
            {/* Sort and Count Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <p className="text-sm text-muted-foreground">
                {total} {total === 1 ? 'Produkt' : 'Produkte'}
                {params.category && params.category !== 'all' ? ' in dieser Kategorie' : ''}
              </p>
              <div className="flex items-center gap-2">
                <Label htmlFor="sort" className="text-sm whitespace-nowrap">Sortieren:</Label>
                <Select defaultValue={params.sort || 'newest'}>
                  <SelectTrigger className="w-[180px]" id="sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <Link
                          href={`/shop${buildQueryString({ ...params, sort: option.value, page: undefined })}`}
                          className="block w-full"
                        >
                          {option.label}
                        </Link>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Product Grid */}
            {products.length === 0 ? (
              <div className="text-center py-16 md:py-24">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <ShoppingBag className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Keine Produkte gefunden</h2>
                <p className="text-muted-foreground mb-6">
                  {params.category || params.minPrice || params.maxPrice
                    ? 'Versuchen Sie andere Filtereinstellungen.'
                    : 'Es sind noch keine Produkte verfügbar.'}
                </p>
                {(params.category || params.minPrice || params.maxPrice) && (
                  <Button asChild variant="outline">
                    <Link href="/shop">Filter zurücksetzen</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <Card
                    key={product.id}
                    className="group overflow-hidden border-border/50 transition-shadow duration-300 hover:shadow-lg"
                  >
                    {/* Image */}
                    <Link href={`/shop/produkte/${product.sku || product.slug}`}>
                      <div className="relative aspect-square bg-gradient-to-br from-muted to-muted/30 overflow-hidden">
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            alt={product.name}
                            fill
                            sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
                            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                            unoptimized={product.imageUrl.includes('localhost') || product.imageUrl.includes('127.0.0.1')}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Package className="h-12 w-12 text-muted-foreground/15" />
                          </div>
                        )}

                        {/* Sale Badge */}
                        {product.compareAtPriceCents &&
                          product.compareAtPriceCents > product.priceCents && (
                            <div className="absolute top-2 left-2">
                              <Badge variant="destructive" className="text-xs">
                                Sale
                              </Badge>
                            </div>
                          )}

                        {/* Out of stock overlay */}
                        {product.stockQuantity <= 0 && (
                          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                            <span className="text-sm font-medium text-muted-foreground bg-background/80 px-3 py-1 rounded-full">
                              Ausverkauft
                            </span>
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Content */}
                    <CardContent className="p-3 md:p-4">
                      {product.category && (
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                          {product.category}
                        </p>
                      )}
                      <Link href={`/shop/produkte/${product.sku || product.slug}`}>
                        <h3 className="font-medium text-sm md:text-base mb-2 line-clamp-2 hover:text-primary transition-colors">
                          {product.name}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-base md:text-lg font-bold text-primary">
                          {formatPrice(product.priceCents)}
                        </span>
                        {product.compareAtPriceCents &&
                          product.compareAtPriceCents > product.priceCents && (
                            <span className="text-xs md:text-sm text-muted-foreground line-through">
                              {formatPrice(product.compareAtPriceCents)}
                            </span>
                          )}
                      </div>
                      <AddToCartButton
                        product={{
                          id: product.id,
                          name: product.name,
                          description: product.description,
                          priceCents: product.priceCents,
                          imageUrl: product.imageUrl,
                          sku: product.sku,
                        }}
                        disabled={product.stockQuantity <= 0}
                        size="sm"
                        className="w-full"
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                {page > 1 && (
                  <Button variant="outline" size="icon" asChild>
                    <Link href={`/shop${buildQueryString({ ...params, page: String(page - 1) })}`}>
                      <ChevronLeft className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Button
                    key={p}
                    variant={p === page ? 'default' : 'outline'}
                    size="sm"
                    asChild
                  >
                    <Link href={`/shop${buildQueryString({ ...params, page: String(p) })}`}>
                      {p}
                    </Link>
                  </Button>
                ))}
                {page < totalPages && (
                  <Button variant="outline" size="icon" asChild>
                    <Link href={`/shop${buildQueryString({ ...params, page: String(page + 1) })}`}>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Gift Voucher Banner */}
      <section className="container-wide mt-12 mb-10">
        <Link href="/shop/gutscheine" className="block">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6 md:p-8 transition-all duration-300 hover:border-primary/40 hover:shadow-md">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="flex h-12 w-12 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Gift className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-0.5">Geschenkgutscheine</h3>
                <p className="text-sm text-muted-foreground">
                  Das perfekte Geschenk - ab CHF 25, digital oder als Karte
                </p>
              </div>
              <Button variant="outline" size="sm" className="hidden sm:flex">
                Gutschein kaufen
              </Button>
            </div>
          </div>
        </Link>
      </section>

      {/* Trust Strip */}
      <section className="container-wide">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
            <Truck className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">Versandkostenfrei</p>
              <p className="text-xs text-muted-foreground">Ab CHF 50 Bestellwert</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
            <Star className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">Profi-Qualität</p>
              <p className="text-xs text-muted-foreground">Salon-Produkte für zuhause</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
            <ShoppingBag className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">Click & Collect</p>
              <p className="text-xs text-muted-foreground">Kostenlos im Salon abholen</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
