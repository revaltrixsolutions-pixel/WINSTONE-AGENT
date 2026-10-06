import test from 'node:test';
import assert from 'node:assert/strict';

import { sendAppointmentNotification } from './appointmentNotification';

test('sends appointment details to the hospital WhatsApp template', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnvironment = {
    token: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    simulation: process.env.WHATSAPP_SIMULATE,
    template: process.env.WHATSAPP_APPOINTMENT_TEMPLATE,
    language: process.env.WHATSAPP_APPOINTMENT_TEMPLATE_LANGUAGE,
  };
  let requestBody: Record<string, unknown> | undefined;

  process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
  process.env.WHATSAPP_APPOINTMENT_TEMPLATE = 'clinic_appointment_alert';
  process.env.WHATSAPP_APPOINTMENT_TEMPLATE_LANGUAGE = 'en_US';
  delete process.env.WHATSAPP_SIMULATE;

  globalThis.fetch = (async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      messages: [{ id: 'wamid.appointment' }],
    }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await sendAppointmentNotification({
      id: 'appointment-reference',
      doctorName: 'Dr Example',
      specialty: 'Dermatology',
      slotTime: new Date('2026-10-07T08:30:00.000Z'),
      status: 'CONFIRMED',
      patient: {
        fullName: 'Mary Patient',
        phoneNumber: '254712345678',
      },
    });

    assert.equal(result.messageId, 'wamid.appointment');
    assert.equal(requestBody?.to, '254726244040');
    assert.deepEqual(requestBody?.template, {
      name: 'clinic_appointment_alert',
      language: { code: 'en_US' },
      components: [{
        type: 'body',
        parameters: [{
          type: 'text',
          text: [
            'Hello, I would like to enquire about this appointment:',
            'Patient: Mary Patient',
            'Patient phone: 254712345678',
            'Service: Dermatology',
            'Doctor: Dr Example',
            'Date and time: 7 Oct 2026, 11:30',
            'Status: CONFIRMED',
            'Reference: appointment-reference',
          ].join('\n'),
        }],
      }],
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnvironment.token === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
    else process.env.WHATSAPP_ACCESS_TOKEN = originalEnvironment.token;
    if (originalEnvironment.phoneNumberId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    else process.env.WHATSAPP_PHONE_NUMBER_ID = originalEnvironment.phoneNumberId;
    if (originalEnvironment.simulation === undefined) delete process.env.WHATSAPP_SIMULATE;
    else process.env.WHATSAPP_SIMULATE = originalEnvironment.simulation;
    if (originalEnvironment.template === undefined) delete process.env.WHATSAPP_APPOINTMENT_TEMPLATE;
    else process.env.WHATSAPP_APPOINTMENT_TEMPLATE = originalEnvironment.template;
    if (originalEnvironment.language === undefined) delete process.env.WHATSAPP_APPOINTMENT_TEMPLATE_LANGUAGE;
    else process.env.WHATSAPP_APPOINTMENT_TEMPLATE_LANGUAGE = originalEnvironment.language;
  }
});
