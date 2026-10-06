"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const whatsappService_1 = require("./whatsappService");
(0, node_test_1.default)('sends WhatsApp template messages with body parameters', async () => {
    const originalFetch = globalThis.fetch;
    const originalToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const originalPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const originalSimulation = process.env.WHATSAPP_SIMULATE;
    let requestBody;
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
    delete process.env.WHATSAPP_SIMULATE;
    globalThis.fetch = (async (_input, init) => {
        requestBody = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({
            contacts: [{ input: '254708130100', wa_id: '254708130100' }],
            messages: [{ id: 'wamid.test' }],
        }), { status: 200 });
    });
    try {
        const result = await (0, whatsappService_1.sendWhatsAppMessage)({
            recipientPhone: '254708130100',
            template: {
                name: 'appointment_notification',
                languageCode: 'en',
                bodyParameters: ['Appointment details'],
            },
        });
        strict_1.default.equal(result.messageId, 'wamid.test');
        strict_1.default.equal(result.recipientPhone, '254708130100');
        strict_1.default.deepEqual(requestBody, {
            messaging_product: 'whatsapp',
            to: '254708130100',
            type: 'template',
            template: {
                name: 'appointment_notification',
                language: { code: 'en' },
                components: [{
                        type: 'body',
                        parameters: [{ type: 'text', text: 'Appointment details' }],
                    }],
            },
        });
    }
    finally {
        globalThis.fetch = originalFetch;
        if (originalToken === undefined)
            delete process.env.WHATSAPP_ACCESS_TOKEN;
        else
            process.env.WHATSAPP_ACCESS_TOKEN = originalToken;
        if (originalPhoneNumberId === undefined)
            delete process.env.WHATSAPP_PHONE_NUMBER_ID;
        else
            process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhoneNumberId;
        if (originalSimulation === undefined)
            delete process.env.WHATSAPP_SIMULATE;
        else
            process.env.WHATSAPP_SIMULATE = originalSimulation;
    }
});
