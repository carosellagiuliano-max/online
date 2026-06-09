'use client';

import { useState, useCallback, useRef } from 'react';
import {
  ImagePlus,
  Trash2,
  Star,
  GripVertical,
  Loader2,
  X,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface ProductImage {
  id: string;
  url: string;
  alt_text: string | null;
  is_primary: boolean;
  sort_order: number;
}

interface ProductImageUploaderProps {
  productId: string;
  images: ProductImage[];
  onImagesChange: (images: ProductImage[]) => void;
  disabled?: boolean;
}

// ============================================
// PRODUCT IMAGE UPLOADER
// ============================================

export function ProductImageUploader({
  productId,
  images,
  onImagesChange,
  disabled = false,
}: ProductImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============================================
  // UPLOAD HANDLER
  // ============================================

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || disabled) return;

      setIsUploading(true);
      const newImages: ProductImage[] = [];

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setUploadProgress(`Lade ${i + 1}/${files.length}...`);

          // Validate file type
          if (!file.type.startsWith('image/')) {
            toast.error(`${file.name} ist keine Bilddatei`);
            continue;
          }

          // Validate file size (5MB max)
          if (file.size > 5 * 1024 * 1024) {
            toast.error(`${file.name} ist zu gross (max 5MB)`);
            continue;
          }

          // Generate unique filename
          const timestamp = Date.now();
          const sanitizedName = file.name
            .toLowerCase()
            .replace(/[^a-z0-9.]/g, '-')
            .replace(/-+/g, '-');
          const path = `${productId}/${timestamp}-${sanitizedName}`;

          // Upload file
          const formData = new FormData();
          formData.append('file', file);
          formData.append('bucket', 'product-images');
          formData.append('path', path);

          const uploadRes = await fetch('/api/admin/upload', {
            method: 'POST',
            credentials: 'include',
            body: formData,
          });

          if (!uploadRes.ok) {
            const errorData = await uploadRes.json().catch(() => ({}));
            toast.error(errorData.error || `Fehler beim Hochladen von ${file.name}`);
            continue;
          }

          const uploadData = await uploadRes.json();

          // Add to product images
          const addRes = await fetch(`/api/admin/products/${productId}/images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              url: uploadData.url,
              alt_text: file.name.replace(/\.[^/.]+$/, ''),
              is_primary: images.length === 0 && newImages.length === 0,
            }),
          });

          if (!addRes.ok) {
            const errorData = await addRes.json().catch(() => ({}));
            toast.error(errorData.error || 'Fehler beim Speichern des Bildes');
            continue;
          }

          const addData = await addRes.json();
          newImages.push(addData.image);
        }

        if (newImages.length > 0) {
          onImagesChange([...images, ...newImages]);
          toast.success(`${newImages.length} Bild(er) hochgeladen`);
        }
      } catch (error) {
        console.error('Upload error:', error);
        toast.error('Fehler beim Hochladen');
      } finally {
        setIsUploading(false);
        setUploadProgress(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [productId, images, onImagesChange, disabled]
  );

  // ============================================
  // DELETE HANDLER
  // ============================================

  const handleDelete = useCallback(
    async (imageId: string) => {
      if (disabled) return;

      try {
        const res = await fetch(`/api/admin/products/${productId}/images?imageId=${imageId}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Fehler beim Löschen');
        }

        const updatedImages = images.filter((img) => img.id !== imageId);

        // If deleted image was primary and there are other images, set first as primary
        const deletedImage = images.find((img) => img.id === imageId);
        if (deletedImage?.is_primary && updatedImages.length > 0) {
          updatedImages[0].is_primary = true;
        }

        onImagesChange(updatedImages);
        toast.success('Bild gelöscht');
      } catch (error) {
        console.error('Delete error:', error);
        toast.error('Fehler beim Löschen');
      }
    },
    [productId, images, onImagesChange, disabled]
  );

  // ============================================
  // SET PRIMARY HANDLER
  // ============================================

  const handleSetPrimary = useCallback(
    async (imageId: string) => {
      if (disabled) return;

      try {
        const res = await fetch(`/api/admin/products/${productId}/images`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ imageId, is_primary: true }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Fehler beim Aktualisieren');
        }

        const updatedImages = images.map((img) => ({
          ...img,
          is_primary: img.id === imageId,
        }));

        onImagesChange(updatedImages);
        toast.success('Hauptbild gesetzt');
      } catch (error) {
        console.error('Set primary error:', error);
        toast.error('Fehler beim Setzen des Hauptbildes');
      }
    },
    [productId, images, onImagesChange, disabled]
  );

  // ============================================
  // DRAG AND DROP REORDERING
  // ============================================

  const handleDragStart = (index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (disabled) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = useCallback(async () => {
    if (draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newImages = [...images];
    const [draggedItem] = newImages.splice(draggedIndex, 1);
    newImages.splice(dragOverIndex, 0, draggedItem);

    // Update sort_order
    const reorderedImages = newImages.map((img, idx) => ({
      ...img,
      sort_order: idx,
    }));

    onImagesChange(reorderedImages);
    setDraggedIndex(null);
    setDragOverIndex(null);

    // Save to server
    try {
      await fetch(`/api/admin/products/${productId}/images`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ imageOrder: reorderedImages.map((img) => img.id) }),
      });
    } catch (error) {
      console.error('Reorder error:', error);
      toast.error('Fehler beim Sortieren');
    }
  }, [draggedIndex, dragOverIndex, images, productId, onImagesChange]);

  // ============================================
  // DROP ZONE
  // ============================================

  const handleDropZoneDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files);
      }
    },
    [handleFileSelect, disabled]
  );

  const handleDropZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
          disabled
            ? 'border-muted bg-muted/20 cursor-not-allowed'
            : 'border-muted-foreground/25 hover:border-primary/50 cursor-pointer'
        )}
        onClick={() => !disabled && fileInputRef.current?.click()}
        onDrop={handleDropZoneDrop}
        onDragOver={handleDropZoneDragOver}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
          disabled={disabled || isUploading}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{uploadProgress || 'Hochladen...'}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="rounded-full bg-muted p-3">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Bilder hochladen</p>
              <p className="text-xs text-muted-foreground">
                Klicken oder Dateien hierher ziehen
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((image, index) => (
            <div
              key={image.id}
              draggable={!disabled}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                'relative group rounded-lg overflow-hidden border-2 transition-all',
                image.is_primary ? 'border-primary' : 'border-transparent',
                draggedIndex === index && 'opacity-50',
                dragOverIndex === index && draggedIndex !== index && 'border-primary/50',
                !disabled && 'cursor-grab active:cursor-grabbing'
              )}
            >
              <div className="aspect-square relative bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={image.alt_text || 'Produktbild'}
                  className="absolute inset-0 w-full h-full object-cover"
                />

                {/* Primary Badge */}
                {image.is_primary && (
                  <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Star className="h-3 w-3 fill-current" />
                    Hauptbild
                  </div>
                )}

                {/* Overlay with actions */}
                {!disabled && (
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {/* Drag handle */}
                    <div className="absolute top-2 left-2 text-white/70">
                      <GripVertical className="h-5 w-5" />
                    </div>

                    {/* Set as primary */}
                    {!image.is_primary && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetPrimary(image.id);
                        }}
                        title="Als Hauptbild setzen"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Delete */}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(image.id);
                      }}
                      title="Löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help Text */}
      <p className="text-xs text-muted-foreground">
        Das Hauptbild wird in Produktlisten angezeigt. Ziehen Sie Bilder, um die Reihenfolge zu ändern.
      </p>
    </div>
  );
}
