import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiContext } from '@/lib/auth/admin-context';

// ============================================
// PUT - Update Template
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const context = await requireAdminApiContext(['admin', 'hq']);
    if ('response' in context) return context.response;

    const body = await request.json();
    const { id, subject, bodyHtml, bodyText, smsBody, isActive } = body;

    if (id) {
      // Update existing template
      const { data, error } = await context.db
        .from('notification_templates')
        .update({
          subject,
          body_html: bodyHtml,
          body_text: bodyText,
          sms_body: smsBody,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('salon_id', context.salonId)
        .select('id')
        .single();

      if (error || !data) {
        console.error('Template update error:', error);
        return NextResponse.json(
          { error: error?.message || 'Vorlage nicht gefunden' },
          { status: error ? 500 : 404 }
        );
      }
    } else {
      // Create new template
      const { code, name, channel = 'email', availableVariables = [] } = body;

      const { error } = await context.db
        .from('notification_templates')
        .insert({
          salon_id: context.salonId,
          code,
          name,
          channel,
          subject,
          body_html: bodyHtml,
          body_text: bodyText,
          sms_body: smsBody,
          available_variables: availableVariables,
          is_active: isActive ?? true,
        });

      if (error) {
        console.error('Template create error:', error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Template save error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
