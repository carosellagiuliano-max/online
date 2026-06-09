'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Star, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

export interface ReviewItem {
  id: string;
  name: string;
  rating: number;
  comment: string | null;
}

interface ReviewsCarouselProps {
  reviews: ReviewItem[];
  title?: string;
  subtitle?: string;
  showFeedbackButton?: boolean;
}

// ============================================
// REVIEWS CAROUSEL COMPONENT
// ============================================

export function ReviewsCarousel({
  reviews,
  title = 'Was unsere Kunden sagen',
  subtitle = 'Kundenstimmen',
  showFeedbackButton = true,
}: ReviewsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const ref = scrollRef.current;
    if (ref) {
      ref.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        ref.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [reviews]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const cardWidth = 320; // Approximate card width + gap
      const scrollAmount = direction === 'left' ? -cardWidth : cardWidth;
      scrollRef.current.scrollBy({
        left: scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (reviews.length === 0) {
    return null;
  }

  return (
    <section className="section-padding bg-background">
      <div className="container-wide">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div className="text-center md:text-left">
            <p className="text-primary text-sm font-medium uppercase tracking-wider mb-2">
              {subtitle}
            </p>
            <h2 className="text-3xl font-bold text-foreground">
              {title}
            </h2>
          </div>

          {/* Navigation Arrows */}
          {reviews.length > 3 && (
            <div className="flex items-center justify-center md:justify-end gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => scroll('left')}
                disabled={!canScrollLeft}
                className="rounded-full h-10 w-10"
                aria-label="Vorherige Bewertungen"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => scroll('right')}
                disabled={!canScrollRight}
                className="rounded-full h-10 w-10"
                aria-label="Nächste Bewertungen"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>

        {/* Reviews Carousel */}
        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-4 -mx-4 px-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {reviews.map((review) => (
            <Card
              key={review.id}
              className="flex-shrink-0 w-[300px] md:w-[340px] border-border/50 bg-card snap-start"
            >
              <CardContent className="p-6">
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'h-4 w-4',
                        i < review.rating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'fill-muted text-muted'
                      )}
                    />
                  ))}
                </div>

                {/* Review Text */}
                {review.comment && (
                  <p className="text-foreground/80 mb-4 italic line-clamp-4">
                    &ldquo;{review.comment}&rdquo;
                  </p>
                )}

                {/* Author */}
                <p className="text-sm font-medium text-foreground">
                  {review.name}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Feedback Button */}
        {showFeedbackButton && (
          <div className="text-center mt-8">
            <Link href="/bewertung">
              <Button variant="outline">
                <MessageSquare className="mr-2 h-4 w-4" />
                Ihre Bewertung abgeben
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
