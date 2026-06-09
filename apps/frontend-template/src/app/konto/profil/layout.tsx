import { redirect } from 'next/navigation';
import { features } from '@/lib/config/features';

// ============================================
// PROFILE LAYOUT
// Redirects to termine if shop is disabled
// ============================================

export default function ProfilLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Redirect to termine if shop is disabled (profile is part of shop features)
  if (!features.shopEnabled) {
    redirect('/konto/termine');
  }

  return <>{children}</>;
}
