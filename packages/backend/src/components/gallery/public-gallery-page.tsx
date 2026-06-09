import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Camera, Instagram } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { PublicGalleryCategory } from '@/lib/actions/gallery';

interface PublicGalleryPageProps {
  categories: PublicGalleryCategory[];
  instagramUrl?: string | null;
  instagramLabel?: string | null;
  introLabel?: string;
  title?: string;
  description?: string;
}

function isLocalImage(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1');
}

export function PublicGalleryPage({
  categories,
  instagramUrl,
  instagramLabel,
  introLabel = 'Unsere Arbeiten',
  title = 'Galerie',
  description = 'Lassen Sie sich von aktuellen Arbeiten, Salonmomenten und Details inspirieren.',
}: PublicGalleryPageProps) {
  const totalImages = categories.reduce((total, category) => total + category.images.length, 0);

  return (
    <div className="py-12">
      <section className="container-wide mb-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-2 text-sm font-medium uppercase tracking-wider text-primary">
            {introLabel}
          </p>
          <h1 className="mb-6 text-4xl font-bold md:text-5xl">{title}</h1>
          <p className="text-lg text-muted-foreground">{description}</p>
        </div>

        {totalImages > 0 && (
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`#${category.slug}`}
                className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                {category.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {category.images.length}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="container-wide space-y-16">
        {totalImages === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <Camera className="mx-auto mb-4 h-16 w-16 text-muted-foreground/30" />
              <h2 className="mb-2 text-xl font-semibold text-muted-foreground">
                Noch keine Bilder vorhanden
              </h2>
              <p className="mx-auto max-w-md text-muted-foreground">
                Sobald neue Galerieinhalte freigegeben sind, erscheinen sie hier automatisch.
              </p>
            </CardContent>
          </Card>
        ) : (
          categories.map((category, categoryIndex) => (
            <div key={category.id} id={category.slug} className="scroll-mt-24">
              <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{category.name}</h2>
                  {category.description && (
                    <p className="mt-2 max-w-2xl text-muted-foreground">
                      {category.description}
                    </p>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {category.images.length} {category.images.length === 1 ? 'Bild' : 'Bilder'}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {category.images.map((image, imageIndex) => (
                  <Card
                    key={image.id}
                    className="group overflow-hidden border-border/50"
                  >
                    <CardContent className="relative aspect-[3/4] p-0">
                      <Image
                        src={image.url}
                        alt={image.alt}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        priority={categoryIndex === 0 && imageIndex < 2}
                        unoptimized={isLocalImage(image.url)}
                      />

                      {(image.title || image.description) && (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-4 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          {image.title && (
                            <p className="text-sm font-semibold">{image.title}</p>
                          )}
                          {image.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-white/80">
                              {image.description}
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {instagramUrl && (
        <section className="container-wide mt-16 text-center">
          <Card className="border-border/50 bg-muted/30">
            <CardContent className="p-8">
              <h2 className="mb-4 text-2xl font-bold">Mehr auf Instagram</h2>
              <p className="mx-auto mb-6 max-w-xl text-muted-foreground">
                Folgen Sie uns für weitere Inspirationen und aktuelle Einblicke.
              </p>
              <Link
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
              >
                <Instagram className="h-4 w-4" />
                {instagramLabel || 'Instagram öffnen'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
