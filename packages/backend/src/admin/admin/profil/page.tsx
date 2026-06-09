import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Lock } from 'lucide-react';
import { AdminPasswordForm } from '@/components/admin/admin-password-form';
import { AdminProfileForm } from '@/components/admin/admin-profile-form';

// Force dynamic rendering (API not available at build time)
export const dynamic = 'force-dynamic';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Profil',
};

// ============================================
// TYPES
// ============================================

interface StaffMemberRow {
  id: string;
  display_name: string | null;
  phone: string | null;
  role: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
}

// ============================================
// DATA FETCHING
// ============================================

async function getProfileData() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, staff: null, profile: null };
  }

  // Try to get staff record
  const { data: staffMember } = await supabase
    .from('staff')
    .select('id, display_name, phone, role, created_at')
    .eq('profile_id', user.id)
    .single() as { data: StaffMemberRow | null };

  // Also get profile record as fallback
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, phone, created_at')
    .eq('id', user.id)
    .single() as { data: ProfileRow | null };

  return {
    user,
    staff: staffMember,
    profile,
  };
}

// ============================================
// ADMIN PROFILE PAGE
// ============================================

export default async function AdminProfilePage() {
  const { user, staff, profile } = await getProfileData();

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Nicht angemeldet</p>
      </div>
    );
  }

  // Get display name from staff or profile
  const displayName = staff?.display_name
    || (profile?.first_name && profile?.last_name
        ? `${profile.first_name} ${profile.last_name}`
        : user.email?.split('@')[0] || '');

  // Get phone from staff or profile
  const phone = staff?.phone || profile?.phone || '';

  // Get role - default to 'Admin' if no staff record
  const role = staff?.role || 'Admin';

  // Get created date from staff, profile, or user
  const createdAt = staff?.created_at || profile?.created_at || user.created_at;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mein Profil</h1>
        <p className="text-muted-foreground mt-2">
          Verwalten Sie Ihre persönlichen Informationen
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>Persönliche Informationen</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminProfileForm
              displayName={displayName}
              email={user.email || ''}
              phone={phone}
              role={role}
            />
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle>Konto-Informationen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="memberSince">Mitglied seit</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="memberSince"
                  defaultValue={createdAt ? new Date(createdAt).toLocaleDateString('de-CH') : '-'}
                  className="pl-9"
                  readOnly
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="userId">Benutzer-ID</Label>
              <Input id="userId" defaultValue={user.id} readOnly className="font-mono text-xs" />
            </div>
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Passwort ändern
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AdminPasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}






