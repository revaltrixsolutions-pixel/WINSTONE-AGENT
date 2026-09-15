"use strict";
// src/controllers/agentController.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgentChats = getAgentChats;
exports.assignChat = assignChat;
exports.sendAgentReply = sendAgentReply;
const prisma_1 = require("../lib/prisma");
const whatsappService_1 = require("../services/whatsappService");
/**
 * GET /api/agent/chats
 * Get all chats waiting for a human agent or currently assigned to one.
 */
async function getAgentChats(_req, res) {
    try {
        const chats = await prisma_1.prisma.patient.findMany({
            where: {
                chatStatus: {
                    in: ['PENDING_AGENT', 'AGENT_ACTIVE'],
                },
            },
            include: {
                messages: {
                    orderBy: {
                        timestamp: 'asc',
                    },
                },
            },
            orderBy: {
                id: 'desc',
            },
        });
        return res.status(200).json({
            success: true,
            chats,
        });
    }
    catch (error) {
        console.error('[getAgentChats Error]', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error while fetching agent chats.',
        });
    }
}
/**
 * POST /api/agent/assign
 * Assigns a patient conversation to a staff member or doctor.
 */
async function assignChat(req, res) {
    try {
        const { patientId, agentName } = req.body;
        const trimmedPatientId = patientId?.trim();
        const trimmedAgentName = agentName?.trim();
        if (!trimmedPatientId || !trimmedAgentName) {
            return res.status(400).json({
                success: false,
                error: 'patientId and agentName are required.',
            });
        }
        const patient = await prisma_1.prisma.patient.findUnique({
            where: {
                id: trimmedPatientId,
            },
            select: {
                id: true,
            },
        });
        if (!patient) {
            return res.status(404).json({
                success: false,
                error: 'Patient not found.',
            });
        }
        const staffUser = await prisma_1.prisma.user.findFirst({
            where: {
                name: trimmedAgentName,
                isActive: true,
                role: { in: ['STAFF', 'ADMIN', 'SUPER_ADMIN'] },
            },
            select: { id: true, name: true },
        });
        if (!staffUser) {
            return res.status(400).json({
                success: false,
                error: 'That staff member is not active or does not exist.',
            });
        }
        const updatedPatient = await prisma_1.prisma.patient.update({
            where: {
                id: trimmedPatientId,
            },
            data: {
                chatStatus: 'AGENT_ACTIVE',
                assignedTo: staffUser.name,
            },
        });
        console.info('[Agent Chat Assigned]', {
            patientId: updatedPatient.id,
            agentName: staffUser.name,
        });
        return res.status(200).json({
            success: true,
            message: `Chat assigned to ${trimmedAgentName}.`,
            patient: updatedPatient,
        });
    }
    catch (error) {
        console.error('[assignChat Error]', error instanceof Error ? error.message : error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error while assigning chat.',
        });
    }
}
/**
 * POST /api/agent/reply
 *
 * Sends a human agent's WhatsApp response to the patient and saves
 * the sent message in the MessageLog table.
 */
async function sendAgentReply(req, res) {
    try {
        const { patientId, messageText, agentName } = req.body;
        const trimmedPatientId = patientId?.trim();
        const trimmedMessage = messageText?.trim();
        const trimmedAgentName = agentName?.trim() || 'Doctor';
        if (!trimmedPatientId || !trimmedMessage) {
            return res.status(400).json({
                success: false,
                error: 'patientId and messageText are required.',
            });
        }
        const patient = await prisma_1.prisma.patient.findUnique({
            where: {
                id: trimmedPatientId,
            },
            select: {
                id: true,
                phoneNumber: true,
                assignedTo: true,
            },
        });
        if (!patient) {
            return res.status(404).json({
                success: false,
                error: 'Patient not found.',
            });
        }
        if (!patient.phoneNumber?.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Patient does not have a registered phone number.',
            });
        }
        const whatsappText = `*[${trimmedAgentName}]:* ${trimmedMessage}`;
        /*
         * Uses the current WhatsApp service signature.
         */
        const whatsappResult = await (0, whatsappService_1.sendWhatsAppMessage)({
            recipientPhone: patient.phoneNumber,
            messageText: whatsappText,
        });
        /*
         * This is the message ID returned by Meta WhatsApp Cloud API.
         *
         * It is intentionally NOT inserted into messageLog because your
         * current Prisma MessageLog model has no whatsappMessageId field.
         */
        const metaMessageId = whatsappResult.messageId;
        const [newMessage, updatedPatient] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.messageLog.create({
                data: {
                    patientId: patient.id,
                    sender: 'AGENT',
                    body: `[${trimmedAgentName}]: ${trimmedMessage}`,
                },
            }),
            prisma_1.prisma.patient.update({
                where: {
                    id: patient.id,
                },
                data: {
                    chatStatus: 'AGENT_ACTIVE',
                    assignedTo: patient.assignedTo || trimmedAgentName,
                },
            }),
        ]);
        console.info('[Agent WhatsApp Reply Sent]', {
            patientId: patient.id,
            recipientPhone: patient.phoneNumber,
            agentName: trimmedAgentName,
            metaMessageId,
            simulated: whatsappResult.simulated,
        });
        return res.status(200).json({
            success: true,
            simulated: whatsappResult.simulated,
            metaMessageId,
            message: newMessage,
            patient: updatedPatient,
        });
    }
    catch (error) {
        if (error instanceof whatsappService_1.WhatsAppApiError) {
            console.error('[sendAgentReply WhatsApp API Error]', {
                message: error.message,
                status: error.status,
                recipientPhone: error.recipientPhone,
                metaCode: error.metaCode,
                metaType: error.metaType,
                metaDetails: error.metaDetails,
                fbTraceId: error.fbTraceId,
            });
            return res.status(502).json({
                success: false,
                error: 'WhatsApp could not accept the message.',
                details: error.message,
                metaCode: error.metaCode ?? null,
                metaDetails: error.metaDetails ?? null,
            });
        }
        console.error('[sendAgentReply Error]', error instanceof Error ? error.message : error);
        return res.status(500).json({
            success: false,
            error: 'Failed to send WhatsApp message.',
            details: error instanceof Error
                ? error.message
                : 'Unknown internal error.',
        });
    }
}
