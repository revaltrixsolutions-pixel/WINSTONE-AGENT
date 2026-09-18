import { Router } from 'express';
import { requireAuth } from '../lib/auth';
import {
	createAppointmentFollowUp,
	createPatientWithAppointment,
	getAppointmentReminders,
	getAppointments,
	getPatients,
	updateAppointmentStatus,
} from '../controllers/dashboardController';

const router = Router();
router.use(requireAuth);
router.get('/appointments', getAppointments);
router.patch('/appointments/:appointmentId/status', updateAppointmentStatus);
router.post('/appointments/:appointmentId/follow-ups', createAppointmentFollowUp);
router.post('/patients-with-appointment', createPatientWithAppointment);
router.get('/reminders', getAppointmentReminders);
router.get('/patients', getPatients);

export default router;