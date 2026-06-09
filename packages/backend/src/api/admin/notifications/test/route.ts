import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiContext } from '@/lib/auth/admin-context';
import { sendEmail } from '@/lib/email/send';
import { getFormattedAddress, DEFAULT_SALON_CONFIG } from '@/lib/salon/config';
import { getSalon } from '@/lib/actions';

// ============================================
// POST - Send Test Email
// ============================================

export async function POST(request: NextRequest) {
  try {
    const context = await requireAdminApiContext(['admin', 'hq']);
    if ('response' in context) return context.response;

    const body = await request.json();
    const { templateId, recipientEmail } = body;

    if (!templateId || !recipientEmail) {
      return NextResponse.json(
        { error: 'Template-ID und Empfänger erforderlich' },
        { status: 400 }
      );
    }

    // Get template
    const { data: template, error: templateError } = await context.db
      .from('notification_templates')
      .select('*')
      .eq('id', templateId)
      .eq('salon_id', context.salonId)
      .single();

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Vorlage nicht gefunden' },
        { status: 404 }
      );
    }

    // Get salon config for sample data
    const salon = await getSalon(context.salonId);
    const salonConfig = salon
      ? {
          ...DEFAULT_SALON_CONFIG,
          id: salon.id,
          name: salon.name,
          slug: salon.slug,
          address: {
            street: salon.address,
            zipCode: salon.zipCode,
            city: salon.city,
            country: salon.country,
          },
          phone: salon.phone,
          email: salon.email,
          website: salon.website,
          timezone: salon.timezone,
          currency: salon.currency,
        }
      : DEFAULT_SALON_CONFIG;

    // Build sample data with actual salon info
    const sampleData: Record<string, string> = {
      customer_name: 'Max Muster',
      appointment_date: '15.01.2025',
      appointment_time: '14:30',
      service_name: 'Herrenschnitt',
      staff_name: 'Anna Schmidt',
      salon_name: salonConfig.name || DEFAULT_SALON_CONFIG.name,
      salon_address: getFormattedAddress(salonConfig),
      order_number: 'ORD-2025-00001',
      order_total: `${salonConfig.currency || 'CHF'} 125.00`,
      order_items: 'Shampoo (1x), Conditioner (1x)',
      tracking_number: '123456789',
      tracking_url: 'https://post.ch/tracking/123456789',
      recipient_name: 'Maria Muster',
      sender_name: 'Max Muster',
      voucher_code: 'GIFT-ABC123',
      voucher_amount: `${salonConfig.currency || 'CHF'} 50.00`,
      personal_message: 'Alles Gute zum Geburtstag!',
      expiry_date: '31.12.2025',
      cancellation_reason: 'Terminkonflikt',
    };

    // Replace variables with sample data
    let subject = template.subject || 'Test-E-Mail';
    let bodyHtml = template.body_html || '';
    let bodyText = template.body_text || '';

    for (const [key, value] of Object.entries(sampleData)) {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder, 'g'), value);
      bodyHtml = bodyHtml.replace(new RegExp(placeholder, 'g'), value);
      bodyText = bodyText.replace(new RegExp(placeholder, 'g'), value);
    }

    // Send test email
    const result = await sendEmail({
      to: recipientEmail,
      subject: `[TEST] ${subject}`,
      html: bodyHtml,
      text: bodyText,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Fehler beim Senden' },
        { status: 500 }
      );
    }

    // Log the test notification
    await context.db.from('notifications').insert({
      salon_id: context.salonId,
      template_id: templateId,
      template_code: template.code,
      channel: 'email',
      recipient_email: recipientEmail,
      subject: `[TEST] ${subject}`,
      body_html: bodyHtml,
      body_text: bodyText,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Test-E-Mail an ${recipientEmail} gesendet`,
    });
  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
