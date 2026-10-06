import React, { useEffect, useMemo, useState } from 'react';
import type { AdminReminder, Appointment } from '../services/api';
import { getAppointmentWhatsAppLink } from '../services/appointmentWhatsApp';
import {
  createAppointmentFollowUp,
  createPatientWithAppointment,
  fetchHospitalPhoneNumber,
  saveHospitalPhoneNumber,
  sendAppointmentFollowUp,
} from '../services/api';

type AdminAppointmentsPageProps = {
  appointments: Appointment[];
  reminders: AdminReminder[];
  onChanged: () => Promise<void>;
  isSuperAdmin: boolean;
};

const services = [
  'General Consultation',
  'Doctors consultation',
  'Antenatal clinic',
  'Postnatal clinic',
  'Maternity services',
  'Well-baby clinic',
  'Pediatric outpatient clinic',
  'Immunization',
  'Family planning',
  'Pharmacy',
  'Laboratory',
  'Radiology, including X-ray and ultrasound',
  'Inpatient services',
  'Endoscopy',
  'Colonoscopy',
  'High Dependency Unit',
  'Intensive Care Unit',
  'Newborn Unit',
  'Theatre services for minor and major surgeries',
  'Ambulance services',
  'Emergency services',
  'Dermatology clinic',
  'Orthopedic clinic',
  'Ear, Nose and Throat clinic',
  'Maternity',
  'Pediatrics',
  'Dental',
  'Physiotherapy',
  'Obstetrics and Gynecology',
  'Optical clinic',
  'Psychology and counselling',
  'Nutrition clinic',
  'Surgical outpatient clinic',
  'Gynecology clinic',
  'Urology clinic',
];

const formatNairobiDateTime = (value: string) => new Intl.DateTimeFormat('en-KE', {
  timeZone: 'Africa/Nairobi',
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

export const AdminAppointmentsPage: React.FC<AdminAppointmentsPageProps> = ({
  appointments,
  reminders,
  onChanged,
  isSuperAdmin,
}) => {
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [followUpNote, setFollowUpNote] = useState('');
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [hospitalPhoneNumber, setHospitalPhoneNumber] = useState('');
  const [hospitalPhoneInput, setHospitalPhoneInput] = useState('');
  const [hospitalPhoneBusy, setHospitalPhoneBusy] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    phoneNumber: '',
    specialty: services[0],
    doctorName: '',
    slotTime: '',
  });

  const orderedAppointments = useMemo(() => (
    [...appointments].sort((a, b) => new Date(a.slotTime).getTime() - new Date(b.slotTime).getTime())
  ), [appointments]);

  useEffect(() => {
    void (async () => {
      try {
        const value = await fetchHospitalPhoneNumber();
        setHospitalPhoneNumber(value);
        setHospitalPhoneInput(value);
      } catch {
        setHospitalPhoneNumber('');
        setHospitalPhoneInput('');
      }
    })();
  }, []);

  const submitHospitalPhone = async () => {
    if (!hospitalPhoneInput.trim()) {
      setMessage('Hospital phone number is required.');
      return;
    }

    setHospitalPhoneBusy(true);
    setMessage(null);

    try {
      const response = await saveHospitalPhoneNumber(hospitalPhoneInput.trim());
      if (!response.success) throw new Error(response.error || 'Unable to save hospital phone number.');
      setHospitalPhoneNumber(response.hospitalPhoneNumber || hospitalPhoneInput.trim());
      setHospitalPhoneInput(response.hospitalPhoneNumber || hospitalPhoneInput.trim());
      setMessage('Hospital phone number saved successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save hospital phone number.');
    } finally {
      setHospitalPhoneBusy(false);
    }
  };

  const canSendFollowUp = (appointment: Appointment) => {
    const hoursUntilVisit = (new Date(appointment.slotTime).getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntilVisit <= 3 && hoursUntilVisit >= -1;
  };

  const makeCall = (appointment: Appointment) => {
    const patientPhone = appointment.patientPhone || '';
    const cleanHospitalPhone = hospitalPhoneNumber.replace(/\D/g, '');

    if (!cleanHospitalPhone) {
      setMessage('Please set the hospital phone number first in Super Admin settings.');
      return;
    }

    const telLink = `tel:${cleanHospitalPhone}`;
    window.location.href = telLink;

    if (patientPhone) {
      setMessage(`Calling hospital line ${cleanHospitalPhone}. The patient phone is ${patientPhone}.`);
    }
  };

  const submitPatient = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormBusy(true);
    setMessage(null);

    try {
      const response = await createPatientWithAppointment({
        ...form,
        slotTime: new Date(form.slotTime).toISOString(),
      });
      if (!response.success) throw new Error(response.error || 'Unable to add patient.');
      setForm({ fullName: '', phoneNumber: '', specialty: services[0], doctorName: '', slotTime: '' });
      if (response.notification?.sent) {
        setMessage('Patient and appointment added. Appointment details were sent to the hospital WhatsApp.');
      } else if (response.notification?.simulated) {
        setMessage('Patient and appointment added. WhatsApp is in simulation mode, so the appointment details were not actually sent.');
      } else if (response.notification?.error) {
        setMessage(`Patient and appointment added, but the WhatsApp notification failed: ${response.notification.error}`);
      } else {
        setMessage('Patient and appointment added. The reminder queue is active.');
      }
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to add patient.');
    } finally {
      setFormBusy(false);
    }
  };

  const submitFollowUp = async (appointmentId: string, mode: 'save' | 'send') => {
    if (!followUpNote.trim()) return;
    setFollowUpBusy(true);
    setMessage(null);

    try {
      const response = mode === 'send'
        ? await sendAppointmentFollowUp(appointmentId, followUpNote.trim())
        : await createAppointmentFollowUp(appointmentId, followUpNote.trim());

      if (!response.success) throw new Error(response.error || 'Unable to save follow-up.');
      setFollowUpNote('');
      setSelectedAppointmentId(null);
      setMessage(mode === 'send' ? 'Follow-up sent immediately to the patient.' : 'Follow-up saved for the whole admin team.');
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save follow-up.');
    } finally {
      setFollowUpBusy(false);
    }
  };

  const importCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setFormBusy(true);
    setMessage(null);
    try {
      const rows = (await file.text())
        .split(/\r?\n/)
        .map((line) => line.split(',').map((value) => value.trim().replace(/^"|"$/g, '')))
        .filter((row) => row.length >= 4 && row[0] && row[1] && row[2] && row[3]);
      const dataRows = rows[0]?.[0].toLowerCase().includes('name') ? rows.slice(1) : rows;
      let imported = 0;

      for (const [fullName, phoneNumber, specialty, date, time = '09:00'] of dataRows) {
        const parsedSlot = new Date(`${date}T${time}`);
        if (Number.isNaN(parsedSlot.getTime())) continue;
        const response = await createPatientWithAppointment({
          fullName,
          phoneNumber,
          specialty,
          slotTime: parsedSlot.toISOString(),
        });
        if (response.success) imported += 1;
      }

      setMessage(`${imported} patient${imported === 1 ? '' : 's'} imported with appointments.`);
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to import CSV.');
    } finally {
      setFormBusy(false);
    }
  };

  return (
    <section className="min-h-0 flex-1 overflow-y-auto p-4 pb-28 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-800 p-6 text-white shadow-2xl md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Admin operations</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">Follow-ups and new bookings</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
            Add walk-in patients, record follow-up actions, and keep every admin looking at the same appointment record.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-cyan-100">
            <span className="rounded-full bg-white/10 px-3 py-2">Patient reminders: 12h, 6h, 1h</span>
            <span className="rounded-full bg-white/10 px-3 py-2">Admin queue: 20m before visit</span>
          </div>
        </header>

        {message && <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-900">{message}</div>}

        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          {isSuperAdmin && <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-xl font-black text-slate-900">Hospital calling line</h3>
            <p className="mt-1 text-sm text-slate-500">Set the hospital number used for outbound calls from the admin dashboard.</p>
            <div className="mt-5 space-y-4">
              <input value={hospitalPhoneInput} onChange={(e) => setHospitalPhoneInput(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500" placeholder="e.g. +254 712 345 678" />
              <button type="button" disabled={hospitalPhoneBusy} onClick={() => void submitHospitalPhone()} className="w-full rounded-2xl bg-violet-700 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-800 disabled:opacity-50">{hospitalPhoneBusy ? 'Saving...' : 'Save hospital phone number'}</button>
              {hospitalPhoneNumber && <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">Current hospital line: {hospitalPhoneNumber}</div>}
            </div>
          </div>}

          <form onSubmit={submitPatient} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-xl font-black text-slate-900">Add patient with appointment</h3>
            <p className="mt-1 text-sm text-slate-500">The patient is upserted by phone number and the appointment is stored immediately.</p>
            <div className="mt-5 space-y-4">
              <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500" placeholder="Patient full name" />
              <input required value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500" placeholder="International phone, e.g. 254712345678" />
              <select value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500">
                {services.map((service) => <option key={service}>{service}</option>)}
              </select>
              <input value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500" placeholder="Doctor (optional)" />
              <label className="block text-sm font-bold text-slate-700">Appointment date and time<input required type="datetime-local" value={form.slotTime} onChange={(e) => setForm({ ...form, slotTime: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500" /></label>
              <button disabled={formBusy} className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-cyan-800 disabled:opacity-50">{formBusy ? 'Saving...' : 'Save patient and appointment'}</button>
              <label className="block rounded-2xl border border-dashed border-cyan-300 bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-900">Import CSV<input disabled={formBusy} type="file" accept=".csv,text/csv" onChange={(event) => void importCsv(event)} className="mt-2 block w-full text-xs font-normal text-slate-600" /><span className="mt-2 block text-xs font-normal text-cyan-800">Columns: name, phone, service, date, time. Include a header row or omit it.</span></label>
            </div>
          </form>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-end justify-between gap-3">
              <div><h3 className="text-xl font-black text-slate-900">Confirmed appointments</h3><p className="mt-1 text-sm text-slate-500">Follow-up notes are visible to every authenticated admin.</p></div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">{orderedAppointments.length} records</span>
            </div>
            <div className="mt-5 space-y-3">
              {orderedAppointments.length === 0 && <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">No appointments yet.</p>}
              {orderedAppointments.map((appointment) => {
                const isSelected = selectedAppointmentId === appointment.id;
                return <article key={appointment.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-black text-slate-900">{appointment.patientName || 'Patient'} <span className="font-normal text-slate-500">· {appointment.patientPhone || 'No phone'}</span></p><p className="mt-1 text-sm font-bold text-cyan-800">{appointment.specialty}</p><p className="text-xs text-slate-500">{formatNairobiDateTime(appointment.slotTime)} · {appointment.status}</p></div>
                    <div className="flex flex-wrap gap-2">
                      <a href={getAppointmentWhatsAppLink(appointment)} target="_blank" rel="noreferrer" className="rounded-xl bg-green-600 px-3 py-2 text-xs font-black text-white hover:bg-green-700">WhatsApp</a>
                      <button type="button" onClick={() => makeCall(appointment)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700">Call</button>
                      <button type="button" onClick={() => setSelectedAppointmentId(isSelected ? null : appointment.id)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">{isSelected ? 'Close' : 'Add follow-up'}</button>
                    </div>
                  </div>
                  {(appointment.followUps || []).map((followUp) => <div key={followUp.id} className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><p className="font-bold text-slate-700">{followUp.authorName} · {formatNairobiDateTime(followUp.createdAt)}</p><p className="mt-1 text-slate-600">{followUp.note}</p></div>)}
                  {isSelected && <div className="mt-4 space-y-2"><div className="flex gap-2"><input value={followUpNote} onChange={(e) => setFollowUpNote(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-cyan-500" placeholder="What did you follow up on?" /></div><div className="flex gap-2"><button type="button" disabled={followUpBusy || !followUpNote.trim()} onClick={() => void submitFollowUp(appointment.id, 'save')} className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Save note</button>{canSendFollowUp(appointment) ? <button type="button" disabled={followUpBusy || !followUpNote.trim()} onClick={() => void submitFollowUp(appointment.id, 'send')} className="rounded-xl bg-cyan-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Send text now</button> : <span className="rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-bold text-slate-500">Text sends only within 3 hrs</span>}</div></div>}
                </article>;
              })}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-xl">
          <div className="flex items-end justify-between gap-3">
            <div><h3 className="text-xl font-black text-amber-950">Admin reminder queue</h3><p className="mt-1 text-sm text-amber-800">The 20-minute booking reminders delivered to this shared workspace.</p></div>
            <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-900">{reminders.length} alerts</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {reminders.slice(0, 6).map((reminder) => <div key={reminder.id} className="rounded-2xl border border-amber-200 bg-white p-4"><p className="font-black text-slate-900">{reminder.appointment.patient?.fullName || reminder.appointment.patientName || 'Patient'} · {reminder.appointment.specialty}</p><p className="mt-1 text-xs text-slate-600">Reference: {reminder.appointment.id.slice(0, 8)}</p><p className="mt-1 text-xs text-slate-600">Appointment: {formatNairobiDateTime(reminder.appointment.slotTime)}</p><p className="mt-1 text-xs text-slate-600">Scheduled: {formatNairobiDateTime(reminder.appointment.createdAt || reminder.appointment.slotTime)}</p><p className="mt-1 text-xs font-bold text-amber-800">Sent: {formatNairobiDateTime(reminder.sentAt)}</p></div>)}
            {reminders.length === 0 && <p className="text-sm text-amber-900">No admin reminders have been queued yet.</p>}
          </div>
        </div>
      </div>
    </section>
  );
};
