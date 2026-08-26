"use strict";
// src/controllers/webhookController.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWhatsAppWebhook = handleWhatsAppWebhook;
const prisma_1 = require("../lib/prisma");
const whatsappService_1 = require("../services/whatsappService");
const hospitalData_1 = require("../knowledge/hospitalData");
const HUMAN_AGENT_KEYWORDS = [
    'human',
    'agent',
    'medical officer',
    'speak to someone',
    'speak to a person',
    'talk to someone',
    'talk to a person',
    'customer care',
    'help me',
];
function isHumanAgentRequest(text) {
    return HUMAN_AGENT_KEYWORDS.some((keyword) => text.includes(keyword));
}
function getFallbackMenu() {
    return [
        '👋 Welcome to *Phadam Hospital*.',
        '',
        'How can we help you?',
        '',
        '• *Insurance* — accepted insurance providers',
        '• *Locations* — branches, contacts, and directions',
        '• *Services* — hospital services',
        '• *Departments* — department information',
        '• *Price* — procedure prices',
        '• *Doctor* — specialist clinics and availability guidance',
        '• Type *BOOK* — appointment booking instructions',
        '• Type *AGENT* — speak to a human agent',
    ].join('\n');
}
function getBookingHelpMessage() {
    return [
        '📅 *Book an Appointment*',
        '',
        'Reply using:',
        '*BOOK [Specialty] [YYYY-MM-DD]*',
        '',
        'Example:',
        '*BOOK General 2026-08-25*',
        '',
        'You can also request a human agent by typing *AGENT*.',
    ].join('\n');
}
function parseBookingRequest(originalText) {
    const parts = originalText.trim().split(/\s+/);
    /*
     * Expected format:
     * BOOK General 2026-08-25
     *
     * parts[0] = BOOK
     * parts[1] = General
     * parts[2] = 2026-08-25
     */
    const specialty = parts[1]?.trim() || 'General';
    const dateText = parts[2]?.trim();
    if (!dateText) {
        return null;
    }
    const appointmentDate = new Date(`${dateText}T09:00:00.000Z`);
    if (Number.isNaN(appointmentDate.getTime())) {
        return null;
    }
    return {
        specialty,
        dateText,
        appointmentDate,
    };
}
/**
 * Handles a single incoming WhatsApp text message.
 *
 * This function:
 * 1. Finds or creates the patient.
 * 2. Stores the patient's WhatsApp message.
 * 3. Keeps agent-active conversations out of the bot flow.
 * 4. Generates a knowledge-base, agent, booking, or menu reply.
 * 5. Sends the reply through Meta WhatsApp Cloud API.
 * 6. Stores the successful bot reply.
 */
async function processIncomingTextMessage(message) {
    const senderPhone = message.from?.trim();
    const incomingMessageId = message.id?.trim();
    const messageType = message.type;
    const userText = message.text?.body?.trim() || '';
    console.info('[WhatsApp incoming message]', {
        incomingMessageId,
        senderPhone,
        messageType,
        userText,
    });
    if (!senderPhone) {
        console.warn('[WhatsApp webhook] Ignoring message because sender phone is missing.');
        return;
    }
    if (messageType !== 'text') {
        console.info('[WhatsApp webhook] Ignoring non-text message.', {
            senderPhone,
            messageType,
        });
        return;
    }
    if (!userText) {
        console.info('[WhatsApp webhook] Ignoring empty text message.', {
            senderPhone,
            incomingMessageId,
        });
        return;
    }
    let patient = await prisma_1.prisma.patient.findUnique({
        where: {
            phoneNumber: senderPhone,
        },
    });
    if (!patient) {
        console.info('[WhatsApp webhook] Creating new patient record.', {
            senderPhone,
        });
        patient = await prisma_1.prisma.patient.create({
            data: {
                phoneNumber: senderPhone,
                chatStatus: 'BOT',
            },
        });
        console.info('[WhatsApp webhook] Patient created.', {
            patientId: patient.id,
            senderPhone,
        });
    }
    else {
        console.info('[WhatsApp webhook] Existing patient found.', {
            patientId: patient.id,
            senderPhone,
            chatStatus: patient.chatStatus,
            assignedTo: patient.assignedTo,
        });
    }
    /*
     * Store every valid incoming patient text.
     *
     * If your MessageLog Prisma model includes `whatsappMessageId`,
     * you may add the incoming Meta message ID:
     *
     * ...(incomingMessageId
     *   ? { whatsappMessageId: incomingMessageId }
     *   : {}),
     */
    await prisma_1.prisma.messageLog.create({
        data: {
            patientId: patient.id,
            sender: 'PATIENT',
            body: userText,
        },
    });
    console.info('[WhatsApp webhook] Patient message saved.', {
        patientId: patient.id,
        incomingMessageId,
    });
    /*
     * Do not let the bot respond while a staff member is actively
     * handling the patient's conversation.
     */
    if (patient.chatStatus === 'AGENT_ACTIVE') {
        console.info('[WhatsApp webhook] No bot reply: conversation is AGENT_ACTIVE.', {
            patientId: patient.id,
            assignedTo: patient.assignedTo,
        });
        return;
    }
    const normalizedText = userText.toLowerCase().trim();
    let replyText;
    /*
     * 1. Explicit agent escalation is checked first.
     * This prevents a phrase such as "I need a human agent" from being
     * handled as a generic hospital-information query.
     */
    if (isHumanAgentRequest(normalizedText)) {
        await prisma_1.prisma.patient.update({
            where: {
                id: patient.id,
            },
            data: {
                chatStatus: 'PENDING_AGENT',
            },
        });
        replyText = [
            '🔄 *Human Assistance Requested*',
            '',
            'You have been placed in the queue for an available medical officer or hospital agent.',
            'Please wait for a member of the Phadam Hospital team to respond.',
        ].join('\n');
        console.info('[WhatsApp webhook] Patient escalated to agent queue.', {
            patientId: patient.id,
            senderPhone,
        });
    }
    /*
     * 2. Booking help command.
     */
    else if (normalizedText === 'book') {
        replyText = getBookingHelpMessage();
    }
    /*
     * 3. Booking command.
     */
    else if (normalizedText.startsWith('book ')) {
        const booking = parseBookingRequest(userText);
        if (!booking) {
            replyText = [
                '❌ *Invalid booking format.*',
                '',
                'Please use:',
                '*BOOK [Specialty] [YYYY-MM-DD]*',
                '',
                'Example:',
                '*BOOK General 2026-08-25*',
            ].join('\n');
        }
        else {
            const appointment = await prisma_1.prisma.appointment.create({
                data: {
                    patientId: patient.id,
                    doctorName: 'On-Call Doctor',
                    specialty: booking.specialty,
                    slotTime: booking.appointmentDate,
                    status: 'CONFIRMED',
                },
            });
            replyText = [
                '✅ *Appointment Confirmed!*',
                '',
                `Specialty: ${booking.specialty}`,
                `Date: ${booking.dateText}`,
                `Reference: ${appointment.id}`,
                '',
                'Please contact the hospital branch for confirmation of the exact consultation time and doctor availability.',
            ].join('\n');
            console.info('[WhatsApp webhook] Appointment created.', {
                appointmentId: appointment.id,
                patientId: patient.id,
                specialty: booking.specialty,
                date: booking.dateText,
            });
        }
    }
    /*
     * 4. Phadam Hospital local knowledge base.
     */
    else {
        const knowledgeBaseReply = (0, hospitalData_1.searchKnowledgeBase)(userText);
        if (knowledgeBaseReply) {
            replyText = knowledgeBaseReply;
            console.info('[WhatsApp webhook] Knowledge-base answer found.', {
                patientId: patient.id,
                senderPhone,
            });
        }
        else {
            replyText = getFallbackMenu();
            console.info('[WhatsApp webhook] Sending fallback menu.', {
                patientId: patient.id,
                senderPhone,
            });
        }
    }
    console.info('[WhatsApp webhook] Sending bot reply.', {
        patientId: patient.id,
        senderPhone,
        replyLength: replyText.length,
    });
    /*
     * Updated service signature:
     *
     * sendWhatsAppMessage({
     *   recipientPhone: string,
     *   messageText: string,
     * })
     *
     * Returned result:
     *
     * {
     *   recipientPhone: string;
     *   messageId: string;
     *   whatsappId?: string;
     *   simulated: boolean;
     * }
     */
    const whatsappResult = await (0, whatsappService_1.sendWhatsAppMessage)({
        recipientPhone: senderPhone,
        messageText: replyText,
    });
    console.info('[WhatsApp webhook] Meta accepted bot reply.', {
        patientId: patient.id,
        senderPhone,
        outgoingMetaMessageId: whatsappResult.messageId,
        simulated: whatsappResult.simulated,
    });
    /*
     * Save the outgoing bot reply only after Meta has accepted it.
     *
     * If your Prisma MessageLog model has a `whatsappMessageId` field,
     * use the optional version below instead:
     *
     * data: {
     *   patientId: patient.id,
     *   sender: 'BOT',
     *   body: replyText,
     *   whatsappMessageId: whatsappResult.messageId,
     * }
     */
    await prisma_1.prisma.messageLog.create({
        data: {
            patientId: patient.id,
            sender: 'BOT',
            body: replyText,
        },
    });
    console.info('[WhatsApp webhook] Bot response saved.', {
        patientId: patient.id,
        outgoingMetaMessageId: whatsappResult.messageId,
    });
}
/**
 * POST /api/whatsapp/webhook
 *
 * Receives incoming WhatsApp Cloud API webhooks.
 *
 * Important:
 * - Meta sends both incoming messages and outbound-status updates here.
 * - Status updates are valid and should return HTTP 200.
 * - Meta can deliver multiple entries, changes, and messages in one webhook.
 */
async function handleWhatsAppWebhook(req, res) {
    console.info('========================================');
    console.info('[WhatsApp webhook] Request received');
    console.info('========================================');
    console.info('Method:', req.method);
    console.info('URL:', req.originalUrl);
    try {
        const body = req.body;
        if (body?.object !== 'whatsapp_business_account') {
            console.warn('[WhatsApp webhook] Invalid webhook object.', {
                receivedObject: body?.object,
            });
            return res.sendStatus(404);
        }
        const entries = body.entry ?? [];
        if (!entries.length) {
            console.info('[WhatsApp webhook] No entries found.');
            return res.sendStatus(200);
        }
        let incomingMessageCount = 0;
        let statusUpdateCount = 0;
        for (const entry of entries) {
            for (const change of entry.changes ?? []) {
                const value = change.value;
                if (!value) {
                    continue;
                }
                const statuses = value.statuses ?? [];
                for (const status of statuses) {
                    statusUpdateCount += 1;
                    console.info('[WhatsApp webhook] Message status update.', {
                        metaMessageId: status.id,
                        status: status.status,
                        recipientId: status.recipient_id,
                        timestamp: status.timestamp,
                        errors: status.errors,
                    });
                }
                const messages = value.messages ?? [];
                for (const message of messages) {
                    incomingMessageCount += 1;
                    await processIncomingTextMessage(message);
                }
            }
        }
        console.info('[WhatsApp webhook] Processing complete.', {
            incomingMessageCount,
            statusUpdateCount,
        });
        console.info('========================================');
        return res.sendStatus(200);
    }
    catch (error) {
        if (error instanceof whatsappService_1.WhatsAppApiError) {
            console.error('[WhatsApp webhook] Meta API error while replying.', {
                message: error.message,
                status: error.status,
                recipientPhone: error.recipientPhone,
                metaCode: error.metaCode,
                metaType: error.metaType,
                metaDetails: error.metaDetails,
                fbTraceId: error.fbTraceId,
            });
        }
        else {
            console.error('[WhatsApp webhook] Processing error.', error instanceof Error ? error.stack || error.message : error);
        }
        console.error('========================================');
        return res.sendStatus(500);
    }
}
