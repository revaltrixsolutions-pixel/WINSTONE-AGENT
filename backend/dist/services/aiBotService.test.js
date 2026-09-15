"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const aiBotService_1 = require("./aiBotService");
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
(0, node_test_1.default)('known hospital query answers with SHA and location', () => {
    const reply = (0, aiBotService_1.generateBotReply)({
        patientName: 'Mary',
        message: 'do you accept SHA?',
        isReturning: false,
        lastInteractionHours: 0,
    });
    strict_1.default.match(reply, /Yes, Mary/i);
    strict_1.default.match(reply, /SHA/i);
    strict_1.default.match(reply, /located/i);
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
(0, node_test_1.default)('parses booking details from patient request', () => {
    const booking = (0, aiBotService_1.parseAppointmentRequest)('I want to book a visit tomorrow at 9am in maternity');
    strict_1.default.equal(booking.ready, true);
    strict_1.default.equal(booking.department, 'Maternity');
    strict_1.default.equal(booking.time, '09:00 AM');
});
(0, node_test_1.default)('asks for missing booking details', () => {
    const prompt = (0, aiBotService_1.generateAppointmentCollectionPrompt)('Mary', {
        date: 'tomorrow',
        time: '09:00 AM'
    });
    strict_1.default.match(prompt, /department/i);
    strict_1.default.doesNotMatch(prompt, /date|time/i);
});
