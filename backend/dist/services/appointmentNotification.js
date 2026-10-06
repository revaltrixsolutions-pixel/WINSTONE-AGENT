"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAppointmentNotification = sendAppointmentNotification;
const whatsappService_1 = require("./whatsappService");
const HOSPITAL_WHATSAPP_NUMBER = '254708130100';
const DEFAULT_APPOINTMENT_TEMPLATE = 'appointment_notification';
const DEFAULT_TEMPLATE_LANGUAGE = 'en';
function sendAppointmentNotification(appointment) {
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
    return (0, whatsappService_1.sendWhatsAppMessage)({
        recipientPhone: HOSPITAL_WHATSAPP_NUMBER,
        template: {
            name: process.env.WHATSAPP_APPOINTMENT_TEMPLATE?.trim() || DEFAULT_APPOINTMENT_TEMPLATE,
            languageCode: process.env.WHATSAPP_APPOINTMENT_TEMPLATE_LANGUAGE?.trim() || DEFAULT_TEMPLATE_LANGUAGE,
            bodyParameters: [details],
        },
    });
}
