'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Mail, Phone, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateAdminProfile } from '@/lib/actions/admin-profile';

interface AdminProfileFormProps {
  displayName: string;
  email: string;
  phone: string;
  role: string;
}

export function AdminProfileForm({
  displayName,
  email,
  phone,
  role,
}: AdminProfileFormProps) {
  const [nameValue, setNameValue] = useState(displayName);
  const [phoneValue, setPhoneValue] = useState(phone);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const result = await updateAdminProfile({
        displayName: nameValue,
        phone: phoneValue || null,
      });

      if (!result.success) {
        toast.error(result.error || 'Profil konnte nicht gespeichert werden');
        return;
      }

      toast.success('Profil gespeichert');
    } catch {
      toast.error('Profil konnte nicht gespeichert werden');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="name"
            value={nameValue}
            onChange={(event) => setNameValue(event.target.value)}
            className="pl-9"
            disabled={isSaving}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-Mail</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input id="email" value={email} className="pl-9" readOnly />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Telefon</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="phone"
            value={phoneValue}
            onChange={(event) => setPhoneValue(event.target.value)}
            className="pl-9"
            disabled={isSaving}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Rolle</Label>
        <Input id="role" value={role} readOnly />
      </div>
      <Button type="submit" className="w-full" disabled={isSaving}>
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Speichert...
          </>
        ) : (
          'Profil speichern'
        )}
      </Button>
    </form>
  );
}
