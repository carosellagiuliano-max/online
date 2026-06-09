import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { User, Calendar, Lock } from 'lucide-react';

// Force dynamic rendering (API not available at build time)
export const dynamic = 'force-dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { getCurrentUser, getCustomerProfile } from '@/lib/actions';
import { ProfileEditForm, DeleteAccountButton } from '@/components/customer';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Mein Profil',
  description: 'Verwalten Sie Ihr BeautifyPRO Profil.',
};

// ============================================
// PAGE COMPONENT
// ============================================

export default async function ProfilPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/konto/login?redirect=/konto/profil');
  }

  const profile = await getCustomerProfile(user.id);

  if (!profile) {
    redirect('/konto/login');
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Mein Profil</h2>

      {/* Profile Card */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Persönliche Daten
          </CardTitle>
          <CardDescription>Aktualisieren Sie Ihre persönlichen Informationen.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileEditForm profile={profile} />
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Konto-Informationen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Mitglied seit</span>
            <span>{format(profile.createdAt, 'd. MMMM yyyy', { locale: de })}</span>
          </div>
          <Separator />
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Konto-ID</span>
            <span className="text-xs font-mono text-muted-foreground">
              {profile.id.slice(0, 8)}...
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Security Card */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Sicherheit
          </CardTitle>
          <CardDescription>Verwalten Sie Ihr Passwort und Ihre Sicherheitseinstellungen.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Passwort</p>
              <p className="text-sm text-muted-foreground">
                Ändern Sie Ihr Passwort regelmässig für mehr Sicherheit.
              </p>
            </div>
            <Button variant="outline" asChild>
              <a href="/konto/passwort-aendern">Passwort ändern</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Gefahrenzone</CardTitle>
          <CardDescription>
            Irreversible und destruktive Aktionen für Ihr Konto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Konto löschen</p>
              <p className="text-sm text-muted-foreground">
                Ihr Konto wird deaktiviert und Ihre persönlichen Daten werden anonymisiert.
              </p>
            </div>
            <DeleteAccountButton userId={user.id} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
