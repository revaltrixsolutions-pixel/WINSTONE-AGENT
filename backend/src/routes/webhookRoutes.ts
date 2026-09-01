// backend/src/routes/whatsappWebhookRoutes.ts

import { Router } from 'express';
import type {
  Request,
  RequestHandler,
  Response,
} from 'express';

import { handleWhatsAppWebhook } from '../controllers/webhookController';

const router = Router();

/* ==========================================================================
   TYPES
   ========================================================================== */

type MetaWebhookVerificationQuery = {
  'hub.mode'?: string;
  'hub.verify_token'?: string;
  'hub.challenge'?: string;
};

/* ==========================================================================
   META WEBHOOK VERIFICATION
   ========================================================================== */

/**
 * GET /
 *
 * Meta calls this endpoint during webhook setup.
 *
 * Expected query parameters:
 * - hub.mode=subscribe
 * - hub.verify_token=YOUR_VERIFY_TOKEN
 * - hub.challenge=RANDOM_META_CHALLENGE
 *
 * When verification succeeds, this route must return the exact raw
 * hub.challenge value with an HTTP 200 response.
 */
const verifyWebhookHandler: RequestHandler = (
  req: Request<Record<string, never>, unknown, unknown, MetaWebhookVerificationQuery>,
  res: Response,
): void => {
  const mode = req.query['hub.mode'];
  const verifyToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.VERIFY_TOKEN?.trim();

  if (!expectedToken) {
    console.error(
      '[WhatsApp Webhook Verification Error] VERIFY_TOKEN is missing from environment variables.',
    );

    res.status(500).json({
      success: false,
      error: 'Webhook verification is not configured.',
    });

    return;
  }

  if (!mode || !verifyToken || !challenge) {
    console.warn(
      '[WhatsApp Webhook Verification Failed] Missing required Meta verification parameters.',
      {
        hasMode: Boolean(mode),
        hasVerifyToken: Boolean(verifyToken),
        hasChallenge: Boolean(challenge),
      },
    );

    res.status(400).json({
      success: false,
      error: 'Missing required webhook verification parameters.',
    });

    return;
  }

  if (mode !== 'subscribe') {
    console.warn(
      '[WhatsApp Webhook Verification Failed] Unexpected webhook mode.',
      {
        receivedMode: mode,
      },
    );

    res.status(403).json({
      success: false,
      error: 'Invalid webhook verification mode.',
    });

    return;
  }

  if (verifyToken !== expectedToken) {
    console.warn(
      '[WhatsApp Webhook Verification Failed] Verify token did not match.',
      {
        receivedMode: mode,
        hasVerifyToken: true,
      },
    );

    /*
     * Never log:
     * - verifyToken
     * - expectedToken
     *
     * Both are secrets and should never appear in hosting logs.
     */
    res.status(403).json({
      success: false,
      error: 'Webhook verification failed.',
    });

    return;
  }

  console.info(
    '[WhatsApp Webhook Verified] Meta webhook handshake completed successfully.',
  );

  /*
   * Meta expects exactly the raw challenge text, not a JSON object.
   */
  res.status(200).type('text/plain').send(challenge);
};

/* ==========================================================================
   META WEBHOOK EVENT RECEIVER
   ========================================================================== */

/**
 * POST /
 *
 * Receives WhatsApp webhook events from Meta:
 * - Incoming messages
 * - Interactive replies
 * - Delivery statuses
 * - Read statuses
 * - Failed-message statuses
 *
 * The actual event processing, database storage, patient lookup, and
 * agent-queue update are handled in webhookController.ts.
 */
const receiveWebhookHandler: RequestHandler = async (
  req,
  res,
  next,
): Promise<void> => {
  try {
    await handleWhatsAppWebhook(req, res);
  } catch (error) {
    console.error(
      '[WhatsApp Webhook Route Error]',
      error instanceof Error ? error.stack || error.message : error,
    );

    next(error);
  }
};

/* ==========================================================================
   ROUTES
   ========================================================================== */

/*
 * If this router is mounted like this:
 *
 * app.use('/api/whatsapp/webhook', whatsappWebhookRoutes);
 *
 * Then Meta callback URL must be:
 *
 * https://YOUR-BACKEND-DOMAIN.com/api/whatsapp/webhook
 */
router.get('/', verifyWebhookHandler);
router.post('/', receiveWebhookHandler);

export default router;ss