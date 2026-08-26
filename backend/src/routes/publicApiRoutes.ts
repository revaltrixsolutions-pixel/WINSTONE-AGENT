// src/routes/publicApiRoutes.ts

import { Router } from 'express';
import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from 'express';
import crypto from 'node:crypto';
import {
  sendWhatsAppMessage,
  WhatsAppApiError,
} from '../services/whatsappService';

const router = Router();

interface SendNotificationBody {
  phoneNumber?: unknown;
  message?: unknown;
}

const MAX_NOTIFICATION_LENGTH = 4096;

/**
 * Hashes an API key into a fixed-length buffer.
 *
 * Hashing both values before timingSafeEqual ensures that
 * the compared buffers are always the same length.
 */
function hashApiKey(value: string): Buffer {
  return crypto.createHash('sha256').update(value).digest();
}

/**
 * Middleware: validates the x-api-key header for external notification calls.
 *
 * Required request header:
 *
 * x-api-key: YOUR_PUBLIC_API_KEY
 */
const verifyApiKey: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const configuredApiKey = process.env.PUBLIC_API_KEY?.trim();
  const suppliedApiKey = req.header('x-api-key')?.trim();

  if (!configuredApiKey) {
    console.error(
      '[Public API Auth Error] PUBLIC_API_KEY is missing from environment variables.',
    );

    res.status(500).json({
      success: false,
      error: 'Internal server configuration error.',
    });

    return;
  }

  if (!suppliedApiKey) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized. Missing x-api-key header.',
    });

    return;
  }

  const suppliedApiKeyHash = hashApiKey(suppliedApiKey);
  const configuredApiKeyHash = hashApiKey(configuredApiKey);

  const keysMatch = crypto.timingSafeEqual(
    suppliedApiKeyHash,
    configuredApiKeyHash,
  );

  if (!keysMatch) {
    console.warn('[Public API Auth Error] Invalid API key supplied.', {
      ip: req.ip,
      path: req.originalUrl,
    });

    res.status(401).json({
      success: false,
      error: 'Unauthorized. Invalid API key.',
    });

    return;
  }

  next();
};

router.use(verifyApiKey);

/**
 * POST /api/public/send-notification
 *
 * Required body:
 *
 * {
 *   "phoneNumber": "254712345678",
 *   "message": "Your appointment has been confirmed."
 * }
 *
 * Required request header:
 *
 * x-api-key: YOUR_PUBLIC_API_KEY
 */
const sendNotificationHandler: RequestHandler<
  Record<string, never>,
  unknown,
  SendNotificationBody
> = async (
  req: Request<Record<string, never>, unknown, SendNotificationBody>,
  res: Response,
): Promise<void> => {
  try {
    const { phoneNumber, message } = req.body;

    if (
      typeof phoneNumber !== 'string' ||
      !phoneNumber.trim()
    ) {
      res.status(400).json({
        success: false,
        error: 'Missing or invalid "phoneNumber" string.',
      });

      return;
    }

    if (
      typeof message !== 'string' ||
      !message.trim()
    ) {
      res.status(400).json({
        success: false,
        error: 'Missing or invalid "message" string.',
      });

      return;
    }

    const sanitizedPhone = phoneNumber.replace(/\D/g, '');
    const trimmedMessage = message.trim();

    if (sanitizedPhone.length < 7 || sanitizedPhone.length > 15) {
      res.status(400).json({
        success: false,
        error:
          'Invalid phone number. Use an international number, for example 254712345678.',
      });

      return;
    }

    if (trimmedMessage.length > MAX_NOTIFICATION_LENGTH) {
      res.status(400).json({
        success: false,
        error: `Message exceeds the ${MAX_NOTIFICATION_LENGTH}-character WhatsApp text limit.`,
      });

      return;
    }

    /*
     * Correct new service signature.
     *
     * Old:
     * sendWhatsAppMessage(sanitizedPhone, trimmedMessage)
     *
     * New:
     * sendWhatsAppMessage({
     *   recipientPhone: sanitizedPhone,
     *   messageText: trimmedMessage,
     * })
     */
    const whatsappResult = await sendWhatsAppMessage({
      recipientPhone: sanitizedPhone,
      messageText: trimmedMessage,
    });

    console.info('[Public API Notification Sent]', {
      recipientPhone: sanitizedPhone,
      messageId: whatsappResult.messageId,
      simulated: whatsappResult.simulated,
    });

    res.status(200).json({
      success: true,
      status: whatsappResult.simulated
        ? 'Message simulated successfully. No WhatsApp message was sent.'
        : 'Message accepted by WhatsApp successfully.',
      data: {
        recipientPhone: whatsappResult.recipientPhone,
        whatsappId: whatsappResult.whatsappId ?? null,
        messageId: whatsappResult.messageId,
        simulated: whatsappResult.simulated,
      },
    });
  } catch (error) {
    if (error instanceof WhatsAppApiError) {
      console.error('[Public API WhatsApp Error]', {
        message: error.message,
        status: error.status,
        recipientPhone: error.recipientPhone,
        metaCode: error.metaCode,
        metaType: error.metaType,
        metaDetails: error.metaDetails,
        fbTraceId: error.fbTraceId,
      });

      res.status(502).json({
        success: false,
        error: 'WhatsApp could not accept the notification.',
        details: error.message,
        metaCode: error.metaCode ?? null,
        metaDetails: error.metaDetails ?? null,
      });

      return;
    }

    console.error(
      '[Public API Send Notification Error]',
      error instanceof Error ? error.message : error,
    );

    res.status(500).json({
      success: false,
      error: 'Failed to send WhatsApp message.',
      details:
        error instanceof Error
          ? error.message
          : 'Unknown internal error.',
    });
  }
};

router.post('/send-notification', sendNotificationHandler);

export default router;