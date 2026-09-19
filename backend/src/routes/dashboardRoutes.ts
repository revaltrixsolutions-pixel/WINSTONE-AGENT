import { Router } from 'express';
import { requireAuth } from '../lib/auth';
import {
	createAppointmentFollowUp,
	createPatientWithAppointment,
	getAppointmentReminders,
	getAppointments,
	getHospitalPhoneSetting,
	getPatients,
	setHospitalPhoneSetting,
	updateAppointmentStatus,
	triggerAppointmentFollowUp,
} from '../controllers/dashboardController';

const router = Router();
router.use(requireAuth);
router.get('/appointments', getAppointments);
router.patch('/appointments/:appointmentId/status', updateAppointmentStatus);
router.post('/appointments/:appointmentId/follow-ups', createAppointmentFollowUp);
router.post('/appointments/:appointmentId/follow-ups/send', triggerAppointmentFollowUp);
router.post('/patients-with-appointment', createPatientWithAppointment);
router.get('/reminders', getAppointmentReminders);
router.get('/patients', getPatients);
router.get('/hospital-phone', getHospitalPhoneSetting);
router.post('/hospital-phone', setHospitalPhoneSetting);

export default router;