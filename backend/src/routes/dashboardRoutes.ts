import { Router } from 'express';
import { requireAuth } from '../lib/auth';
import { getAppointments, getPatients, updateAppointmentStatus } from '../controllers/dashboardController';

const router = Router();
router.use(requireAuth);
router.get('/appointments', getAppointments);
router.patch('/appointments/:appointmentId/status', updateAppointmentStatus);
router.get('/patients', getPatients);

export default router;