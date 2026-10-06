type AppointmentWhatsAppDetails = {
  id: string;
  patientName?: string | null;
  patientPhone?: string;
  specialty?: string;
  doctorName?: string;
  slotTime: string;
  status: string;
};

const HOSPITAL_WHATSAPP_NUMBER = '254708130100';

export function getAppointmentWhatsAppLink(appointment: AppointmentWhatsAppDetails): string {
  const appointmentDate = new Date(appointment.slotTime);
  const formattedDate = Number.isNaN(appointmentDate.getTime())
    ? appointment.slotTime
    : new Intl.DateTimeFormat('en-KE', {
        timeZone: 'Africa/Nairobi',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(appointmentDate);
  const message = [
    'Hello, I would like to enquire about this appointment:',
    `Patient: ${appointment.patientName || 'Not provided'}`,
    `Patient phone: ${appointment.patientPhone || 'Not provided'}`,
    `Service: ${appointment.specialty || 'Not specified'}`,
    `Doctor: ${appointment.doctorName || 'Not assigned'}`,
    `Date and time: ${formattedDate}`,
    `Status: ${appointment.status || 'Unknown'}`,
    `Reference: ${appointment.id}`,
  ].join('\n');

  return `https://wa.me/${HOSPITAL_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
