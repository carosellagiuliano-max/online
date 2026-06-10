'use client'

import { useState, useRef, useMemo } from 'react'
import { useThemeLayout } from '@/contexts/theme-layout-context'
import { useMockGalleryAdditions } from '@/components/gallery/mock-gallery-additions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

// ============================================
// THEME-AWARE GALLERY SECTION
// Renders different gallery layouts based on theme configuration
// ============================================

export interface GalleryImage {
  id: string
  url: string
  alt: string
  category?: string
}

interface GallerySectionProps {
  title?: string
  subtitle?: string
  images: GalleryImage[]
  maxItems?: number
}

function isUnoptimizedImage(image: GalleryImage): boolean {
  // Demo-mode images (data: URLs or arbitrary hosts) bypass the Next.js optimizer.
  return (
    image.url.includes('localhost') ||
    image.url.startsWith('data:') ||
    image.id.startsWith('gal-')
  )
}

export function GallerySection({
  title = 'Galerie',
  subtitle = 'Einblicke in unseren Salon',
  images,
  maxItems = 8,
}: GallerySectionProps) {
  const { layout } = useThemeLayout()

  // Demo mode: merge homepage images created in the admin (localStorage) after mount.
  const mockAdditions = useMockGalleryAdditions()
  const allImages = useMemo(() => {
    const additions = mockAdditions
      .filter((item) => item.show_on_homepage !== false)
      .map((item) => ({
        id: item.id,
        url: item.url,
        alt: item.alt_text || item.title || 'Galerie Bild',
      }))
    return additions.length > 0 ? [...images, ...additions] : images
  }, [images, mockAdditions])

  const displayImages = allImages.slice(0, maxItems)

  switch (layout.gallery) {
    case 'grid':
      return (
        <GalleryGrid
          title={title}
          subtitle={subtitle}
          images={displayImages}
          layout={layout}
        />
      )
    case 'slider':
      return (
        <GallerySlider
          title={title}
          subtitle={subtitle}
          images={displayImages}
          layout={layout}
        />
      )
    case 'lightbox':
      return (
        <GalleryLightbox
          title={title}
          subtitle={subtitle}
          images={displayImages}
          layout={layout}
        />
      )
    case 'masonry':
    default:
      return (
        <GalleryMasonry
          title={title}
          subtitle={subtitle}
          images={displayImages}
          layout={layout}
        />
      )
  }
}

// ============================================
// GALLERY VARIANTS
// ============================================

interface GalleryVariantProps {
  title: string
  subtitle: string
  images: GalleryImage[]
  layout: ReturnType<typeof useThemeLayout>['layout']
}

// Masonry Layout (Default)
function GalleryMasonry({ title, subtitle, images, layout }: GalleryVariantProps) {
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null)

  return (
    <section className={cn(
      'py-16 lg:py-24',
      layout.sectionSpacing === 'compact' && 'py-12 lg:py-16',
      layout.sectionSpacing === 'relaxed' && 'py-20 lg:py-32'
    )}>
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{title}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>
        </div>

        {/* Masonry Grid */}
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
          {images.map((image, index) => (
            <div
              key={image.id}
              className={cn(
                'break-inside-avoid group cursor-pointer overflow-hidden',
                layout.borderRadius === 'full' ? 'rounded-3xl' : layout.borderRadius === 'lg' ? 'rounded-2xl' : layout.borderRadius === 'md' ? 'rounded-xl' : 'rounded-lg'
              )}
              onClick={() => setSelectedImage(image)}
            >
              <div className="relative">
                <Image
                  src={image.url}
                  alt={image.alt}
                  width={400}
                  height={index % 3 === 0 ? 500 : index % 2 === 0 ? 350 : 400}
                  className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                  unoptimized={isUnoptimizedImage(image)}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 bg-transparent border-none">
          {selectedImage && (
            <div className="relative">
              <Image
                src={selectedImage.url}
                alt={selectedImage.alt}
                width={1200}
                height={800}
                className="w-full h-auto rounded-lg"
                unoptimized={isUnoptimizedImage(selectedImage)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

// Grid Layout (Uniform)
function GalleryGrid({ title, subtitle, images, layout }: GalleryVariantProps) {
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null)

  return (
    <section className={cn(
      'py-16 lg:py-24',
      layout.sectionSpacing === 'compact' && 'py-12 lg:py-16',
      layout.sectionSpacing === 'relaxed' && 'py-20 lg:py-32'
    )}>
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{title}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>
        </div>

        {/* Uniform Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <div
              key={image.id}
              className={cn(
                'relative aspect-square group cursor-pointer overflow-hidden',
                layout.borderRadius === 'full' ? 'rounded-3xl' : layout.borderRadius === 'lg' ? 'rounded-2xl' : layout.borderRadius === 'md' ? 'rounded-xl' : 'rounded-lg'
              )}
              onClick={() => setSelectedImage(image)}
            >
              <Image
                src={image.url}
                alt={image.alt}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
                unoptimized={isUnoptimizedImage(image)}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 bg-transparent border-none">
          {selectedImage && (
            <div className="relative">
              <Image
                src={selectedImage.url}
                alt={selectedImage.alt}
                width={1200}
                height={800}
                className="w-full h-auto rounded-lg"
                unoptimized={isUnoptimizedImage(selectedImage)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

// Slider Layout
function GallerySlider({ title, subtitle, images, layout }: GalleryVariantProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const newIndex = direction === 'left'
        ? Math.max(0, currentIndex - 1)
        : Math.min(images.length - 1, currentIndex + 1)
      setCurrentIndex(newIndex)

      const scrollAmount = scrollRef.current.clientWidth
      scrollRef.current.scrollTo({
        left: newIndex * scrollAmount,
        behavior: 'smooth',
      })
    }
  }

  return (
    <section className={cn(
      'py-16 lg:py-24',
      layout.sectionSpacing === 'compact' && 'py-12 lg:py-16',
      layout.sectionSpacing === 'relaxed' && 'py-20 lg:py-32'
    )}>
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-2">{title}</h2>
            <p className="text-muted-foreground">{subtitle}</p>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} / {images.length}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => scroll('left')}
                disabled={currentIndex === 0}
                className="rounded-full"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => scroll('right')}
                disabled={currentIndex === images.length - 1}
                className="rounded-full"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Slider */}
        <div
          ref={scrollRef}
          className="flex overflow-x-hidden snap-x snap-mandatory"
        >
          {images.map((image) => (
            <div
              key={image.id}
              className="flex-shrink-0 w-full snap-center"
            >
              <div className={cn(
                'relative aspect-[16/9] overflow-hidden mx-auto max-w-5xl',
                layout.borderRadius === 'full' ? 'rounded-3xl' : layout.borderRadius === 'lg' ? 'rounded-2xl' : layout.borderRadius === 'md' ? 'rounded-xl' : 'rounded-lg'
              )}>
                <Image
                  src={image.url}
                  alt={image.alt}
                  fill
                  className="object-cover"
                  unoptimized={isUnoptimizedImage(image)}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-6">
          {images.map((_, index) => (
            <button
              key={index}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                index === currentIndex ? 'bg-primary w-6' : 'bg-muted-foreground/30'
              )}
              onClick={() => {
                setCurrentIndex(index)
                if (scrollRef.current) {
                  scrollRef.current.scrollTo({
                    left: index * scrollRef.current.clientWidth,
                    behavior: 'smooth',
                  })
                }
              }}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

// Lightbox Layout (Click to expand)
function GalleryLightbox({ title, subtitle, images, layout }: GalleryVariantProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const navigate = (direction: 'prev' | 'next') => {
    if (selectedIndex === null) return
    if (direction === 'prev') {
      setSelectedIndex(selectedIndex > 0 ? selectedIndex - 1 : images.length - 1)
    } else {
      setSelectedIndex(selectedIndex < images.length - 1 ? selectedIndex + 1 : 0)
    }
  }

  return (
    <section className={cn(
      'py-16 lg:py-24',
      layout.sectionSpacing === 'compact' && 'py-12 lg:py-16',
      layout.sectionSpacing === 'relaxed' && 'py-20 lg:py-32'
    )}>
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{title}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {/* First large image */}
          {images[0] && (
            <div
              className={cn(
                'col-span-2 row-span-2 relative aspect-square cursor-pointer overflow-hidden group',
                layout.borderRadius === 'lg' ? 'rounded-2xl' : 'rounded-xl'
              )}
              onClick={() => setSelectedIndex(0)}
            >
              <Image
                src={images[0].url}
                alt={images[0].alt}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                unoptimized={isUnoptimizedImage(images[0])}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}

          {/* Remaining images */}
          {images.slice(1).map((image, index) => (
            <div
              key={image.id}
              className={cn(
                'relative aspect-square cursor-pointer overflow-hidden group',
                layout.borderRadius === 'lg' ? 'rounded-xl' : 'rounded-lg'
              )}
              onClick={() => setSelectedIndex(index + 1)}
            >
              <Image
                src={image.url}
                alt={image.alt}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                unoptimized={isUnoptimizedImage(image)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      </div>

      {/* Fullscreen Lightbox */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
          {selectedIndex !== null && images[selectedIndex] && (
            <div className="relative flex items-center justify-center min-h-[80vh]">
              <Image
                src={images[selectedIndex].url}
                alt={images[selectedIndex].alt}
                width={1400}
                height={900}
                className="max-w-full max-h-[85vh] object-contain"
                unoptimized={isUnoptimizedImage(images[selectedIndex])}
              />

              {/* Navigation */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white h-12 w-12"
                onClick={() => navigate('prev')}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white h-12 w-12"
                onClick={() => navigate('next')}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>

              {/* Close */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white"
                onClick={() => setSelectedIndex(null)}
              >
                <X className="h-6 w-6" />
              </Button>

              {/* Counter */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
                {selectedIndex + 1} / {images.length}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
