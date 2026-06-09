'use client';

import { useState, useTransition } from 'react';
import { Star, Send, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface FeedbackFormProps {
  onSuccess?: () => void;
  className?: string;
}

// ============================================
// STAR RATING COMPONENT
// ============================================

function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  const [hoverValue, setHoverValue] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
          onMouseEnter={() => setHoverValue(star)}
          onMouseLeave={() => setHoverValue(0)}
          onClick={() => onChange(star)}
          aria-label={`${star} Stern${star > 1 ? 'e' : ''}`}
        >
          <Star
            className={cn(
              'h-8 w-8 transition-colors cursor-pointer',
              (hoverValue || value) >= star
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-muted text-muted-foreground hover:text-yellow-400'
            )}
          />
        </button>
      ))}
    </div>
  );
}

// ============================================
// FEEDBACK FORM COMPONENT
// ============================================

export function FeedbackForm({ onSuccess, className }: FeedbackFormProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [website, setWebsite] = useState(''); // Honeypot field
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    if (!name.trim()) {
      setError('Bitte geben Sie Ihren Namen ein.');
      return;
    }

    if (rating === 0) {
      setError('Bitte geben Sie eine Bewertung ab.');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/feedback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: name.trim(),
            rating,
            comment: comment.trim() || undefined,
            website, // Honeypot
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Ein Fehler ist aufgetreten.');
          return;
        }

        setSuccess(true);
        setName('');
        setRating(0);
        setComment('');
        onSuccess?.();
      } catch {
        setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
      }
    });
  };

  if (success) {
    return (
      <Card className={cn('bg-green-50 border-green-200', className)}>
        <CardContent className="p-6 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
          <h3 className="mt-4 font-semibold text-green-800">
            Vielen Dank für Ihre Bewertung!
          </h3>
          <p className="mt-2 text-sm text-green-700">
            Ihre Bewertung wird nach Prüfung veröffentlicht.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setSuccess(false)}
          >
            Weitere Bewertung abgeben
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Ihre Bewertung</CardTitle>
        <CardDescription>
          Teilen Sie Ihre Erfahrung mit uns
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="feedback-name">Name *</Label>
            <Input
              id="feedback-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ihr Name"
              required
              disabled={isPending}
            />
          </div>

          {/* Rating */}
          <div className="space-y-2">
            <Label>Bewertung *</Label>
            <StarRatingInput value={rating} onChange={setRating} />
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="feedback-comment">Kommentar (optional)</Label>
            <Textarea
              id="feedback-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Erzählen Sie uns von Ihrer Erfahrung..."
              rows={4}
              disabled={isPending}
            />
          </div>

          {/* Honeypot - hidden from users, visible to bots */}
          <div className="hidden" aria-hidden="true">
            <Label htmlFor="feedback-website">Website</Label>
            <Input
              id="feedback-website"
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {/* Submit Button */}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? (
              'Wird gesendet...'
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Bewertung abschicken
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            * Pflichtfelder. Ihre Bewertung wird nach Prüfung veröffentlicht.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
