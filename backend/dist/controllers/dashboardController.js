"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAppointments = getAppointments;
exports.getPatients = getPatients;
exports.updateAppointmentStatus = updateAppointmentStatus;
exports.createPatientWithAppointment = createPatientWithAppointment;
exports.createAppointmentFollowUp = createAppointmentFollowUp;
exports.getAppointmentReminders = getAppointmentReminders;
const prisma_1 = require("../lib/prisma");
const whatsappService_1 = require("../services/whatsappService");
function parseSlotTime(value) {
    if (typeof value !== 'string' || !value.trim())
        return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function cleanPhone(value) {
    return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}
async function getAppointments(_req, res) {
    const appointments = await prisma_1.prisma.appointment.findMany({
        include: {
            patient: {
                select: { id: true, fullName: true, phoneNumber: true },
            },
            followUps: { orderBy: { createdAt: 'desc' } },
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
async function createPatientWithAppointment(req, res) {
    const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
    const phoneNumber = cleanPhone(req.body?.phoneNumber);
    const specialty = typeof req.body?.specialty === 'string' ? req.body.specialty.trim() : '';
    const doctorName = typeof req.body?.doctorName === 'string' && req.body.doctorName.trim()
        ? req.body.doctorName.trim()
        : 'To be assigned';
    const slotTime = parseSlotTime(req.body?.slotTime);
    if (!fullName || phoneNumber.length < 7 || !specialty || !slotTime) {
        return res.status(400).json({
            success: false,
            error: 'Full name, valid international phone number, service, and appointment date/time are required.',
        });
    }
    const patient = await prisma_1.prisma.patient.upsert({
        where: { phoneNumber },
        update: { fullName },
        create: { phoneNumber, fullName, chatStatus: 'BOT' },
    });
    const appointment = await prisma_1.prisma.appointment.create({
        data: {
            patientId: patient.id,
            doctorName,
            specialty,
            servicePrice: typeof req.body?.servicePrice === 'string' ? req.body.servicePrice : 'KSh 0',
            consultationFee: typeof req.body?.consultationFee === 'string' ? req.body.consultationFee : 'KSh 1,000',
            slotTime,
            status: 'CONFIRMED',
        },
        include: { patient: true },
    });
    return res.status(201).json({ success: true, patient, appointment });
}
async function createAppointmentFollowUp(req, res) {
    const appointmentId = req.params.appointmentId?.trim();
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (!appointmentId || !note) {
        return res.status(400).json({ success: false, error: 'Appointment and follow-up note are required.' });
    }
    const appointment = await prisma_1.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment) {
        return res.status(404).json({ success: false, error: 'Appointment not found.' });
    }
    const followUp = await prisma_1.prisma.appointmentFollowUp.create({
        data: {
            appointmentId,
            authorId: req.user?.id || 'system',
            authorName: req.user?.name || 'Hospital staff',
            note,
        },
    });
    return res.status(201).json({ success: true, followUp });
}
async function getAppointmentReminders(_req, res) {
    const reminders = await prisma_1.prisma.reminderDelivery.findMany({
        where: { recipientType: 'ADMIN' },
        include: {
            appointment: {
                include: { patient: { select: { fullName: true, phoneNumber: true } } },
            },
        },
        orderBy: { sentAt: 'desc' },
        take: 50,
    });
    return res.status(200).json({ success: true, reminders });
}
