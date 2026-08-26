"use strict";
// src/routes/publicApiRoutes.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const node_crypto_1 = __importDefault(require("node:crypto"));
const whatsappService_1 = require("../services/whatsappService");
const router = (0, express_1.Router)();
const MAX_NOTIFICATION_LENGTH = 4096;
/**
 * Hashes an API key into a fixed-length buffer.
 *
 * Hashing both values before timingSafeEqual ensures that
 * the compared buffers are always the same length.
 */
function hashApiKey(value) {
    return node_crypto_1.default.createHash('sha256').update(value).digest();
}
/**
 * Middleware: validates the x-api-key header for external notification calls.
 *
 * Required request header:
 *
 * x-api-key: YOUR_PUBLIC_API_KEY
 */
const verifyApiKey = (req, res, next) => {
    const configuredApiKey = process.env.PUBLIC_API_KEY?.trim();
    const suppliedApiKey = req.header('x-api-key')?.trim();
    if (!configuredApiKey) {
        console.error('[Public API Auth Error] PUBLIC_API_KEY is missing from environment variables.');
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
    const keysMatch = node_crypto_1.default.timingSafeEqual(suppliedApiKeyHash, configuredApiKeyHash);
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
const sendNotificationHandler = async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        if (typeof phoneNumber !== 'string' ||
            !phoneNumber.trim()) {
            res.status(400).json({
                success: false,
                error: 'Missing or invalid "phoneNumber" string.',
            });
            return;
        }
        if (typeof message !== 'string' ||
            !message.trim()) {
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
                error: 'Invalid phone number. Use an international number, for example 254712345678.',
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
        const whatsappResult = await (0, whatsappService_1.sendWhatsAppMessage)({
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
    }
    catch (error) {
        if (error instanceof whatsappService_1.WhatsAppApiError) {
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
        console.error('[Public API Send Notification Error]', error instanceof Error ? error.message : error);
        res.status(500).json({
            success: false,
            error: 'Failed to send WhatsApp message.',
            details: error instanceof Error
                ? error.message
                : 'Unknown internal error.',
        });
    }
};
router.post('/send-notification', sendNotificationHandler);
exports.default = router;
