import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getCurrentStaffMember } from '@/lib/auth/rbac';
import { resolveStaffSalonId } from '@/lib/auth/admin-context';
import { AdminNotificationTemplatesView } from '@/components/admin/admin-notification-templates-view';

// Force dynamic rendering (API not available at build time)
export const dynamic = 'force-dynamic';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Benachrichtigungen',
};

// ============================================
// TYPES
// ============================================

interface NotificationTemplate {
  id: string;
  name: string;
  code: string;
  channel: 'email' | 'sms' | 'push';
  subject: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  smsBody: string | null;
  availableVariables: string[];
  isActive: boolean;
  updatedAt: string;
}

interface NotificationLog {
  id: string;
  templateCode: string;
  channel: string;
  recipientEmail: string | null;
  subject: string | null;
  status: string;
  sentAt: string | null;
  createdAt: string;
  errorMessage: string | null;
}

// Supabase row types
interface TemplateRow {
  id: string;
  name: string;
  code: string;
  channel: string;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  sms_body: string | null;
  available_variables: string[] | null;
  is_active: boolean;
  updated_at: string;
}

interface NotificationLogRow {
  id: string;
  template_code: string;
  channel: string;
  recipient_email: string | null;
  subject: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
  error_message: string | null;
}

// ============================================
// DEFAULT TEMPLATES
// ============================================

const defaultTemplates = [
  {
    code: 'appointment_confirmation',
    name: 'Terminbestätigung',
    variables: ['customer_name', 'appointment_date', 'appointment_time', 'service_name', 'staff_name', 'salon_name', 'salon_address'],
  },
  {
    code: 'appointment_reminder',
    name: 'Terminerinnerung',
    variables: ['customer_name', 'appointment_date', 'appointment_time', 'service_name', 'staff_name', 'salon_name'],
  },
  {
    code: 'appointment_cancelled',
    name: 'Terminabsage',
    variables: ['customer_name', 'appointment_date', 'appointment_time', 'cancellation_reason', 'salon_name'],
  },
  {
    code: 'order_confirmation',
    name: 'Bestellbestätigung',
    variables: ['customer_name', 'order_number', 'order_total', 'order_items', 'salon_name'],
  },
  {
    code: 'order_shipped',
    name: 'Versandbestätigung',
    variables: ['customer_name', 'order_number', 'tracking_number', 'tracking_url', 'salon_name'],
  },
  {
    code: 'voucher_received',
    name: 'Gutschein erhalten',
    variables: ['recipient_name', 'sender_name', 'voucher_code', 'voucher_amount', 'personal_message', 'expiry_date', 'salon_name'],
  },
  {
    code: 'welcome',
    name: 'Willkommen',
    variables: ['customer_name', 'salon_name'],
  },
  {
    code: 'birthday_greeting',
    name: 'Geburtstagsgruss',
    variables: ['customer_name', 'salon_name'],
  },
];

// ============================================
// DATA FETCHING
// ============================================

async function getNotificationData() {
  const staffMember = await getCurrentStaffMember();
  if (!staffMember) {
    redirect('/admin/login');
  }

  const salonId = resolveStaffSalonId(staffMember.salon_id);
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return { templates: [], logs: [] };
  }

  // Get templates
  const { data: templatesData } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('salon_id', salonId)
    .order('code', { ascending: true }) as { data: TemplateRow[] | null };

  // Get recent notification logs
  const { data: logsData } = await supabase
    .from('notifications')
    .select('id, template_code, channel, recipient_email, subject, status, sent_at, created_at, error_message')
    .eq('salon_id', salonId)
    .order('created_at', { ascending: false })
    .limit(50) as { data: NotificationLogRow[] | null };

  // Transform templates
  const templates: NotificationTemplate[] = (templatesData || []).map((t) => ({
    id: t.id,
    name: t.name,
    code: t.code,
    channel: t.channel as NotificationTemplate['channel'],
    subject: t.subject,
    bodyHtml: t.body_html,
    bodyText: t.body_text,
    smsBody: t.sms_body,
    availableVariables: t.available_variables || [],
    isActive: t.is_active,
    updatedAt: t.updated_at,
  }));

  // Transform logs
  const logs: NotificationLog[] = (logsData || []).map((l) => ({
    id: l.id,
    templateCode: l.template_code,
    channel: l.channel,
    recipientEmail: l.recipient_email,
    subject: l.subject,
    status: l.status,
    sentAt: l.sent_at,
    createdAt: l.created_at,
    errorMessage: l.error_message,
  }));

  return {
    templates,
    logs,
    defaultTemplates,
  };
}

// ============================================
// NOTIFICATION TEMPLATES PAGE
// ============================================

export default async function NotificationTemplatesPage() {
  const { templates, logs, defaultTemplates } = await getNotificationData();

  return (
    <AdminNotificationTemplatesView
      templates={templates}
      logs={logs}
      defaultTemplates={defaultTemplates}
    />
  );
}
