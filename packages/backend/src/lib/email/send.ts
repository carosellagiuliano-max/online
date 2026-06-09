// ============================================
// BASE EMAIL SENDING (SMTP)
// ============================================

import nodemailer from 'nodemailer';
import { getSalonConfig, DEFAULT_SALON_CONFIG } from '@/lib/salon/config';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM;

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Create reusable transporter
const createTransporter = () => {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

export async function sendEmail(options: EmailOptions): Promise<SendResult> {
  const transporter = createTransporter();

  if (!transporter) {
    console.warn('SMTP not configured, email was not sent');
    return { success: false, error: 'SMTP ist nicht konfiguriert' };
  }

  // Get salon config for sender info
  const salonConfig = await getSalonConfig();
  const fromEmail =
    SMTP_FROM ||
    process.env.SMTP_ADMIN_EMAIL ||
    SMTP_USER ||
    salonConfig.email ||
    DEFAULT_SALON_CONFIG.email;
  const fromName = salonConfig.name || DEFAULT_SALON_CONFIG.name;

  try {
    const info = await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    });

    console.log('Email sent:', info.messageId, 'to:', options.to, 'subject:', options.subject);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
