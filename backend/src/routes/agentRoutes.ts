import { Router } from 'express';
import { getAgentChats, assignChat, sendAgentReply } from '../controllers/agentController';

const router = Router();

router.get('/chats', getAgentChats);
router.post('/assign', assignChat);
router.post('/reply', sendAgentReply);

export default router;