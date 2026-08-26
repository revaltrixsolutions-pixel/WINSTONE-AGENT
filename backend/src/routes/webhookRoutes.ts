import { Router, Request, Response, RequestHandler } from 'express';
import { handleWhatsAppWebhook } from '../controllers/webhookController';

const router = Router();

/**
 * GET /
 * Meta Webhook Verification Endpoint.
 * Meta calls this GET endpoint when configuring your webhook URL in the Developer Portal.
 */
const verifyWebhookHandler: RequestHandler = (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'] as string | undefined;
  const token = req.query['hub.verify_token'] as string | undefined;
  const challenge = req.query['hub.challenge'] as string | undefined;

  const expectedToken = process.env.VERIFY_TOKEN;

  if (!expectedToken) {
    console.error('[Webhook Verification Error]: VERIFY_TOKEN is missing in environment variables.');
    res.status(500).send('Server configuration error');
    return;
  }

  // Check if mode and token match the configured verification settings
  if (mode === 'subscribe' && token === expectedToken) {
    if (!challenge) {
      console.warn('[Webhook Verification Warning]: Challenge missing from Meta request.');
      res.status(400).send('Missing challenge parameter');
      return;
    }

    console.log('[Webhook Verified]: Meta webhook handshake successful.');
    // Respond strictly with 200 OK and the raw hub.challenge string
    res.status(200).send(challenge);
    return;
  }

  console.warn('[Webhook Verification Failed]: Invalid mode or verify token mismatch.', {
    receivedMode: mode,
    receivedToken: token,
  });
  
  res.sendStatus(403);
};

// Route definitions
router.get('/', verifyWebhookHandler);
router.post('/', handleWhatsAppWebhook as RequestHandler);

export default router;