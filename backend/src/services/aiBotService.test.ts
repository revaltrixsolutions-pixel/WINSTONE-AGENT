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
  getServicePrice,
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
  assert.equal(isHumanSupportRequest('I need an agent'), true);
  assert.equal(isHumanSupportRequest('Please connect me to a doctor'), true);
  assert.equal(isHumanSupportRequest('I need staff help'), true);
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

test('starts every conversation by asking for the patient name', () => {
  const reply = generateBotReply({
    patientName: null,
    message: 'book appointment tomorrow at 9am in maternity',
    isReturning: false,
    lastInteractionHours: 0,
  });

  assert.match(reply, /what is your name/i);
  assert.doesNotMatch(reply, /tomorrow at 9am/i);
});

test('understands affirmative replies like okay and thanks in appointment flow', () => {
  const step1 = generateBotReply({
    patientId: 'affirm-1',
    patientName: null,
    message: 'my name is Mary',
  });
  assert.match(step1, /How can I help you today|welcome/i);

  const step2 = generateBotReply({
    patientId: 'affirm-1',
    patientName: null,
    message: 'book appointment today at 9am in maternity',
  });
  assert.match(step2, /appointment request|correct|confirm/i);

  const step3 = generateBotReply({
    patientId: 'affirm-1',
    patientName: null,
    message: 'thanks',
  });
  assert.match(step3, /Appointment Confirmed|booking reference/i);
});

test('answers common price and rebooking questions naturally', () => {
  const priceReply = generateBotReply({
    patientName: 'Mary',
    message: 'what is the consultation fee for obstetrics and gynecology?',
    isReturning: false,
    lastInteractionHours: 0,
  });
  assert.match(priceReply, /KSh 1,000/i);

  const rescheduleReply = generateBotReply({
    patientName: 'Mary',
    message: 'can i do it tomorrow at 9am in maternity?',
    isReturning: false,
    lastInteractionHours: 0,
  });
  assert.match(rescheduleReply, /appointment request|correct|confirm|what time/i);

  const cancelReply = generateBotReply({
    patientName: 'Mary',
    message: 'I want to cancel my appointment',
    isReturning: false,
    lastInteractionHours: 0,
  });
  assert.match(cancelReply, /cancel|cleared|No problem/i);
});

test('handles appointment history and reschedule keywords with patient-friendly wording', () => {
  const historyReply = generateBotReply({
    patientName: 'Mary',
    message: 'show my appointment history',
    isReturning: false,
    lastInteractionHours: 0,
  });
  assert.match(historyReply, /history|appointment/i);

  const rescheduleReply = generateBotReply({
    patientName: 'Mary',
    message: 'reschedule my appointment to tomorrow at 3pm',
    isReturning: false,
    lastInteractionHours: 0,
  });
  assert.match(rescheduleReply, /reschedule|appointment|tomorrow|3pm|available/i);
});

test('handles real-world patient phrases like confirmation, doctor availability, and late arrival', () => {
  const confirmReply = generateBotReply({
    patientName: 'Mary',
    message: 'can you confirm my appointment?',
    isReturning: false,
    lastInteractionHours: 0,
  });
  assert.match(confirmReply, /appointment|confirm|reference|date|time/i);

  const availabilityReply = generateBotReply({
    patientName: 'Mary',
    message: 'is there a doctor available now?',
    isReturning: false,
    lastInteractionHours: 0,
  });
  assert.match(availabilityReply, /doctor|available|appointment|book|call/i);

  const lateReply = generateBotReply({
    patientName: 'Mary',
    message: 'i am running late',
    isReturning: false,
    lastInteractionHours: 0,
  });
  assert.match(lateReply, /late|appointment|contact|staff|call/i);
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

test('parses interactive menu time values like 09 00 am', () => {
  const booking = parseAppointmentRequest('tomorrow 09 00 am in maternity');
  assert.equal(booking.department, 'Maternity');
  assert.equal(booking.time, '09:00 AM');
  assert.equal(booking.ready, true);
});

test('does not confuse appointments with ENT', () => {
  const booking = parseAppointmentRequest('I need appointments');
  assert.equal(booking.department, undefined);
  assert.equal(booking.ready, false);
});

test('recognizes common gynecology typos and returns the exact consultation fee', () => {
  const booking = parseAppointmentRequest('Obstetrics and Gynecolog appointment today at 11:00 AM');
  assert.equal(booking.department, 'Obstetrics and Gynecology');
  assert.equal(booking.time, '11:00 AM');
  assert.equal(getServicePrice(booking.department), 'KSh 1,000');
});

test('asks for missing booking details', () => {
  const prompt = generateAppointmentCollectionPrompt('Mary', {
    date: 'tomorrow',
    time: '09:00 AM'
  });

  assert.match(prompt, /department/i);
  assert.match(prompt, /date|time/i);
});

test('keeps consultation pricing wording exact and human-friendly', () => {
  const prompt = generateAppointmentCollectionPrompt('Mary', {
    department: 'Obstetrics and Gynecology',
    date: 'today',
  });

  assert.match(prompt, /KSh 1,000/i);
  assert.doesNotMatch(prompt, /KSh 1,000 \+ KSh 1,000 consultation/i);
  assert.match(prompt, /what time/i);
});
