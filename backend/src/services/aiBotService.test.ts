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
  appointmentServiceOptions,
  appointmentTimeOptions,
  updateAppointmentConversation,
  resetPatientSession,
} from './aiBotService';
import { searchKnowledgeBase } from '../knowledge/hospitalData';

test('welcome message asks for patient name', () => {
  const reply = generateBotReply({
    patientName: null,
    message: 'hello',
    isReturning: false,
    lastInteractionHours: 0,
  });

  assert.equal(reply, 'Hello too \nWelcome, how can I help you today?\nDo you have any enquiry you want to make?');
});

test('returns every supplied clinic FAQ answer exactly as provided', () => {
  const cases = [
    {
      message: 'Do you do micro needling?',
      answer: 'Yes we do micro needling at a cost of KSH.22,000/= per session',
    },
    {
      message: 'Do you remove skin tags,keloids, warts, ingrown nails?',
      answer: 'Yes we handle this condition but after doctor has reviewed it and and decides on treatment plan.\nVisit us for clinical evaluation first .',
    },
    {
      message: 'What causes dark spots.?',
      answer: 'Dark spots has so many causes and treatment depends with the causative agent and wether it is superficial or deep dark spot.\nThe causes ranges from post inflammatory reaction, sunburn, drugs, skin infections,ance, and trauma, hormonal and some genetical conditions.\nWe recommend you visit and see our dermatologist for guidance on the appropriate treatment plan for your dark spots.',
    },
    {
      message: 'Hello?',
      answer: 'Hello too \nWelcome, how can I help you today?\nDo you have any enquiry you want to make?',
    },
    {
      message: 'Do you use SHA.?',
      answer: "No we don't accept SHA for dermatology services.\nWe only use Cash.",
    },
    {
      message: 'Which insurance do you accept?',
      answer: 'At the moment we do accept GA INSURANCE, KENYAN ALLIANCE,MTIBA under GA INSURANCE.\nsome major insurance companies will be onboarded soon.',
    },
    {
      message: 'Can I share picture of my skin condition?',
      answer: 'Yes you can but we recommend you call the doctor directly on his number first.\n0708130100/0726244040',
    },
    {
      message: 'What causes Acne Keloidalis Nuchae?',
      answer: 'This is mostly caused by inflammation of hair follicles after clear shaving, irritation by certain types of shirt collar or plastic caps and helmets,genetics resulting in ingrown hair within the hair follicles and colonization by propionibacterium..',
    },
  ];

  for (const { message, answer } of cases) {
    assert.equal(
      generateBotReply({
        patientName: 'Mary',
        message,
        isReturning: false,
        lastInteractionHours: 0,
      }),
      answer,
      `Expected verbatim FAQ answer for "${message}"`,
    );
  }
});

test('returns the exact consultation fee wording for the requested question', () => {
  const reply = generateBotReply({ patientName: 'Mary', message: 'how much is consultation fee' });

  assert.equal(reply, 'General consultation fee is 500/=\nAnd dermatologist consultation fee is 1000/=.');
});

test('uses the exact call-the-doctor fallback for questions outside the supplied FAQs', () => {
  const expected = 'Thank you for your question. For this enquiry, please call the doctor directly on 0708130100 or 0726244040.';
  for (const message of ['What is the weather in Nairobi?', 'What causes persistent dizziness?']) {
    assert.equal(
      generateBotReply({ patientName: 'Mary', message }),
      expected,
    );
  }
});

test('answers Winston location and contact questions with supplied details', () => {
  const reply = generateBotReply({
    patientName: 'Mary',
    message: 'where is Winston Medical Centre and how can I contact it?',
    isReturning: false,
    lastInteractionHours: 0,
  });

  assert.match(reply, /Winston Medical Centre/i);
  assert.match(reply, /Fedha Stage/i);
  assert.match(reply, /0726 244040/i);
});

test('answers the supplied location, fee, hours, and appointment questions', () => {
  const locationReply = searchKnowledgeBase('Do you have a branch in Nairobi?') ?? '';
  assert.match(locationReply, /one branch/i);
  assert.match(locationReply, /Standard Drive, Fedha, Embakasi, Nairobi/i);

  const consultationReply = searchKnowledgeBase('What is your consultation fee?') ?? '';
  assert.match(consultationReply, /KSh 500/i);
  assert.doesNotMatch(consultationReply, /KSh 1,000/i);
  assert.equal(getServicePrice('General Consultation'), 'KSh 500');
  assert.equal(getServicePrice('General Outpatient Care'), 'KSh 500');
  assert.equal(getServicePrice('Dermatologist'), 'KSh 1,000');
  const dermatologyFeeReply = searchKnowledgeBase('What is the dermatology consultation fee?') ?? '';
  assert.match(dermatologyFeeReply, /Dermatologist: \*KSh 1,000\*/i);
  assert.doesNotMatch(dermatologyFeeReply, /Gynecologist|Paediatrician|Nutritionist/i);

  for (const message of [
    'How much do you charge to see a dermatologist?',
    'Dermatology consultation fee',
  ]) {
    const reply = generateBotReply({
      patientName: 'Mary',
      message,
      isReturning: false,
      lastInteractionHours: 0,
    });
    assert.match(reply, /Dermatologist: \*KSh 1,000\*/i);
    assert.doesNotMatch(reply, /Gynecologist|Paediatrician|Nutritionist/i);
  }

  const hoursReply = generateBotReply({
    patientName: 'Mary',
    message: 'What time are you open?',
    isReturning: false,
    lastInteractionHours: 0,
  });
  assert.match(hoursReply, /Monday to Saturday/i);
  assert.match(hoursReply, /8:00 AM to 5:00 PM/i);
  assert.match(hoursReply, /appointments can also be booked on Sundays and public holidays/i);

  const sundayReply = generateBotReply({
    patientName: 'Mary',
    message: 'Can I book an appointment on Sunday?',
    isReturning: false,
    lastInteractionHours: 0,
  });
  assert.match(sundayReply, /call 0726 244040 or 0708 130100/i);
});

test('answers each supplied FAQ wording through the bot reply flow', () => {
  const questions: Array<{ message: string; expected: RegExp[] }> = [
    {
      message: 'Where are located?',
      expected: [/Standard Drive/i, /Fedha/i, /Embakasi/i, /Nairobi/i],
    },
    {
      message: 'Do you have branch in Mombasa?',
      expected: [/one branch/i, /Nairobi/i, /Standard Drive/i],
    },
    {
      message: 'What is the consultation fee?',
      expected: [/KSh 500/i],
    },
    {
      message: 'What time are you open?',
      expected: [/Monday to Saturday/i, /8:00 AM to 5:00 PM/i, /Sundays and public holidays/i, /0726 244040/i, /0708 130100/i],
    },
    {
      message: 'Do you treat this condition, dark spots, ance, keloids, vitiligo, hair loss etc?',
      expected: [/dermatologist handles all skin conditions/i, /clinical and physical examination/i, /before making a diagnosis/i],
    },
    {
      message: 'How much do you charge?',
      expected: [/treatment plan/i, /doctor after examining you/i],
    },
    {
      message: 'Can you offer online consultation?',
      expected: [/virtual consultations are available/i, /call 0726 244040 or 0708 130100/i],
    },
    {
      message: 'Am not in Nairobi how can you help?',
      expected: [/outside Nairobi/i, /virtual consultation/i, /visit us at a convenient time/i],
    },
    {
      message: 'How do you charge for virtual or online consultation?',
      expected: [/KSh 1,000/i, /virtual consultations are available/i],
    },
    {
      message: 'Do you do skin analysis?',
      expected: [/do not offer skin analysis/i, /clinical and physical examination/i, /misdiagnosis/i, /cosmetic outlets/i],
    },
    {
      message: 'What is you contact address or phone number?',
      expected: [/Standard Drive/i, /0726 244040/i, /0708 130100/i, /winstonmedicalcentre01@gmail.com/i],
    },
    {
      message: 'Do you do micro needling?',
      expected: [/Yes we do micro needling/i, /KSH\.22,000\/= per session/i],
    },
    {
      message: 'Do you remove skin tags,keloids, warts, ingrown nails?',
      expected: [/Yes we handle this condition/i, /doctor has reviewed/i, /decides on treatment plan/i, /clinical evaluation first/i],
    },
    {
      message: 'What causes dark spots?',
      expected: [/post inflammatory reaction/i, /sunburn/i, /ance/i, /superficial or deep dark spot/i, /see our dermatologist/i],
    },
    {
      message: 'Hello?',
      expected: [/Hello too/i, /Welcome/i, /How can I help you today/i, /enquiry/i],
    },
    {
      message: 'Do you use SHA?',
      expected: [/No we don't accept SHA for dermatology services/i, /We only use Cash/i],
    },
    {
      message: 'Which insurance do you accept?',
      expected: [/GA Insurance/i, /Kenyan Alliance/i, /MTIBA/i, /onboarded soon/i],
    },
    {
      message: 'Can I share picture of my skin condition?',
      expected: [/Yes you can/i, /call the doctor directly/i, /0708130100\/0726244040/i],
    },
    {
      message: 'What causes Acne Keloidalis Nuchae?',
      expected: [/inflammation of hair follicles/i, /clear shaving/i, /shirt collar or plastic caps and helmets/i, /ingrown hair within the hair follicles/i, /propionibacterium/i],
    },
  ];

  for (const { message, expected } of questions) {
    const reply = generateBotReply({
      patientName: 'Mary',
      message,
      isReturning: false,
      lastInteractionHours: 0,
    });
    for (const pattern of expected) {
      assert.match(reply, pattern, `Expected response to "${message}" to match ${pattern}`);
    }
  }
});

test('answers dermatology, treatment-cost, and virtual-consultation questions safely', () => {
  const dermatologyReply = generateBotReply({
    patientName: 'Mary',
    message: 'Do you treat rash, acne, keloids, vitiligo, and hair loss?',
    isReturning: false,
    lastInteractionHours: 0,
  });
  assert.match(dermatologyReply, /dermatologist handles all skin conditions/i);
  assert.match(dermatologyReply, /clinical and physical examination/i);

  const treatmentReply = searchKnowledgeBase('How much do you charge?') ?? '';
  assert.match(treatmentReply, /treatment plan/i);
  assert.match(treatmentReply, /after examining you/i);

  const onlineReply = generateBotReply({
    patientName: 'Mary',
    message: 'How much is an online consultation?',
    isReturning: false,
    lastInteractionHours: 0,
  });
  assert.match(onlineReply, /KSh 1,000/i);
  assert.match(onlineReply, /call 0726 244040 or 0708 130100/i);

  const skinAnalysisReply = searchKnowledgeBase('Do you do skin analysis?') ?? '';
  assert.match(skinAnalysisReply, /do not offer skin analysis/i);
  assert.match(skinAnalysisReply, /misdiagnosis/i);
});

test('answers dermatology procedure, condition, image, and insurance questions', () => {
  const microneedlingReply = searchKnowledgeBase('Do you do micro needling?') ?? '';
  assert.match(microneedlingReply, /^Yes, we do microneedling at a cost of KSh 22,000 per session\.$/i);

  const lesionReply = searchKnowledgeBase('Do you remove skin tags, keloids, warts, and ingrown nails?') ?? '';
  assert.match(lesionReply, /skin tags, keloids, warts, and ingrown nails/i);
  assert.match(lesionReply, /doctor must examine/i);

  const darkSpotsReply = searchKnowledgeBase('What causes dark spots?') ?? '';
  assert.match(darkSpotsReply, /post-inflammatory changes/i);
  assert.match(darkSpotsReply, /superficial or deeper/i);
  assert.match(darkSpotsReply, /see our dermatologist/i);

  const acneKeloidalisReply = searchKnowledgeBase('What causes Acne Keloidalis Nuchae?') ?? '';
  assert.match(acneKeloidalisReply, /close shaving/i);
  assert.match(acneKeloidalisReply, /friction or irritation/i);
  assert.match(acneKeloidalisReply, /bacterial colonisation/i);

  const acneKeloidalisBotReply = generateBotReply({
    patientName: 'Mary',
    message: 'What causes Acne Keloidalis Nuchae?',
    isReturning: false,
    lastInteractionHours: 0,
  });
  assert.equal(
    acneKeloidalisBotReply,
    'This is mostly caused by inflammation of hair follicles after clear shaving, irritation by certain types of shirt collar or plastic caps and helmets,genetics resulting in ingrown hair within the hair follicles and colonization by propionibacterium..',
  );

  const imageReply = searchKnowledgeBase('Can I share a picture of my skin condition?') ?? '';
  assert.match(imageReply, /may share a photo/i);
  assert.match(imageReply, /0708 130100 or 0726 244040/i);

  const imageBotReply = generateBotReply({
    patientName: 'Mary',
    message: 'Can I share a picture of my skin condition?',
    isReturning: false,
    lastInteractionHours: 0,
  });
  assert.equal(
    imageBotReply,
    'Yes you can but we recommend you call the doctor directly on his number first.\n0708130100/0726244040',
  );

  const insuranceReply = searchKnowledgeBase('Which insurance do you accept?') ?? '';
  assert.match(insuranceReply, /GA Insurance/i);
  assert.match(insuranceReply, /Kenyan Alliance/i);
  assert.match(insuranceReply, /MTIBA \(under GA Insurance\)/i);

  const shaReply = searchKnowledgeBase('Do you use SHA?') ?? '';
  assert.match(shaReply, /do not accept SHA for dermatology services/i);
  assert.match(shaReply, /cash-only/i);
});

test('answers a standalone hello with a short greeting', () => {
  const reply = generateBotReply({
    patientName: 'Mary',
    message: 'Hello?',
    isReturning: false,
    lastInteractionHours: 0,
  });

  assert.equal(reply, 'Hello too \nWelcome, how can I help you today?\nDo you have any enquiry you want to make?');
});

test('answers Winston price, contact, capacity, and insurance questions from supplied facts', () => {
  const cbcReply = searchKnowledgeBase('What does a full blood count cost?') ?? '';
  assert.match(cbcReply, /CBC: \*KSh 1,000\*/i);

  const counselingReply = searchKnowledgeBase('Do you offer counselling?') ?? '';
  assert.match(counselingReply, /Counseling/i);
  assert.match(counselingReply, /KSh 500/i);

  const emailReply = searchKnowledgeBase('What is your email address?') ?? '';
  assert.match(emailReply, /winstonmedicalcentre01@gmail.com/i);

  const capacityReply = searchKnowledgeBase('How many beds do you have?') ?? '';
  assert.match(capacityReply, /Beds:\* 2/i);

  const insuranceReply = generateBotReply({
    patientName: 'Mary',
    message: 'do you accept SHA?',
    isReturning: false,
    lastInteractionHours: 0,
  });
  assert.match(insuranceReply, /No we don't accept SHA for dermatology services/i);
  assert.match(insuranceReply, /We only use Cash/i);
  assert.doesNotMatch(insuranceReply, /^Yes,/i);
});

test('unknown content asks to speak to a doctor', () => {
  const reply = generateBotReply({
    patientName: 'Mary',
    message: 'what is the weather in Nairobi?',
    isReturning: false,
    lastInteractionHours: 0,
  });

  assert.equal(reply, 'Thank you for your question. For this enquiry, please call the doctor directly on 0708130100 or 0726244040.');
});

test('guides unknown questions with suggested topics and staff contacts', () => {
  const reply = generateBotReply({
    patientName: 'Mary',
    message: 'Do you provide lunar cartography?',
    isReturning: false,
    lastInteractionHours: 0,
  });

  assert.equal(reply, 'Thank you for your question. For this enquiry, please call the doctor directly on 0708130100 or 0726244040.');
});

test('routes unrecognized medical questions to staff with direct contacts', () => {
  const reply = generateBotReply({
    patientName: 'Mary',
    message: 'What causes persistent dizziness?',
    isReturning: false,
    lastInteractionHours: 0,
  });

  assert.equal(reply, 'Thank you for your question. For this enquiry, please call the doctor directly on 0708130100 or 0726244040.');

  const unsupportedConditionReply = generateBotReply({
    patientName: 'Mary',
    message: 'Do you treat heart disease?',
    isReturning: false,
    lastInteractionHours: 0,
  });
  assert.equal(unsupportedConditionReply, 'Thank you for your question. For this enquiry, please call the doctor directly on 0708130100 or 0726244040.');
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

test('starts a booking conversation by requesting all required booking details', () => {
  const reply = generateBotReply({
    patientName: null,
    message: 'book appointment tomorrow at 9am in maternity',
    isReturning: false,
    lastInteractionHours: 0,
  });

  assert.match(reply, /full name/i);
  assert.match(reply, /phone number/i);
  assert.match(reply, /preferred date and time/i);
  assert.match(reply, /reason for the visit/i);
});

test('asks for every required booking detail when a WhatsApp session has no name yet', () => {
  const reply = generateBotReply({
    patientId: 'booking-before-name-captured',
    message: 'help me book appointment today please',
  });

  assert.match(reply, /full name/i);
  assert.match(reply, /phone number/i);
  assert.match(reply, /preferred date and time/i);
  assert.match(reply, /reason for the visit/i);
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
  assert.match(priceReply, /KSh 1,500/i);

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

test('answers consultation-fee phrases instead of entering the booking flow', () => {
  const questions = [
    'How much is consultation',
    'Consultation fee',
    'how much is general consultation',
    'how much is general consultation?',
  ];

  for (const message of questions) {
    const reply = generateBotReply({
      patientName: 'REVALTRIX TECHNOLOGIES',
      message,
      isReturning: false,
      lastInteractionHours: 0,
    });

    assert.match(reply, /KSh 500/i, `Expected fee answer for "${message}"`);
    assert.doesNotMatch(reply, /what time|what date|which day/i);
  }
});

test('answers consultation-fee questions during a session-backed conversation', () => {
  const patientId = 'consultation-fee-reply-regression';
  const nameReply = generateBotReply({
    patientId,
    message: 'my name is REVALTRIX TECHNOLOGIES',
  });
  assert.match(nameReply, /How can I help you today/i);

  const helloReply = generateBotReply({
    patientId,
    message: 'hello',
  });
  assert.match(helloReply, /How can I help you today/i);

  const feeReply = generateBotReply({
    patientId,
    message: 'how much is general consultation',
  });
  assert.match(feeReply, /KSh 500/i);
  assert.doesNotMatch(feeReply, /what time|what date|which day/i);
});

test('answers dermatology pricing during an active appointment flow and continues booking', () => {
  const patientId = 'appointment-flow-dermatologist-fee';
  generateBotReply({ patientId, message: 'my name is Mary' });

  const bookingPrompt = generateBotReply({
    patientId,
    message: 'Book appointment',
  });
  assert.match(bookingPrompt, /full name|department/i);

  const feeReply = generateBotReply({
    patientId,
    message: 'How much do you charge to see a dermatologist?',
  });
  assert.match(feeReply, /Listed fee: KSh 1,000/i);
  assert.doesNotMatch(feeReply, /Gynecologist|Paediatrician|Nutritionist/i);

  const nextPrompt = generateBotReply({
    patientId,
    message: 'Dermatologist',
  });
  assert.match(nextPrompt, /Listed fee: KSh 1,000/i);
  assert.match(nextPrompt, /preferred date and time|what date|what time/i);
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
    'how can I book appointment',
    'can I book an appointment',
    'help me book appointment',
    'I would like to enquire about booking an appointment',
    'i want to book',
    'book for me',
    'make appointment',
    'do appointment',
    'book an appointment',
    'schedule an appointment',
    'reserve an appointment',
    'set up an appointment',
    'arrange an appointment',
    'I need an appointment',
    'I want to book a visit',
    'can i come in',
    'when can i visit',
    'i need to see the doctor',
    'appointment please',
    'how do i reserve a slot',
    'can i get a consultation',
    'help me book appointment today please',
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
    assert.match(reply, /full name/i, `Expected a name request for: ${message}`);
    assert.match(reply, /phone number/i, `Expected a phone request for: ${message}`);
    assert.match(reply, /reason for the visit/i, `Expected a visit reason request for: ${message}`);
  }
});

test('continues a multi-turn appointment request from booking intent to confirmation', () => {
  const patientId = 'natural-language-booking-flow';
  const welcome = generateBotReply({
    patientId,
    message: 'my name is Mary',
  });
  assert.match(welcome, /How can I help you today/i);

  const bookingPrompt = generateBotReply({
    patientId,
    message: 'how can I book appointment?',
  });
  assert.match(bookingPrompt, /department or clinic/i);
  assert.match(bookingPrompt, /preferred date and time/i);
  assert.match(bookingPrompt, /full name/i);
  assert.match(bookingPrompt, /phone number/i);
  assert.match(bookingPrompt, /reason for the visit/i);

  const departmentPrompt = generateBotReply({
    patientId,
    message: 'Gynecology',
  });
  assert.match(departmentPrompt, /KSh 1,500/i);
  assert.match(departmentPrompt, /date and time/i);

  const datePrompt = generateBotReply({
    patientId,
    message: 'tomorrow',
  });
  assert.match(datePrompt, /what time/i);
  assert.match(datePrompt, /full name/i);
  assert.match(datePrompt, /phone number/i);
  assert.match(datePrompt, /reason for the visit/i);

  const confirmation = generateBotReply({
    patientId,
    message: '10 am',
  });
  assert.match(confirmation, /Department: Gynecology/i);
  assert.match(confirmation, /Date:/i);
  assert.match(confirmation, /Time: 10:00 AM/i);
  assert.match(confirmation, /Reply \*Yes\* to submit/i);
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
  assert.equal(booking.department, 'Antenatal Clinic');
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
  assert.equal(booking.department, 'Antenatal Clinic');
  assert.equal(booking.time, '09:00 AM');
});

test('puts Dermatology first in the appointment service list and accepts its label', () => {
  assert.equal(appointmentServiceOptions[0], 'Dermatologist');
  assert.equal(parseAppointmentRequest('Dermatology').department, 'Dermatologist');
});

test('appointment booking advances to confirmation only after service, date, and time are collected', () => {
  const patientId = 'complete-appointment-confirmation-flow';
  resetPatientSession(patientId);

  const service = updateAppointmentConversation(patientId, 'Mary Wanjiku', 'Dermatology');
  assert.equal(service.completed, false);
  assert.equal(service.data?.department, 'Dermatologist');

  const date = updateAppointmentConversation(patientId, 'Mary Wanjiku', 'tomorrow');
  assert.equal(date.completed, false);
  assert.ok(date.data?.date);

  const time = updateAppointmentConversation(patientId, 'Mary Wanjiku', '10 am');
  assert.equal(time.completed, true);
  assert.equal(time.awaitingConfirmation, true);
  assert.match(time.prompt, /Department: Dermatologist/);
  assert.match(time.prompt, /Reply \*Yes\* to submit/);

  resetPatientSession(patientId);
});

test('offers five appointment times within clinic hours and rejects out-of-hours times', () => {
  assert.deepEqual(
    appointmentTimeOptions.map(({ label }) => label),
    ['8:00 AM', '10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM'],
  );

  const patientId = 'appointment-time-options-and-hours';
  resetPatientSession(patientId);
  updateAppointmentConversation(patientId, 'Mary Wanjiku', 'Dermatology');
  const datePrompt = updateAppointmentConversation(patientId, 'Mary Wanjiku', 'Tomorrow');
  assert.equal(datePrompt.data?.department, 'Dermatologist');
  assert.ok(datePrompt.data?.date);
  assert.equal(datePrompt.data?.time, undefined);
  assert.match(datePrompt.prompt, /8:00 AM.*10:00 AM.*12:00 PM.*2:00 PM.*4:00 PM/);
  assert.match(datePrompt.prompt, /clinic hours: 8:00 AM–5:00 PM/);

  const outsideHours = updateAppointmentConversation(patientId, 'Mary Wanjiku', '7:00 AM');
  assert.equal(outsideHours.completed, false);
  assert.equal(outsideHours.data?.time, undefined);
  assert.match(outsideHours.prompt, /8:00 AM.*10:00 AM.*12:00 PM.*2:00 PM.*4:00 PM/);
  assert.match(outsideHours.prompt, /8:00 AM–5:00 PM/);

  const validTime = updateAppointmentConversation(patientId, 'Mary Wanjiku', '4:00 PM');
  assert.equal(validTime.completed, true);
  assert.equal(validTime.data?.time, '04:00 PM');
  resetPatientSession(patientId);
});

test('maps supported appointment aliases to Winston clinics and rejects unsupported services', () => {
  const maternityBooking = parseAppointmentRequest('book maternity tomorrow at 9am');
  assert.equal(maternityBooking.department, 'Antenatal Clinic');

  const familyPlanningBooking = parseAppointmentRequest('book birth control tomorrow at 9am');
  assert.equal(familyPlanningBooking.department, 'Family Planning Services');

  const ultrasoundBooking = parseAppointmentRequest('ultrasound appointment tomorrow at 9am');
  assert.equal(ultrasoundBooking.department, 'Ultrasound Services');

  const unsupportedDelivery = parseAppointmentRequest('book a delivery tomorrow at 9am');
  assert.equal(unsupportedDelivery.department, undefined);

  const unsupportedBooking = parseAppointmentRequest('book a dental appointment tomorrow at 9am');
  assert.equal(unsupportedBooking.department, undefined);
  assert.equal(unsupportedBooking.ready, false);
});

test('parses interactive menu time values like 09 00 am', () => {
  const booking = parseAppointmentRequest('tomorrow 09 00 am in maternity');
  assert.equal(booking.department, 'Antenatal Clinic');
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
  assert.equal(booking.department, 'Gynecology');
  assert.equal(booking.time, '11:00 AM');
  assert.equal(getServicePrice(booking.department), 'KSh 1,500');
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

  assert.match(prompt, /KSh 1,500/i);
  assert.doesNotMatch(prompt, /KSh 1,500 \+ KSh 1,500/i);
  assert.match(prompt, /what time/i);
});
