'use client';

import { useState } from 'react';
import { Clock, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useBooking } from '../booking-context';
import type { BookableService, ServiceVariant } from '@/lib/domain/booking';

// ============================================
// SERVICE SELECTION STEP
// ============================================

interface ServiceSelectionProps {
  services: BookableService[];
  categories?: { id: string; name: string }[];
}

export function ServiceSelection({
  services,
  categories = [],
}: ServiceSelectionProps) {
  const { state, toggleService, removeService, selectServiceWithVariant, goNext, canProceed, totalDuration, totalPrice } =
    useBooking();

  // Track which services have their variants expanded
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

  const formatPrice = (cents: number) => {
    return `CHF ${(cents / 100).toFixed(0)}.-`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} Min.`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} Std. ${mins} Min.` : `${hours} Std.`;
  };

  // Group services by category
  const servicesByCategory = services.reduce(
    (acc, service) => {
      const categoryId = service.categoryId || 'other';
      if (!acc[categoryId]) {
        acc[categoryId] = [];
      }
      acc[categoryId].push(service);
      return acc;
    },
    {} as Record<string, BookableService[]>
  );

  const isSelected = (serviceId: string) =>
    state.selectedServices.some((s) => s.id === serviceId);

  const toggleExpanded = (serviceId: string) => {
    setExpandedServices((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  };

  const handleServiceClick = (service: BookableService) => {
    if (service.hasVariants && service.variants && service.variants.length > 0) {
      if (isSelected(service.id)) {
        // Already selected - deselect it
        removeService(service.id);
        setExpandedServices((prev) => {
          const next = new Set(prev);
          next.delete(service.id);
          return next;
        });
      } else {
        // Not selected - expand variants for user to pick
        toggleExpanded(service.id);
      }
    } else {
      // No variants, just toggle selection
      toggleService(service);
    }
  };

  const handleVariantSelect = (service: BookableService, variant: ServiceVariant) => {
    selectServiceWithVariant(service, variant);
    // Collapse after selection
    setExpandedServices((prev) => {
      const next = new Set(prev);
      next.delete(service.id);
      return next;
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">
          Welche Leistung möchten Sie buchen?
        </h2>
        <p className="text-muted-foreground">
          Wählen Sie eine oder mehrere Leistungen aus.
        </p>
      </div>

      {/* Service Categories */}
      <div className="space-y-8">
        {categories.map((category) => {
          const categoryServices = servicesByCategory[category.id];
          if (!categoryServices || categoryServices.length === 0) return null;

          return (
            <div key={category.id}>
              <h3 className="text-lg font-semibold mb-4">{category.name}</h3>
              <div className="space-y-3">
                {categoryServices.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    selected={isSelected(service.id)}
                    expanded={expandedServices.has(service.id)}
                    selectedVariantId={state.selectedServices.find(s => s.id === service.id)?.selectedVariantId}
                    onToggle={() => handleServiceClick(service)}
                    onVariantSelect={(variant) => handleVariantSelect(service, variant)}
                    formatPrice={formatPrice}
                    formatDuration={formatDuration}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {/* Services without category */}
        {servicesByCategory['other'] && servicesByCategory['other'].length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Weitere Leistungen</h3>
            <div className="space-y-3">
              {servicesByCategory['other'].map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  selected={isSelected(service.id)}
                  expanded={expandedServices.has(service.id)}
                  selectedVariantId={state.selectedServices.find(s => s.id === service.id)?.selectedVariantId}
                  onToggle={() => handleServiceClick(service)}
                  onVariantSelect={(variant) => handleVariantSelect(service, variant)}
                  formatPrice={formatPrice}
                  formatDuration={formatDuration}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary & Continue */}
      <div className="sticky bottom-0 bg-background pt-4 pb-2 border-t">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            {state.selectedServices.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {state.selectedServices.length} Leistung
                  {state.selectedServices.length !== 1 ? 'en' : ''} ausgewählt
                </p>
                <p className="font-semibold">
                  {formatDuration(totalDuration)} •{' '}
                  <span className="text-primary">
                    {formatPrice(totalPrice)}
                  </span>
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Bitte wählen Sie mindestens eine Leistung
              </p>
            )}
          </div>
          <Button
            size="lg"
            onClick={goNext}
            disabled={!canProceed}
            className="w-full sm:w-auto"
          >
            Weiter
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SERVICE CARD COMPONENT
// ============================================

interface ServiceCardProps {
  service: BookableService;
  selected: boolean;
  expanded: boolean;
  selectedVariantId?: string;
  onToggle: () => void;
  onVariantSelect: (variant: ServiceVariant) => void;
  formatPrice: (cents: number) => string;
  formatDuration: (minutes: number) => string;
}

function ServiceCard({
  service,
  selected,
  expanded,
  selectedVariantId,
  onToggle,
  onVariantSelect,
  formatPrice,
  formatDuration,
}: ServiceCardProps) {
  const hasVariants = service.hasVariants && service.variants && service.variants.length > 0;
  const selectedVariant = hasVariants ? service.variants?.find(v => v.id === selectedVariantId) : undefined;

  // Get price range for services with variants
  const getPriceDisplay = () => {
    if (hasVariants && service.variants) {
      const minPrice = Math.min(...service.variants.map(v => v.priceCents));
      const maxPrice = Math.max(...service.variants.map(v => v.priceCents));
      if (selectedVariant) {
        return formatPrice(selectedVariant.priceCents);
      }
      if (minPrice === maxPrice) {
        return formatPrice(minPrice);
      }
      return `ab ${formatPrice(minPrice)}`;
    }
    return formatPrice(service.currentPrice);
  };

  return (
    <Card
      className={cn(
        'transition-all border-2',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border/50 hover:border-primary/50'
      )}
    >
      <CardContent className="p-4 sm:p-6">
        <div
          className="flex items-start gap-4 cursor-pointer"
          onClick={onToggle}
        >
          {/* Checkbox */}
          <div
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 mt-0.5',
              selected
                ? 'bg-primary border-primary text-primary-foreground'
                : 'border-muted-foreground/30'
            )}
          >
            {selected && <Check className="h-4 w-4" />}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">{service.name}</h4>
                  {hasVariants && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedVariant ? selectedVariant.name : 'Varianten'}
                    </Badge>
                  )}
                </div>
                {service.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {service.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    ca. {formatDuration(selectedVariant?.durationMinutes || service.durationMinutes)}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0 flex items-center gap-2">
                <span className="text-lg font-bold text-primary">
                  {getPriceDisplay()}
                </span>
                {hasVariants && (
                  expanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Variants Selection */}
        {hasVariants && expanded && service.variants && (
          <div className="mt-4 pt-4 border-t space-y-2 ml-10">
            <p className="text-sm text-muted-foreground mb-3">
              Bitte wählen Sie eine Option:
            </p>
            {service.variants.map((variant) => (
              <div
                key={variant.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                  selectedVariantId === variant.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border/50 hover:border-primary/50'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onVariantSelect(variant);
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                      selectedVariantId === variant.id
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-muted-foreground/30'
                    )}
                  >
                    {selectedVariantId === variant.id && <Check className="h-3 w-3" />}
                  </div>
                  <div>
                    <span className="font-medium">{variant.name}</span>
                    {variant.durationMinutes && (
                      <span className="text-sm text-muted-foreground ml-2">
                        ({formatDuration(variant.durationMinutes)})
                      </span>
                    )}
                  </div>
                </div>
                <span className="font-bold text-primary">
                  {formatPrice(variant.priceCents)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
