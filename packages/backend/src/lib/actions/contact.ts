'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { createServerClient } from '@/lib/db/client';
import { getSalon } from './salon';
import { sendEmail } from '@/lib/email/send';

// ============================================
// CONTACT FORM SERVER ACTIONS
// ============================================

// ============================================
// RATE LIMITING (Simple in-memory)
// ============================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_WINDOW = 5; // 5 contact submissions per hour per IP

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - entry.count };
}

// Clean up old entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap.entries()) {
      if (entry.resetAt < now) {
        rateLimitMap.delete(ip);
      }
    }
  }, 60 * 60 * 1000); // Clean up every hour
}

// Validation schema
const contactFormSchema = z.object({
  firstName: z.string().min(1, 'Vorname ist erforderlich').max(100),
  lastName: z.string().min(1, 'Nachname ist erforderlich').max(100),
  email: z.string().email('Ungültige E-Mail-Adresse'),
  phone: z.string().max(30).optional(),
  reason: z.enum(['termin', 'beratung', 'bewerbung', 'feedback', 'sonstiges']),
  message: z.string().min(10, 'Nachricht muss mindestens 10 Zeichen lang sein').max(5000),
  // Honeypot field - should be empty
  website: z.string().max(0).optional(),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;

export type ContactFormResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

// Reason labels for email
const REASON_LABELS: Record<string, string> = {
  termin: 'Terminanfrage',
  beratung: 'Beratungsgespräch',
  bewerbung: 'Bewerbung',
  feedback: 'Feedback',
  sonstiges: 'Sonstiges',
};

// ============================================
// SUBMIT CONTACT FORM
// ============================================

export async function submitContactForm(
  formData: FormData
): Promise<ContactFormResult> {
  try {
    // Get client IP for rate limiting
    const headersList = await headers();
    const forwarded = headersList.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      'unknown';

    // Check rate limit
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      console.warn('Rate limit exceeded for contact form', { ip });
      return {
        success: false,
        error: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.',
      };
    }

    // Parse form data
    const rawData = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string | undefined,
      reason: formData.get('reason') as string,
      message: formData.get('message') as string,
      website: formData.get('website') as string | undefined, // Honeypot
    };

    // Honeypot check - if website field is filled, it's spam
    if (rawData.website) {
      console.warn('Honeypot triggered in contact form', { ip });
      // Return success to not reveal the honeypot
      return { success: true };
    }

    // Validate
    const validation = contactFormSchema.safeParse(rawData);

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      return {
        success: false,
        error: 'Bitte überprüfen Sie Ihre Eingaben.',
        fieldErrors,
      };
    }

    const data = validation.data;

    // Get salon info
    const salon = await getSalon();

    // Store inquiry in database
    const supabase = createServerClient() as any;

    const { error: dbError } = await supabase
      .from('contact_inquiries')
      .insert({
        salon_id: salon?.id || '550e8400-e29b-41d4-a716-446655440001',
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone || null,
        reason: data.reason,
        message: data.message,
        status: 'new',
      });

    if (dbError) {
      console.error('Error storing contact inquiry:', dbError);
      // Continue anyway - email is more important
    }

    // Send notification email
    const emailSent = await sendContactNotificationEmail(data, salon);

    if (!emailSent) {
      console.error('Failed to send contact notification email');
      // Still return success if DB save worked
    }

    // Log to audit
    await supabase
      .from('audit_logs')
      .insert({
        salon_id: salon?.id || '550e8400-e29b-41d4-a716-446655440001',
        action_type: 'contact_inquiry_submitted',
        target_type: 'contact_inquiry',
        metadata: {
          email: data.email,
          reason: data.reason,
        },
      });

    return { success: true };
  } catch (error) {
    console.error('Contact form submission error:', error);
    return {
      success: false,
      error: 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.',
    };
  }
}

// ============================================
// SEND NOTIFICATION EMAIL
// ============================================

async function sendContactNotificationEmail(
  data: ContactFormData,
  salon: { name: string; email: string | null } | null
): Promise<boolean> {
  const toEmail = salon?.email || process.env.SMTP_ADMIN_EMAIL || '';
  const salonName = salon?.name || 'Salon';

  const emailHtml = `
    <h2>Neue Kontaktanfrage über die Website</h2>

    <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Name:</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(data.firstName)} ${escapeHtml(data.lastName)}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">E-Mail:</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></td>
      </tr>
      ${data.phone ? `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Telefon:</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="tel:${escapeHtml(data.phone)}">${escapeHtml(data.phone)}</a></td>
      </tr>
      ` : ''}
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Anliegen:</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${REASON_LABELS[data.reason] || data.reason}</td>
      </tr>
    </table>

    <h3 style="margin-top: 24px;">Nachricht:</h3>
    <div style="background: #f9f9f9; padding: 16px; border-radius: 4px; white-space: pre-wrap;">
${escapeHtml(data.message)}
    </div>

    <p style="margin-top: 24px; color: #666; font-size: 12px;">
      Diese Nachricht wurde über das Kontaktformular auf ${salonName} gesendet.
    </p>
  `;

  const result = await sendEmail({
    to: toEmail,
    subject: `[${REASON_LABELS[data.reason]}] Kontaktanfrage von ${data.firstName} ${data.lastName}`,
    html: emailHtml,
    replyTo: data.email,
  });

  return result.success;
}

// ============================================
// HELPER: Escape HTML
// ============================================

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// ============================================
// CONTACT INQUIRY TYPES
// ============================================

export type ContactInquiryStatus = 'new' | 'in_progress' | 'resolved' | 'spam';

export interface ContactInquiry {
  id: string;
  salonId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  reason: string;
  message: string;
  status: ContactInquiryStatus;
  assignedTo: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

// ============================================
// GET ALL CONTACT INQUIRIES
// ============================================

export async function getContactInquiries(): Promise<ContactInquiry[]> {
  const supabase = createServerClient() as any;
  const salon = await getSalon();

  if (!salon) return [];

  const { data, error } = await supabase
    .from('contact_inquiries')
    .select('*')
    .eq('salon_id', salon.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching contact inquiries:', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    salonId: row.salon_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    reason: row.reason,
    message: row.message,
    status: row.status as ContactInquiryStatus,
    assignedTo: row.assigned_to,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  }));
}

// ============================================
// GET SINGLE CONTACT INQUIRY
// ============================================

export async function getContactInquiry(id: string): Promise<ContactInquiry | null> {
  const supabase = createServerClient() as any;

  const { data, error } = await supabase
    .from('contact_inquiries')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error('Error fetching contact inquiry:', error);
    return null;
  }

  return {
    id: data.id,
    salonId: data.salon_id,
    firstName: data.first_name,
    lastName: data.last_name,
    email: data.email,
    phone: data.phone,
    reason: data.reason,
    message: data.message,
    status: data.status as ContactInquiryStatus,
    assignedTo: data.assigned_to,
    notes: data.notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    resolvedAt: data.resolved_at,
  };
}

// ============================================
// UPDATE CONTACT INQUIRY STATUS
// ============================================

export async function updateContactInquiryStatus(
  id: string,
  status: ContactInquiryStatus,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerClient() as any;

  const updateData: Record<string, unknown> = { status };

  if (notes !== undefined) {
    updateData.notes = notes;
  }

  if (status === 'resolved') {
    updateData.resolved_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('contact_inquiries')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('Error updating contact inquiry:', error);
    return { success: false, error: 'Fehler beim Aktualisieren der Anfrage.' };
  }

  return { success: true };
}

// ============================================
// SEND REPLY EMAIL
// ============================================

export async function sendContactReply(
  inquiryId: string,
  subject: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  // Get the inquiry details
  const inquiry = await getContactInquiry(inquiryId);

  if (!inquiry) {
    return { success: false, error: 'Anfrage nicht gefunden.' };
  }

  // Get salon info for sender
  const salon = await getSalon();
  const salonName = salon?.name || 'Salon';

  const emailHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <p>Guten Tag ${escapeHtml(inquiry.firstName)} ${escapeHtml(inquiry.lastName)},</p>

      <div style="white-space: pre-wrap; margin: 24px 0;">
${escapeHtml(message)}
      </div>

      <p style="margin-top: 32px;">
        Mit freundlichen Grüssen<br />
        ${escapeHtml(salonName)}
      </p>

      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />

      <p style="color: #666; font-size: 12px;">
        Dies ist eine Antwort auf Ihre Kontaktanfrage vom ${new Date(inquiry.createdAt).toLocaleDateString('de-CH')}.
      </p>
    </div>
  `;

  const result = await sendEmail({
    to: inquiry.email,
    subject: subject,
    html: emailHtml,
  });

  if (!result.success) {
    console.error('Email send failed:', result.error);
    return { success: false, error: 'Fehler beim Senden der E-Mail.' };
  }

  // Update the inquiry status to in_progress if it was new
  if (inquiry.status === 'new') {
    await updateContactInquiryStatus(inquiryId, 'in_progress');
  }

  // Add note about reply
  const supabase = createServerClient() as any;
  const currentNotes = inquiry.notes || '';
  const timestamp = new Date().toLocaleString('de-CH');
  const newNote = `[${timestamp}] Antwort gesendet: ${subject}`;

  await supabase
    .from('contact_inquiries')
    .update({
      notes: currentNotes ? `${currentNotes}\n${newNote}` : newNote,
    })
    .eq('id', inquiryId);

  return { success: true };
}

// ============================================
// DELETE CONTACT INQUIRY
// ============================================

export async function deleteContactInquiry(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerClient() as any;

  const { error } = await supabase
    .from('contact_inquiries')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting contact inquiry:', error);
    return { success: false, error: 'Fehler beim Löschen der Anfrage.' };
  }

  return { success: true };
}
