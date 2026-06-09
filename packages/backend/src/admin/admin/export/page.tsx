import type { Metadata } from 'next';
import { AdminExportView } from '@/components/admin/admin-export-view';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Datenexport',
};

// ============================================
// EXPORT PAGE
// ============================================

export default function AdminExportPage() {
  return <AdminExportView />;
}
