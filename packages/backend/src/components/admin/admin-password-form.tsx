'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updatePassword } from '@/lib/actions/auth';

export function AdminPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const newPassword = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (newPassword.length < 8) {
      toast.error('Passwort muss mindestens 8 Zeichen lang sein');
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwörter stimmen nicht überein');
      setIsLoading(false);
      return;
    }

    try {
      const result = await updatePassword(formData);

      if (result.success) {
        toast.success('Passwort erfolgreich geändert');
        (e.target as HTMLFormElement).reset();
      } else {
        toast.error(result.error || 'Passwort konnte nicht geändert werden');
      }
    } catch {
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Neues Passwort</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type={showNewPassword ? 'text' : 'password'}
            placeholder="Mindestens 8 Zeichen"
            className="pl-9 pr-10"
            required
            minLength={8}
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
          >
            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Passwort wiederholen"
            className="pl-9 pr-10"
            required
            minLength={8}
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Wird geändert...
          </>
        ) : (
          'Passwort ändern'
        )}
      </Button>
    </form>
  );
}
