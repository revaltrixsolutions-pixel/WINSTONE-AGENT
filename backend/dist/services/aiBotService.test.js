"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const aiBotService_1 = require("./aiBotService");
const hospitalData_1 = require("../knowledge/hospitalData");
(0, node_test_1.default)('welcome message asks for patient name', () => {
    const reply = (0, aiBotService_1.generateBotReply)({
        patientName: null,
        message: 'hello',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(reply, /welcome/i);
    strict_1.default.match(reply, /what is your name/i);
});
(0, node_test_1.default)('answers Winston location and contact questions with supplied details', () => {
    const reply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'where is Winston Medical Centre and how can I contact it?',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(reply, /Winston Medical Centre/i);
    strict_1.default.match(reply, /Fedha Stage/i);
    strict_1.default.match(reply, /0726 244040/i);
});
(0, node_test_1.default)('answers the supplied location, fee, hours, and appointment questions', () => {
    const locationReply = (0, hospitalData_1.searchKnowledgeBase)('Do you have a branch in Nairobi?') ?? '';
    strict_1.default.match(locationReply, /one branch/i);
    strict_1.default.match(locationReply, /Standard Drive, Fedha, Embakasi, Nairobi/i);
    const consultationReply = (0, hospitalData_1.searchKnowledgeBase)('What is your consultation fee?') ?? '';
    strict_1.default.match(consultationReply, /KSh 500/i);
    strict_1.default.doesNotMatch(consultationReply, /KSh 1,000/i);
    strict_1.default.equal((0, aiBotService_1.getServicePrice)('General Consultation'), 'KSh 500');
    strict_1.default.equal((0, aiBotService_1.getServicePrice)('General Outpatient Care'), 'KSh 500');
    strict_1.default.equal((0, aiBotService_1.getServicePrice)('Dermatologist'), 'KSh 1,000');
    const dermatologyFeeReply = (0, hospitalData_1.searchKnowledgeBase)('What is the dermatology consultation fee?') ?? '';
    strict_1.default.match(dermatologyFeeReply, /Dermatologist: \*KSh 1,000\*/i);
    const hoursReply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'What time are you open?',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(hoursReply, /Monday to Saturday/i);
    strict_1.default.match(hoursReply, /8:00 AM to 5:00 PM/i);
    strict_1.default.match(hoursReply, /appointments can also be booked on Sundays and public holidays/i);
    const sundayReply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'Can I book an appointment on Sunday?',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(sundayReply, /call 0726 244040 or 0708 130100/i);
});
(0, node_test_1.default)('answers each supplied FAQ wording through the bot reply flow', () => {
    const questions = [
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
            expected: [/KSh 22,000 per session/i],
        },
        {
            message: 'Do you remove skin tags,keloids, warts, ingrown nails?',
            expected: [/skin tags, keloids, warts, and ingrown nails/i, /doctor must examine/i, /clinical evaluation/i],
        },
        {
            message: 'What causes dark spots?',
            expected: [/post-inflammatory changes/i, /sunburn/i, /acne/i, /superficial or deeper/i, /see our dermatologist/i],
        },
        {
            message: 'Hello?',
            expected: [/Hello too/i, /Welcome/i, /How can I help you today/i, /enquiry/i],
        },
        {
            message: 'Do you use SHA?',
            expected: [/do not accept SHA for dermatology services/i, /cash-only/i],
        },
        {
            message: 'Which insurance do you accept?',
            expected: [/GA Insurance/i, /Kenyan Alliance/i, /MTIBA/i, /onboarded soon/i],
        },
        {
            message: 'Can I share picture of my skin condition?',
            expected: [/may share a photo/i, /call the doctor directly first/i, /0708 130100/i, /0726 244040/i],
        },
        {
            message: 'What causes Acne Keloidalis Nuchae?',
            expected: [/inflammation of hair follicles/i, /close shaving/i, /collars, caps or helmets/i, /ingrown hairs/i, /Propionibacterium/i],
        },
    ];
    for (const { message, expected } of questions) {
        const reply = (0, aiBotService_1.generateBotReply)({
            patientName: 'Mary',
            message,
            isReturning: false,
            lastInteractionHours: 0,
        });
        for (const pattern of expected) {
            strict_1.default.match(reply, pattern, `Expected response to "${message}" to match ${pattern}`);
        }
    }
});
(0, node_test_1.default)('answers dermatology, treatment-cost, and virtual-consultation questions safely', () => {
    const dermatologyReply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'Do you treat rash, acne, keloids, vitiligo, and hair loss?',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(dermatologyReply, /dermatologist handles all skin conditions/i);
    strict_1.default.match(dermatologyReply, /clinical and physical examination/i);
    const treatmentReply = (0, hospitalData_1.searchKnowledgeBase)('How much do you charge?') ?? '';
    strict_1.default.match(treatmentReply, /treatment plan/i);
    strict_1.default.match(treatmentReply, /after examining you/i);
    const onlineReply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'How much is an online consultation?',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(onlineReply, /KSh 1,000/i);
    strict_1.default.match(onlineReply, /call 0726 244040 or 0708 130100/i);
    const skinAnalysisReply = (0, hospitalData_1.searchKnowledgeBase)('Do you do skin analysis?') ?? '';
    strict_1.default.match(skinAnalysisReply, /do not offer skin analysis/i);
    strict_1.default.match(skinAnalysisReply, /misdiagnosis/i);
});
(0, node_test_1.default)('answers dermatology procedure, condition, image, and insurance questions', () => {
    const microneedlingReply = (0, hospitalData_1.searchKnowledgeBase)('Do you do micro needling?') ?? '';
    strict_1.default.match(microneedlingReply, /Microneedling: \*KSh 22,000 per session\*/i);
    const lesionReply = (0, hospitalData_1.searchKnowledgeBase)('Do you remove skin tags, keloids, warts, and ingrown nails?') ?? '';
    strict_1.default.match(lesionReply, /skin tags, keloids, warts, and ingrown nails/i);
    strict_1.default.match(lesionReply, /doctor must examine/i);
    const darkSpotsReply = (0, hospitalData_1.searchKnowledgeBase)('What causes dark spots?') ?? '';
    strict_1.default.match(darkSpotsReply, /post-inflammatory changes/i);
    strict_1.default.match(darkSpotsReply, /superficial or deeper/i);
    strict_1.default.match(darkSpotsReply, /see our dermatologist/i);
    const acneKeloidalisReply = (0, hospitalData_1.searchKnowledgeBase)('What causes Acne Keloidalis Nuchae?') ?? '';
    strict_1.default.match(acneKeloidalisReply, /close shaving/i);
    strict_1.default.match(acneKeloidalisReply, /friction or irritation/i);
    strict_1.default.match(acneKeloidalisReply, /bacterial colonisation/i);
    const acneKeloidalisBotReply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'What causes Acne Keloidalis Nuchae?',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(acneKeloidalisBotReply, /close shaving/i);
    const imageReply = (0, hospitalData_1.searchKnowledgeBase)('Can I share a picture of my skin condition?') ?? '';
    strict_1.default.match(imageReply, /may share a photo/i);
    strict_1.default.match(imageReply, /0708 130100 or 0726 244040/i);
    const imageBotReply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'Can I share a picture of my skin condition?',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(imageBotReply, /may share a photo/i);
    const insuranceReply = (0, hospitalData_1.searchKnowledgeBase)('Which insurance do you accept?') ?? '';
    strict_1.default.match(insuranceReply, /GA Insurance/i);
    strict_1.default.match(insuranceReply, /Kenyan Alliance/i);
    strict_1.default.match(insuranceReply, /MTIBA \(under GA Insurance\)/i);
    const shaReply = (0, hospitalData_1.searchKnowledgeBase)('Do you use SHA?') ?? '';
    strict_1.default.match(shaReply, /do not accept SHA for dermatology services/i);
    strict_1.default.match(shaReply, /cash-only/i);
});
(0, node_test_1.default)('answers a standalone hello with a short greeting', () => {
    const reply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'Hello?',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(reply, /Hello too, Mary!/i);
    strict_1.default.match(reply, /Do you have any enquiry/i);
});
(0, node_test_1.default)('answers Winston price, contact, capacity, and insurance questions from supplied facts', () => {
    const cbcReply = (0, hospitalData_1.searchKnowledgeBase)('What does a full blood count cost?') ?? '';
    strict_1.default.match(cbcReply, /CBC: \*KSh 1,000\*/i);
    const counselingReply = (0, hospitalData_1.searchKnowledgeBase)('Do you offer counselling?') ?? '';
    strict_1.default.match(counselingReply, /Counseling/i);
    strict_1.default.match(counselingReply, /KSh 500/i);
    const emailReply = (0, hospitalData_1.searchKnowledgeBase)('What is your email address?') ?? '';
    strict_1.default.match(emailReply, /winstonmedicalcentre01@gmail.com/i);
    const capacityReply = (0, hospitalData_1.searchKnowledgeBase)('How many beds do you have?') ?? '';
    strict_1.default.match(capacityReply, /Beds:\* 2/i);
    const insuranceReply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'do you accept SHA?',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(insuranceReply, /do not accept SHA for dermatology services/i);
    strict_1.default.match(insuranceReply, /cash-only/i);
    strict_1.default.doesNotMatch(insuranceReply, /^Yes,/i);
});
(0, node_test_1.default)('unknown content asks to speak to a doctor', () => {
    const reply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'what is the weather in Nairobi?',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(reply, /doctor/i);
});
(0, node_test_1.default)('guides unknown questions with suggested topics and staff contacts', () => {
    const reply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'Do you provide lunar cartography?',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(reply, /Did you mean/i);
    strict_1.default.match(reply, /clinic and specialist services/i);
    strict_1.default.match(reply, /Tell me which topic you mean/i);
    strict_1.default.match(reply, /0726 244040/i);
    strict_1.default.match(reply, /0708 130100/i);
    strict_1.default.doesNotMatch(reply, /I don.t have that information/i);
});
(0, node_test_1.default)('routes unrecognized medical questions to staff with direct contacts', () => {
    const reply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'What causes persistent dizziness?',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(reply, /medical questions need assessment by a clinician/i);
    strict_1.default.match(reply, /0726 244040/i);
    strict_1.default.match(reply, /0708 130100/i);
    strict_1.default.doesNotMatch(reply, /Did you mean/i);
    const unsupportedConditionReply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'Do you treat heart disease?',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(unsupportedConditionReply, /medical questions need assessment by a clinician/i);
    strict_1.default.match(unsupportedConditionReply, /0726 244040/i);
});
(0, node_test_1.default)('stale conversation triggers follow-up welcome', () => {
    const stale = (0, aiBotService_1.isConversationStale)(7);
    strict_1.default.equal(stale, true);
    const reply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'hi again',
        isReturning: true,
        lastInteractionHours: 7,
    });
    strict_1.default.match(reply, /welcome back|continue/i);
});
(0, node_test_1.default)('extracts patient name from message', () => {
    const name = (0, aiBotService_1.extractPatientName)('my name is John Kamau');
    strict_1.default.equal(name, 'John Kamau');
});
(0, node_test_1.default)('does not treat a command as a patient name', () => {
    strict_1.default.equal((0, aiBotService_1.extractPatientName)('Assign me'), null);
    strict_1.default.equal((0, aiBotService_1.isUsablePatientName)('Assign'), false);
    strict_1.default.equal((0, aiBotService_1.isUsablePatientName)('Patient'), false);
});
(0, node_test_1.default)('guides patients who request a human', () => {
    strict_1.default.equal((0, aiBotService_1.isHumanSupportRequest)('Can I talk to a human?'), true);
    strict_1.default.equal((0, aiBotService_1.isHumanSupportRequest)('I need an agent'), true);
    strict_1.default.equal((0, aiBotService_1.isHumanSupportRequest)('Please connect me to a doctor'), true);
    strict_1.default.equal((0, aiBotService_1.isHumanSupportRequest)('I need staff help'), true);
    strict_1.default.match((0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'Can I talk to a human?',
        isReturning: false,
        lastInteractionHours: 0,
    }), /staff|introduce/i);
});
(0, node_test_1.default)('named greetings provide Kenya time and next actions', () => {
    const reply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'Hi',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(reply, /Mary/i);
    strict_1.default.match(reply, /appointment|service|staff/i);
});
(0, node_test_1.default)('starts every conversation by asking for the patient name', () => {
    const reply = (0, aiBotService_1.generateBotReply)({
        patientName: null,
        message: 'book appointment tomorrow at 9am in maternity',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(reply, /what is your name/i);
    strict_1.default.doesNotMatch(reply, /tomorrow at 9am/i);
});
(0, node_test_1.default)('understands affirmative replies like okay and thanks in appointment flow', () => {
    const step1 = (0, aiBotService_1.generateBotReply)({
        patientId: 'affirm-1',
        patientName: null,
        message: 'my name is Mary',
    });
    strict_1.default.match(step1, /How can I help you today|welcome/i);
    const step2 = (0, aiBotService_1.generateBotReply)({
        patientId: 'affirm-1',
        patientName: null,
        message: 'book appointment today at 9am in maternity',
    });
    strict_1.default.match(step2, /appointment request|correct|confirm/i);
    const step3 = (0, aiBotService_1.generateBotReply)({
        patientId: 'affirm-1',
        patientName: null,
        message: 'thanks',
    });
    strict_1.default.match(step3, /Appointment Confirmed|booking reference/i);
});
(0, node_test_1.default)('answers common price and rebooking questions naturally', () => {
    const priceReply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'what is the consultation fee for obstetrics and gynecology?',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(priceReply, /KSh 1,500/i);
    const rescheduleReply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'can i do it tomorrow at 9am in maternity?',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(rescheduleReply, /appointment request|correct|confirm|what time/i);
    const cancelReply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'I want to cancel my appointment',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(cancelReply, /cancel|cleared|No problem/i);
});
(0, node_test_1.default)('answers consultation-fee phrases instead of entering the booking flow', () => {
    const questions = [
        'How much is consultation',
        'Consultation fee',
        'how much is general consultation',
        'how much is general consultation?',
    ];
    for (const message of questions) {
        const reply = (0, aiBotService_1.generateBotReply)({
            patientName: 'REVALTRIX TECHNOLOGIES',
            message,
            isReturning: false,
            lastInteractionHours: 0,
        });
        strict_1.default.match(reply, /KSh 500/i, `Expected fee answer for "${message}"`);
        strict_1.default.doesNotMatch(reply, /what time|what date|which day/i);
    }
});
(0, node_test_1.default)('answers consultation-fee questions during a session-backed conversation', () => {
    const patientId = 'consultation-fee-reply-regression';
    const nameReply = (0, aiBotService_1.generateBotReply)({
        patientId,
        message: 'my name is REVALTRIX TECHNOLOGIES',
    });
    strict_1.default.match(nameReply, /How can I help you today/i);
    const helloReply = (0, aiBotService_1.generateBotReply)({
        patientId,
        message: 'hello',
    });
    strict_1.default.match(helloReply, /How can I help you today/i);
    const feeReply = (0, aiBotService_1.generateBotReply)({
        patientId,
        message: 'how much is general consultation',
    });
    strict_1.default.match(feeReply, /KSh 500/i);
    strict_1.default.doesNotMatch(feeReply, /what time|what date|which day/i);
});
(0, node_test_1.default)('handles appointment history and reschedule keywords with patient-friendly wording', () => {
    const historyReply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'show my appointment history',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(historyReply, /history|appointment/i);
    const rescheduleReply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'reschedule my appointment to tomorrow at 3pm',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(rescheduleReply, /reschedule|appointment|tomorrow|3pm|available/i);
});
(0, node_test_1.default)('understands natural booking phrases for appointments', () => {
    const helpReply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'help me book an appointment',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(helpReply, /appointment|department|date|time|book/i);
    const guideReply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'guide me to book a consultation',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(guideReply, /appointment|department|date|time|book/i);
    const canBookReply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'can I book appointments?',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(canBookReply, /appointment|book|department|date|time/i);
});
(0, node_test_1.default)('shows the booking steps for a short booking request', () => {
    const reply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Revaltrix Solutions',
        message: 'can I book appointment',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(reply, /book an appointment/i);
    strict_1.default.match(reply, /department/i);
    strict_1.default.match(reply, /date/i);
    strict_1.default.match(reply, /time/i);
});
(0, node_test_1.default)('recognizes common booking commands and synonyms', () => {
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
        const reply = (0, aiBotService_1.generateBotReply)({
            patientName: 'Revaltrix Solutions',
            message,
            isReturning: false,
            lastInteractionHours: 0,
        });
        strict_1.default.match(reply, /appointment|consultation/i, `Expected booking response for: ${message}`);
        strict_1.default.match(reply, /date|time/i, `Expected date or time step for: ${message}`);
    }
});
(0, node_test_1.default)('understands the complete appointment phrase set', () => {
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
        const reply = (0, aiBotService_1.generateBotReply)({
            patientName: 'Revaltrix Solutions',
            message,
            isReturning: false,
            lastInteractionHours: 0,
        });
        strict_1.default.doesNotMatch(reply, /I don't have that information on hand/i, `Unrecognized phrase: ${message}`);
        strict_1.default.match(reply, /appointment|doctor|specialist|slot|available|department|date|time/i, `Unexpected response for: ${message}`);
    }
});
(0, node_test_1.default)('recognizes available-slot questions', () => {
    const availabilityPhrases = [
        'Can I book the next available appointment?',
        'Is there any slot available?',
        'Do you have any free slots?',
    ];
    for (const message of availabilityPhrases) {
        const reply = (0, aiBotService_1.generateBotReply)({
            patientName: 'Revaltrix Solutions',
            message,
            isReturning: false,
            lastInteractionHours: 0,
        });
        strict_1.default.match(reply, /available|appointment|slot|department|date|time/i);
    }
});
(0, node_test_1.default)('normalizes afternoon booking times to 12-hour display format', () => {
    const booking = (0, aiBotService_1.parseAppointmentRequest)('book maternity today at 3pm');
    strict_1.default.equal(booking.time, '03:00 PM');
    strict_1.default.equal(booking.department, 'Antenatal Clinic');
});
(0, node_test_1.default)('understands a misspelled new appointment request', () => {
    const reply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Revaltrix Solutions',
        message: 'can I booke new appointment',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(reply, /appointment|department|date|time/i);
});
(0, node_test_1.default)('starts booking when the appointment is for a family member', () => {
    const reply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Revaltrix Solutions',
        message: 'i need an appointment for my mother',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(reply, /appointment/i);
    strict_1.default.match(reply, /department|date|time|patient/i);
    strict_1.default.doesNotMatch(reply, /I don't have that information on hand/i);
});
(0, node_test_1.default)('recognizes requests to get appointment history', () => {
    const reply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Revaltrix Solutions',
        message: 'can I get my appointment history',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(reply, /appointment history/i);
    strict_1.default.doesNotMatch(reply, /which department|preferred date/i);
});
(0, node_test_1.default)('handles real-world patient phrases like confirmation, doctor availability, and late arrival', () => {
    const confirmReply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'can you confirm my appointment?',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(confirmReply, /appointment|confirm|reference|date|time/i);
    const availabilityReply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'is there a doctor available now?',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(availabilityReply, /doctor|available|appointment|book|call/i);
    const lateReply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'i am running late',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(lateReply, /late|appointment|contact|staff|call/i);
});
(0, node_test_1.default)('formats Kenya greeting periods', () => {
    strict_1.default.equal((0, aiBotService_1.getKenyaGreeting)(new Date('2026-09-15T08:00:00.000Z')), 'Good morning');
    strict_1.default.equal((0, aiBotService_1.getKenyaGreeting)(new Date('2026-09-15T12:00:00.000Z')), 'Good afternoon');
    strict_1.default.equal((0, aiBotService_1.getKenyaGreeting)(new Date('2026-09-15T15:00:00.000Z')), 'Good evening');
});
(0, node_test_1.default)('conversation memory expires after three minutes', () => {
    strict_1.default.equal((0, aiBotService_1.isConversationStale)((aiBotService_1.CONVERSATION_MEMORY_MINUTES - 1) / 60), false);
    strict_1.default.equal((0, aiBotService_1.isConversationStale)(aiBotService_1.CONVERSATION_MEMORY_MINUTES / 60), true);
});
(0, node_test_1.default)('parses booking details from patient request', () => {
    const booking = (0, aiBotService_1.parseAppointmentRequest)('I want to book a visit tomorrow at 9am in maternity');
    strict_1.default.equal(booking.ready, true);
    strict_1.default.equal(booking.department, 'Antenatal Clinic');
    strict_1.default.equal(booking.time, '09:00 AM');
});
(0, node_test_1.default)('maps supported appointment aliases to Winston clinics and rejects unsupported services', () => {
    const maternityBooking = (0, aiBotService_1.parseAppointmentRequest)('book maternity tomorrow at 9am');
    strict_1.default.equal(maternityBooking.department, 'Antenatal Clinic');
    const familyPlanningBooking = (0, aiBotService_1.parseAppointmentRequest)('book birth control tomorrow at 9am');
    strict_1.default.equal(familyPlanningBooking.department, 'Family Planning Services');
    const ultrasoundBooking = (0, aiBotService_1.parseAppointmentRequest)('ultrasound appointment tomorrow at 9am');
    strict_1.default.equal(ultrasoundBooking.department, 'Ultrasound Services');
    const unsupportedDelivery = (0, aiBotService_1.parseAppointmentRequest)('book a delivery tomorrow at 9am');
    strict_1.default.equal(unsupportedDelivery.department, undefined);
    const unsupportedBooking = (0, aiBotService_1.parseAppointmentRequest)('book a dental appointment tomorrow at 9am');
    strict_1.default.equal(unsupportedBooking.department, undefined);
    strict_1.default.equal(unsupportedBooking.ready, false);
});
(0, node_test_1.default)('parses interactive menu time values like 09 00 am', () => {
    const booking = (0, aiBotService_1.parseAppointmentRequest)('tomorrow 09 00 am in maternity');
    strict_1.default.equal(booking.department, 'Antenatal Clinic');
    strict_1.default.equal(booking.time, '09:00 AM');
    strict_1.default.equal(booking.ready, true);
});
(0, node_test_1.default)('does not confuse appointments with ENT', () => {
    const booking = (0, aiBotService_1.parseAppointmentRequest)('I need appointments');
    strict_1.default.equal(booking.department, undefined);
    strict_1.default.equal(booking.ready, false);
});
(0, node_test_1.default)('recognizes common gynecology typos and returns the exact consultation fee', () => {
    const booking = (0, aiBotService_1.parseAppointmentRequest)('Obstetrics and Gynecolog appointment today at 11:00 AM');
    strict_1.default.equal(booking.department, 'Gynecology');
    strict_1.default.equal(booking.time, '11:00 AM');
    strict_1.default.equal((0, aiBotService_1.getServicePrice)(booking.department), 'KSh 1,500');
});
(0, node_test_1.default)('asks for missing booking details', () => {
    const prompt = (0, aiBotService_1.generateAppointmentCollectionPrompt)('Mary', {
        date: 'tomorrow',
        time: '09:00 AM'
    });
    strict_1.default.match(prompt, /department/i);
    strict_1.default.match(prompt, /date|time/i);
});
(0, node_test_1.default)('keeps consultation pricing wording exact and human-friendly', () => {
    const prompt = (0, aiBotService_1.generateAppointmentCollectionPrompt)('Mary', {
        department: 'Obstetrics and Gynecology',
        date: 'today',
    });
    strict_1.default.match(prompt, /KSh 1,500/i);
    strict_1.default.doesNotMatch(prompt, /KSh 1,500 \+ KSh 1,500/i);
    strict_1.default.match(prompt, /what time/i);
});
