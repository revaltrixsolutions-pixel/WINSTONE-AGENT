import type { Appointment } from '../generated/prisma/client';
import { sendWhatsAppMessage, type SentWhatsAppMessage } from './whatsappService';

const HOSPITAL_WHATSAPP_NUMBER = '254708130100';
const DEFAULT_APPOINTMENT_TEMPLATE = 'appointment_notification';
const DEFAULT_TEMPLATE_LANGUAGE = 'en';

/**
 * Sends appointment details using an approved WhatsApp template with one
 * body variable. The template name and language can be configured via env.
 */
type AppointmentNotificationDetails = Pick<
  Appointment,
  'id' | 'doctorName' | 'specialty' | 'slotTime' | 'status' | 'consultationFee'
> & {
  patient?: {
    fullName?: string | null;
    phoneNumber?: string;
  } | null;
  patientName?: string | null;
  patientPhone?: string;
};

export function sendAppointmentNotification(
  appointment: AppointmentNotificationDetails,
): Promise<SentWhatsAppMessage> {
  const appointmentDate = new Intl.DateTimeFormat('en-KE', {
    timeZone: 'Africa/Nairobi',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(appointment.slotTime);
  const details = [
    `Reference: ${appointment.id}`,
    `Patient: ${appointment.patient?.fullName || appointment.patientName || 'Not provided'}`,
    `Patient phone: ${appointment.patient?.phoneNumber || appointment.patientPhone || 'Not provided'}`,
    `Service: ${appointment.specialty}`,
    `Doctor: ${appointment.doctorName}`,
    `Date and time: ${appointmentDate}`,
    `Listed fee: ${appointment.consultationFee}`,
    `Status: ${appointment.status}`,
  ].join('\n');

  return sendWhatsAppMessage({
    recipientPhone: HOSPITAL_WHATSAPP_NUMBER,
    template: {
      name: process.env.WHATSAPP_APPOINTMENT_TEMPLATE?.trim() || DEFAULT_APPOINTMENT_TEMPLATE,
      languageCode: process.env.WHATSAPP_APPOINTMENT_TEMPLATE_LANGUAGE?.trim() || DEFAULT_TEMPLATE_LANGUAGE,
      bodyParameters: [details],
    },
  });
}
