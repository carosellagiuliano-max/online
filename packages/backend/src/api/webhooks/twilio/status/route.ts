/**
 * BeautifyPRO - Twilio Status Webhook
 * Receives delivery status updates for SMS messages
 */

import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { logger } from '@/lib/logging/logger';

// Twilio webhook signature validation
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

interface TwilioStatusPayload {
  MessageSid: string;
  MessageStatus: string;
  To: string;
  ErrorCode?: string;
  ErrorMessage?: string;
}

/**
 * Validate Twilio webhook signature
 */
function validateTwilioSignature(
  request: NextRequest,
  body: string
): boolean {
  if (!TWILIO_AUTH_TOKEN) {
    logger.error('TWILIO_AUTH_TOKEN not configured');
    return false;
  }

  const signature = request.headers.get('x-twilio-signature');
  if (!signature) {
    logger.warn('Missing Twilio signature header');
    return false;
  }

  // Get the full URL that Twilio called
  const url = request.url;

  // Parse body into params object for validation
  const params: Record<string, string> = {};
  const urlParams = new URLSearchParams(body);
  urlParams.forEach((value, key) => {
    params[key] = value;
  });

  // Validate the signature
  const isValid = twilio.validateRequest(
    TWILIO_AUTH_TOKEN,
    signature,
    url,
    params
  );

  if (!isValid) {
    logger.warn('Invalid Twilio webhook signature', {
      url: url.substring(0, 50) + '...',
    });
  }

  return isValid;
}

/**
 * POST /api/webhooks/twilio/status
 * Receives SMS delivery status updates from Twilio
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature validation
    const rawBody = await request.text();

    // Validate Twilio signature
    if (!validateTwilioSignature(request, rawBody)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse form data from raw body
    const urlParams = new URLSearchParams(rawBody);

    const payload: TwilioStatusPayload = {
      MessageSid: urlParams.get('MessageSid') || '',
      MessageStatus: urlParams.get('MessageStatus') || '',
      To: urlParams.get('To') || '',
      ErrorCode: urlParams.get('ErrorCode') || undefined,
      ErrorMessage: urlParams.get('ErrorMessage') || undefined,
    };

    // Log the status update
    logger.info('SMS delivery status received', {
      messageId: payload.MessageSid,
      status: payload.MessageStatus,
      to: payload.To?.slice(0, 6) + '***', // Masked for privacy
      errorCode: payload.ErrorCode,
    });

    // Handle different statuses
    switch (payload.MessageStatus) {
      case 'delivered':
        await handleDelivered(payload);
        break;

      case 'failed':
      case 'undelivered':
        await handleFailed(payload);
        break;

      case 'sent':
        // Message is on its way, no action needed
        break;

      default:
        logger.debug('SMS status update', { status: payload.MessageStatus });
    }

    // Twilio expects a 200 response
    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    logger.error('Twilio webhook error', error as Error);

    // Still return 200 to prevent retries for malformed requests
    return new NextResponse('OK', { status: 200 });
  }
}

/**
 * Handle successful delivery
 */
async function handleDelivered(payload: TwilioStatusPayload) {
  logger.info('SMS delivered successfully', {
    messageId: payload.MessageSid,
  });

  // TODO: Update notification_logs table if tracking
  // await updateNotificationStatus(payload.MessageSid, 'delivered');
}

/**
 * Handle failed delivery
 */
async function handleFailed(payload: TwilioStatusPayload) {
  logger.warn('SMS delivery failed', {
    messageId: payload.MessageSid,
    errorCode: payload.ErrorCode,
    errorMessage: payload.ErrorMessage,
  });

  // TODO: Update notification_logs table
  // TODO: Consider retry logic for transient failures
  // TODO: Alert on persistent failures

  // Common error codes to handle:
  // 30003 - Unreachable destination
  // 30004 - Message blocked
  // 30005 - Unknown destination
  // 30006 - Landline or unreachable carrier
  // 30007 - Message filtered (spam)
}
