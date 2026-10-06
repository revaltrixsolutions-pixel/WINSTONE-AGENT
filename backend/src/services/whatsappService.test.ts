import test from 'node:test';
import assert from 'node:assert/strict';

import { sendWhatsAppMessage } from './whatsappService';

test('sends WhatsApp template messages with body parameters', async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const originalPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const originalSimulation = process.env.WHATSAPP_SIMULATE;
  let requestBody: Record<string, unknown> | undefined;

  process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
  delete process.env.WHATSAPP_SIMULATE;

  globalThis.fetch = (async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      contacts: [{ input: '254708130100', wa_id: '254708130100' }],
      messages: [{ id: 'wamid.test' }],
    }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await sendWhatsAppMessage({
      recipientPhone: '254708130100',
      template: {
        name: 'appointment_notification',
        languageCode: 'en',
        bodyParameters: ['Appointment details'],
      },
    });

    assert.equal(result.messageId, 'wamid.test');
    assert.equal(result.recipientPhone, '254708130100');
    assert.deepEqual(requestBody, {
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
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
    else process.env.WHATSAPP_ACCESS_TOKEN = originalToken;
    if (originalPhoneNumberId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    else process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhoneNumberId;
    if (originalSimulation === undefined) delete process.env.WHATSAPP_SIMULATE;
    else process.env.WHATSAPP_SIMULATE = originalSimulation;
  }
});

test('sends a single interactive appointment prompt content type', async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const originalPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const originalSimulation = process.env.WHATSAPP_SIMULATE;
  let requestBody: Record<string, unknown> | undefined;

  process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
  delete process.env.WHATSAPP_SIMULATE;

  globalThis.fetch = (async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      messages: [{ id: 'wamid.interactive' }],
    }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await sendWhatsAppMessage({
      recipientPhone: '254712345678',
      interactive: {
        type: 'list',
        body: { text: 'Choose an appointment service.' },
        action: {
          button: 'Choose a service',
          sections: [{
            title: 'Services',
            rows: [{ id: 'service_dermatologist', title: 'Dermatologist' }],
          }],
        },
      },
    });

    assert.equal(result.messageId, 'wamid.interactive');
    assert.equal(requestBody?.type, 'interactive');
    assert.equal(requestBody?.text, undefined);
    assert.deepEqual(requestBody?.interactive, {
      type: 'list',
      body: { text: 'Choose an appointment service.' },
      action: {
        button: 'Choose a service',
        sections: [{
          title: 'Services',
          rows: [{ id: 'service_dermatologist', title: 'Dermatologist' }],
        }],
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
    else process.env.WHATSAPP_ACCESS_TOKEN = originalToken;
    if (originalPhoneNumberId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    else process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhoneNumberId;
    if (originalSimulation === undefined) delete process.env.WHATSAPP_SIMULATE;
    else process.env.WHATSAPP_SIMULATE = originalSimulation;
  }
});
