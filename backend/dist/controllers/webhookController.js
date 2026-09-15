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
async function sendBotReply(patient, incomingMessage) {
    const patientName = patient.fullName || (0, aiBotService_1.extractPatientName)(incomingMessage) || 'Patient';
    const bookingIntent = /book|appointment|visit|consult|schedule|booking/i.test(incomingMessage);
    if (bookingIntent || aiBotService_1.appointmentConversationState.has(patient.id)) {
        const appointmentState = (0, aiBotService_1.updateAppointmentConversation)(patient.id, patientName, incomingMessage);
        if (!appointmentState.completed) {
            const replyText = appointmentState.prompt;
            try {
                await (0, whatsappService_1.sendWhatsAppMessage)({
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
        const slotTime = parseAppointmentDate(date, time);
        try {
            const appointment = await prisma_1.prisma.appointment.create({
                data: {
                    patientId: patient.id,
                    doctorName: 'To be assigned',
                    specialty: department,
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
        message: incomingMessage,
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
            return (message.interactive.button_reply?.title?.trim() ||
                message.interactive.button_reply?.id?.trim() ||
                '[Interactive button response]');
        }
        if (message.interactive?.type === 'list_reply') {
            return (message.interactive.list_reply?.title?.trim() ||
                message.interactive.list_reply?.description?.trim() ||
                message.interactive.list_reply?.id?.trim() ||
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
                    const detectedName = patient.fullName || (0, aiBotService_1.extractPatientName)(messageBody);
                    if (detectedName && !patient.fullName) {
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
