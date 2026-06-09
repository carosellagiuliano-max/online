/**
 * BeautifyPRO - Feedback Server Actions
 * Functions for managing customer feedback/reviews
 */

'use server';

import { createServiceRoleClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logging/logger';
import { isMockMode } from '@/lib/mock/mock-auth';
import { MOCK_FEEDBACK } from '@/lib/mock/mock-data';

// Default salon ID (single-tenant setup)
const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';

// ============================================
// TYPES
// ============================================

export type FeedbackStatus = 'pending' | 'approved' | 'hidden' | 'flagged';

export interface PublicFeedback {
  id: string;
  name: string;
  rating: number;
  comment: string | null;
  submittedAt: Date;
}

export interface AdminFeedback {
  id: string;
  name: string;
  email: string | null;
  rating: number;
  comment: string | null;
  status: FeedbackStatus;
  response: string | null;
  respondedAt: Date | null;
  submittedAt: Date;
  ipAddress: string | null;
}

export interface SubmitFeedbackInput {
  name: string;
  rating: number;
  comment?: string;
  // Honeypot field - should be empty
  website?: string;
}

export interface SubmitFeedbackResult {
  success: boolean;
  error?: string;
}

export interface UpdateFeedbackStatusResult {
  success: boolean;
  error?: string;
}

// ============================================
// PUBLIC FUNCTIONS
// ============================================

/**
 * Get approved feedback for public display (homepage)
 * Returns the latest reviews with min. 4 stars, sorted by date (newest first)
 */
export async function getApprovedFeedback(limit: number = 6): Promise<PublicFeedback[]> {
  if (isMockMode()) {
    return MOCK_FEEDBACK
      .filter((item) => item.status === 'approved' && item.rating >= 4)
      .slice(0, limit)
      .map((item) => ({
        id: item.id,
        name: item.customer_name || 'Anonym',
        rating: item.rating,
        comment: item.comment,
        submittedAt: new Date(item.submitted_at),
      }));
  }

  const supabase = createServiceRoleClient() as any;
  if (!supabase) return [];

  const salonId = DEFAULT_SALON_ID;

  const { data, error } = await supabase
    .from('customer_feedback')
    .select('id, customer_name, rating, comment, submitted_at')
    .eq('salon_id', salonId)
    .eq('status', 'approved')
    .gte('rating', 4) // Minimum 4 stars
    .order('submitted_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to get approved feedback', error);
    return [];
  }

  return (data || []).map((item) => ({
    id: item.id,
    name: item.customer_name || 'Anonym',
    rating: item.rating,
    comment: item.comment,
    submittedAt: new Date(item.submitted_at),
  }));
}

/**
 * Get feedback statistics for public display
 */
export async function getFeedbackStats(): Promise<{
  averageRating: number;
  totalReviews: number;
}> {
  if (isMockMode()) {
    const approved = MOCK_FEEDBACK.filter((item) => item.status === 'approved');
    if (approved.length === 0) {
      return { averageRating: 0, totalReviews: 0 };
    }

    const sum = approved.reduce((acc, item) => acc + item.rating, 0);
    return {
      averageRating: Math.round((sum / approved.length) * 10) / 10,
      totalReviews: approved.length,
    };
  }

  const supabase = createServiceRoleClient() as any;
  if (!supabase) return { averageRating: 0, totalReviews: 0 };

  const salonId = DEFAULT_SALON_ID;

  const { data, error } = await supabase
    .from('customer_feedback')
    .select('rating')
    .eq('salon_id', salonId)
    .eq('status', 'approved');

  if (error || !data || data.length === 0) {
    return { averageRating: 0, totalReviews: 0 };
  }

  const totalReviews = data.length;
  const sum = data.reduce((acc, item) => acc + item.rating, 0);
  const averageRating = Math.round((sum / totalReviews) * 10) / 10;

  return { averageRating, totalReviews };
}

/**
 * Submit public feedback (anyone can submit)
 * Requires spam protection checks before calling this
 */
export async function submitPublicFeedback(
  input: SubmitFeedbackInput,
  ipAddress?: string
): Promise<SubmitFeedbackResult> {
  // Honeypot check - if website field is filled, it's spam
  if (input.website) {
    logger.warn('Honeypot triggered in feedback submission', { ipAddress });
    // Return success to not reveal the honeypot
    return { success: true };
  }

  // Validate input
  if (!input.name || input.name.trim().length < 2) {
    return { success: false, error: 'Bitte geben Sie Ihren Namen ein.' };
  }

  if (!input.rating || input.rating < 1 || input.rating > 5) {
    return { success: false, error: 'Bitte geben Sie eine Bewertung von 1-5 ab.' };
  }

  if (isMockMode()) {
    logger.info('Mock feedback submitted', { name: input.name, rating: input.rating });
    return { success: true };
  }

  const supabase = createServiceRoleClient() as any;
  if (!supabase) {
    return { success: false, error: 'Datenbankverbindung fehlgeschlagen.' };
  }

  const salonId = DEFAULT_SALON_ID;

  try {
    const { error } = await supabase.from('customer_feedback').insert({
      salon_id: salonId,
      customer_name: input.name.trim(),
      rating: input.rating,
      comment: input.comment?.trim() || null,
      status: 'pending',
      submitted_at: new Date().toISOString(),
      ip_address: ipAddress || null,
    });

    if (error) {
      logger.error('Failed to submit feedback', error);
      console.error('Feedback submission error:', error.message, error.details, error.hint);
      return { success: false, error: `Feedback konnte nicht gespeichert werden: ${error.message}` };
    }

    logger.info('Public feedback submitted', { name: input.name, rating: input.rating });
    return { success: true };
  } catch (err) {
    logger.error('Error submitting feedback', err);
    return { success: false, error: 'Ein Fehler ist aufgetreten.' };
  }
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

/**
 * Get all feedback for admin panel
 */
export async function getAdminFeedback(options?: {
  status?: FeedbackStatus;
  limit?: number;
  offset?: number;
}): Promise<{ feedback: AdminFeedback[]; total: number }> {
  if (isMockMode()) {
    const offset = options?.offset || 0;
    const limit = options?.limit || 20;
    const rows = MOCK_FEEDBACK
      .filter((item) => !options?.status || item.status === options.status)
      .map((item) => ({
        id: item.id,
        name: item.customer_name || 'Anonym',
        email: null,
        rating: item.rating,
        comment: item.comment,
        status: item.status as FeedbackStatus,
        response: null,
        respondedAt: null,
        submittedAt: new Date(item.submitted_at),
        ipAddress: null,
      }));

    return { feedback: rows.slice(offset, offset + limit), total: rows.length };
  }

  const supabase = createServiceRoleClient() as any;
  if (!supabase) return { feedback: [], total: 0 };

  const salonId = DEFAULT_SALON_ID;

  let query = supabase
    .from('customer_feedback')
    .select('*', { count: 'exact' })
    .eq('salon_id', salonId)
    .order('submitted_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
  }

  const { data, count, error } = await query;

  if (error) {
    logger.error('Failed to get admin feedback', error);
    return { feedback: [], total: 0 };
  }

  const feedback = (data || []).map((item) => ({
    id: item.id,
    name: item.customer_name || 'Anonym',
    email: item.customer_email || null,
    rating: item.rating,
    comment: item.comment,
    status: item.status as FeedbackStatus,
    response: item.response,
    respondedAt: item.responded_at ? new Date(item.responded_at) : null,
    submittedAt: new Date(item.submitted_at),
    ipAddress: item.ip_address || null,
  }));

  return { feedback, total: count || 0 };
}

/**
 * Get pending feedback count for admin dashboard
 */
export async function getPendingFeedbackCount(): Promise<number> {
  if (isMockMode()) {
    return MOCK_FEEDBACK.filter((item) => item.status === 'pending').length;
  }

  const supabase = createServiceRoleClient() as any;
  if (!supabase) return 0;

  const salonId = DEFAULT_SALON_ID;

  const { count, error } = await supabase
    .from('customer_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('salon_id', salonId)
    .eq('status', 'pending');

  if (error) {
    logger.error('Failed to get pending feedback count', error);
    return 0;
  }

  return count || 0;
}

/**
 * Update feedback status (approve, hide, flag)
 */
export async function updateFeedbackStatus(
  feedbackId: string,
  status: FeedbackStatus
): Promise<UpdateFeedbackStatusResult> {
  if (isMockMode()) {
    logger.info('Mock feedback status update', { feedbackId, status });
    return { success: true };
  }

  const supabase = createServiceRoleClient() as any;
  if (!supabase) {
    return { success: false, error: 'Datenbankverbindung fehlgeschlagen.' };
  }

  const salonId = DEFAULT_SALON_ID;

  const { error } = await supabase
    .from('customer_feedback')
    .update({ status })
    .eq('id', feedbackId)
    .eq('salon_id', salonId);

  if (error) {
    logger.error('Failed to update feedback status', error, { feedbackId, status });
    return { success: false, error: 'Status konnte nicht aktualisiert werden.' };
  }

  logger.info('Feedback status updated', { feedbackId, status });
  return { success: true };
}

/**
 * Respond to feedback
 */
export async function respondToFeedback(
  feedbackId: string,
  response: string
): Promise<UpdateFeedbackStatusResult> {
  const supabase = createServiceRoleClient() as any;
  if (!supabase) {
    return { success: false, error: 'Datenbankverbindung fehlgeschlagen.' };
  }

  const salonId = DEFAULT_SALON_ID;

  const { error } = await supabase
    .from('customer_feedback')
    .update({
      response: response.trim(),
      responded_at: new Date().toISOString(),
    })
    .eq('id', feedbackId)
    .eq('salon_id', salonId);

  if (error) {
    logger.error('Failed to respond to feedback', error, { feedbackId });
    return { success: false, error: 'Antwort konnte nicht gespeichert werden.' };
  }

  logger.info('Feedback response added', { feedbackId });
  return { success: true };
}

/**
 * Delete feedback (soft delete by setting status to hidden)
 */
export async function deleteFeedback(feedbackId: string): Promise<UpdateFeedbackStatusResult> {
  return updateFeedbackStatus(feedbackId, 'hidden');
}
