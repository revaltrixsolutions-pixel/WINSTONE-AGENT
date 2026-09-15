import { Router } from 'express';
import { getAgentChats, assignChat, sendAgentReply } from '../controllers/agentController';
import { requireAuth } from '../lib/auth';

const router = Router();

router.use(requireAuth);

router.get('/chats', getAgentChats);
router.post('/assign', assignChat);
router.post('/reply', sendAgentReply);

export default router;