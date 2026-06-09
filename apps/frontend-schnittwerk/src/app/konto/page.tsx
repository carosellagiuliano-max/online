import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions';

// Force dynamic rendering (API not available at build time)
export const dynamic = 'force-dynamic';

// ============================================
// KONTO INDEX PAGE
// Redirects to dashboard or login
// ============================================

export default async function KontoPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/konto/login');
  }

  // Redirect to appropriate dashboard based on role
  const roleNames = (user.roles || []).map((role: any) => role.role_name);

  if (roleNames.includes('admin') || roleNames.includes('manager')) {
    redirect('/admin');
  } else if (roleNames.includes('mitarbeiter')) {
    redirect('/admin/kalender');
  }

  // Default: customer dashboard
  redirect('/konto/termine');
}
