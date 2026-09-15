"use strict";
// backend/src/routes/whatsappWebhookRoutes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const webhookController_1 = require("../controllers/webhookController");
const router = (0, express_1.Router)();
/* ==========================================================================
   META WEBHOOK VERIFICATION
   ========================================================================== */
/**
 * GET /
 *
 * Meta calls this endpoint when you verify the WhatsApp webhook callback URL.
 *
 * Expected parameters:
 * - hub.mode=subscribe
 * - hub.verify_token=YOUR_VERIFY_TOKEN
 * - hub.challenge=CHALLENGE_VALUE
 *
 * When successful, Meta requires a 200 response containing exactly the
 * raw `hub.challenge` string.
 */
const verifyWebhookHandler = (req, res) => {
    const mode = req.query['hub.mode'];
    const verifyToken = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expectedToken = process.env.VERIFY_TOKEN?.trim();
    if (!expectedToken) {
        console.error('[WhatsApp Webhook Verification Error] VERIFY_TOKEN is missing from environment variables.');
        res.status(500).json({
            success: false,
            error: 'Webhook verification is not configured.',
        });
        return;
    }
    if (!mode || !verifyToken || !challenge) {
        console.warn('[WhatsApp Webhook Verification Failed] Required query parameters are missing.', {
            hasMode: Boolean(mode),
            hasVerifyToken: Boolean(verifyToken),
            hasChallenge: Boolean(challenge),
        });
        res.status(400).json({
            success: false,
            error: 'Missing required webhook verification parameters.',
        });
        return;
    }
    if (mode !== 'subscribe') {
        console.warn('[WhatsApp Webhook Verification Failed] Invalid verification mode.', {
            receivedMode: mode,
        });
        res.status(403).json({
            success: false,
            error: 'Invalid webhook verification mode.',
        });
        return;
    }
    if (verifyToken !== expectedToken) {
        console.warn('[WhatsApp Webhook Verification Failed] Verify token mismatch.', {
            receivedMode: mode,
            hasVerifyToken: true,
        });
        /*
         * Do not log `verifyToken` or `expectedToken`.
         * They are secrets and must not appear in Render, Railway,
         * Vercel, PM2, Docker, or server logs.
         */
        res.status(403).json({
            success: false,
            error: 'Webhook verification failed.',
        });
        return;
    }
    console.info('[WhatsApp Webhook Verified] Meta webhook handshake completed successfully.');
    /*
     * Meta needs the raw challenge text, not a JSON response.
     */
    res.status(200).type('text/plain').send(challenge);
};
/* ==========================================================================
   META WEBHOOK EVENT RECEIVER
   ========================================================================== */
/**
 * POST /
 *
 * Meta sends incoming WhatsApp messages and message-status events here.
 *
 * The actual incoming-message parsing and database storage are handled by:
 *
 * src/controllers/webhookController.ts
 */
const receiveWebhookHandler = async (req, res, next) => {
    try {
        await (0, webhookController_1.handleWhatsAppWebhook)(req, res);
    }
    catch (error) {
        console.error('[WhatsApp Webhook Route Error]', error instanceof Error ? error.stack || error.message : error);
        next(error);
    }
};
/* ==========================================================================
   ROUTES
   ========================================================================== */
/*
 * If mounted in your Express app as:
 *
 * app.use('/api/whatsapp/webhook', whatsappWebhookRoutes);
 *
 * Then configure this exact Meta Callback URL:
 *
 * https://YOUR-BACKEND-DOMAIN.com/api/whatsapp/webhook
 */
router.get('/', verifyWebhookHandler);
router.post('/', receiveWebhookHandler);
exports.default = router;
