'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  Plus,
  MoreHorizontal,
  Package,
  Edit,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ImageIcon,
  ImagePlus,
  Loader2,
  FolderOpen,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ProductImageUploader } from './product-image-uploader';

// ============================================
// TYPES
// ============================================

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  stock_quantity: number;
  sku: string | null;
  category: string | null;
  category_id: string | null;
  is_active: boolean;
  image_url: string | null;
  created_at: string;
  variant_count: number;
}

interface Category {
  id: string;
  name: string;
}

interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  stock_quantity: number;
  sort_order: number;
  is_active: boolean;
  image_url: string | null;
}

interface ProductImage {
  id: string;
  url: string;
  alt_text: string | null;
  is_primary: boolean;
  sort_order: number;
}

interface AdminProductListProps {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  categories: Category[];
  initialSearch: string;
  initialCategory: string;
}

interface ProductForm {
  name: string;
  description: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  stockQuantity: string;
  category: string;
  categoryId: string;
  isActive: boolean;
}

interface CategoryForm {
  name: string;
  description: string;
}

interface VariantForm {
  name: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  stockQuantity: string;
  imageUrl: string;
}

// ============================================
// HELPERS
// ============================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(cents / 100);
}

// ============================================
// ADMIN PRODUCT LIST
// ============================================

export function AdminProductList({
  products,
  total,
  page,
  limit,
  categories,
  initialSearch,
  initialCategory,
}: AdminProductListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Create/Edit product state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>({
    name: '',
    description: '',
    sku: '',
    price: '',
    compareAtPrice: '',
    stockQuantity: '0',
    category: '',
    categoryId: '',
    isActive: true,
  });

  // Category management state
  const [categoriesList, setCategoriesList] = useState<ProductCategory[]>([]);
  const [categoriesManageOpen, setCategoriesManageOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>({ name: '', description: '' });
  const [deleteCategoryDialogOpen, setDeleteCategoryDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<ProductCategory | null>(null);

  // Variant management state
  const [variantsManageOpen, setVariantsManageOpen] = useState(false);
  const [variantProductId, setVariantProductId] = useState<string>('');
  const [variantProductName, setVariantProductName] = useState<string>('');
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [variantForm, setVariantForm] = useState<VariantForm>({
    name: '',
    sku: '',
    price: '',
    compareAtPrice: '',
    stockQuantity: '0',
    imageUrl: '',
  });
  const [isUploadingVariantImage, setIsUploadingVariantImage] = useState(false);
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);

  // Image management state
  const [imagesManageOpen, setImagesManageOpen] = useState(false);
  const [imageProductId, setImageProductId] = useState<string>('');
  const [imageProductName, setImageProductName] = useState<string>('');
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);

  const totalPages = Math.ceil(total / limit);

  // Handle ?action=new query parameter
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'new') {
      setCreateDialogOpen(true);
      // Remove the query param from URL without refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('action');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, [searchParams]);

  // ============================================
  // CATEGORY HANDLERS
  // ============================================

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/products/categories', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCategoriesList(data.categories || []);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }, []);

  const openCategoriesManageDialog = async () => {
    await loadCategories();
    setCategoriesManageOpen(true);
  };

  const openAddCategoryDialog = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', description: '' });
    setCategoryDialogOpen(true);
  };

  const openEditCategoryDialog = (cat: ProductCategory) => {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, description: cat.description || '' });
    setCategoryDialogOpen(true);
  };

  const openDeleteCategoryDialog = (cat: ProductCategory) => {
    setCategoryToDelete(cat);
    setDeleteCategoryDialogOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      toast.error('Bitte geben Sie einen Namen ein');
      return;
    }

    setIsSaving(true);
    try {
      const url = editingCategory
        ? `/api/admin/products/categories/${editingCategory.id}`
        : '/api/admin/products/categories';
      const method = editingCategory ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Fehler beim Speichern');
      }

      toast.success(editingCategory ? 'Kategorie aktualisiert' : 'Kategorie erstellt');
      setCategoryDialogOpen(false);
      await loadCategories();
      router.refresh();
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error('Fehler beim Speichern der Kategorie');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/products/categories/${categoryToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Fehler beim Löschen');
      }

      toast.success('Kategorie gelöscht');
      setDeleteCategoryDialogOpen(false);
      setCategoryToDelete(null);
      await loadCategories();
      router.refresh();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Fehler beim Löschen der Kategorie');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMoveCategory = async (index: number, direction: 'up' | 'down') => {
    const newList = [...categoriesList];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newList.length) return;

    [newList[index], newList[swapIndex]] = [newList[swapIndex], newList[index]];
    setCategoriesList(newList);

    try {
      const res = await fetch('/api/admin/products/categories/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ categoryIds: newList.map((c) => c.id) }),
      });

      if (!res.ok) {
        // Revert on error
        await loadCategories();
        toast.error('Fehler beim Sortieren');
      }
    } catch (error) {
      console.error('Error reordering categories:', error);
      await loadCategories();
      toast.error('Fehler beim Sortieren');
    }
  };

  // ============================================
  // VARIANT HANDLERS
  // ============================================

  const openVariantsDialog = async (product: Product) => {
    setVariantProductId(product.id);
    setVariantProductName(product.name);
    setIsLoadingVariants(true);
    setVariantsManageOpen(true);

    try {
      const res = await fetch(`/api/admin/products/${product.id}/variants`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setVariants(data.variants || []);
      }
    } catch (error) {
      console.error('Error loading variants:', error);
      toast.error('Fehler beim Laden der Varianten');
    } finally {
      setIsLoadingVariants(false);
    }
  };

  const openAddVariantDialog = () => {
    setEditingVariant(null);
    setVariantForm({ name: '', sku: '', price: '', compareAtPrice: '', stockQuantity: '0', imageUrl: '' });
    setVariantDialogOpen(true);
  };

  const openEditVariantDialog = (variant: ProductVariant) => {
    setEditingVariant(variant);
    setVariantForm({
      name: variant.name,
      sku: variant.sku || '',
      price: (variant.price_cents / 100).toFixed(2),
      compareAtPrice: variant.compare_at_price_cents
        ? (variant.compare_at_price_cents / 100).toFixed(2)
        : '',
      stockQuantity: variant.stock_quantity.toString(),
      imageUrl: variant.image_url || '',
    });
    setVariantDialogOpen(true);
  };

  const handleSaveVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantForm.name.trim()) {
      toast.error('Bitte geben Sie einen Namen ein');
      return;
    }

    setIsSaving(true);
    try {
      const priceCents = variantForm.price ? Math.round(parseFloat(variantForm.price) * 100) : 0;
      const compareAtPriceCents = variantForm.compareAtPrice
        ? Math.round(parseFloat(variantForm.compareAtPrice) * 100)
        : null;
      const stockQuantity = parseInt(variantForm.stockQuantity) || 0;

      const url = editingVariant
        ? `/api/admin/products/${variantProductId}/variants/${editingVariant.id}`
        : `/api/admin/products/${variantProductId}/variants`;
      const method = editingVariant ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: variantForm.name.trim(),
          sku: variantForm.sku.trim() || null,
          price_cents: priceCents,
          compare_at_price_cents: compareAtPriceCents,
          stock_quantity: stockQuantity,
          image_url: variantForm.imageUrl.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Fehler beim Speichern');
      }

      toast.success(editingVariant ? 'Variante aktualisiert' : 'Variante erstellt');
      setVariantDialogOpen(false);

      // Reload variants
      const reloadRes = await fetch(`/api/admin/products/${variantProductId}/variants`, { credentials: 'include' });
      if (reloadRes.ok) {
        const data = await reloadRes.json();
        setVariants(data.variants || []);
      }
    } catch (error) {
      console.error('Error saving variant:', error);
      toast.error('Fehler beim Speichern der Variante');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVariant = async (variant: ProductVariant) => {
    if (!confirm(`Variante "${variant.name}" wirklich löschen?`)) return;

    try {
      const res = await fetch(`/api/admin/products/${variantProductId}/variants/${variant.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Fehler beim Löschen');
      }

      toast.success('Variante gelöscht');
      setVariants((prev) => prev.filter((v) => v.id !== variant.id));
    } catch (error) {
      console.error('Error deleting variant:', error);
      toast.error('Fehler beim Löschen der Variante');
    }
  };

  const handleVariantImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Bitte wählen Sie eine Bilddatei');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Datei zu gross (max 5MB)');
      return;
    }

    setIsUploadingVariantImage(true);
    try {
      const timestamp = Date.now();
      const sanitizedName = file.name.toLowerCase().replace(/[^a-z0-9.]/g, '-').replace(/-+/g, '-');
      const path = `variants/${variantProductId}/${timestamp}-${sanitizedName}`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', 'product-images');
      formData.append('path', path);

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Upload fehlgeschlagen');
      }

      const data = await res.json();
      setVariantForm((prev) => ({ ...prev, imageUrl: data.url }));
      toast.success('Bild hochgeladen');
    } catch (error) {
      console.error('Variant image upload error:', error);
      toast.error('Fehler beim Hochladen');
    } finally {
      setIsUploadingVariantImage(false);
    }
  };

  // ============================================
  // IMAGE HANDLERS
  // ============================================

  const openImagesDialog = async (product: Product) => {
    setImageProductId(product.id);
    setImageProductName(product.name);
    setIsLoadingImages(true);
    setImagesManageOpen(true);

    try {
      const res = await fetch(`/api/admin/products/${product.id}/images`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setProductImages(data.images || []);
      }
    } catch (error) {
      console.error('Error loading images:', error);
      toast.error('Fehler beim Laden der Bilder');
    } finally {
      setIsLoadingImages(false);
    }
  };

  // ============================================
  // PRODUCT HANDLERS
  // ============================================

  // Open view dialog
  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setViewDialogOpen(true);
  };

  // Open edit dialog
  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || '',
      sku: product.sku || '',
      price: (product.price_cents / 100).toFixed(2),
      compareAtPrice: product.compare_at_price_cents
        ? (product.compare_at_price_cents / 100).toFixed(2)
        : '',
      stockQuantity: product.stock_quantity.toString(),
      category: product.category || '',
      categoryId: product.category_id || '',
      isActive: product.is_active,
    });
    setEditDialogOpen(true);
  };

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[äÄ]/g, 'ae')
      .replace(/[öÖ]/g, 'oe')
      .replace(/[üÜ]/g, 'ue')
      .replace(/[ß]/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  // Reset form
  const resetProductForm = () => {
    setProductForm({
      name: '',
      description: '',
      sku: '',
      price: '',
      compareAtPrice: '',
      stockQuantity: '0',
      category: '',
      categoryId: '',
      isActive: true,
    });
  };

  // Create product handler
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productForm.name.trim()) {
      toast.error('Bitte geben Sie einen Produktnamen ein');
      return;
    }

    if (!productForm.price || parseFloat(productForm.price) <= 0) {
      toast.error('Bitte geben Sie einen gültigen Preis ein');
      return;
    }

    setIsSaving(true);

    try {
      const priceCents = Math.round(parseFloat(productForm.price) * 100);
      const compareAtPriceCents = productForm.compareAtPrice
        ? Math.round(parseFloat(productForm.compareAtPrice) * 100)
        : null;
      const stockQuantity = parseInt(productForm.stockQuantity) || 0;
      const slug = generateSlug(productForm.name);

      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: productForm.name.trim(),
          slug: slug + '-' + Date.now(),
          description: productForm.description.trim() || null,
          sku: productForm.sku.trim() || null,
          price_cents: priceCents,
          compare_at_price_cents: compareAtPriceCents,
          stock_quantity: stockQuantity,
          is_active: productForm.isActive,
          category_id: productForm.categoryId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Fehler beim Erstellen des Produkts');
      }

      toast.success('Produkt erfolgreich erstellt');
      setCreateDialogOpen(false);
      resetProductForm();
      router.refresh();
    } catch (error) {
      console.error('Error creating product:', error);
      toast.error('Fehler beim Erstellen des Produkts');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (search) {
      params.set('search', search);
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    router.push(`/admin/produkte?${params.toString()}`);
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    const params = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      params.set('category', value);
    } else {
      params.delete('category');
    }
    params.set('page', '1');
    router.push(`/admin/produkte?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    router.push(`/admin/produkte?${params.toString()}`);
  };

  const handleDeleteClick = (product: Product) => {
    setSelectedProduct(product);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedProduct) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/products/${selectedProduct.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Fehler beim Löschen des Produkts');
      }

      toast.success('Produkt erfolgreich gelöscht');
      setDeleteDialogOpen(false);
      setSelectedProduct(null);
      router.refresh();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Fehler beim Löschen des Produkts');
    } finally {
      setIsDeleting(false);
    }
  };

  // Update product handler
  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingProduct) return;

    if (!productForm.name.trim()) {
      toast.error('Bitte geben Sie einen Produktnamen ein');
      return;
    }

    if (!productForm.price || parseFloat(productForm.price) <= 0) {
      toast.error('Bitte geben Sie einen gültigen Preis ein');
      return;
    }

    setIsSaving(true);

    try {
      const priceCents = Math.round(parseFloat(productForm.price) * 100);
      const compareAtPriceCents = productForm.compareAtPrice
        ? Math.round(parseFloat(productForm.compareAtPrice) * 100)
        : null;
      const stockQuantity = parseInt(productForm.stockQuantity) || 0;

      const res = await fetch(`/api/admin/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: productForm.name.trim(),
          description: productForm.description.trim() || null,
          sku: productForm.sku.trim() || null,
          price_cents: priceCents,
          compare_at_price_cents: compareAtPriceCents,
          stock_quantity: stockQuantity,
          is_active: productForm.isActive,
          category_id: productForm.categoryId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Fehler beim Aktualisieren des Produkts');
      }

      toast.success('Produkt erfolgreich aktualisiert');
      setEditDialogOpen(false);
      setEditingProduct(null);
      resetProductForm();
      router.refresh();
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Fehler beim Aktualisieren des Produkts');
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // Category select dropdown for product forms
  // ============================================

  const CategorySelect = ({ id, value, onChange }: { id: string; value: string; onChange: (val: string) => void }) => (
    <div className="space-y-2">
      <Label htmlFor={id}>Kategorie</Label>
      <Select value={value || 'none'} onValueChange={(val) => onChange(val === 'none' ? '' : val)}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Keine Kategorie" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Keine Kategorie</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {total} Produkte insgesamt
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Suchen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-48"
              />
            </div>
            <Button type="submit" variant="secondary">
              Suchen
            </Button>
          </form>
          {categories.length > 0 && (
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kategorien</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={openCategoriesManageDialog}>
            <FolderOpen className="h-4 w-4 mr-2" />
            Kategorien
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Neues Produkt
          </Button>
        </div>
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Bild</TableHead>
                <TableHead>Produkt</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead className="text-right">Preis</TableHead>
                <TableHead className="text-center">Bestand</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[90px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        Keine Produkte gefunden
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="h-10 w-10 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                        {product.image_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        {product.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.sku || '-'}
                    </TableCell>
                    <TableCell>
                      {product.category && (
                        <Badge variant="secondary">{product.category}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <p className="font-medium">
                          {formatCurrency(product.price_cents)}
                        </p>
                        {product.compare_at_price_cents && (
                          <p className="text-xs text-muted-foreground line-through">
                            {formatCurrency(product.compare_at_price_cents)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          product.stock_quantity <= 0
                            ? 'destructive'
                            : product.stock_quantity <= 5
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {product.stock_quantity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.is_active ? 'default' : 'outline'}>
                        {product.is_active ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Bilder"
                          onClick={() => openImagesDialog(product)}
                          className={product.image_url ? 'text-primary' : ''}
                        >
                          <ImageIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Varianten"
                          onClick={() => openVariantsDialog(product)}
                          className={product.variant_count > 0 ? 'text-primary' : ''}
                        >
                          <Layers className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewProduct(product)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Anzeigen
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Bearbeiten
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(product)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Seite {page} von {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Produkt löschen</DialogTitle>
            <DialogDescription>
              Sind Sie sicher, dass Sie &quot;{selectedProduct?.name}&quot;
              löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Lösche...
                </>
              ) : (
                'Löschen'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Product Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Produktdetails</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              {/* Product Image */}
              <div className="flex justify-center">
                <div className="h-32 w-32 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                  {selectedProduct.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={selectedProduct.image_url}
                      alt={selectedProduct.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Product Info */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedProduct.name}</p>
                </div>

                {selectedProduct.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Beschreibung</p>
                    <p>{selectedProduct.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Preis</p>
                    <p className="font-medium">{formatCurrency(selectedProduct.price_cents)}</p>
                  </div>
                  {selectedProduct.compare_at_price_cents && (
                    <div>
                      <p className="text-sm text-muted-foreground">Streichpreis</p>
                      <p className="line-through text-muted-foreground">
                        {formatCurrency(selectedProduct.compare_at_price_cents)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Artikelnummer</p>
                    <p>{selectedProduct.sku || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Lagerbestand</p>
                    <p>{selectedProduct.stock_quantity}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Kategorie</p>
                    <p>{selectedProduct.category || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={selectedProduct.is_active ? 'default' : 'outline'}>
                      {selectedProduct.is_active ? 'Aktiv' : 'Inaktiv'}
                    </Badge>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                  Schliessen
                </Button>
                <Button onClick={() => {
                  setViewDialogOpen(false);
                  handleEditProduct(selectedProduct);
                }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Bearbeiten
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) {
          setEditingProduct(null);
          resetProductForm();
        }
      }}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Produkt bearbeiten</DialogTitle>
            <DialogDescription>
              Aktualisieren Sie die Produktinformationen.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateProduct}>
            <div className="space-y-4 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="edit-name">Produktname *</Label>
                <Input
                  id="edit-name"
                  value={productForm.name}
                  onChange={(e) =>
                    setProductForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="z.B. Shampoo Professional"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="edit-description">Beschreibung</Label>
                <Textarea
                  id="edit-description"
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Produktbeschreibung..."
                  rows={3}
                />
              </div>

              {/* Category */}
              <CategorySelect
                id="edit-category"
                value={productForm.categoryId}
                onChange={(val) => setProductForm((prev) => ({ ...prev, categoryId: val }))}
              />

              {/* Price and Compare At Price */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-price">Preis (CHF) *</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.price}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, price: e.target.value }))
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-compareAtPrice">Streichpreis (CHF)</Label>
                  <Input
                    id="edit-compareAtPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.compareAtPrice}
                    onChange={(e) =>
                      setProductForm((prev) => ({
                        ...prev,
                        compareAtPrice: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* SKU and Stock */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-sku">Artikelnummer (SKU)</Label>
                  <Input
                    id="edit-sku"
                    value={productForm.sku}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, sku: e.target.value }))
                    }
                    placeholder="z.B. SHP-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-stockQuantity">Lagerbestand</Label>
                  <Input
                    id="edit-stockQuantity"
                    type="number"
                    min="0"
                    value={productForm.stockQuantity}
                    onChange={(e) =>
                      setProductForm((prev) => ({
                        ...prev,
                        stockQuantity: e.target.value,
                      }))
                    }
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Active Switch */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label>Produkt aktiv</Label>
                  <p className="text-sm text-muted-foreground">
                    Aktive Produkte sind im Shop sichtbar
                  </p>
                </div>
                <Switch
                  checked={productForm.isActive}
                  onCheckedChange={(checked) =>
                    setProductForm((prev) => ({ ...prev, isActive: checked }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setEditingProduct(null);
                  resetProductForm();
                }}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Speichere...
                  </>
                ) : (
                  'Speichern'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Product Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Neues Produkt erstellen</DialogTitle>
            <DialogDescription>
              Fügen Sie ein neues Produkt zu Ihrem Sortiment hinzu.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateProduct}>
            <div className="space-y-4 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Produktname *</Label>
                <Input
                  id="name"
                  value={productForm.name}
                  onChange={(e) =>
                    setProductForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="z.B. Shampoo Professional"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea
                  id="description"
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Produktbeschreibung..."
                  rows={3}
                />
              </div>

              {/* Category */}
              <CategorySelect
                id="create-category"
                value={productForm.categoryId}
                onChange={(val) => setProductForm((prev) => ({ ...prev, categoryId: val }))}
              />

              {/* Price and Compare At Price */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Preis (CHF) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.price}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, price: e.target.value }))
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compareAtPrice">Streichpreis (CHF)</Label>
                  <Input
                    id="compareAtPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.compareAtPrice}
                    onChange={(e) =>
                      setProductForm((prev) => ({
                        ...prev,
                        compareAtPrice: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* SKU and Stock */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">Artikelnummer (SKU)</Label>
                  <Input
                    id="sku"
                    value={productForm.sku}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, sku: e.target.value }))
                    }
                    placeholder="z.B. SHP-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stockQuantity">Lagerbestand</Label>
                  <Input
                    id="stockQuantity"
                    type="number"
                    min="0"
                    value={productForm.stockQuantity}
                    onChange={(e) =>
                      setProductForm((prev) => ({
                        ...prev,
                        stockQuantity: e.target.value,
                      }))
                    }
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Active Switch */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label>Produkt aktiv</Label>
                  <p className="text-sm text-muted-foreground">
                    Aktive Produkte sind im Shop sichtbar
                  </p>
                </div>
                <Switch
                  checked={productForm.isActive}
                  onCheckedChange={(checked) =>
                    setProductForm((prev) => ({ ...prev, isActive: checked }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  resetProductForm();
                }}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Erstelle...
                  </>
                ) : (
                  'Produkt erstellen'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* Categories Management Dialog */}
      {/* ============================================ */}
      <Dialog open={categoriesManageOpen} onOpenChange={setCategoriesManageOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Produktkategorien verwalten</DialogTitle>
            <DialogDescription>
              Erstellen, bearbeiten und sortieren Sie Ihre Produktkategorien.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {categoriesList.length === 0 ? (
              <div className="text-center py-6">
                <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground text-sm">Keine Kategorien vorhanden</p>
              </div>
            ) : (
              <div className="space-y-2">
                {categoriesList.map((cat, index) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{cat.name}</p>
                      {cat.description && (
                        <p className="text-xs text-muted-foreground truncate">{cat.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={index === 0}
                        onClick={() => handleMoveCategory(index, 'up')}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={index === categoriesList.length - 1}
                        onClick={() => handleMoveCategory(index, 'down')}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditCategoryDialog(cat)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteCategoryDialog(cat)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoriesManageOpen(false)}>
              Schliessen
            </Button>
            <Button onClick={openAddCategoryDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Neue Kategorie
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Create/Edit Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? 'Aktualisieren Sie die Kategorieinformationen.'
                : 'Erstellen Sie eine neue Produktkategorie.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCategory}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cat-name">Name *</Label>
                <Input
                  id="cat-name"
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="z.B. Haarpflege"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-description">Beschreibung</Label>
                <Textarea
                  id="cat-description"
                  value={categoryForm.description}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Optionale Beschreibung..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Speichere...
                  </>
                ) : (
                  'Speichern'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Delete AlertDialog */}
      <AlertDialog open={deleteCategoryDialogOpen} onOpenChange={setDeleteCategoryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kategorie löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie die Kategorie &quot;{categoryToDelete?.name}&quot;
              löschen möchten? Produkte in dieser Kategorie werden keiner Kategorie mehr zugeordnet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Lösche...
                </>
              ) : (
                'Löschen'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============================================ */}
      {/* Variants Management Dialog */}
      {/* ============================================ */}
      <Dialog open={variantsManageOpen} onOpenChange={setVariantsManageOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Varianten - {variantProductName}</DialogTitle>
            <DialogDescription>
              Verwalten Sie die Varianten dieses Produkts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isLoadingVariants ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : variants.length === 0 ? (
              <div className="text-center py-6">
                <Layers className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground text-sm">Keine Varianten vorhanden</p>
              </div>
            ) : (
              <div className="space-y-2">
                {variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="h-12 w-12 rounded-md overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                      {variant.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={variant.image_url}
                          alt={variant.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{variant.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatCurrency(variant.price_cents)}</span>
                        {variant.sku && <span>SKU: {variant.sku}</span>}
                        <span>Bestand: {variant.stock_quantity}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditVariantDialog(variant)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteVariant(variant)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVariantsManageOpen(false)}>
              Schliessen
            </Button>
            <Button onClick={openAddVariantDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Neue Variante
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variant Create/Edit Dialog */}
      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>
              {editingVariant ? 'Variante bearbeiten' : 'Neue Variante'}
            </DialogTitle>
            <DialogDescription>
              {editingVariant
                ? 'Aktualisieren Sie die Variante.'
                : 'Erstellen Sie eine neue Produktvariante.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveVariant}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="var-name">Name *</Label>
                <Input
                  id="var-name"
                  value={variantForm.name}
                  onChange={(e) =>
                    setVariantForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="z.B. 250ml"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="var-sku">Artikelnummer (SKU)</Label>
                <Input
                  id="var-sku"
                  value={variantForm.sku}
                  onChange={(e) =>
                    setVariantForm((prev) => ({ ...prev, sku: e.target.value }))
                  }
                  placeholder="z.B. SHP-001-250"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="var-price">Preis (CHF)</Label>
                  <Input
                    id="var-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={variantForm.price}
                    onChange={(e) =>
                      setVariantForm((prev) => ({ ...prev, price: e.target.value }))
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="var-compareAtPrice">Streichpreis (CHF)</Label>
                  <Input
                    id="var-compareAtPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={variantForm.compareAtPrice}
                    onChange={(e) =>
                      setVariantForm((prev) => ({
                        ...prev,
                        compareAtPrice: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="var-stockQuantity">Lagerbestand</Label>
                <Input
                  id="var-stockQuantity"
                  type="number"
                  min="0"
                  value={variantForm.stockQuantity}
                  onChange={(e) =>
                    setVariantForm((prev) => ({
                      ...prev,
                      stockQuantity: e.target.value,
                    }))
                  }
                  placeholder="0"
                />
              </div>

              {/* Variant Image */}
              <div className="space-y-2">
                <Label>Variantenbild</Label>
                <div className="flex items-center gap-4">
                  {variantForm.imageUrl ? (
                    <div className="relative h-20 w-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={variantForm.imageUrl}
                        alt="Variantenbild"
                        className="h-full w-full object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => setVariantForm((prev) => ({ ...prev, imageUrl: '' }))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-20 w-20 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/50 flex-shrink-0">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="variant-image-input"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleVariantImageUpload(file);
                        e.target.value = '';
                      }}
                      disabled={isUploadingVariantImage}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('variant-image-input')?.click()}
                      disabled={isUploadingVariantImage}
                    >
                      {isUploadingVariantImage ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Hochladen...
                        </>
                      ) : (
                        <>
                          <ImagePlus className="h-4 w-4 mr-2" />
                          Bild wählen
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVariantDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Speichere...
                  </>
                ) : (
                  'Speichern'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* Product Images Management Dialog */}
      {/* ============================================ */}
      <Dialog open={imagesManageOpen} onOpenChange={setImagesManageOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Produktbilder - {imageProductName}</DialogTitle>
            <DialogDescription>
              Laden Sie Bilder hoch und wählen Sie das Hauptbild aus.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isLoadingImages ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ProductImageUploader
                productId={imageProductId}
                images={productImages}
                onImagesChange={(newImages) => {
                  setProductImages(newImages);
                  router.refresh();
                }}
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImagesManageOpen(false)}>
              Schliessen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
