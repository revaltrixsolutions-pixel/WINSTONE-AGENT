import { Router } from 'express';

import {
  createAccount,
  getCurrentUser,
  listUsers,
  login,
  updateAccountStatus,
  deleteAccount,
} from '../controllers/authController';
import { requireAuth, requireSuperAdmin } from '../lib/auth';

const router = Router();

router.post('/login', login);
router.get('/me', requireAuth, getCurrentUser);
router.get('/users', requireAuth, listUsers);
router.post('/users', requireAuth, requireSuperAdmin, createAccount);
router.patch('/users/:userId/status', requireAuth, requireSuperAdmin, updateAccountStatus);
router.delete('/users/:userId', requireAuth, requireSuperAdmin, deleteAccount);

export default router;