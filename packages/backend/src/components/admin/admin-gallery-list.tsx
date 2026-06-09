'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  FolderPlus,
  Home,
  ImageIcon,
  Images,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

interface GalleryCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface GalleryImage {
  id: string;
  url: string;
  alt_text: string | null;
  title: string | null;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  storage_path: string | null;
  sort_order: number;
  is_active: boolean;
  show_on_homepage: boolean;
  created_at: string;
  updated_at: string;
}

interface AdminGalleryListProps {
  salonId: string;
  categories: GalleryCategory[];
  images: GalleryImage[];
}

interface CategoryForm {
  name: string;
  description: string;
  isActive: boolean;
}

interface ImageForm {
  url: string;
  title: string;
  description: string;
  altText: string;
  categoryId: string;
  isActive: boolean;
  showOnHomepage: boolean;
}

type ImageStatusFilter = 'all' | 'active' | 'inactive' | 'homepage';

const NO_CATEGORY_VALUE = '__none__';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function compareSort<T extends { sort_order?: number | null; created_at?: string | null }>(
  a: T,
  b: T
) {
  const sortDiff = (a.sort_order || 0) - (b.sort_order || 0);
  if (sortDiff !== 0) return sortDiff;
  return (a.created_at || '').localeCompare(b.created_at || '');
}

function isLocalImage(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1') || url.startsWith('blob:');
}

function getImageAlt(image: GalleryImage): string {
  return image.alt_text || image.title || 'Galerie Bild';
}

function filenameToText(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function sendGalleryRequest(
  method: 'POST' | 'PUT' | 'DELETE',
  payload: Record<string, unknown>
) {
  const response = await fetch('/api/admin/gallery', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.error) {
    throw new Error(result.error || 'Die Galerie-Aktion konnte nicht ausgeführt werden.');
  }

  return result;
}

export function AdminGalleryList({
  salonId,
  categories,
  images,
}: AdminGalleryListProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ImageStatusFilter>('all');

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [deleteCategoryDialogOpen, setDeleteCategoryDialogOpen] = useState(false);
  const [deleteImageDialogOpen, setDeleteImageDialogOpen] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<GalleryCategory | null>(null);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [targetCategoryId, setTargetCategoryId] = useState<string | null>(null);

  const [categoryForm, setCategoryForm] = useState<CategoryForm>({
    name: '',
    description: '',
    isActive: true,
  });
  const [imageForm, setImageForm] = useState<ImageForm>({
    url: '',
    title: '',
    description: '',
    altText: '',
    categoryId: NO_CATEGORY_VALUE,
    isActive: true,
    showOnHomepage: true,
  });

  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const sortedCategories = useMemo(
    () => [...categories].sort(compareSort),
    [categories]
  );

  const sortedImages = useMemo(
    () => [...images].sort(compareSort),
    [images]
  );

  const stats = useMemo(() => {
    const activeImages = images.filter((image) => image.is_active);
    return {
      categories: categories.length,
      images: images.length,
      active: activeImages.length,
      homepage: activeImages.filter((image) => image.show_on_homepage).length,
      inactive: images.filter((image) => !image.is_active).length,
    };
  }, [categories, images]);

  const matchesFilter = (image: GalleryImage) => {
    const needle = query.trim().toLowerCase();
    const searchable = [
      image.title,
      image.description,
      image.alt_text,
      image.category_name,
      image.url,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (needle && !searchable.includes(needle)) return false;
    if (statusFilter === 'active') return image.is_active;
    if (statusFilter === 'inactive') return !image.is_active;
    if (statusFilter === 'homepage') return image.is_active && image.show_on_homepage;
    return true;
  };

  const getImagesForCategory = (categoryId: string | null, filtered = true) => {
    return sortedImages.filter((image) => {
      const inCategory = categoryId ? image.category_id === categoryId : !image.category_id;
      return inCategory && (!filtered || matchesFilter(image));
    });
  };

  const refreshAfterMutation = () => {
    router.refresh();
  };

  const resetCategoryForm = () => {
    setCategoryForm({ name: '', description: '', isActive: true });
    setSelectedCategory(null);
    setFormError(null);
  };

  const resetImageForm = () => {
    setImageForm({
      url: '',
      title: '',
      description: '',
      altText: '',
      categoryId: targetCategoryId || NO_CATEGORY_VALUE,
      isActive: true,
      showOnHomepage: true,
    });
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadMode('file');
    setSelectedImage(null);
    setFormError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openCreateCategoryDialog = () => {
    resetCategoryForm();
    setCategoryDialogOpen(true);
  };

  const openEditCategoryDialog = (category: GalleryCategory) => {
    setSelectedCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      isActive: category.is_active,
    });
    setFormError(null);
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!categoryForm.name.trim()) {
      setFormError('Bitte geben Sie einen Kategorienamen ein.');
      return;
    }

    setIsSaving(true);
    try {
      if (selectedCategory) {
        await sendGalleryRequest('PUT', {
          resource: 'category',
          id: selectedCategory.id,
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim() || null,
          is_active: categoryForm.isActive,
        });
        toast.success('Kategorie gespeichert');
      } else {
        await sendGalleryRequest('POST', {
          resource: 'category',
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim() || null,
          is_active: categoryForm.isActive,
        });
        toast.success('Kategorie erstellt');
      }

      setCategoryDialogOpen(false);
      resetCategoryForm();
      refreshAfterMutation();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kategorie konnte nicht gespeichert werden.';
      setFormError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveCategory = async (category: GalleryCategory, direction: 'up' | 'down') => {
    const orderedIds = sortedCategories.map((item) => item.id);
    const currentIndex = orderedIds.indexOf(category.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedIds.length) return;

    const nextIds = [...orderedIds];
    [nextIds[currentIndex], nextIds[targetIndex]] = [nextIds[targetIndex], nextIds[currentIndex]];

    setIsSaving(true);
    try {
      await sendGalleryRequest('PUT', {
        resource: 'category-order',
        category_ids: nextIds,
      });
      toast.success('Kategorie-Reihenfolge gespeichert');
      refreshAfterMutation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Reihenfolge konnte nicht gespeichert werden.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategoryConfirm = async () => {
    if (!selectedCategory) return;

    setIsDeleting(true);
    try {
      await sendGalleryRequest('DELETE', {
        resource: 'category',
        id: selectedCategory.id,
      });
      toast.success('Kategorie gelöscht');
      setDeleteCategoryDialogOpen(false);
      setSelectedCategory(null);
      refreshAfterMutation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kategorie konnte nicht gelöscht werden.');
    } finally {
      setIsDeleting(false);
    }
  };

  const openCreateImageDialog = (categoryId: string | null) => {
    setTargetCategoryId(categoryId);
    setSelectedImage(null);
    setImageForm({
      url: '',
      title: '',
      description: '',
      altText: '',
      categoryId: categoryId || NO_CATEGORY_VALUE,
      isActive: true,
      showOnHomepage: true,
    });
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadMode('file');
    setFormError(null);
    setImageDialogOpen(true);
  };

  const openEditImageDialog = (image: GalleryImage) => {
    setSelectedImage(image);
    setTargetCategoryId(image.category_id);
    setUploadMode(image.storage_path ? 'file' : 'url');
    setSelectedFile(null);
    setPreviewUrl(image.url);
    setImageForm({
      url: image.url,
      title: image.title || '',
      description: image.description || '',
      altText: image.alt_text || '',
      categoryId: image.category_id || NO_CATEGORY_VALUE,
      isActive: image.is_active,
      showOnHomepage: image.show_on_homepage,
    });
    setFormError(null);
    setImageDialogOpen(true);
  };

  const handleFileSelect = (file: File | null) => {
    setFormError(null);
    if (!file) return;

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setFormError('Erlaubt sind nur JPG, PNG und WebP.');
      toast.error('Ungültiger Dateityp');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFormError('Die Datei ist zu gross. Maximal erlaubt sind 5 MB.');
      toast.error('Datei zu gross');
      return;
    }

    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));

    const fallbackText = filenameToText(file.name);
    setImageForm((prev) => ({
      ...prev,
      title: prev.title || fallbackText,
      altText: prev.altText || fallbackText,
    }));
  };

  const validateImageForm = () => {
    if (!imageForm.altText.trim()) {
      return 'Bitte setzen Sie einen Alt-Text. Das ist wichtig für Barrierefreiheit und SEO.';
    }

    if (!selectedImage && uploadMode === 'file' && !selectedFile) {
      return 'Bitte wählen Sie ein Bild aus.';
    }

    if (uploadMode === 'url') {
      try {
        const url = new URL(imageForm.url);
        if (url.protocol !== 'https:') {
          return 'Externe Bild-URLs müssen HTTPS verwenden.';
        }
      } catch {
        return 'Bitte geben Sie eine gültige Bild-URL ein.';
      }
    }

    return null;
  };

  const handleSaveImage = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const validationError = validateImageForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const categoryId = imageForm.categoryId === NO_CATEGORY_VALUE ? null : imageForm.categoryId;

    setIsSaving(true);
    try {
      if (selectedImage) {
        await sendGalleryRequest('PUT', {
          resource: 'image',
          id: selectedImage.id,
          title: imageForm.title.trim() || null,
          description: imageForm.description.trim() || null,
          alt_text: imageForm.altText.trim(),
          category_id: categoryId,
          is_active: imageForm.isActive,
          show_on_homepage: imageForm.showOnHomepage,
        });
        toast.success('Bild gespeichert');
      } else if (uploadMode === 'file' && selectedFile) {
        const categoryImages = getImagesForCategory(categoryId, false);
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('bucket', 'gallery');
        formData.append('path', `${salonId}/${Date.now()}-${selectedFile.name}`);
        formData.append('dbInsert', JSON.stringify({
          table: 'gallery_images',
          data: {
            title: imageForm.title.trim() || null,
            description: imageForm.description.trim() || null,
            alt_text: imageForm.altText.trim(),
            category_id: categoryId,
            is_active: imageForm.isActive,
            show_on_homepage: imageForm.showOnHomepage,
            sort_order: categoryImages.length + 1,
          },
        }));

        const response = await fetch('/api/admin/upload', {
          method: 'POST',
          body: formData,
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.error) {
          throw new Error(result.error || 'Upload fehlgeschlagen.');
        }
        toast.success('Bild hochgeladen');
      } else {
        const categoryImages = getImagesForCategory(categoryId, false);
        await sendGalleryRequest('POST', {
          resource: 'image',
          url: imageForm.url.trim(),
          storage_path: null,
          title: imageForm.title.trim() || null,
          description: imageForm.description.trim() || null,
          alt_text: imageForm.altText.trim(),
          category_id: categoryId,
          is_active: imageForm.isActive,
          show_on_homepage: imageForm.showOnHomepage,
          sort_order: categoryImages.length + 1,
        });
        toast.success('Bild hinzugefügt');
      }

      setImageDialogOpen(false);
      resetImageForm();
      refreshAfterMutation();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bild konnte nicht gespeichert werden.';
      setFormError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleImageActive = async (image: GalleryImage) => {
    setIsSaving(true);
    try {
      await sendGalleryRequest('PUT', {
        resource: 'image',
        id: image.id,
        title: image.title,
        description: image.description,
        alt_text: image.alt_text,
        category_id: image.category_id,
        is_active: !image.is_active,
        show_on_homepage: image.show_on_homepage,
      });
      toast.success(image.is_active ? 'Bild deaktiviert' : 'Bild aktiviert');
      refreshAfterMutation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Status konnte nicht geändert werden.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveImage = async (image: GalleryImage, direction: 'up' | 'down') => {
    const categoryId = image.category_id || null;
    const categoryImages = getImagesForCategory(categoryId, false);
    const orderedIds = categoryImages.map((item) => item.id);
    const currentIndex = orderedIds.indexOf(image.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedIds.length) return;

    const nextIds = [...orderedIds];
    [nextIds[currentIndex], nextIds[targetIndex]] = [nextIds[targetIndex], nextIds[currentIndex]];

    setIsSaving(true);
    try {
      await sendGalleryRequest('PUT', {
        resource: 'image-order',
        category_id: categoryId,
        image_ids: nextIds,
      });
      toast.success('Bild-Reihenfolge gespeichert');
      refreshAfterMutation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Reihenfolge konnte nicht gespeichert werden.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteImageConfirm = async () => {
    if (!selectedImage) return;

    setIsDeleting(true);
    try {
      await sendGalleryRequest('DELETE', {
        resource: 'image',
        id: selectedImage.id,
      });
      toast.success('Bild gelöscht');
      setDeleteImageDialogOpen(false);
      setSelectedImage(null);
      refreshAfterMutation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bild konnte nicht gelöscht werden.');
    } finally {
      setIsDeleting(false);
    }
  };

  const renderImageTile = (image: GalleryImage, index: number, categoryImages: GalleryImage[]) => (
    <div
      key={image.id}
      className="group overflow-hidden rounded-md border bg-background"
    >
      <div className="relative aspect-[4/5] bg-muted">
        <Image
          src={image.url}
          alt={getImageAlt(image)}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className="object-cover"
          unoptimized={isLocalImage(image.url)}
        />

        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {image.is_active ? (
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Aktiv</Badge>
          ) : (
            <Badge variant="secondary">Inaktiv</Badge>
          )}
          {image.show_on_homepage && image.is_active && (
            <Badge className="bg-primary text-primary-foreground hover:bg-primary">
              Homepage
            </Badge>
          )}
        </div>

        <div className="absolute right-2 top-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="secondary" className="h-8 w-8 shadow">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Bildaktionen</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEditImageDialog(image)}>
                <Pencil className="mr-2 h-4 w-4" />
                Bearbeiten
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleImageActive(image)}>
                {image.is_active ? (
                  <EyeOff className="mr-2 h-4 w-4" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                {image.is_active ? 'Deaktivieren' : 'Aktivieren'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleMoveImage(image, 'up')}
                disabled={index === 0}
              >
                <ArrowUp className="mr-2 h-4 w-4" />
                Nach oben
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleMoveImage(image, 'down')}
                disabled={index === categoryImages.length - 1}
              >
                <ArrowDown className="mr-2 h-4 w-4" />
                Nach unten
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  setSelectedImage(image);
                  setDeleteImageDialogOpen(true);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-2 p-3">
        <div>
          <p className="line-clamp-1 text-sm font-medium">
            {image.title || 'Ohne Titel'}
          </p>
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {image.alt_text || 'Kein Alt-Text'}
          </p>
        </div>
        {image.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {image.description}
          </p>
        )}
      </div>
    </div>
  );

  const renderCategorySection = (category: GalleryCategory | null, categoryIndex: number) => {
    const categoryId = category?.id || null;
    const categoryImages = getImagesForCategory(categoryId);
    const allCategoryImages = getImagesForCategory(categoryId, false);
    const isUncategorized = !category;

    if (isUncategorized && allCategoryImages.length === 0 && images.length > 0) {
      return null;
    }

    return (
      <section key={categoryId || 'uncategorized'} className="rounded-lg border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">
                {isUncategorized ? 'Ohne Kategorie' : category.name}
              </h2>
              {!isUncategorized && !category.is_active && (
                <Badge variant="secondary">Kategorie inaktiv</Badge>
              )}
              <Badge variant="outline">{allCategoryImages.length} Bilder</Badge>
            </div>
            {!isUncategorized && category.description && (
              <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {!isUncategorized && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleMoveCategory(category, 'up')}
                  disabled={categoryIndex === 0 || isSaving}
                >
                  <ArrowUp className="h-4 w-4" />
                  <span className="sr-only">Kategorie nach oben</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleMoveCategory(category, 'down')}
                  disabled={categoryIndex === sortedCategories.length - 1 || isSaving}
                >
                  <ArrowDown className="h-4 w-4" />
                  <span className="sr-only">Kategorie nach unten</span>
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" onClick={() => openCreateImageDialog(categoryId)}>
              <Plus className="mr-2 h-4 w-4" />
              Bild
            </Button>
            {!isUncategorized && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Kategorieaktionen</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEditCategoryDialog(category)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Bearbeiten
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => {
                      setSelectedCategory(category);
                      setDeleteCategoryDialogOpen(true);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Löschen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="p-4">
          {categoryImages.length === 0 ? (
            <button
              type="button"
              className="flex min-h-40 w-full flex-col items-center justify-center rounded-md border border-dashed p-8 text-center transition-colors hover:border-primary hover:bg-muted/30"
              onClick={() => openCreateImageDialog(categoryId)}
            >
              <ImageIcon className="mb-3 h-9 w-9 text-muted-foreground" />
              <span className="text-sm font-medium">Bild hinzufügen</span>
              <span className="mt-1 max-w-sm text-xs text-muted-foreground">
                {query || statusFilter !== 'all'
                  ? 'Keine Bilder passen zu Suche oder Filter.'
                  : 'Laden Sie ein neues Bild hoch und veröffentlichen Sie es optional auf der Homepage.'}
              </span>
            </button>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {categoryImages.map((image, imageIndex) =>
                renderImageTile(image, imageIndex, categoryImages)
              )}
            </div>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-primary">
            Website-Inhalte
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Galerie</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Verwalten Sie Salonbilder, Referenzen und Impressionen. Aktive Bilder erscheinen
            auf der öffentlichen Galerie, mit Homepage-Markierung zusätzlich auf der Startseite.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/galerie" target="_blank" rel="noopener noreferrer">
              <Eye className="mr-2 h-4 w-4" />
              Galerie ansehen
            </Link>
          </Button>
          <Button onClick={openCreateCategoryDialog}>
            <FolderPlus className="mr-2 h-4 w-4" />
            Neue Kategorie
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Images className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Bilder</p>
              <p className="text-2xl font-semibold">{stats.images}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Eye className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-sm text-muted-foreground">Aktiv öffentlich</p>
              <p className="text-2xl font-semibold">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Home className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Homepage</p>
              <p className="text-2xl font-semibold">{stats.homepage}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <FolderPlus className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Kategorien</p>
              <p className="text-2xl font-semibold">{stats.categories}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Titel, Alt-Text, Beschreibung oder Kategorie suchen..."
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'active', 'homepage', 'inactive'] as ImageStatusFilter[]).map((filter) => (
              <Button
                key={filter}
                variant={statusFilter === filter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(filter)}
              >
                {filter === 'all' && 'Alle'}
                {filter === 'active' && 'Aktiv'}
                {filter === 'homepage' && 'Homepage'}
                {filter === 'inactive' && 'Inaktiv'}
              </Button>
            ))}
            {(query || statusFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery('');
                  setStatusFilter('all');
                }}
              >
                <X className="mr-2 h-4 w-4" />
                Zurücksetzen
              </Button>
            )}
          </div>
        </div>
      </div>

      {categories.length === 0 && images.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center">
            <ImageIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
            <h2 className="mb-2 text-lg font-semibold">Noch keine Galerieinhalte</h2>
            <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">
              Erstellen Sie eine Kategorie oder laden Sie direkt ein Bild hoch. Aktive Bilder
              werden nach dem Speichern automatisch auf der Website aktualisiert.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={openCreateCategoryDialog}>
                <FolderPlus className="mr-2 h-4 w-4" />
                Erste Kategorie erstellen
              </Button>
              <Button variant="outline" onClick={() => openCreateImageDialog(null)}>
                <Upload className="mr-2 h-4 w-4" />
                Bild hochladen
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {sortedCategories.map((category, categoryIndex) =>
            renderCategorySection(category, categoryIndex)
          )}
          {renderCategorySection(null, sortedCategories.length)}
        </div>
      )}

      <Dialog
        open={categoryDialogOpen}
        onOpenChange={(open) => {
          setCategoryDialogOpen(open);
          if (!open) resetCategoryForm();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {selectedCategory ? 'Kategorie bearbeiten' : 'Kategorie erstellen'}
            </DialogTitle>
            <DialogDescription>
              Kategorien strukturieren die öffentliche Galerie und bestimmen die Reihenfolge der Bereiche.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveCategory} className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="gallery-category-name">Name *</Label>
              <Input
                id="gallery-category-name"
                value={categoryForm.name}
                onChange={(event) =>
                  setCategoryForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="z.B. Colorationen"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gallery-category-description">Beschreibung</Label>
              <Textarea
                id="gallery-category-description"
                value={categoryForm.description}
                onChange={(event) =>
                  setCategoryForm((prev) => ({ ...prev, description: event.target.value }))
                }
                rows={3}
                placeholder="Kurze Beschreibung für die öffentliche Galerie..."
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Kategorie aktiv</Label>
                <p className="text-xs text-muted-foreground">
                  Inaktive Kategorien und deren Bilder erscheinen nicht öffentlich.
                </p>
              </div>
              <Switch
                checked={categoryForm.isActive}
                onCheckedChange={(checked) =>
                  setCategoryForm((prev) => ({ ...prev, isActive: checked }))
                }
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Speichern
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={imageDialogOpen}
        onOpenChange={(open) => {
          setImageDialogOpen(open);
          if (!open) resetImageForm();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>{selectedImage ? 'Bild bearbeiten' : 'Bild hinzufügen'}</DialogTitle>
            <DialogDescription>
              Bilder werden nach dem Speichern im Admin, auf der Galerie-Seite und optional auf der Homepage aktualisiert.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveImage} className="space-y-5">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            {!selectedImage && (
              <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-1">
                <Button
                  type="button"
                  variant={uploadMode === 'file' ? 'default' : 'ghost'}
                  onClick={() => setUploadMode('file')}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Hochladen
                </Button>
                <Button
                  type="button"
                  variant={uploadMode === 'url' ? 'default' : 'ghost'}
                  onClick={() => setUploadMode('url')}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  HTTPS-URL
                </Button>
              </div>
            )}

            {(!selectedImage && uploadMode === 'file') || selectedImage?.storage_path ? (
              <div
                className="rounded-lg border border-dashed p-4 text-center transition-colors hover:border-primary"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleFileSelect(event.dataTransfer.files?.[0] || null);
                }}
              >
                {previewUrl ? (
                  <div className="relative mx-auto aspect-[4/3] max-h-72 overflow-hidden rounded-md bg-muted">
                    <Image
                      src={previewUrl}
                      alt="Vorschau"
                      fill
                      className="object-contain"
                      unoptimized={isLocalImage(previewUrl)}
                    />
                    {!selectedImage && (
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        className="absolute right-2 top-2 h-8 w-8"
                        onClick={() => {
                          if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
                          setPreviewUrl(null);
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex min-h-44 w-full flex-col items-center justify-center"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
                    <span className="font-medium">Bild auswählen oder hier ablegen</span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      JPG, PNG oder WebP, maximal 5 MB
                    </span>
                  </button>
                )}
                {!selectedImage && (
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => handleFileSelect(event.target.files?.[0] || null)}
                  />
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="gallery-image-url">HTTPS-Bild-URL *</Label>
                <Input
                  id="gallery-image-url"
                  type="url"
                  value={imageForm.url}
                  onChange={(event) =>
                    setImageForm((prev) => ({ ...prev, url: event.target.value }))
                  }
                  placeholder="https://example.com/bild.webp"
                />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gallery-image-title">Titel</Label>
                <Input
                  id="gallery-image-title"
                  value={imageForm.title}
                  onChange={(event) =>
                    setImageForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="z.B. Balayage in warmen Tönen"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gallery-image-alt">Alt-Text *</Label>
                <Input
                  id="gallery-image-alt"
                  value={imageForm.altText}
                  onChange={(event) =>
                    setImageForm((prev) => ({ ...prev, altText: event.target.value }))
                  }
                  placeholder="Beschreibt das Bild für Screenreader"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gallery-image-description">Beschreibung</Label>
              <Textarea
                id="gallery-image-description"
                value={imageForm.description}
                onChange={(event) =>
                  setImageForm((prev) => ({ ...prev, description: event.target.value }))
                }
                rows={3}
                placeholder="Optionale Beschreibung für öffentliche Hover-Infos..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Kategorie</Label>
                <Select
                  value={imageForm.categoryId}
                  onValueChange={(value) =>
                    setImageForm((prev) => ({ ...prev, categoryId: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Kategorie wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY_VALUE}>Ohne Kategorie</SelectItem>
                    {sortedCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Öffentliche Sichtbarkeit</Label>
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Bild aktiv</p>
                      <p className="text-xs text-muted-foreground">Erscheint auf /galerie</p>
                    </div>
                    <Switch
                      checked={imageForm.isActive}
                      onCheckedChange={(checked) =>
                        setImageForm((prev) => ({ ...prev, isActive: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Auf Homepage zeigen</p>
                      <p className="text-xs text-muted-foreground">Nur wenn Bild aktiv ist</p>
                    </div>
                    <Switch
                      checked={imageForm.showOnHomepage}
                      onCheckedChange={(checked) =>
                        setImageForm((prev) => ({ ...prev, showOnHomepage: checked }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setImageDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedImage ? 'Speichern' : 'Bild hinzufügen'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteCategoryDialogOpen} onOpenChange={setDeleteCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kategorie löschen</DialogTitle>
            <DialogDescription>
              Die Kategorie „{selectedCategory?.name}“ wird gelöscht. Zugeordnete Bilder bleiben erhalten
              und werden danach unter „Ohne Kategorie“ geführt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCategoryDialogOpen(false)} disabled={isDeleting}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDeleteCategoryConfirm} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteImageDialogOpen} onOpenChange={setDeleteImageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bild löschen</DialogTitle>
            <DialogDescription>
              Dieses Bild wird aus der Datenbank entfernt. Bei hochgeladenen Bildern wird auch die Storage-Datei gelöscht.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteImageDialogOpen(false)} disabled={isDeleting}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDeleteImageConfirm} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
