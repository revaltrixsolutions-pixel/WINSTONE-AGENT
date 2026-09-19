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

test('understands natural booking phrases for appointments', () => {
  const helpReply = generateBotReply({
    patientName: 'Mary',
    message: 'help me book an appointment',
    isReturning: false,
    lastInteractionHours: 0,
  });
  assert.match(helpReply, /appointment|department|date|time|book/i);

  const guideReply = generateBotReply({
    patientName: 'Mary',
    message: 'guide me to book a consultation',
    isReturning: false,
    lastInteractionHours: 0,
  });
  assert.match(guideReply, /appointment|department|date|time|book/i);

  const canBookReply = generateBotReply({
    patientName: 'Mary',
    message: 'can I book appointments?',
    isReturning: false,
    lastInteractionHours: 0,
  });
  assert.match(canBookReply, /appointment|book|department|date|time/i);
});

test('shows the booking steps for a short booking request', () => {
  const reply = generateBotReply({
    patientName: 'Revaltrix Solutions',
    message: 'can I book appointment',
    isReturning: false,
    lastInteractionHours: 0,
  });

  assert.match(reply, /book an appointment/i);
  assert.match(reply, /department/i);
  assert.match(reply, /date/i);
  assert.match(reply, /time/i);
});

test('recognizes common booking commands and synonyms', () => {
  const bookingPhrases = [
    'can I book appointment',
    'make appointment',
    'do appointment',
    'book an appointment',
    'schedule an appointment',
    'reserve an appointment',
    'set up an appointment',
    'arrange an appointment',
    'I need an appointment',
    'I want to book a visit',
    'help me book',
    'guide me to book',
    'can I schedule a consultation',
  ];

  for (const message of bookingPhrases) {
    const reply = generateBotReply({
      patientName: 'Revaltrix Solutions',
      message,
      isReturning: false,
      lastInteractionHours: 0,
    });

    assert.match(reply, /appointment|consultation/i, `Expected booking response for: ${message}`);
    assert.match(reply, /date|time/i, `Expected date or time step for: ${message}`);
  }
});

test('understands the complete appointment phrase set', () => {
  const phrases = [
    'Can I make an appointment?', 'Can I book an appointment?',
    'I want to make an appointment.', 'I want to book an appointment.',
    'I need an appointment.', 'I need to book an appointment.',
    'I need to make an appointment.', 'I\'d like to make an appointment.',
    'I\'d like to book an appointment.', 'I would like to make an appointment.',
    'I would like to book an appointment.', 'Help me make an appointment.',
    'Help me book an appointment.', 'Please help me make an appointment.',
    'Please help me book an appointment.', 'Can I make a new appointment?',
    'Can I book a new appointment?', 'I want to make a new appointment.',
    'I want to book a new appointment.', 'I need a new appointment.',
    'Help me make a new appointment.', 'Help me book a new appointment.',
    'Can I do a new appointment?', 'I want to do a new appointment.',
    'I need to schedule a new appointment.', 'Can I schedule an appointment?',
    'I want to schedule an appointment.', 'I need to schedule an appointment.',
    'I\'d like to schedule an appointment.', 'Help me schedule an appointment.',
    'Can you schedule an appointment for me?', 'Please schedule an appointment for me.',
    'I want to arrange an appointment.', 'I need to arrange an appointment.',
    'Can you arrange an appointment for me?', 'I want to see a doctor.',
    'I need to see a doctor.', 'Can I see a doctor?', 'I want to book a doctor.',
    'I need to book a doctor.', 'I want to see a specialist.',
    'I need an appointment with a doctor.', 'I need an appointment with a specialist.',
    'Can I book an appointment with a doctor?', 'I want to see Dr. Kamau.',
    'I need to see Dr. Kamau.', 'I want an appointment today.',
    'Can I book an appointment today?', 'Do you have appointments today?',
    'I need an appointment tomorrow.', 'Can I book for tomorrow?',
    'I want to book for Monday.', 'Can I get an appointment on Monday?',
    'I need an appointment this week.', 'Do you have any available appointments?',
    'What appointments are available?', 'What times are available?',
    'When can I get an appointment?', 'When is the next available appointment?',
    'Can I book the next available appointment?', 'Is there any slot available?',
    'Do you have any free slots?', 'Is there an opening today?',
    'Is there an opening tomorrow?', 'Appointment', 'Book appointment',
    'Make appointment', 'New appointment', 'Need appointment',
    'Need to see doctor', 'Book doctor', 'Doctor appointment',
    'Schedule appointment', 'Schedule doctor', 'Help appointment',
    'Help me book', 'I need to book', 'I want to book', 'Book for me',
    'Can you book for me?', 'Appointment please', 'I need a slot',
    'Need a slot with doctor', 'Any available slot?', 'Any appointment available?',
    'Can I make appointment', 'Can I book appointment', 'Can I do new appointment',
    'Help me do appointment', 'Help me make appointment', 'Help me book appointment',
    'I want appointment', 'I need appointment', 'I want to see doctor',
    'I need to see doctor', 'Book me an appointment', 'Make an appointment for me',
    'Schedule me', 'I want to schedule', 'I need to schedule',
    'I want a doctor appointment', 'I need a doctor appointment',
    'Can I get a doctor',
  ];

  for (const message of phrases) {
    const reply = generateBotReply({
      patientName: 'Revaltrix Solutions',
      message,
      isReturning: false,
      lastInteractionHours: 0,
    });

    assert.doesNotMatch(reply, /I don't have that information on hand/i, `Unrecognized phrase: ${message}`);
    assert.match(reply, /appointment|doctor|specialist|slot|available|department|date|time/i, `Unexpected response for: ${message}`);
  }
});

test('recognizes available-slot questions', () => {
  const availabilityPhrases = [
    'Can I book the next available appointment?',
    'Is there any slot available?',
    'Do you have any free slots?',
  ];

  for (const message of availabilityPhrases) {
    const reply = generateBotReply({
      patientName: 'Revaltrix Solutions',
      message,
      isReturning: false,
      lastInteractionHours: 0,
    });

    assert.match(reply, /available|appointment|slot|department|date|time/i);
  }
});

test('normalizes afternoon booking times to 12-hour display format', () => {
  const booking = parseAppointmentRequest('book maternity today at 3pm');

  assert.equal(booking.time, '03:00 PM');
  assert.equal(booking.department, 'Maternity');
});

test('understands a misspelled new appointment request', () => {
  const reply = generateBotReply({
    patientName: 'Revaltrix Solutions',
    message: 'can I booke new appointment',
    isReturning: false,
    lastInteractionHours: 0,
  });

  assert.match(reply, /appointment|department|date|time/i);
});

test('starts booking when the appointment is for a family member', () => {
  const reply = generateBotReply({
    patientName: 'Revaltrix Solutions',
    message: 'i need an appointment for my mother',
    isReturning: false,
    lastInteractionHours: 0,
  });

  assert.match(reply, /appointment/i);
  assert.match(reply, /department|date|time|patient/i);
  assert.doesNotMatch(reply, /I don't have that information on hand/i);
});

test('recognizes requests to get appointment history', () => {
  const reply = generateBotReply({
    patientName: 'Revaltrix Solutions',
    message: 'can I get my appointment history',
    isReturning: false,
    lastInteractionHours: 0,
  });

  assert.match(reply, /appointment history/i);
  assert.doesNotMatch(reply, /which department|preferred date/i);
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
