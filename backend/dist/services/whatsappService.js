"use strict";
// src/services/whatsappService.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppApiError = void 0;
exports.sendWhatsAppMessage = sendWhatsAppMessage;
exports.splitWhatsAppMessage = splitWhatsAppMessage;
exports.sendWhatsAppText = sendWhatsAppText;
class WhatsAppApiError extends Error {
    status;
    metaCode;
    metaType;
    metaDetails;
    fbTraceId;
    recipientPhone;
    constructor({ message, status, recipientPhone, metaError, }) {
        super(message);
        this.name = 'WhatsAppApiError';
        this.status = status;
        this.recipientPhone = recipientPhone;
        this.metaCode = metaError?.code;
        this.metaType = metaError?.type;
        this.metaDetails = metaError?.error_data?.details;
        this.fbTraceId = metaError?.fbtrace_id;
    }
}
exports.WhatsAppApiError = WhatsAppApiError;
const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || 'v22.0';
const REQUEST_TIMEOUT_MS = Number(process.env.WHATSAPP_REQUEST_TIMEOUT_MS || 15_000);
const MAX_TEXT_MESSAGE_LENGTH = 4_096;
function normalizeWhatsAppPhone(phone) {
    const normalized = phone.replace(/\D/g, '');
    if (normalized.length < 7 || normalized.length > 15) {
        throw new Error(`[WhatsApp API Error]: Invalid international phone number "${phone}". Use a full E.164 number, for example 254712345678.`);
    }
    return normalized;
}
function getWhatsAppConfig() {
    const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    if (!token || !phoneNumberId) {
        throw new Error('[WhatsApp API Configuration Error]: WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID must both be configured.');
    }
    return {
        token,
        phoneNumberId,
    };
}
function isSimulationEnabled() {
    return process.env.WHATSAPP_SIMULATE === 'true';
}
function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
async function parseApiResponse(response) {
    const rawBody = await response.text();
    if (!rawBody) {
        return {};
    }
    try {
        return JSON.parse(rawBody);
    }
    catch {
        throw new Error(`[WhatsApp API Error]: Meta returned a non-JSON response (${response.status}): ${rawBody.slice(0, 500)}`);
    }
}
/**
 * Sends one WhatsApp free-form text message through WhatsApp Cloud API.
 *
 * Free-form messages may only be sent during the active 24-hour customer
 * service window after the customer has messaged the business.
 */
async function sendWhatsAppMessage({ recipientPhone, messageText, interactive, }) {
    if (!recipientPhone?.trim()) {
        throw new Error('[WhatsApp API Error]: recipientPhone is required.');
    }
    if (!messageText?.trim() && !interactive) {
        throw new Error('[WhatsApp API Error]: messageText is required.');
    }
    if (messageText && messageText.length > MAX_TEXT_MESSAGE_LENGTH) {
        throw new Error(`[WhatsApp API Error]: Message exceeds the ${MAX_TEXT_MESSAGE_LENGTH}-character WhatsApp text limit. Split the response before sending.`);
    }
    const cleanPhone = normalizeWhatsAppPhone(recipientPhone);
    if (isSimulationEnabled()) {
        const messageId = `simulated_${Date.now()}`;
        console.warn('[WhatsApp SIMULATION: message not sent]', {
            recipientPhone: cleanPhone,
            messageId,
            messageLength: messageText?.length || interactive?.body.text.length || 0,
        });
        return {
            recipientPhone: cleanPhone,
            messageId,
            simulated: true,
        };
    }
    const { token, phoneNumberId } = getWhatsAppConfig();
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: cleanPhone,
                ...(interactive
                    ? {
                        type: 'interactive',
                        interactive,
                    }
                    : {
                        type: 'text',
                        text: {
                            preview_url: false,
                            body: messageText,
                        },
                    }),
            }),
        });
        const data = await parseApiResponse(response);
        if (!response.ok) {
            console.error('[WhatsApp API call failed]', {
                recipientPhone: cleanPhone,
                status: response.status,
                statusText: response.statusText,
                metaError: data.error,
            });
            throw new WhatsAppApiError({
                message: data.error?.message ||
                    `WhatsApp API request failed with HTTP ${response.status}.`,
                status: response.status,
                recipientPhone: cleanPhone,
                metaError: data.error,
            });
        }
        const messageId = data.messages?.[0]?.id;
        if (!messageId) {
            console.error('[WhatsApp API invalid success response]', {
                recipientPhone: cleanPhone,
                response: data,
            });
            throw new WhatsAppApiError({
                message: 'WhatsApp API returned success but did not provide a sent message ID.',
                status: response.status,
                recipientPhone: cleanPhone,
            });
        }
        const whatsappId = data.contacts?.[0]?.wa_id;
        console.info('[WhatsApp API message accepted]', {
            recipientPhone: cleanPhone,
            whatsappId,
            messageId,
            graphApiVersion: GRAPH_API_VERSION,
        });
        return {
            recipientPhone: cleanPhone,
            whatsappId,
            messageId,
            simulated: false,
        };
    }
    catch (error) {
        if (error instanceof WhatsAppApiError) {
            throw error;
        }
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`[WhatsApp API Error]: Request timed out after ${REQUEST_TIMEOUT_MS}ms.`);
        }
        console.error('[WhatsApp service exception]', {
            recipientPhone: cleanPhone,
            error: getErrorMessage(error),
        });
        throw error;
    }
    finally {
        clearTimeout(timeout);
    }
}
/**
 * Splits a long response into WhatsApp-safe text chunks.
 * Prefer splitting at a newline or space whenever possible.
 */
function splitWhatsAppMessage(messageText, maxLength = MAX_TEXT_MESSAGE_LENGTH) {
    const text = messageText.trim();
    if (!text) {
        return [];
    }
    if (text.length <= maxLength) {
        return [text];
    }
    const chunks = [];
    let remaining = text;
    while (remaining.length > maxLength) {
        let splitAt = remaining.lastIndexOf('\n', maxLength);
        if (splitAt < Math.floor(maxLength * 0.6)) {
            splitAt = remaining.lastIndexOf(' ', maxLength);
        }
        if (splitAt < Math.floor(maxLength * 0.6)) {
            splitAt = maxLength;
        }
        chunks.push(remaining.slice(0, splitAt).trim());
        remaining = remaining.slice(splitAt).trim();
    }
    if (remaining) {
        chunks.push(remaining);
    }
    return chunks;
}
/**
 * Sends one or more WhatsApp text messages when a bot response is long.
 */
async function sendWhatsAppText(recipientPhone, messageText) {
    const chunks = splitWhatsAppMessage(messageText);
    if (!chunks.length) {
        throw new Error('[WhatsApp API Error]: Cannot send an empty WhatsApp message.');
    }
    const results = [];
    for (const chunk of chunks) {
        const result = await sendWhatsAppMessage({
            recipientPhone,
            messageText: chunk,
        });
        results.push(result);
    }
    return results;
}
