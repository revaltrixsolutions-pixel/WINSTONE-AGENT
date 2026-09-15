import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateBotReply,
  extractPatientName,
  isConversationStale,
  parseAppointmentRequest,
  generateAppointmentCollectionPrompt,
  getKenyaGreeting,
  isUsablePatientName,
  isHumanSupportRequest,
  CONVERSATION_MEMORY_MINUTES,
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

test('does not treat a command as a patient name', () => {
  assert.equal(extractPatientName('Assign me'), null);
  assert.equal(isUsablePatientName('Assign'), false);
  assert.equal(isUsablePatientName('Patient'), false);
});

test('guides patients who request a human', () => {
  assert.equal(isHumanSupportRequest('Can I talk to a human?'), true);
  assert.match(generateBotReply({
    patientName: 'Mary',
    message: 'Can I talk to a human?',
    isReturning: false,
    lastInteractionHours: 0,
  }), /staff|introduce/i);
});

test('named greetings provide Kenya time and next actions', () => {
  const reply = generateBotReply({
    patientName: 'Mary',
    message: 'Hi',
    isReturning: false,
    lastInteractionHours: 0,
  });

  assert.match(reply, /Mary/i);
  assert.match(reply, /appointment|service|staff/i);
});

test('formats Kenya greeting periods', () => {
  assert.equal(getKenyaGreeting(new Date('2026-09-15T08:00:00.000Z')), 'Good morning');
  assert.equal(getKenyaGreeting(new Date('2026-09-15T12:00:00.000Z')), 'Good afternoon');
  assert.equal(getKenyaGreeting(new Date('2026-09-15T15:00:00.000Z')), 'Good evening');
});

test('conversation memory expires after three minutes', () => {
  assert.equal(isConversationStale((CONVERSATION_MEMORY_MINUTES - 1) / 60), false);
  assert.equal(isConversationStale(CONVERSATION_MEMORY_MINUTES / 60), true);
});

test('parses booking details from patient request', () => {
  const booking = parseAppointmentRequest('I want to book a visit tomorrow at 9am in maternity');
  assert.equal(booking.ready, true);
  assert.equal(booking.department, 'Maternity');
  assert.equal(booking.time, '09:00 AM');
});

test('does not confuse appointments with ENT', () => {
  const booking = parseAppointmentRequest('I need appointments');
  assert.equal(booking.department, undefined);
  assert.equal(booking.ready, false);
});

test('asks for missing booking details', () => {
  const prompt = generateAppointmentCollectionPrompt('Mary', {
    date: 'tomorrow',
    time: '09:00 AM'
  });

  assert.match(prompt, /department/i);
  assert.match(prompt, /date|time/i);
});
