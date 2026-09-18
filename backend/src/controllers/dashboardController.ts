import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { sendWhatsAppMessage } from '../services/whatsappService';

function parseSlotTime(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function cleanPhone(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

export async function getAppointments(_req: Request, res: Response): Promise<Response> {
  const appointments = await prisma.appointment.findMany({
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

export async function getPatients(_req: Request, res: Response): Promise<Response> {
  const patients = await prisma.patient.findMany({
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

export async function updateAppointmentStatus(req: Request, res: Response): Promise<Response> {
  const appointmentId = req.params.appointmentId?.trim();
  const status = typeof req.body?.status === 'string' ? req.body.status.trim().toUpperCase() : '';
  const allowedStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'RESCHEDULED'];

  if (!appointmentId || !allowedStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Valid appointmentId and status are required.' });
  }

  const appointment = await prisma.appointment.update({
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

    await sendWhatsAppMessage({
      recipientPhone: appointment.patient.phoneNumber,
      messageText: confirmation,
    });
  }

  return res.status(200).json({ success: true, appointment });
}

export async function createPatientWithAppointment(req: Request, res: Response): Promise<Response> {
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

  const patient = await prisma.patient.upsert({
    where: { phoneNumber },
    update: { fullName },
    create: { phoneNumber, fullName, chatStatus: 'BOT' },
  });

  const appointment = await prisma.appointment.create({
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

export async function createAppointmentFollowUp(req: Request, res: Response): Promise<Response> {
  const appointmentId = req.params.appointmentId?.trim();
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

  if (!appointmentId || !note) {
    return res.status(400).json({ success: false, error: 'Appointment and follow-up note are required.' });
  }

  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment) {
    return res.status(404).json({ success: false, error: 'Appointment not found.' });
  }

  const followUp = await prisma.appointmentFollowUp.create({
    data: {
      appointmentId,
      authorId: req.user?.id || 'system',
      authorName: req.user?.name || 'Hospital staff',
      note,
    },
  });

  return res.status(201).json({ success: true, followUp });
}

export async function getAppointmentReminders(_req: Request, res: Response): Promise<Response> {
  const reminders = await prisma.reminderDelivery.findMany({
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