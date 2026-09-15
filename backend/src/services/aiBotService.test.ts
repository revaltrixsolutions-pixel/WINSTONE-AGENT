import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateBotReply,
  extractPatientName,
  isConversationStale,
  parseAppointmentRequest,
  generateAppointmentCollectionPrompt,
} from './aiBotService';

test('welcome message asks for patient name', () => {
  const reply = generateBotReply({
    patientName: null,
    message: 'hello',
    isReturning: false,
    lastInteractionHours: 0,
  });

  assert.match(reply, /welcome/i);
  assert.match(reply, /what is your name/i);
});

test('known hospital query answers with SHA and location', () => {
  const reply = generateBotReply({
    patientName: 'Mary',
    message: 'do you accept SHA?',
    isReturning: false,
    lastInteractionHours: 0,
  });

  assert.match(reply, /Yes, Mary/i);
  assert.match(reply, /SHA/i);
  assert.match(reply, /located/i);
});

test('unknown content asks to speak to a doctor', () => {
  const reply = generateBotReply({
    patientName: 'Mary',
    message: 'what is the weather in Nairobi?',
    isReturning: false,
    lastInteractionHours: 0,
  });

  assert.match(reply, /doctor/i);
});

test('stale conversation triggers follow-up welcome', () => {
  const stale = isConversationStale(7);
  assert.equal(stale, true);

  const reply = generateBotReply({
    patientName: 'Mary',
    message: 'hi again',
    isReturning: true,
    lastInteractionHours: 7,
  });

  assert.match(reply, /welcome back|continue/i);
});

test('extracts patient name from message', () => {
  const name = extractPatientName('my name is John Kamau');
  assert.equal(name, 'John Kamau');
});

test('parses booking details from patient request', () => {
  const booking = parseAppointmentRequest('I want to book a visit tomorrow at 9am in maternity');
  assert.equal(booking.ready, true);
  assert.equal(booking.department, 'Maternity');
  assert.equal(booking.time, '09:00 AM');
});

test('asks for missing booking details', () => {
  const prompt = generateAppointmentCollectionPrompt('Mary', {
    date: 'tomorrow',
    time: '09:00 AM'
  });

  assert.match(prompt, /department/i);
  assert.doesNotMatch(prompt, /date|time/i);
});
