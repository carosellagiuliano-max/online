'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { submitContactForm } from '@/lib/actions';

// ============================================
// CONTACT FORM COMPONENT
// ============================================

const inquiryReasons = [
  { value: 'termin', label: 'Terminanfrage' },
  { value: 'beratung', label: 'Beratungsgespräch' },
  { value: 'bewerbung', label: 'Bewerbung' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

export function ContactForm() {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = (formData: FormData) => {
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await submitContactForm(formData);

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || 'Ein Fehler ist aufgetreten.');
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
      }
    });
  };

  if (success) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Nachricht gesendet!</h3>
        <p className="text-muted-foreground mb-6">
          Vielen Dank für Ihre Nachricht. Wir werden uns so schnell wie möglich
          bei Ihnen melden.
        </p>
        <Button variant="outline" onClick={() => setSuccess(false)}>
          Weitere Nachricht senden
        </Button>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">Vorname *</Label>
          <Input
            id="firstName"
            name="firstName"
            placeholder="Ihr Vorname"
            required
            disabled={isPending}
            aria-invalid={!!fieldErrors.firstName}
          />
          {fieldErrors.firstName && (
            <p className="text-sm text-destructive">{fieldErrors.firstName}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Nachname *</Label>
          <Input
            id="lastName"
            name="lastName"
            placeholder="Ihr Nachname"
            required
            disabled={isPending}
            aria-invalid={!!fieldErrors.lastName}
          />
          {fieldErrors.lastName && (
            <p className="text-sm text-destructive">{fieldErrors.lastName}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">E-Mail *</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="ihre@email.ch"
            required
            disabled={isPending}
            aria-invalid={!!fieldErrors.email}
          />
          {fieldErrors.email && (
            <p className="text-sm text-destructive">{fieldErrors.email}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefon</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+41 79 123 45 67"
            disabled={isPending}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Anliegen *</Label>
        <Select name="reason" required disabled={isPending}>
          <SelectTrigger aria-invalid={!!fieldErrors.reason}>
            <SelectValue placeholder="Bitte wählen..." />
          </SelectTrigger>
          <SelectContent>
            {inquiryReasons.map((reason) => (
              <SelectItem key={reason.value} value={reason.value}>
                {reason.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.reason && (
          <p className="text-sm text-destructive">{fieldErrors.reason}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Nachricht *</Label>
        <Textarea
          id="message"
          name="message"
          placeholder="Ihre Nachricht an uns..."
          rows={5}
          required
          disabled={isPending}
          aria-invalid={!!fieldErrors.message}
        />
        {fieldErrors.message && (
          <p className="text-sm text-destructive">{fieldErrors.message}</p>
        )}
      </div>

      {/* Honeypot - hidden from users, visible to bots */}
      <div className="hidden" aria-hidden="true">
        <Label htmlFor="contact-website">Website</Label>
        <Input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        * Pflichtfelder. Mit dem Absenden erklären Sie sich mit unserer{' '}
        <Link href="/datenschutz" className="text-primary hover:underline">
          Datenschutzerklärung
        </Link>{' '}
        einverstanden.
      </p>

      <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Wird gesendet...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Nachricht senden
          </>
        )}
      </Button>
    </form>
  );
}
