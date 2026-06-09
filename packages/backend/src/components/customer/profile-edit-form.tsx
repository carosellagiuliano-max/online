'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, User, Mail, Phone, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { updateCustomerProfile, type CustomerProfile } from '@/lib/actions';

interface ProfileEditFormProps {
  profile: CustomerProfile;
}

export function ProfileEditForm({ profile }: ProfileEditFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await updateCustomerProfile(profile.id, formData);

      if (!result.success) {
        setError(result.error || 'Speichern fehlgeschlagen.');
        return;
      }

      setSuccess(true);
      router.refresh();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-600">
            Profil wurde gespeichert.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">Vorname</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="firstName"
              name="firstName"
              type="text"
              defaultValue={profile.firstName}
              required
              disabled={isLoading}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">Nachname</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="lastName"
              name="lastName"
              type="text"
              defaultValue={profile.lastName}
              required
              disabled={isLoading}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-Mail-Adresse</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            value={profile.email}
            disabled
            className="pl-10 bg-muted"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          E-Mail-Adresse kann nicht geändert werden.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Telefonnummer</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={profile.phone || ''}
            placeholder="+41 71 234 56 78"
            disabled={isLoading}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Speichern...
            </>
          ) : (
            'Änderungen speichern'
          )}
        </Button>
      </div>
    </form>
  );
}
