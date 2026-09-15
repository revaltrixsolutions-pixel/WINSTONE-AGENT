"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appointmentConversationState = void 0;
exports.extractPatientName = extractPatientName;
exports.isConversationStale = isConversationStale;
exports.parseAppointmentRequest = parseAppointmentRequest;
exports.generateAppointmentCollectionPrompt = generateAppointmentCollectionPrompt;
exports.updateAppointmentConversation = updateAppointmentConversation;
exports.generateBotReply = generateBotReply;
const hospitalData_1 = require("../knowledge/hospitalData");
exports.appointmentConversationState = new Map();
const DEFAULT_WELCOME = 'Welcome to Phadam Hospital. We are here to help you with your care needs. What is your name?';
function cleanText(value) {
    return value.replace(/\s+/g, ' ').trim();
}
function normalizeKeyword(text) {
    return cleanText(text)
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function extractPatientName(message) {
    const text = normalizeKeyword(message);
    const patterns = [
        /(?:my name is|i am|i'm|call me|this is)\s+([a-z0-9 ]+)/i,
        /(?:name is)\s+([a-z0-9 ]+)/i,
    ];
    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match && match[1]) {
            const cleaned = cleanText(match[1]).replace(/^\s+|\s+$/g, '');
            if (cleaned && cleaned.length > 1) {
                return cleaned;
            }
        }
    }
    const words = text.split(' ');
    if (words.length >= 2) {
        const candidate = words.filter((w) => w.length > 2 && !['hi', 'hello', 'hey', 'good', 'morning', 'afternoon', 'evening', 'my', 'name', 'is', 'i', 'am', 'im', 'call', 'me', 'this'].includes(w)).slice(0, 4).join(' ');
        return candidate ? candidate.replace(/\b\w/g, (ch) => ch.toUpperCase()) : null;
    }
    return null;
}
function isConversationStale(lastInteractionHours) {
    return Number.isFinite(lastInteractionHours) && lastInteractionHours >= 6;
}
function parseAppointmentRequest(message) {
    const lower = normalizeKeyword(message);
    const departmentMatch = Object.keys(hospitalData_1.hospitalKnowledge.departments).find((department) => lower.includes(normalizeKeyword(department))) ||
        (lower.includes('maternity') ? 'Maternity' : undefined) ||
        (lower.includes('pediatric') || lower.includes('paediatric') ? 'Pediatrics' : undefined) ||
        (lower.includes('emergency') ? 'Emergency' : undefined) ||
        (lower.includes('laboratory') || lower.includes('lab') ? 'Laboratory' : undefined) ||
        (lower.includes('pharmacy') ? 'Pharmacy' : undefined);
    const timeMatch = lower.match(/(\d{1,2})(?::?(\d{2}))?\s*(am|pm|a\.m|p\.m)?/i);
    const dateMatch = lower.match(/(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i) ||
        lower.match(/\b(\d{1,2})\s*(?:st|nd|rd|th)?\s*(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i);
    const normalizedTime = timeMatch
        ? `${Number(timeMatch[1]).toString().padStart(2, '0')}:${(timeMatch[2] || '00').padStart(2, '0')} ${timeMatch[3] ? timeMatch[3].toUpperCase() : 'AM'}`
        : undefined;
    const normalizedDate = dateMatch ? (dateMatch[1] || dateMatch[0]) : undefined;
    return {
        date: normalizedDate,
        time: normalizedTime,
        department: departmentMatch,
        ready: Boolean(normalizedDate && normalizedTime && departmentMatch),
    };
}
function generateAppointmentCollectionPrompt(patientName, currentData = {}) {
    const missing = [];
    if (!currentData.date)
        missing.push('date');
    if (!currentData.time)
        missing.push('time');
    if (!currentData.department)
        missing.push('department');
    if (!missing.length) {
        return `Thank you, ${patientName}. Your appointment request is ready. Please confirm the details: date ${currentData.date}, time ${currentData.time}, department ${currentData.department}.`;
    }
    const message = missing.length === 1
        ? `Please tell me the ${missing[0]} for your appointment.`
        : `Please tell me the ${missing.join(', ')} for your appointment.`;
    return `${patientName}, ${message}`;
}
function updateAppointmentConversation(patientId, patientName, message) {
    const current = exports.appointmentConversationState.get(patientId) ?? {};
    const parsed = parseAppointmentRequest(message);
    const next = {
        date: current.date ?? parsed.date,
        time: current.time ?? parsed.time,
        department: current.department ?? parsed.department,
    };
    const shouldConfirm = Boolean(next.date && next.time && next.department);
    if (message.toLowerCase().includes('confirm') || message.toLowerCase().includes('yes')) {
        exports.appointmentConversationState.delete(patientId);
        return {
            prompt: `Thank you, ${patientName}. Your appointment is now booked for ${next.date} at ${next.time} in ${next.department}.`,
            completed: true,
            data: {
                date: next.date,
                time: next.time,
                department: next.department,
            },
        };
    }
    const missing = [
        !next.date ? 'date' : null,
        !next.time ? 'time' : null,
        !next.department ? 'department' : null,
    ].filter(Boolean);
    if (missing.length) {
        exports.appointmentConversationState.set(patientId, next);
        return {
            prompt: generateAppointmentCollectionPrompt(patientName, next),
            completed: false,
        };
    }
    if (shouldConfirm) {
        exports.appointmentConversationState.set(patientId, next);
        return {
            prompt: `Please confirm your appointment: ${next.date} at ${next.time} in the ${next.department} department. Reply YES to confirm or tell me to change it.`,
            completed: false,
            awaitingConfirmation: true,
        };
    }
    exports.appointmentConversationState.delete(patientId);
    return {
        prompt: `Thank you, ${patientName}. Your appointment is now booked for ${next.date} at ${next.time} in ${next.department}.`,
        completed: true,
        data: {
            date: next.date,
            time: next.time,
            department: next.department,
        },
    };
}
function getAnswerFromKnowledgeBase(message) {
    const directAnswer = (0, hospitalData_1.searchKnowledgeBase)(message);
    if (directAnswer) {
        return directAnswer;
    }
    const normalized = normalizeKeyword(message);
    const lower = normalized.toLowerCase();
    if (lower.includes('sha') || lower.includes('insurance') || lower.includes('cover')) {
        return [
            'Yes, we accept SHA and several other medical insurance partners.',
            '',
            'We also work with AON Minet, Sanlam, Britam, UAP, CIC General, and more.',
            '',
            'Please confirm your cover and preauthorization requirements before treatment.',
        ].join('\n');
    }
    if (lower.includes('location') || lower.includes('where') || lower.includes('address') || lower.includes('branch')) {
        return [
            'We are located at two main branches:',
            '',
            `• ${hospitalData_1.hospitalKnowledge.locations[0].branch}: ${hospitalData_1.hospitalKnowledge.locations[0].address}`,
            `  Landmark: ${hospitalData_1.hospitalKnowledge.locations[0].landmark}`,
            `  Contact: ${hospitalData_1.hospitalKnowledge.locations[0].phoneNumbers.join(', ')}`,
            '',
            `• ${hospitalData_1.hospitalKnowledge.locations[1].branch}: ${hospitalData_1.hospitalKnowledge.locations[1].address}`,
            `  Landmark: ${hospitalData_1.hospitalKnowledge.locations[1].landmark}`,
            `  Contact: ${hospitalData_1.hospitalKnowledge.locations[1].phoneNumbers.join(', ')}`,
        ].join('\n');
    }
    if (lower.includes('book') || lower.includes('appointment') || lower.includes('visit') || lower.includes('consult')) {
        return [
            'Yes, we offer appointments and consultations.',
            '',
            'You may visit any of our hospital branches or contact the hospital directly for current doctor schedules and availability.',
            '',
            'What time would you like to visit us?',
        ].join('\n');
    }
    if (lower.includes('service') || lower.includes('offer') || lower.includes('department')) {
        return [
            'We offer general consultation, maternity, pediatric, emergency, pharmacy, laboratory, radiology, dental, optical, physiotherapy, and specialist clinics.',
            '',
            'Please tell us the service or department you need, and we will guide you.',
        ].join('\n');
    }
    return null;
}
function generateBotReply({ patientName, message, isReturning, lastInteractionHours, }) {
    const text = cleanText(message || '');
    const normalized = normalizeKeyword(text);
    if (!text) {
        return 'Welcome to Phadam Hospital. Please tell us what you need today.';
    }
    if (!patientName) {
        return 'Welcome to Phadam Hospital. We are happy to help you. What is your name?';
    }
    if (isReturning || isConversationStale(lastInteractionHours)) {
        return [
            `Welcome back, ${patientName}.`,
            '',
            'We are here to continue with your conversation. Would you like to continue with your enquiry?',
        ].join('\n');
    }
    const appointmentRequest = parseAppointmentRequest(text);
    if (appointmentRequest.ready) {
        return `Thank you, ${patientName}. I have noted your appointment for ${appointmentRequest.date} at ${appointmentRequest.time} in the ${appointmentRequest.department} department. Please confirm, and I will book it for you.`;
    }
    const answer = getAnswerFromKnowledgeBase(text);
    if (answer) {
        const lines = answer.split('\n');
        const final = lines.map((line) => line.trim()).filter(Boolean);
        if (final[0]?.toLowerCase().includes('yes') || final[0]?.toLowerCase().includes('we are located')) {
            return answer;
        }
        if (normalized.includes('sha') || normalized.includes('insurance') || normalized.includes('cover')) {
            return [
                `Yes, ${patientName} we accept SHA and other insurance partners at Phadam Hospital.`,
                '',
                `${patientName}, we are located at Phadam Hospital with branches in Nasra and Umoja.`,
                '',
                answer,
            ].join('\n');
        }
        if (normalized.includes('where') ||
            normalized.includes('location') ||
            normalized.includes('address') ||
            normalized.includes('branch')) {
            return `${patientName}, we are located at Phadam Hospital.\n\n${answer}`;
        }
        if (normalized.includes('appointment') ||
            normalized.includes('visit') ||
            normalized.includes('book') ||
            normalized.includes('consult')) {
            return generateAppointmentCollectionPrompt(patientName, {
                date: appointmentRequest.date,
                time: appointmentRequest.time,
                department: appointmentRequest.department,
            });
        }
        return answer;
    }
    const fallback = [
        `Thank you, ${patientName}.`,
        '',
        'I am sorry, I may not have enough information for that question.',
        'Please kindly speak to one of our doctors or staff members for the best assistance.',
    ].join('\n');
    return fallback;
}
