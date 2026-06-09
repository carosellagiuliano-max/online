import type { Metadata } from 'next';
import { getAdminFeedback, getFeedbackStats } from '@/lib/actions';
import { AdminFeedbackList } from '@/components/admin/admin-feedback-list';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Bewertungen verwalten',
};

// ============================================
// DATA FETCHING
// ============================================

async function getFeedbackData() {
  const [feedbackResult, statsResult] = await Promise.all([
    getAdminFeedback(),
    getFeedbackStats(),
  ]);

  // Count by status
  const pending = feedbackResult.feedback.filter((f) => f.status === 'pending').length;
  const approved = feedbackResult.feedback.filter((f) => f.status === 'approved').length;

  return {
    feedback: feedbackResult.feedback,
    stats: {
      total: feedbackResult.total,
      pending,
      approved,
      averageRating: statsResult.averageRating,
    },
  };
}

// ============================================
// ADMIN BEWERTUNGEN PAGE
// ============================================

export default async function AdminBewertungenPage() {
  const { feedback, stats } = await getFeedbackData();

  return <AdminFeedbackList feedback={feedback} stats={stats} />;
}
