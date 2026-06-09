'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { requestPasswordReset } from '@/lib/actions';

interface PasswordResetFormProps {
  returnHref?: string;
  returnLabel?: string;
  resetRedirectPath?: '/konto/passwort-aendern' | '/admin/passwort-aendern';
}

export function PasswordResetForm({
  returnHref = '/konto/login',
  returnLabel = 'Zurück zur Anmeldung',
  resetRedirectPath = '/konto/passwort-aendern',
}: PasswordResetFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    setError(null);

    try {
      const result = await requestPasswordReset(formData);

      if (!result.success) {
        setError(result.error || 'Fehler beim Senden der E-Mail.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center space-y-6">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">E-Mail gesendet!</h2>
          <p className="text-muted-foreground">
            Falls ein Konto mit dieser E-Mail-Adresse existiert, haben wir Ihnen einen Link zum
            Zurücksetzen des Passworts gesendet. Bitte prüfen Sie auch Ihren Spam-Ordner.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={returnHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {returnLabel}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <input type="hidden" name="redirectTo" value={resetRedirectPath} />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">E-Mail-Adresse</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="ihre@email.ch"
            required
            disabled={isLoading}
            className="pl-10"
            autoComplete="email"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Geben Sie die E-Mail-Adresse ein, mit der Sie sich registriert haben.
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Senden...
          </>
        ) : (
          'Link zum Zurücksetzen senden'
        )}
      </Button>

      <div className="text-center">
        <Link
          href={returnHref}
          className="text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="inline mr-1 h-4 w-4" />
          {returnLabel}
        </Link>
      </div>
    </form>
  );
}
