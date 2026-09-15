"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAppointments = getAppointments;
exports.getPatients = getPatients;
exports.updateAppointmentStatus = updateAppointmentStatus;
const prisma_1 = require("../lib/prisma");
const whatsappService_1 = require("../services/whatsappService");
async function getAppointments(_req, res) {
    const appointments = await prisma_1.prisma.appointment.findMany({
        include: {
            patient: {
                select: { id: true, fullName: true, phoneNumber: true },
            },
        },
        orderBy: { slotTime: 'asc' },
    });
    return res.status(200).json({
        success: true,
        appointments: appointments.map((appointment) => ({
            ...appointment,
            patientId: appointment.patientId,
            patientName: appointment.patient.fullName,
            patientPhone: appointment.patient.phoneNumber,
        })),
    });
}
async function getPatients(_req, res) {
    const patients = await prisma_1.prisma.patient.findMany({
        include: {
            _count: { select: { messages: true, appointments: true } },
            messages: { orderBy: { timestamp: 'desc' }, take: 1 },
            appointments: { orderBy: { slotTime: 'asc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({
        success: true,
        patients: patients.map((patient) => ({
            id: patient.id,
            fullName: patient.fullName,
            phoneNumber: patient.phoneNumber,
            chatStatus: patient.chatStatus,
            assignedTo: patient.assignedTo,
            createdAt: patient.createdAt,
            messageCount: patient._count.messages,
            appointmentCount: patient._count.appointments,
            lastMessage: patient.messages[0] || null,
            nextAppointment: patient.appointments[0] || null,
        })),
    });
}
async function updateAppointmentStatus(req, res) {
    const appointmentId = req.params.appointmentId?.trim();
    const status = typeof req.body?.status === 'string' ? req.body.status.trim().toUpperCase() : '';
    const allowedStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'RESCHEDULED'];
    if (!appointmentId || !allowedStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Valid appointmentId and status are required.' });
    }
    const appointment = await prisma_1.prisma.appointment.update({
        where: { id: appointmentId },
        data: { status },
        include: { patient: true },
    });
    if (status === 'CONFIRMED' && appointment.patient.phoneNumber) {
        const confirmation = [
            '🏥 *Phadam Hospital Appointment Confirmed*',
            '',
            `Service: ${appointment.specialty}`,
            `Date: ${appointment.slotTime.toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi', dateStyle: 'full' })}`,
            `Time: ${appointment.slotTime.toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi', timeStyle: 'short' })}`,
            `Consultation fee: ${appointment.consultationFee}`,
            `Reference: ${appointment.id.slice(0, 8)}`,
            '',
            'Reply here if you need help or need to reschedule.',
        ].join('\n');
        await (0, whatsappService_1.sendWhatsAppMessage)({
            recipientPhone: appointment.patient.phoneNumber,
            messageText: confirmation,
        });
    }
    return res.status(200).json({ success: true, appointment });
}
