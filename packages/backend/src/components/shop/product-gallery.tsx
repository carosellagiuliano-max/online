'use client';

import { useState } from 'react';
import { Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ProductImage {
  id?: string;
  url: string;
  alt_text?: string;
  is_primary?: boolean;
  sort_order?: number;
}

interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
  isOnSale?: boolean;
}

export function ProductGallery({ images, productName, isOnSale }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedImage = images[selectedIndex];

  const goToPrevious = () => {
    setSelectedIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setSelectedIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div className="relative aspect-square bg-gradient-to-br from-muted to-muted/50 rounded-xl overflow-hidden group">
        {selectedImage ? (
          <img
            src={selectedImage.url}
            alt={selectedImage.alt_text || productName}
            className="object-cover w-full h-full transition-opacity duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package className="h-24 w-24 text-muted-foreground/20" />
          </div>
        )}

        {/* Click areas for navigation */}
        {images.length > 1 && (
          <>
            {/* Left side - Previous */}
            <button
              onClick={goToPrevious}
              className="absolute left-0 top-0 bottom-0 w-1/3 flex items-center justify-start pl-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              aria-label="Vorheriges Bild"
            >
              <div className="bg-black/30 hover:bg-black/50 rounded-full p-2 transition-colors">
                <ChevronLeft className="h-6 w-6 text-white" />
              </div>
            </button>

            {/* Right side - Next */}
            <button
              onClick={goToNext}
              className="absolute right-0 top-0 bottom-0 w-1/3 flex items-center justify-end pr-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              aria-label="Nächstes Bild"
            >
              <div className="bg-black/30 hover:bg-black/50 rounded-full p-2 transition-colors">
                <ChevronRight className="h-6 w-6 text-white" />
              </div>
            </button>

            {/* Image counter */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1 rounded-full">
              {selectedIndex + 1} / {images.length}
            </div>
          </>
        )}

        {isOnSale && (
          <div className="absolute top-4 left-4">
            <Badge variant="destructive" className="text-sm px-3 py-1">
              Sale
            </Badge>
          </div>
        )}
      </div>

      {/* Thumbnail Gallery */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((img, index) => (
            <button
              key={img.id || index}
              onClick={() => setSelectedIndex(index)}
              className={`relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                index === selectedIndex
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-transparent hover:border-muted-foreground/30'
              }`}
            >
              <img
                src={img.url}
                alt={img.alt_text || `${productName} ${index + 1}`}
                className="object-cover w-full h-full"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
