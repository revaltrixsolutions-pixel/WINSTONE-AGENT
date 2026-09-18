"use strict";
// backend/src/controllers/webhookController.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWhatsAppWebhook = handleWhatsAppWebhook;
const prisma_1 = require("../lib/prisma");
const aiBotService_1 = require("../services/aiBotService");
const whatsappService_1 = require("../services/whatsappService");
/* ==========================================================================
   HELPERS
   ========================================================================== */
/**
 * Converts a phone number into digits only.
 *
 * Examples:
 * +254 712 345 678 -> 254712345678
 * 254712345678      -> 254712345678
 */
function normalizePhoneNumber(phoneNumber) {
    return phoneNumber.replace(/\D/g, '');
}
async function getLastInteractionHours(patientId) {
    const lastMessage = await prisma_1.prisma.messageLog.findFirst({
        where: {
            patientId,
        },
        orderBy: {
            timestamp: 'desc',
        },
        select: {
            timestamp: true,
        },
    });
    if (!lastMessage?.timestamp) {
        return Number.POSITIVE_INFINITY;
    }
    const diffMs = Date.now() - new Date(lastMessage.timestamp).getTime();
    return diffMs / (1000 * 60 * 60);
}
async function getLastAgentInteractionHours(patientId) {
    const lastAgentMessage = await prisma_1.prisma.messageLog.findFirst({
        where: { patientId, sender: 'AGENT' },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
    });
    if (!lastAgentMessage?.timestamp) {
        return Number.POSITIVE_INFINITY;
    }
    return (Date.now() - new Date(lastAgentMessage.timestamp).getTime()) /
        (1000 * 60 * 60);
}
function isAppointmentLookupRequest(message) {
    return /\b(my|our|the)\b.*\b(appointment|appointments|booking|bookings|visit|visits)\b/i.test(message) ||
        /\b(appointment|appointments|booking|bookings|visit|visits)\b.*\b(details|status|when|date|time|schedule|scheduled|confirm|check|see)\b/i.test(message) ||
        /\b(when|where|what time)\b.*\b(appointment|visit|doctor|clinic)\b/i.test(message) ||
        /\b(scheduled|upcoming|confirmed)\b.*\b(appointment|visit|booking)\b/i.test(message);
}
function formatKenyaDateTime(date) {
    return new Intl.DateTimeFormat('en-KE', {
        timeZone: 'Africa/Nairobi',
        dateStyle: 'full',
        timeStyle: 'short',
    }).format(date);
}
async function getAppointmentLookupReply(patientId, patientName, message) {
    if (!isAppointmentLookupRequest(message))
        return null;
    const appointments = await prisma_1.prisma.appointment.findMany({
        where: {
            patientId,
            slotTime: { gte: new Date() },
            status: { not: 'CANCELLED' },
        },
        orderBy: { slotTime: 'asc' },
        take: 5,
    });
    if (!appointments.length) {
        return `${patientName}, I could not find an upcoming appointment under this WhatsApp number. Would you like to book one? Please send the date, time, and department, for example: tomorrow at 9am in Maternity.`;
    }
    const details = appointments.map((appointment, index) => [
        `${index + 1}. ${formatKenyaDateTime(appointment.slotTime)}`,
        `Department: ${appointment.specialty}`,
        `Doctor: ${appointment.doctorName}`,
        `Status: ${appointment.status}`,
        `Reference: ${appointment.id.slice(0, 8)}`,
    ].join('\n')).join('\n\n');
    return `${(0, aiBotService_1.getKenyaGreeting)()}, ${patientName}. Here are your upcoming appointment details:\n\n${details}\n\nWhat would you like to do next: keep this appointment, book another one, or speak with staff?`;
}
function parseAppointmentDate(dateText, timeText) {
    const normalizedDate = dateText.toLowerCase();
    const normalizedTime = timeText.toLowerCase();
    const base = new Date();
    const dateOnly = new Date(base);
    dateOnly.setHours(0, 0, 0, 0);
    const timeMatch = normalizedTime.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    const parsedHour = timeMatch ? Number(timeMatch[1]) : 9;
    const parsedMinute = timeMatch && timeMatch[2] ? Number(timeMatch[2]) : 0;
    let hour = parsedHour;
    const meridiem = timeMatch?.[3]?.toLowerCase();
    if (meridiem === 'pm' && hour < 12) {
        hour += 12;
    }
    if (meridiem === 'am' && hour === 12) {
        hour = 0;
    }
    if (normalizedDate.includes('today')) {
        dateOnly.setHours(hour, parsedMinute, 0, 0);
        return dateOnly;
    }
    if (normalizedDate.includes('tomorrow')) {
        dateOnly.setDate(dateOnly.getDate() + 1);
        dateOnly.setHours(hour, parsedMinute, 0, 0);
        return dateOnly;
    }
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const weekdayIndex = weekdays.findIndex((day) => normalizedDate.includes(day));
    if (weekdayIndex >= 0) {
        const currentIndex = dateOnly.getDay();
        const daysUntil = (weekdayIndex - currentIndex + 7) % 7 || 7;
        dateOnly.setDate(dateOnly.getDate() + daysUntil);
        dateOnly.setHours(hour, parsedMinute, 0, 0);
        return dateOnly;
    }
    if (normalizedDate.includes('next week')) {
        dateOnly.setDate(dateOnly.getDate() + 7);
        dateOnly.setHours(hour, parsedMinute, 0, 0);
        return dateOnly;
    }
    const directDate = new Date(normalizedDate);
    if (!Number.isNaN(directDate.getTime())) {
        directDate.setHours(hour, parsedMinute, 0, 0);
        return directDate;
    }
    dateOnly.setHours(hour, parsedMinute, 0, 0);
    return dateOnly;
}
function buildAppointmentInteractive(prompt, appointmentState) {
    if (appointmentState.awaitingConfirmation) {
        return {
            type: 'button',
            body: { text: prompt },
            action: {
                buttons: [
                    { type: 'reply', reply: { id: 'appointment_confirm', title: 'Confirm' } },
                    { type: 'reply', reply: { id: 'appointment_change', title: 'Change details' } },
                ],
            },
        };
    }
    if (!appointmentState.department) {
        const rows = aiBotService_1.appointmentServiceOptions.map((service) => ({
            id: `service_${service.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
            title: service.slice(0, 24),
            description: `${(0, aiBotService_1.getServicePrice)(service)} + KSh 1,000 consultation`,
        }));
        return {
            type: 'list',
            body: {
                text: `${prompt} The menu shows the most requested services. If yours is not listed, reply with the service name.`,
            },
            action: {
                button: 'Choose a service',
                sections: [{
                        title: 'Hospital services',
                        rows: rows.slice(0, 10),
                    }],
            },
        };
    }
    if (!appointmentState.date) {
        return {
            type: 'list',
            body: { text: prompt },
            action: {
                button: 'Choose a date',
                sections: [{
                        title: 'Appointment date',
                        rows: [
                            { id: 'date_today', title: 'Today' },
                            { id: 'date_tomorrow', title: 'Tomorrow' },
                            { id: 'date_next_week', title: 'Next week' },
                        ],
                    }],
            },
        };
    }
    if (!appointmentState.time) {
        return {
            type: 'list',
            body: { text: prompt },
            action: {
                button: 'Choose a time',
                sections: [{
                        title: 'Available times',
                        rows: ['09:00 AM', '11:00 AM', '01:00 PM', '03:00 PM', '05:00 PM'].map((time) => ({
                            id: `time_${time.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
                            title: time,
                        })),
                    }],
            },
        };
    }
    return undefined;
}
function buildPatientMenu() {
    return {
        type: 'list',
        body: {
            text: 'Welcome to Phadam Hospital. Choose what you need below. You only need to type your name; all other options can be selected.',
        },
        action: {
            button: 'Open hospital menu',
            sections: [{
                    title: 'How can we help?',
                    rows: [
                        { id: 'menu_appointments', title: 'Book appointment', description: 'Choose service, date and time' },
                        { id: 'menu_scheduled', title: 'My appointments', description: 'View scheduled appointments' },
                        { id: 'menu_services', title: 'Our services', description: 'Browse hospital services' },
                        { id: 'menu_departments', title: 'Departments', description: 'View hospital departments' },
                        { id: 'menu_locations', title: 'Locations and contacts', description: 'Find our branches' },
                        { id: 'menu_prices', title: 'Prices and fees', description: 'View available prices' },
                        { id: 'menu_insurance', title: 'SHA and insurance', description: 'Check accepted covers' },
                        { id: 'menu_human', title: 'Speak to staff', description: 'Request human assistance' },
                    ],
                }],
        },
    };
}
function buildKnowledgeMenu() {
    return {
        type: 'list',
        body: { text: 'Choose a topic and I will show the exact Phadam Hospital information.' },
        action: {
            button: 'Choose a topic',
            sections: [{
                    title: 'Hospital information',
                    rows: [
                        { id: 'menu_services', title: 'Services', description: 'Clinical and support services' },
                        { id: 'menu_departments', title: 'Departments', description: 'Department information' },
                        { id: 'menu_specialists', title: 'Specialist clinics', description: 'Specialist care options' },
                        { id: 'menu_locations', title: 'Locations', description: 'Branches and contacts' },
                        { id: 'menu_prices', title: 'Prices', description: 'Procedures and fees' },
                        { id: 'menu_insurance', title: 'SHA and insurance', description: 'Accepted medical covers' },
                        { id: 'menu_about', title: 'About Phadam', description: 'Mission, values and leadership' },
                        { id: 'menu_human', title: 'Speak to staff', description: 'Request human help' },
                    ],
                }],
        },
    };
}
function normalizeInteractiveSelection(message) {
    const selections = {
        menu_appointments: 'book appointment',
        menu_scheduled: 'show my scheduled appointments',
        menu_services: 'show our services',
        menu_departments: 'show our departments',
        menu_specialists: 'show our specialist clinics',
        menu_locations: 'show our locations and contacts',
        menu_prices: 'show prices and fees',
        menu_insurance: 'show SHA and insurance',
        menu_about: 'show hospital information',
        menu_human: 'I want to speak to a human staff member',
        appointment_confirm: 'confirm',
        appointment_change: 'change details',
        date_today: 'today',
        date_tomorrow: 'tomorrow',
        date_next_week: 'next week',
    };
    if (selections[message])
        return selections[message];
    if (message.startsWith('time_')) {
        return message.slice('time_'.length).replaceAll('_', ' ');
    }
    if (message.startsWith('service_')) {
        return message.slice('service_'.length).replaceAll('_', ' ');
    }
    return message;
}
async function sendBotReply(patient, incomingMessage) {
    const effectiveMessage = normalizeInteractiveSelection(incomingMessage);
    const patientName = ((0, aiBotService_1.isUsablePatientName)(patient.fullName)
        ? patient.fullName
        : (0, aiBotService_1.extractPatientName)(effectiveMessage)) || 'Patient';
    const bookingIntent = /book|appointment|visit|consult|schedule|booking/i.test(effectiveMessage);
    const hasPatientName = patientName !== 'Patient';
    const appointmentDetails = (0, aiBotService_1.parseAppointmentRequest)(effectiveMessage);
    const nameWasJustCaptured = patient.nameWasJustCaptured === true;
    if (aiBotService_1.appointmentConversationState.has(patient.id) &&
        !bookingIntent &&
        !appointmentDetails.date &&
        !appointmentDetails.time &&
        !appointmentDetails.department) {
        aiBotService_1.appointmentConversationState.delete(patient.id);
    }
    if (patient.chatStatus === 'AGENT_ACTIVE') {
        const hoursSinceAgentMessage = await getLastAgentInteractionHours(patient.id);
        if (!Number.isFinite(hoursSinceAgentMessage) || hoursSinceAgentMessage < 3 / 60) {
            console.info('[WhatsApp Bot Suppressed] Chat is assigned to staff.', {
                patientId: patient.id,
                hoursSinceAgentMessage,
            });
            return;
        }
    }
    if (nameWasJustCaptured) {
        const menu = buildPatientMenu();
        await (0, whatsappService_1.sendWhatsAppMessage)({ recipientPhone: patient.phoneNumber, interactive: menu });
        await prisma_1.prisma.messageLog.create({
            data: {
                patientId: patient.id,
                sender: 'BOT',
                body: menu.body.text,
                timestamp: new Date(),
            },
        });
        return;
    }
    if (effectiveMessage === 'show our services' || effectiveMessage === 'show our departments' || effectiveMessage === 'show our specialist clinics' || effectiveMessage === 'show prices and fees' || effectiveMessage === 'show SHA and insurance' || effectiveMessage === 'show hospital information') {
        const menu = buildKnowledgeMenu();
        await (0, whatsappService_1.sendWhatsAppMessage)({ recipientPhone: patient.phoneNumber, interactive: menu });
        return;
    }
    if ((0, aiBotService_1.isHumanSupportRequest)(effectiveMessage)) {
        const humanReply = hasPatientName
            ? `Thanks, ${patientName}. I have asked our staff to help you. Please briefly describe what you need, and a staff member will introduce themselves here shortly.`
            : 'I can connect you with a human staff member. Before I send the request, please reply with your full name and briefly tell me what you need help with.';
        if (hasPatientName) {
            await prisma_1.prisma.patient.update({
                where: { id: patient.id },
                data: { chatStatus: 'PENDING_AGENT' },
            });
        }
        try {
            await (0, whatsappService_1.sendWhatsAppMessage)({
                recipientPhone: patient.phoneNumber,
                messageText: humanReply,
            });
            await prisma_1.prisma.messageLog.create({
                data: {
                    patientId: patient.id,
                    sender: 'BOT',
                    body: humanReply,
                    timestamp: new Date(),
                },
            });
        }
        catch (error) {
            console.error('[WhatsApp Human Handoff Reply Failed]', {
                patientId: patient.id,
                error: error instanceof Error ? error.message : error,
            });
        }
        return;
    }
    const appointmentLookupReply = hasPatientName
        ? await getAppointmentLookupReply(patient.id, patientName, effectiveMessage)
        : null;
    if (appointmentLookupReply) {
        try {
            const whatsappResult = await (0, whatsappService_1.sendWhatsAppMessage)({
                recipientPhone: patient.phoneNumber,
                messageText: appointmentLookupReply,
            });
            await prisma_1.prisma.messageLog.create({
                data: {
                    patientId: patient.id,
                    sender: 'BOT',
                    body: appointmentLookupReply,
                    timestamp: new Date(),
                },
            });
            console.info('[WhatsApp Appointment Lookup Reply Sent]', {
                patientId: patient.id,
                messageId: whatsappResult.messageId,
            });
        }
        catch (error) {
            console.error('[WhatsApp Appointment Lookup Reply Failed]', {
                patientId: patient.id,
                error: error instanceof Error ? error.message : error,
            });
        }
        return;
    }
    if (hasPatientName && (bookingIntent || aiBotService_1.appointmentConversationState.has(patient.id))) {
        const appointmentState = (0, aiBotService_1.updateAppointmentConversation)(patient.id, patientName, effectiveMessage);
        if (!appointmentState.completed) {
            const replyText = appointmentState.prompt;
            const interactive = buildAppointmentInteractive(replyText, {
                ...appointmentState.data,
                awaitingConfirmation: appointmentState.awaitingConfirmation,
            });
            try {
                await (0, whatsappService_1.sendWhatsAppMessage)({
                    recipientPhone: patient.phoneNumber,
                    messageText: replyText,
                    interactive,
                });
                await prisma_1.prisma.messageLog.create({
                    data: {
                        patientId: patient.id,
                        sender: 'BOT',
                        body: replyText,
                        timestamp: new Date(),
                    },
                });
                console.info('[WhatsApp Appointment Prompt Sent]', {
                    patientId: patient.id,
                    prompt: replyText,
                });
            }
            catch (error) {
                console.error('[WhatsApp Appointment Prompt Failed]', {
                    patientId: patient.id,
                    error: error instanceof Error ? error.message : error,
                });
            }
            if (appointmentState.awaitingConfirmation) {
                return;
            }
            return;
        }
        const { date, time, department } = appointmentState.data;
        if (!date || !time || !department) {
            return;
        }
        const slotTime = parseAppointmentDate(date, time);
        try {
            const appointment = await prisma_1.prisma.appointment.create({
                data: {
                    patientId: patient.id,
                    doctorName: 'To be assigned',
                    specialty: department,
                    servicePrice: (0, aiBotService_1.getServicePrice)(department) ?? undefined,
                    consultationFee: 'KSh 1,000',
                    slotTime,
                    status: 'CONFIRMED',
                },
            });
            const confirmationText = `Thank you, ${patientName}. Your appointment has been booked for ${date} at ${time} in the ${department} department. Your appointment reference is ${appointment.id.slice(0, 8)}.`;
            await (0, whatsappService_1.sendWhatsAppMessage)({
                recipientPhone: patient.phoneNumber,
                messageText: confirmationText,
            });
            await prisma_1.prisma.messageLog.create({
                data: {
                    patientId: patient.id,
                    sender: 'BOT',
                    body: confirmationText,
                    timestamp: new Date(),
                },
            });
            console.info('[WhatsApp Booking Saved]', {
                patientId: patient.id,
                appointmentId: appointment.id,
                date,
                time,
                department,
            });
            return;
        }
        catch (error) {
            console.error('[WhatsApp Booking Save Failed]', {
                patientId: patient.id,
                error: error instanceof Error ? error.message : error,
            });
            return;
        }
    }
    const lastInteractionHours = await getLastInteractionHours(patient.id);
    const replyText = (0, aiBotService_1.generateBotReply)({
        patientName: patientName || null,
        message: effectiveMessage,
        isReturning: (0, aiBotService_1.isConversationStale)(lastInteractionHours),
        lastInteractionHours,
    });
    if (!replyText.trim()) {
        return;
    }
    try {
        const whatsappResult = await (0, whatsappService_1.sendWhatsAppMessage)({
            recipientPhone: patient.phoneNumber,
            messageText: replyText,
        });
        await prisma_1.prisma.messageLog.create({
            data: {
                patientId: patient.id,
                sender: 'BOT',
                body: replyText,
                timestamp: new Date(),
            },
        });
        console.info('[WhatsApp Auto Reply Sent]', {
            patientId: patient.id,
            recipientPhone: patient.phoneNumber,
            messageId: whatsappResult.messageId,
            simulated: whatsappResult.simulated,
            patientName: patientName || null,
        });
    }
    catch (error) {
        if (error instanceof whatsappService_1.WhatsAppApiError) {
            console.error('[WhatsApp Auto Reply API Error]', {
                patientId: patient.id,
                recipientPhone: patient.phoneNumber,
                status: error.status,
                metaCode: error.metaCode,
                metaType: error.metaType,
                metaDetails: error.metaDetails,
                fbTraceId: error.fbTraceId,
            });
            return;
        }
        console.error('[WhatsApp Auto Reply Send Failed]', {
            patientId: patient.id,
            recipientPhone: patient.phoneNumber,
            error: error instanceof Error ? error.message : error,
        });
    }
}
/**
 * Converts the incoming Meta timestamp, which is in Unix seconds,
 * into a JavaScript Date object.
 */
function getWebhookMessageDate(timestamp) {
    if (!timestamp) {
        return new Date();
    }
    const timestampSeconds = Number(timestamp);
    if (!Number.isFinite(timestampSeconds)) {
        return new Date();
    }
    return new Date(timestampSeconds * 1000);
}
/**
 * Gets a displayable body for text, buttons, interactive messages,
 * media, voice notes, documents, and location messages.
 */
function getMessageBody(message) {
    if (message.type === 'text') {
        return message.text?.body?.trim() || '';
    }
    if (message.type === 'button') {
        return (message.button?.text?.trim() ||
            message.button?.payload?.trim() ||
            '[Button response]');
    }
    if (message.type === 'interactive') {
        if (message.interactive?.type === 'button_reply') {
            return (message.interactive.button_reply?.id?.trim() ||
                message.interactive.button_reply?.title?.trim() ||
                '[Interactive button response]');
        }
        if (message.interactive?.type === 'list_reply') {
            return (message.interactive.list_reply?.id?.trim() ||
                message.interactive.list_reply?.title?.trim() ||
                message.interactive.list_reply?.description?.trim() ||
                '[Interactive list response]');
        }
        return '[Interactive WhatsApp response]';
    }
    if (message.type === 'image') {
        const caption = message.image?.caption?.trim();
        return caption
            ? `[Image] ${caption}`
            : '[Image received]';
    }
    if (message.type === 'document') {
        const filename = message.document?.filename?.trim();
        const caption = message.document?.caption?.trim();
        if (filename && caption) {
            return `[Document: ${filename}] ${caption}`;
        }
        if (filename) {
            return `[Document received: ${filename}]`;
        }
        if (caption) {
            return `[Document] ${caption}`;
        }
        return '[Document received]';
    }
    if (message.type === 'audio') {
        return '[Voice note received]';
    }
    if (message.type === 'video') {
        const caption = message.video?.caption?.trim();
        return caption
            ? `[Video] ${caption}`
            : '[Video received]';
    }
    if (message.type === 'location') {
        const name = message.location?.name?.trim();
        const address = message.location?.address?.trim();
        if (name && address) {
            return `[Location] ${name} — ${address}`;
        }
        if (name) {
            return `[Location] ${name}`;
        }
        if (address) {
            return `[Location] ${address}`;
        }
        return '[Location received]';
    }
    return `[Unsupported WhatsApp message type: ${message.type || 'unknown'}]`;
}
/**
 * Finds a profile name from the Meta contacts array.
 */
function getContactProfileName(contacts, phoneNumber) {
    const contact = contacts.find((item) => {
        const contactNumber = normalizePhoneNumber(item.wa_id || '');
        return contactNumber === phoneNumber;
    });
    return contact?.profile?.name?.trim() || null;
}
/* ==========================================================================
   WEBHOOK CONTROLLER
   ========================================================================== */
/**
 * POST /api/whatsapp/webhook
 *
 * Receives WhatsApp events sent by Meta.
 *
 * Main responsibilities:
 * 1. Read incoming patient WhatsApp messages.
 * 2. Find or create a Patient using the WhatsApp phone number.
 * 3. Save incoming message into MessageLog.
 * 4. Set chatStatus to PENDING_AGENT.
 * 5. Return HTTP 200 so Meta knows the webhook was accepted.
 */
async function handleWhatsAppWebhook(req, res) {
    try {
        const payload = req.body;
        console.info('[WhatsApp Webhook Received]', {
            object: payload?.object,
            entryCount: Array.isArray(payload?.entry)
                ? payload.entry.length
                : 0,
        });
        /*
         * Ignore any event that is not a WhatsApp Business Account webhook.
         */
        if (payload?.object !== 'whatsapp_business_account') {
            console.warn('[WhatsApp Webhook Ignored] Unexpected webhook object.', {
                object: payload?.object,
            });
            res.sendStatus(200);
            return;
        }
        const entries = Array.isArray(payload.entry)
            ? payload.entry
            : [];
        for (const entry of entries) {
            const changes = Array.isArray(entry.changes)
                ? entry.changes
                : [];
            for (const change of changes) {
                /*
                 * WhatsApp incoming messages and delivery/read statuses
                 * normally arrive under field: "messages".
                 */
                if (change.field !== 'messages') {
                    console.info('[WhatsApp Webhook Ignored] Unsupported event field.', {
                        field: change.field,
                    });
                    continue;
                }
                const value = change.value;
                if (!value) {
                    continue;
                }
                const contacts = Array.isArray(value.contacts)
                    ? value.contacts
                    : [];
                const incomingMessages = Array.isArray(value.messages)
                    ? value.messages
                    : [];
                const statuses = Array.isArray(value.statuses)
                    ? value.statuses
                    : [];
                /*
                 * These status events are generated for messages sent from
                 * your system to a patient.
                 *
                 * They are not patient messages, so they are logged only.
                 */
                for (const status of statuses) {
                    console.info('[WhatsApp Message Status Update]', {
                        whatsappMessageId: status.id,
                        status: status.status,
                        recipientPhone: status.recipient_id,
                        error: status.errors?.[0]?.error_data?.details ||
                            status.errors?.[0]?.message ||
                            null,
                    });
                }
                /*
                 * These are messages sent from the patient's WhatsApp number
                 * to your connected WhatsApp Business number.
                 */
                for (const incomingMessage of incomingMessages) {
                    const senderPhoneRaw = incomingMessage.from?.trim();
                    const whatsappMessageId = incomingMessage.id?.trim();
                    const messageType = incomingMessage.type || 'unknown';
                    if (!senderPhoneRaw) {
                        console.warn('[WhatsApp Incoming Message Ignored] Missing sender phone number.', {
                            whatsappMessageId,
                            messageType,
                        });
                        continue;
                    }
                    const senderPhone = normalizePhoneNumber(senderPhoneRaw);
                    if (!senderPhone) {
                        console.warn('[WhatsApp Incoming Message Ignored] Invalid sender phone number.', {
                            senderPhoneRaw,
                            whatsappMessageId,
                        });
                        continue;
                    }
                    const messageBody = getMessageBody(incomingMessage);
                    if (!messageBody) {
                        console.warn('[WhatsApp Incoming Message Ignored] Empty message body.', {
                            senderPhoneLast4: senderPhone.slice(-4),
                            whatsappMessageId,
                            messageType,
                        });
                        continue;
                    }
                    const sentAt = getWebhookMessageDate(incomingMessage.timestamp);
                    if (whatsappMessageId) {
                        const alreadyProcessed = await prisma_1.prisma.messageLog.findUnique({
                            where: { whatsappMessageId },
                            select: { id: true },
                        });
                        if (alreadyProcessed) {
                            console.info('[WhatsApp Duplicate Event Ignored]', {
                                whatsappMessageId,
                            });
                            continue;
                        }
                    }
                    const profileName = getContactProfileName(contacts, senderPhone);
                    console.info('[WhatsApp Incoming Message]', {
                        senderPhoneLast4: senderPhone.slice(-4),
                        whatsappMessageId,
                        messageType,
                        profileName,
                    });
                    /*
                     * Find the existing patient/chat by WhatsApp number.
                     *
                     * Patient.phoneNumber should be stored consistently in
                     * international digits-only format, for example:
                     *
                     * 254712345678
                     */
                    let patient = await prisma_1.prisma.patient.findFirst({
                        where: {
                            phoneNumber: senderPhone,
                        },
                        select: {
                            id: true,
                            phoneNumber: true,
                            chatStatus: true,
                            assignedTo: true,
                            fullName: true,
                        },
                    });
                    /*
                     * A first-time WhatsApp sender gets a new patient/chat record.
                     *
                     * If your Patient Prisma model has other required fields,
                     * add them in this `data` object.
                     */
                    if (!patient) {
                        patient = await prisma_1.prisma.patient.create({
                            data: {
                                phoneNumber: senderPhone,
                                chatStatus: 'PENDING_AGENT',
                            },
                            select: {
                                id: true,
                                phoneNumber: true,
                                chatStatus: true,
                                assignedTo: true,
                                fullName: true,
                            },
                        });
                        console.info('[WhatsApp New Patient Created]', {
                            patientId: patient.id,
                            phoneLast4: senderPhone.slice(-4),
                            profileName,
                        });
                    }
                    const storedName = (0, aiBotService_1.isUsablePatientName)(patient.fullName)
                        ? patient.fullName
                        : null;
                    const profileNameCandidate = (0, aiBotService_1.isUsablePatientName)(profileName)
                        ? profileName
                        : null;
                    const detectedName = storedName ||
                        (0, aiBotService_1.extractPatientName)(messageBody) ||
                        profileNameCandidate;
                    if (detectedName !== patient.fullName) {
                        patient = await prisma_1.prisma.patient.update({
                            where: {
                                id: patient.id,
                            },
                            data: {
                                fullName: detectedName,
                            },
                            select: {
                                id: true,
                                phoneNumber: true,
                                chatStatus: true,
                                assignedTo: true,
                                fullName: true,
                            },
                        });
                    }
                    const duplicateWindowEnd = new Date(sentAt.getTime() + 60_000);
                    const duplicateWindowStart = new Date(sentAt.getTime() - 60_000);
                    const duplicateMessage = await prisma_1.prisma.messageLog.findFirst({
                        where: {
                            patientId: patient.id,
                            sender: 'PATIENT',
                            body: messageBody,
                            timestamp: {
                                gte: duplicateWindowStart,
                                lte: duplicateWindowEnd,
                            },
                        },
                        select: {
                            id: true,
                        },
                    });
                    if (duplicateMessage) {
                        console.info('[WhatsApp Incoming Message Duplicate Ignored]', {
                            patientId: patient.id,
                            duplicateMessageLogId: duplicateMessage.id,
                            whatsappMessageId,
                        });
                        continue;
                    }
                    /*
                     * Save incoming WhatsApp message to your MessageLog table.
                     *
                     * This is what makes the text available in:
                     *
                     * GET /api/agent/chats
                     */
                    const [savedMessage, updatedPatient] = await prisma_1.prisma.$transaction([
                        prisma_1.prisma.messageLog.create({
                            data: {
                                patientId: patient.id,
                                sender: 'PATIENT',
                                body: messageBody,
                                whatsappMessageId: whatsappMessageId || undefined,
                                timestamp: sentAt,
                            },
                        }),
                        prisma_1.prisma.patient.update({
                            where: {
                                id: patient.id,
                            },
                            data: {
                                /*
                                 * Keep an active agent assignment if a staff member
                                 * already owns the conversation.
                                 */
                                chatStatus: patient.chatStatus === 'AGENT_ACTIVE'
                                    ? 'AGENT_ACTIVE'
                                    : 'PENDING_AGENT',
                            },
                            select: {
                                id: true,
                                phoneNumber: true,
                                chatStatus: true,
                                assignedTo: true,
                            },
                        }),
                    ]);
                    console.info('[WhatsApp Incoming Message Saved]', {
                        patientId: updatedPatient.id,
                        messageLogId: savedMessage.id,
                        senderPhoneLast4: senderPhone.slice(-4),
                        whatsappMessageId,
                        messageType,
                        chatStatus: updatedPatient.chatStatus,
                        assignedTo: updatedPatient.assignedTo,
                    });
                    await sendBotReply({
                        id: patient.id,
                        phoneNumber: patient.phoneNumber,
                        fullName: patient.fullName || detectedName || null,
                        chatStatus: patient.chatStatus,
                    }, messageBody);
                }
            }
        }
        /*
         * Meta needs a successful response.
         * A non-2xx status can cause Meta to retry the same event.
         */
        res.sendStatus(200);
    }
    catch (error) {
        console.error('[WhatsApp Webhook Controller Error]', error instanceof Error ? error.stack || error.message : error);
        /*
         * Returning 500 tells Meta delivery failed.
         * Meta may retry the event later.
         */
        res.status(500).json({
            success: false,
            error: 'Unable to process incoming WhatsApp webhook event.',
        });
    }
}
