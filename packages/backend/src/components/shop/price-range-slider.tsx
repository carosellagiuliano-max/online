'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

interface PriceRangeSliderProps {
  min: number;
  max: number;
  step?: number;
  currentMin?: number;
  currentMax?: number;
}

export function PriceRangeSlider({
  min,
  max,
  step = 5,
  currentMin,
  currentMax,
}: PriceRangeSliderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const effectiveMin = currentMin ?? min;
  const effectiveMax = currentMax ?? max;

  const [values, setValues] = useState<[number, number]>([effectiveMin, effectiveMax]);

  // Sync with URL params when they change externally
  useEffect(() => {
    setValues([currentMin ?? min, currentMax ?? max]);
  }, [currentMin, currentMax, min, max]);

  const buildUrl = useCallback(
    (minVal: number, maxVal: number) => {
      const params = new URLSearchParams(searchParams.toString());
      // Remove page when filter changes
      params.delete('page');

      if (minVal <= min && maxVal >= max) {
        // Full range = no filter
        params.delete('minPrice');
        params.delete('maxPrice');
      } else {
        params.set('minPrice', String(minVal));
        params.set('maxPrice', String(maxVal));
      }

      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [searchParams, pathname, min, max]
  );

  const handleValueCommit = useCallback(
    (newValues: number[]) => {
      router.push(buildUrl(newValues[0], newValues[1]));
    },
    [router, buildUrl]
  );

  // Don't render if range is invalid
  if (min >= max) return null;

  const isFiltered = values[0] > min || values[1] < max;

  return (
    <div className="space-y-4">
      {/* Price display */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium tabular-nums">CHF {values[0]}</span>
        <span className="text-muted-foreground">-</span>
        <span className="font-medium tabular-nums">CHF {values[1]}</span>
      </div>

      {/* Dual-thumb range slider */}
      <SliderPrimitive.Root
        className="relative flex w-full touch-none select-none items-center"
        min={min}
        max={max}
        step={step}
        value={values}
        onValueChange={(v) => setValues(v as [number, number])}
        onValueCommit={handleValueCommit}
        minStepsBetweenThumbs={1}
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
          <SliderPrimitive.Range className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          aria-label="Mindestpreis"
        />
        <SliderPrimitive.Thumb
          className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          aria-label="Höchstpreis"
        />
      </SliderPrimitive.Root>

      {/* Min/Max labels */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>CHF {min}</span>
        <span>CHF {max}</span>
      </div>

      {/* Reset link */}
      {isFiltered && (
        <button
          type="button"
          onClick={() => {
            setValues([min, max]);
            router.push(buildUrl(min, max));
          }}
          className="text-xs text-primary hover:underline"
        >
          Preisfilter zurücksetzen
        </button>
      )}
    </div>
  );
}
