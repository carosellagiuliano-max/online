/**
 * BeautifyPRO - Customer Feedback Service
 * Manage customer reviews, ratings, and feedback requests
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logging/logger';

// ============================================
// TYPES
// ============================================

export type FeedbackStatus = 'pending' | 'approved' | 'hidden' | 'flagged';

export interface CustomerFeedback {
  id: string;
  salonId: string;
  customerId: string;
  appointmentId: string | null;
  staffId: string | null;
  serviceId: string | null;
  rating: number;
  comment: string | null;
  serviceQuality: number | null;
  cleanliness: number | null;
  waitTime: number | null;
  valueForMoney: number | null;
  response: string | null;
  respondedAt: Date | null;
  status: FeedbackStatus;
  googleReviewPrompted: boolean;
  googleReviewClicked: boolean;
  submittedAt: Date;
}

export interface FeedbackWithDetails extends CustomerFeedback {
  customerName: string;
  serviceName: string | null;
  staffName: string | null;
}

export interface FeedbackRequest {
  id: string;
  salonId: string;
  appointmentId: string;
  customerId: string;
  channel: 'email' | 'sms';
  token: string;
  expiresAt: Date;
  opened: boolean;
  completed: boolean;
  sentAt: Date;
}

export interface FeedbackStats {
  totalReviews: number;
  averageRating: number;
  fiveStar: number;
  fourStar: number;
  threeStar: number;
  twoStar: number;
  oneStar: number;
  responseRate: number;
  avgServiceQuality: number | null;
  avgCleanliness: number | null;
  avgValueForMoney: number | null;
}

export interface SubmitFeedbackParams {
  rating: number;
  comment?: string;
  serviceQuality?: number;
  cleanliness?: number;
  waitTime?: number;
  valueForMoney?: number;
}

// ============================================
// FEEDBACK SERVICE
// ============================================

export class FeedbackService {
  private get supabase() {
    return createServiceRoleClient();
  }

  /**
   * Create a feedback request for a completed appointment
   */
  async createFeedbackRequest(
    appointmentId: string,
    channel: 'email' | 'sms' = 'email'
  ): Promise<{ id: string; token: string } | null> {
    const { data, error } = await this.supabase.rpc('create_feedback_request', {
      p_appointment_id: appointmentId,
      p_channel: channel,
    });

    if (error) {
      logger.error('Failed to create feedback request', error, { appointmentId });
      return null;
    }

    if (!data) return null;

    // Get the token
    const { data: request } = await this.supabase
      .from('feedback_requests')
      .select('id, token')
      .eq('id', data)
      .single();

    logger.info('Feedback request created', { appointmentId, requestId: data });
    return request;
  }

  /**
   * Submit feedback using a secure token
   */
  async submitFeedbackByToken(
    token: string,
    params: SubmitFeedbackParams
  ): Promise<{ id: string } | null> {
    const { data, error } = await this.supabase.rpc('submit_feedback_by_token', {
      p_token: token,
      p_rating: params.rating,
      p_comment: params.comment || null,
      p_service_quality: params.serviceQuality || null,
      p_cleanliness: params.cleanliness || null,
      p_wait_time: params.waitTime || null,
      p_value_for_money: params.valueForMoney || null,
    });

    if (error) {
      logger.error('Failed to submit feedback', error);
      throw new Error(error.message);
    }

    logger.info('Feedback submitted', { feedbackId: data });
    return { id: data };
  }

  /**
   * Submit feedback directly (for logged-in customers)
   */
  async submitFeedback(
    customerId: string,
    salonId: string,
    params: SubmitFeedbackParams & {
      appointmentId?: string;
      staffId?: string;
      serviceId?: string;
    }
  ): Promise<{ id: string } | null> {
    const { data, error } = await this.supabase
      .from('customer_feedback')
      .insert({
        customer_id: customerId,
        salon_id: salonId,
        appointment_id: params.appointmentId,
        staff_id: params.staffId,
        service_id: params.serviceId,
        rating: params.rating,
        comment: params.comment,
        service_quality: params.serviceQuality,
        cleanliness: params.cleanliness,
        wait_time: params.waitTime,
        value_for_money: params.valueForMoney,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to submit feedback', error, { customerId });
      return null;
    }

    logger.info('Feedback submitted', { feedbackId: data.id, customerId });
    return { id: data.id };
  }

  /**
   * Get feedback by ID
   */
  async getFeedback(feedbackId: string): Promise<FeedbackWithDetails | null> {
    const { data, error } = await this.supabase
      .from('v_recent_feedback')
      .select('*')
      .eq('id', feedbackId)
      .single();

    if (error) {
      logger.error('Failed to get feedback', error);
      return null;
    }

    return this.mapFeedback(data);
  }

  /**
   * Get feedback request by token
   */
  async getFeedbackRequestByToken(token: string): Promise<FeedbackRequest | null> {
    const { data, error } = await this.supabase
      .from('feedback_requests')
      .select('*')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .eq('completed', false)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        logger.error('Failed to get feedback request', error);
      }
      return null;
    }

    return {
      id: data.id,
      salonId: data.salon_id,
      appointmentId: data.appointment_id,
      customerId: data.customer_id,
      channel: data.channel,
      token: data.token,
      expiresAt: new Date(data.expires_at),
      opened: data.opened,
      completed: data.completed,
      sentAt: new Date(data.sent_at),
    };
  }

  /**
   * Mark feedback request as opened
   */
  async markRequestOpened(token: string): Promise<void> {
    await this.supabase
      .from('feedback_requests')
      .update({ opened: true, opened_at: new Date().toISOString() })
      .eq('token', token);
  }

  /**
   * Get salon feedback list
   */
  async getSalonFeedback(
    salonId: string,
    options?: {
      status?: FeedbackStatus;
      staffId?: string;
      minRating?: number;
      maxRating?: number;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ feedback: FeedbackWithDetails[]; total: number }> {
    let query = this.supabase
      .from('customer_feedback')
      .select(`
        *,
        customer:customers(first_name, last_name),
        service:services(name),
        staff:staff(first_name, last_name)
      `, { count: 'exact' })
      .eq('salon_id', salonId)
      .order('submitted_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.staffId) {
      query = query.eq('staff_id', options.staffId);
    }
    if (options?.minRating) {
      query = query.gte('rating', options.minRating);
    }
    if (options?.maxRating) {
      query = query.lte('rating', options.maxRating);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, count, error } = await query;

    if (error) {
      logger.error('Failed to get salon feedback', error);
      return { feedback: [], total: 0 };
    }

    const feedback = (data || []).map((item) => ({
      ...this.mapFeedbackFromJoin(item),
    }));

    return { feedback, total: count || 0 };
  }

  /**
   * Get customer's feedback history
   */
  async getCustomerFeedback(customerId: string): Promise<FeedbackWithDetails[]> {
    const { data, error } = await this.supabase
      .from('customer_feedback')
      .select(`
        *,
        service:services(name),
        staff:staff(first_name, last_name)
      `)
      .eq('customer_id', customerId)
      .order('submitted_at', { ascending: false });

    if (error) {
      logger.error('Failed to get customer feedback', error);
      return [];
    }

    return (data || []).map(this.mapFeedbackFromJoin);
  }

  /**
   * Get feedback statistics for salon
   */
  async getSalonStats(salonId: string, staffId?: string): Promise<FeedbackStats> {
    let query = this.supabase
      .from('v_feedback_summary')
      .select('*')
      .eq('salon_id', salonId);

    if (staffId) {
      query = query.eq('staff_id', staffId);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        fiveStar: 0,
        fourStar: 0,
        threeStar: 0,
        twoStar: 0,
        oneStar: 0,
        responseRate: 0,
        avgServiceQuality: null,
        avgCleanliness: null,
        avgValueForMoney: null,
      };
    }

    // Aggregate if multiple staff
    const stats = data.reduce(
      (acc, row) => ({
        totalReviews: acc.totalReviews + (row.total_reviews || 0),
        fiveStar: acc.fiveStar + (row.five_star || 0),
        fourStar: acc.fourStar + (row.four_star || 0),
        threeStar: acc.threeStar + (row.three_star || 0),
        twoStar: acc.twoStar + (row.two_star || 0),
        oneStar: acc.oneStar + (row.one_star || 0),
        ratingSum: acc.ratingSum + ((row.average_rating || 0) * (row.total_reviews || 0)),
        serviceQualitySum: acc.serviceQualitySum + ((row.avg_service_quality || 0) * (row.total_reviews || 0)),
        cleanlinessSum: acc.cleanlinessSum + ((row.avg_cleanliness || 0) * (row.total_reviews || 0)),
        valueSum: acc.valueSum + ((row.avg_value_for_money || 0) * (row.total_reviews || 0)),
      }),
      {
        totalReviews: 0,
        fiveStar: 0,
        fourStar: 0,
        threeStar: 0,
        twoStar: 0,
        oneStar: 0,
        ratingSum: 0,
        serviceQualitySum: 0,
        cleanlinessSum: 0,
        valueSum: 0,
      }
    );

    const total = stats.totalReviews || 1;

    return {
      totalReviews: stats.totalReviews,
      averageRating: Math.round((stats.ratingSum / total) * 10) / 10,
      fiveStar: stats.fiveStar,
      fourStar: stats.fourStar,
      threeStar: stats.threeStar,
      twoStar: stats.twoStar,
      oneStar: stats.oneStar,
      responseRate: 0, // TODO: Calculate from responses
      avgServiceQuality: stats.serviceQualitySum > 0 ? Math.round((stats.serviceQualitySum / total) * 10) / 10 : null,
      avgCleanliness: stats.cleanlinessSum > 0 ? Math.round((stats.cleanlinessSum / total) * 10) / 10 : null,
      avgValueForMoney: stats.valueSum > 0 ? Math.round((stats.valueSum / total) * 10) / 10 : null,
    };
  }

  /**
   * Respond to feedback
   */
  async respondToFeedback(
    feedbackId: string,
    response: string,
    respondedBy: string
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from('customer_feedback')
      .update({
        response,
        responded_at: new Date().toISOString(),
        responded_by: respondedBy,
      })
      .eq('id', feedbackId);

    if (error) {
      logger.error('Failed to respond to feedback', error);
      return false;
    }

    logger.info('Feedback response added', { feedbackId });
    return true;
  }

  /**
   * Update feedback status
   */
  async updateFeedbackStatus(feedbackId: string, status: FeedbackStatus): Promise<boolean> {
    const { error } = await this.supabase
      .from('customer_feedback')
      .update({ status })
      .eq('id', feedbackId);

    if (error) {
      logger.error('Failed to update feedback status', error);
      return false;
    }

    logger.info('Feedback status updated', { feedbackId, status });
    return true;
  }

  /**
   * Mark that Google Review was prompted
   */
  async markGoogleReviewPrompted(feedbackId: string, clicked: boolean): Promise<void> {
    await this.supabase
      .from('customer_feedback')
      .update({
        google_review_prompted: true,
        google_review_clicked: clicked,
      })
      .eq('id', feedbackId);
  }

  /**
   * Get rating trend over time
   */
  async getRatingTrend(
    salonId: string,
    days: number = 30
  ): Promise<Array<{ date: string; avgRating: number; count: number }>> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const { data, error } = await this.supabase
      .from('customer_feedback')
      .select('rating, submitted_at')
      .eq('salon_id', salonId)
      .eq('status', 'approved')
      .gte('submitted_at', cutoff.toISOString())
      .order('submitted_at', { ascending: true });

    if (error || !data) {
      return [];
    }

    // Group by date
    const byDate: Record<string, { sum: number; count: number }> = {};
    data.forEach((item) => {
      const date = new Date(item.submitted_at).toISOString().split('T')[0];
      if (!byDate[date]) {
        byDate[date] = { sum: 0, count: 0 };
      }
      byDate[date].sum += item.rating;
      byDate[date].count += 1;
    });

    return Object.entries(byDate).map(([date, { sum, count }]) => ({
      date,
      avgRating: Math.round((sum / count) * 10) / 10,
      count,
    }));
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private mapFeedback(data: Record<string, unknown>): FeedbackWithDetails {
    return {
      id: data.id as string,
      salonId: data.salon_id as string,
      customerId: data.customer_id as string,
      appointmentId: data.appointment_id as string | null,
      staffId: data.staff_id as string | null,
      serviceId: data.service_id as string | null,
      rating: data.rating as number,
      comment: data.comment as string | null,
      serviceQuality: data.service_quality as number | null,
      cleanliness: data.cleanliness as number | null,
      waitTime: data.wait_time as number | null,
      valueForMoney: data.value_for_money as number | null,
      response: data.response as string | null,
      respondedAt: data.responded_at ? new Date(data.responded_at as string) : null,
      status: data.status as FeedbackStatus,
      googleReviewPrompted: data.google_review_prompted as boolean,
      googleReviewClicked: data.google_review_clicked as boolean,
      submittedAt: new Date(data.submitted_at as string),
      customerName: data.customer_name as string,
      serviceName: data.service_name as string | null,
      staffName: data.staff_name as string | null,
    };
  }

  private mapFeedbackFromJoin(data: Record<string, unknown>): FeedbackWithDetails {
    const customer = data.customer as { first_name: string; last_name: string } | null;
    const service = data.service as { name: string } | null;
    const staff = data.staff as { first_name: string; last_name: string } | null;

    return {
      id: data.id as string,
      salonId: data.salon_id as string,
      customerId: data.customer_id as string,
      appointmentId: data.appointment_id as string | null,
      staffId: data.staff_id as string | null,
      serviceId: data.service_id as string | null,
      rating: data.rating as number,
      comment: data.comment as string | null,
      serviceQuality: data.service_quality as number | null,
      cleanliness: data.cleanliness as number | null,
      waitTime: data.wait_time as number | null,
      valueForMoney: data.value_for_money as number | null,
      response: data.response as string | null,
      respondedAt: data.responded_at ? new Date(data.responded_at as string) : null,
      status: data.status as FeedbackStatus,
      googleReviewPrompted: (data.google_review_prompted as boolean) || false,
      googleReviewClicked: (data.google_review_clicked as boolean) || false,
      submittedAt: new Date(data.submitted_at as string),
      customerName: customer ? `${customer.first_name} ${customer.last_name}` : 'Unbekannt',
      serviceName: service?.name || null,
      staffName: staff ? `${staff.first_name} ${staff.last_name}` : null,
    };
  }
}

// ============================================
// SINGLETON
// ============================================

let feedbackServiceInstance: FeedbackService | null = null;

export function getFeedbackService(): FeedbackService {
  if (!feedbackServiceInstance) {
    feedbackServiceInstance = new FeedbackService();
  }
  return feedbackServiceInstance;
}
