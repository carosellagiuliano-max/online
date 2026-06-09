'use client'

import { useThemeLayout } from '@/contexts/theme-layout-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'

// ============================================
// THEME-AWARE SERVICES SECTION
// Renders different service layouts based on theme configuration
// ============================================

export interface Service {
  id: string
  name: string
  description?: string
  duration_minutes: number
  price_cents: number
  image_url?: string
  category?: string
}

interface ServicesSectionProps {
  title?: string
  subtitle?: string
  services: Service[]
  showAllLink?: string
  maxItems?: number
}

export function ServicesSection({
  title = 'Unsere Leistungen',
  subtitle = 'Entdecken Sie unser vielfältiges Angebot',
  services,
  showAllLink = '/leistungen',
  maxItems = 6,
}: ServicesSectionProps) {
  const { layout } = useThemeLayout()
  const displayServices = services.slice(0, maxItems)

  switch (layout.services) {
    case 'list':
      return (
        <ServicesList
          title={title}
          subtitle={subtitle}
          services={displayServices}
          showAllLink={showAllLink}
          layout={layout}
        />
      )
    case 'carousel':
      return (
        <ServicesCarousel
          title={title}
          subtitle={subtitle}
          services={displayServices}
          showAllLink={showAllLink}
          layout={layout}
        />
      )
    case 'grid':
      return (
        <ServicesGrid
          title={title}
          subtitle={subtitle}
          services={displayServices}
          showAllLink={showAllLink}
          layout={layout}
        />
      )
    case 'cards':
    default:
      return (
        <ServicesCards
          title={title}
          subtitle={subtitle}
          services={displayServices}
          showAllLink={showAllLink}
          layout={layout}
        />
      )
  }
}

// ============================================
// SERVICE VARIANTS
// ============================================

interface ServiceVariantProps {
  title: string
  subtitle: string
  services: Service[]
  showAllLink: string
  layout: ReturnType<typeof useThemeLayout>['layout']
}

// Format price
function formatPrice(cents: number): string {
  return `CHF ${(cents / 100).toFixed(0)}`
}

// Get card classes based on layout
function getCardClasses(layout: ServiceVariantProps['layout']): string {
  const baseClasses = 'transition-all duration-300'

  const cardStyles = {
    elevated: 'shadow-elegant hover:shadow-elegant-lg bg-card',
    flat: 'bg-muted/50 hover:bg-muted',
    bordered: 'border-2 hover:border-primary bg-transparent',
    glass: 'glass hover:glass-strong',
  }

  const radiusStyles = {
    none: 'rounded-none',
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    full: 'rounded-3xl',
  }

  return cn(
    baseClasses,
    cardStyles[layout.cards],
    radiusStyles[layout.borderRadius]
  )
}

// Cards Layout (Default)
function ServicesCards({ title, subtitle, services, showAllLink, layout }: ServiceVariantProps) {
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

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <div
              key={service.id}
              className={cn(getCardClasses(layout), 'p-6 group')}
            >
              {service.image_url && (
                <div className={cn(
                  'relative aspect-[16/10] mb-4 overflow-hidden',
                  layout.borderRadius === 'full' ? 'rounded-2xl' : layout.borderRadius === 'lg' ? 'rounded-xl' : 'rounded-lg'
                )}>
                  <Image
                    src={service.image_url}
                    alt={service.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              )}

              <h3 className="text-xl font-semibold mb-2">{service.name}</h3>

              {service.description && (
                <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                  {service.description}
                </p>
              )}

              <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{service.duration_minutes} Min.</span>
                </div>
                <span className="font-semibold text-primary">
                  {formatPrice(service.price_cents)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Show All Link */}
        <div className="text-center mt-10">
          <Button asChild variant="outline" size="lg">
            <Link href={showAllLink}>
              Alle Leistungen
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

// List Layout (Minimal)
function ServicesList({ title, subtitle, services, showAllLink, layout }: ServiceVariantProps) {
  return (
    <section className={cn(
      'py-16 lg:py-24',
      layout.sectionSpacing === 'compact' && 'py-12 lg:py-16',
      layout.sectionSpacing === 'relaxed' && 'py-20 lg:py-32'
    )}>
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-2">{title}</h2>
            <p className="text-muted-foreground">{subtitle}</p>
          </div>
          <Button asChild variant="outline">
            <Link href={showAllLink}>
              Alle anzeigen
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Services List */}
        <div className="divide-y divide-border">
          {services.map((service) => (
            <div
              key={service.id}
              className="py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:bg-muted/30 -mx-4 px-4 transition-colors"
            >
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-1 group-hover:text-primary transition-colors">
                  {service.name}
                </h3>
                {service.description && (
                  <p className="text-muted-foreground text-sm line-clamp-1">
                    {service.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{service.duration_minutes} Min.</span>
                </div>
                <span className="font-semibold text-lg min-w-[80px] text-right">
                  {formatPrice(service.price_cents)}
                </span>
                <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  Buchen
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Carousel Layout
function ServicesCarousel({ title, subtitle, services, showAllLink, layout }: ServiceVariantProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
    }
  }

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 340
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      })
      setTimeout(checkScroll, 300)
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className="rounded-full"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className="rounded-full"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Carousel */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-4 px-4 pb-4"
        >
          {services.map((service) => (
            <div
              key={service.id}
              className={cn(
                getCardClasses(layout),
                'flex-shrink-0 w-[300px] snap-start p-5 group'
              )}
            >
              {service.image_url && (
                <div className={cn(
                  'relative aspect-[4/3] mb-4 overflow-hidden',
                  layout.borderRadius === 'full' ? 'rounded-2xl' : 'rounded-xl'
                )}>
                  <Image
                    src={service.image_url}
                    alt={service.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              )}

              <h3 className="text-lg font-semibold mb-2">{service.name}</h3>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {service.duration_minutes} Min.
                </span>
                <span className="font-semibold text-primary">
                  {formatPrice(service.price_cents)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Show All Link */}
        <div className="text-center mt-8">
          <Button asChild variant="link">
            <Link href={showAllLink}>
              Alle Leistungen anzeigen
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

// Grid Layout (Compact)
function ServicesGrid({ title, subtitle, services, showAllLink, layout }: ServiceVariantProps) {
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

        {/* Services Grid - Compact */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {services.map((service) => (
            <Link
              key={service.id}
              href={`/leistungen#${service.id}`}
              className={cn(
                getCardClasses(layout),
                'p-4 group text-center hover:scale-[1.02]'
              )}
            >
              {service.image_url && (
                <div className={cn(
                  'relative aspect-square mb-3 overflow-hidden mx-auto w-20 h-20',
                  layout.borderRadius === 'full' ? 'rounded-full' : 'rounded-xl'
                )}>
                  <Image
                    src={service.image_url}
                    alt={service.name}
                    fill
                    className="object-cover"
                  />
                </div>
              )}

              <h3 className="font-semibold mb-1 text-sm group-hover:text-primary transition-colors">
                {service.name}
              </h3>

              <p className="text-xs text-muted-foreground mb-2">
                {service.duration_minutes} Min.
              </p>

              <span className="text-sm font-semibold text-primary">
                {formatPrice(service.price_cents)}
              </span>
            </Link>
          ))}
        </div>

        {/* Show All Link */}
        <div className="text-center mt-10">
          <Button asChild variant="outline" size="lg">
            <Link href={showAllLink}>
              Alle Leistungen
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
