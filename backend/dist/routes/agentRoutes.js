"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const agentController_1 = require("../controllers/agentController");
const router = (0, express_1.Router)();
router.get('/chats', agentController_1.getAgentChats);
router.post('/assign', agentController_1.assignChat);
router.post('/reply', agentController_1.sendAgentReply);
exports.default = router;
