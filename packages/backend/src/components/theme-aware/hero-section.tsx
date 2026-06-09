'use client'

import { useThemeLayout } from '@/contexts/theme-layout-context'
import { Button } from '@/components/ui/button'
import { ArrowRight, Play, Calendar } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

// ============================================
// THEME-AWARE HERO SECTION
// Renders different hero layouts based on theme configuration
// ============================================

interface HeroSectionProps {
  title: string
  subtitle: string
  tagline?: string
  ctaText?: string
  ctaHref?: string
  secondaryCtaText?: string
  secondaryCtaHref?: string
  imageUrl?: string
  videoUrl?: string
}

export function HeroSection({
  title,
  subtitle,
  tagline,
  ctaText = 'Termin buchen',
  ctaHref = '/termin-buchen',
  secondaryCtaText,
  secondaryCtaHref,
  imageUrl,
  videoUrl,
}: HeroSectionProps) {
  const { layout } = useThemeLayout()

  switch (layout.hero) {
    case 'split':
      return (
        <HeroSplit
          title={title}
          subtitle={subtitle}
          tagline={tagline}
          ctaText={ctaText}
          ctaHref={ctaHref}
          secondaryCtaText={secondaryCtaText}
          secondaryCtaHref={secondaryCtaHref}
          imageUrl={imageUrl}
          layout={layout}
        />
      )
    case 'minimal':
      return (
        <HeroMinimal
          title={title}
          subtitle={subtitle}
          ctaText={ctaText}
          ctaHref={ctaHref}
          layout={layout}
        />
      )
    case 'video':
      return (
        <HeroVideo
          title={title}
          subtitle={subtitle}
          tagline={tagline}
          ctaText={ctaText}
          ctaHref={ctaHref}
          videoUrl={videoUrl}
          imageUrl={imageUrl}
          layout={layout}
        />
      )
    case 'fullscreen':
      return (
        <HeroFullscreen
          title={title}
          subtitle={subtitle}
          tagline={tagline}
          ctaText={ctaText}
          ctaHref={ctaHref}
          imageUrl={imageUrl}
          layout={layout}
        />
      )
    case 'centered':
    default:
      return (
        <HeroCentered
          title={title}
          subtitle={subtitle}
          tagline={tagline}
          ctaText={ctaText}
          ctaHref={ctaHref}
          secondaryCtaText={secondaryCtaText}
          secondaryCtaHref={secondaryCtaHref}
          imageUrl={imageUrl}
          layout={layout}
        />
      )
  }
}

// ============================================
// HERO VARIANTS
// ============================================

interface HeroVariantProps {
  title: string
  subtitle: string
  tagline?: string
  ctaText: string
  ctaHref: string
  secondaryCtaText?: string
  secondaryCtaHref?: string
  imageUrl?: string
  videoUrl?: string
  layout: ReturnType<typeof useThemeLayout>['layout']
}

// Centered Hero (Default - BeautifyPRO style)
function HeroCentered({ title, subtitle, tagline, ctaText, ctaHref, secondaryCtaText, secondaryCtaHref, imageUrl, layout }: HeroVariantProps) {
  const buttonClass = layout.buttons === 'pill' ? 'rounded-full' : layout.buttons === 'square' ? 'rounded-none' : ''

  return (
    <section className="relative py-20 lg:py-32 overflow-hidden">
      {/* Background: Image with overlay OR gradient */}
      {imageUrl ? (
        <>
          <Image
            src={imageUrl}
            alt="Salon background"
            fill
            className="object-cover"
            priority
            unoptimized={isLocalUrl(imageUrl)}
          />
          {/* Pale overlay to ensure text readability */}
          <div className="absolute inset-0 bg-background/75 backdrop-blur-[1px]" />
        </>
      ) : layout.gradients ? (
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
      ) : null}

      <div className="relative container mx-auto px-4 text-center">
        {tagline && (
          <p className="text-gold font-medium tracking-wider uppercase text-sm mb-4 animate-fade-in">
            {tagline}
          </p>
        )}

        <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-6 tracking-tight animate-slide-up">
          <span className="text-gradient-gold">{title}</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in">
          {subtitle}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
          <Button asChild size="lg" className={`shadow-glow ${buttonClass}`}>
            <Link href={ctaHref}>
              <Calendar className="mr-2 h-5 w-5" />
              {ctaText}
            </Link>
          </Button>

          {secondaryCtaText && secondaryCtaHref && (
            <Button asChild variant="outline" size="lg" className={buttonClass}>
              <Link href={secondaryCtaHref}>
                {secondaryCtaText}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

// Helper to check if URL is from local development (Docker can't reach localhost)
function isLocalUrl(url?: string): boolean {
  return !!url && (url.includes('localhost') || url.includes('127.0.0.1'))
}

// Split Hero (Image on one side, content on other)
function HeroSplit({ title, subtitle, tagline, ctaText, ctaHref, secondaryCtaText, secondaryCtaHref, imageUrl, layout }: HeroVariantProps) {
  const buttonClass = layout.buttons === 'pill' ? 'rounded-full' : layout.buttons === 'square' ? 'rounded-none' : ''

  return (
    <section className="relative min-h-[80vh] flex items-center overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Content */}
          <div className="order-2 lg:order-1">
            {tagline && (
              <p className="text-primary font-medium tracking-wider uppercase text-sm mb-4">
                {tagline}
              </p>
            )}

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight">
              {title}
            </h1>

            <p className="text-lg text-muted-foreground mb-8">
              {subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg" className={buttonClass}>
                <Link href={ctaHref}>
                  <Calendar className="mr-2 h-5 w-5" />
                  {ctaText}
                </Link>
              </Button>

              {secondaryCtaText && secondaryCtaHref && (
                <Button asChild variant="outline" size="lg" className={buttonClass}>
                  <Link href={secondaryCtaHref}>
                    {secondaryCtaText}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Image or Gradient Placeholder */}
          <div className="order-1 lg:order-2 relative">
            <div className={`relative aspect-[4/5] ${layout.borderRadius === 'full' ? 'rounded-3xl' : layout.borderRadius === 'lg' ? 'rounded-2xl' : layout.borderRadius === 'md' ? 'rounded-xl' : 'rounded-lg'} overflow-hidden shadow-elegant-lg`}>
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt="Salon"
                  fill
                  className="object-cover"
                  priority
                  unoptimized={isLocalUrl(imageUrl)}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-muted" />
              )}
              {layout.glassmorphism && (
                <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// Minimal Hero (Simple text only)
function HeroMinimal({ title, subtitle, ctaText, ctaHref, layout }: HeroVariantProps) {
  const buttonClass = layout.buttons === 'pill' ? 'rounded-full' : layout.buttons === 'square' ? 'rounded-none' : layout.buttons === 'minimal' ? 'bg-transparent border-0 underline underline-offset-4 hover:bg-transparent' : ''

  return (
    <section className="py-16 lg:py-24">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 tracking-tight">
          {title}
        </h1>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <p className="text-lg text-muted-foreground max-w-xl">
            {subtitle}
          </p>

          <Button asChild size="lg" className={buttonClass}>
            <Link href={ctaHref}>
              {ctaText}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>

        <div className="mt-12 h-px bg-border" />
      </div>
    </section>
  )
}

// Video Hero (Background video)
function HeroVideo({ title, subtitle, tagline, ctaText, ctaHref, videoUrl, imageUrl, layout }: HeroVariantProps) {
  const buttonClass = layout.buttons === 'pill' ? 'rounded-full' : layout.buttons === 'square' ? 'rounded-none' : ''

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Video/Image/Gradient Background */}
      <div className="absolute inset-0">
        {videoUrl ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
            poster={imageUrl}
          >
            <source src={videoUrl} type="video/mp4" />
          </video>
        ) : imageUrl ? (
          <Image
            src={imageUrl}
            alt="Salon"
            fill
            className="object-cover"
            priority
            unoptimized={isLocalUrl(imageUrl)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/10 to-muted" />
        )}
        <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px]" />
      </div>

      {/* Content */}
      <div className="relative container mx-auto px-4 text-center">
        {tagline && (
          <p className="text-primary font-medium tracking-wider uppercase text-sm mb-4">
            {tagline}
          </p>
        )}

        <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-6 tracking-tight">
          {title}
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          {subtitle}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg" className={buttonClass}>
            <Link href={ctaHref}>
              <Calendar className="mr-2 h-5 w-5" />
              {ctaText}
            </Link>
          </Button>

          {videoUrl && (
            <Button variant="outline" size="lg" className={`${buttonClass} bg-background/50 backdrop-blur`}>
              <Play className="mr-2 h-5 w-5" />
              Video ansehen
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

// Fullscreen Hero (Full viewport with image)
function HeroFullscreen({ title, subtitle, tagline, ctaText, ctaHref, imageUrl, layout }: HeroVariantProps) {
  const buttonClass = layout.buttons === 'pill' ? 'rounded-full' : layout.buttons === 'square' ? 'rounded-none' : ''

  return (
    <section className="relative min-h-screen flex items-end pb-20 overflow-hidden">
      {/* Background Image or Gradient */}
      <div className="absolute inset-0">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt="Salon"
            fill
            className="object-cover"
            priority
            unoptimized={isLocalUrl(imageUrl)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/10 to-muted" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative container mx-auto px-4">
        {tagline && (
          <p className="text-primary font-medium tracking-wider uppercase text-sm mb-4">
            {tagline}
          </p>
        )}

        <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-6 tracking-tight max-w-4xl">
          {title}
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-10">
          {subtitle}
        </p>

        <Button asChild size="lg" className={buttonClass}>
          <Link href={ctaHref}>
            <Calendar className="mr-2 h-5 w-5" />
            {ctaText}
          </Link>
        </Button>
      </div>
    </section>
  )
}
