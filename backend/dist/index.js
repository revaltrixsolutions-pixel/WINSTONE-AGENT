"use strict";
// src/index.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const node_cron_1 = __importDefault(require("node-cron"));
const webhookRoutes_1 = __importDefault(require("./routes/webhookRoutes"));
const publicApiRoutes_1 = __importDefault(require("./routes/publicApiRoutes"));
const agentRoutes_1 = __importDefault(require("./routes/agentRoutes"));
const prisma_1 = require("./lib/prisma");
const whatsappService_1 = require("./services/whatsappService");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT || 5000);
const APP_NAME = 'Phadam Medical Automation Engine';
const CRON_TIMEZONE = 'Africa/Nairobi';
if (Number.isNaN(PORT) || PORT <= 0) {
    throw new Error(`[Startup Error]: Invalid PORT value "${process.env.PORT}".`);
}
/**
 * Allowed frontend origins.
 *
 * Example .env:
 *
 * FRONTEND_URL=https://app.phadamhospital.co.ke
 *
 * For multiple frontend URLs:
 *
 * FRONTEND_URLS=https://app.phadamhospital.co.ke,https://admin.phadamhospital.co.ke
 */
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
    ...(process.env.FRONTEND_URLS?.split(',') ?? []),
]
    .map((origin) => origin?.trim())
    .filter((origin) => Boolean(origin));
const corsOptions = {
    origin(origin, callback) {
        /*
         * Requests without Origin are commonly server-to-server requests,
         * cURL requests, uptime checks, Meta webhook callbacks, and Postman.
         */
        if (!origin) {
            callback(null, true);
            return;
        }
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        console.warn('[CORS Blocked]', {
            origin,
            allowedOrigins,
        });
        callback(new Error(`Origin "${origin}" is not allowed by CORS.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-api-key',
        'x-hub-signature-256',
    ],
};
app.use((0, cors_1.default)(corsOptions));
/**
 * Meta WhatsApp webhook requests are normal JSON payloads in the
 * current controller implementation.
 *
 * Keep express.json() before the routes only if your webhook controller
 * does not validate Meta's x-hub-signature-256 against the raw request body.
 *
 * If you later add raw Meta webhook signature validation, mount the
 * webhook router BEFORE express.json() and use express.raw() only on
 * the POST webhook route.
 */
app.use(express_1.default.json({ limit: '1mb' }));
/**
 * Application routes
 *
 * Meta callback endpoint:
 * GET/POST https://your-domain.com/webhook
 *
 * Public notification endpoint:
 * POST https://your-domain.com/api/v1/send-notification
 *
 * Agent dashboard endpoints:
 * GET/POST https://your-domain.com/api/agent/...
 */
app.use('/webhook', webhookRoutes_1.default);
app.use('/api/v1', publicApiRoutes_1.default);
app.use('/api/agent', agentRoutes_1.default);
/**
 * Basic health-check endpoint.
 *
 * Use this for load balancers, deployment health checks,
 * UptimeRobot, Render, Railway, Fly.io, or reverse proxies.
 */
app.get('/', (_req, res) => {
    return res.status(200).json({
        success: true,
        service: APP_NAME,
        status: 'running',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
    });
});
app.get('/health', async (_req, res) => {
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        return res.status(200).json({
            success: true,
            service: APP_NAME,
            status: 'healthy',
            database: 'connected',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('[Health Check Error]', error instanceof Error ? error.message : error);
        return res.status(503).json({
            success: false,
            service: APP_NAME,
            status: 'unhealthy',
            database: 'unavailable',
        });
    }
});
/**
 * Daily appointment reminders.
 *
 * Schedule:
 * 0 8 * * *
 *
 * Meaning:
 * 8:00 AM every day in Africa/Nairobi timezone.
 */
node_cron_1.default.schedule('0 8 * * *', async () => {
    console.info('[Cron Job] Starting appointment reminder check for tomorrow.');
    try {
        const startOfTomorrow = new Date();
        startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
        startOfTomorrow.setHours(0, 0, 0, 0);
        const endOfTomorrow = new Date(startOfTomorrow);
        endOfTomorrow.setHours(23, 59, 59, 999);
        const appointments = await prisma_1.prisma.appointment.findMany({
            where: {
                slotTime: {
                    gte: startOfTomorrow,
                    lte: endOfTomorrow,
                },
                status: 'CONFIRMED',
            },
            include: {
                patient: true,
            },
        });
        console.info(`[Cron Job] Found ${appointments.length} confirmed appointment(s) scheduled for tomorrow.`);
        for (const appointment of appointments) {
            const patientPhone = appointment.patient?.phoneNumber?.trim();
            if (!patientPhone) {
                console.warn('[Cron Job] Appointment skipped: patient has no phone number.', {
                    appointmentId: appointment.id,
                    patientId: appointment.patientId,
                });
                continue;
            }
            const appointmentDate = appointment.slotTime.toLocaleDateString('en-KE', {
                timeZone: CRON_TIMEZONE,
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
            const appointmentTime = appointment.slotTime.toLocaleTimeString('en-KE', {
                timeZone: CRON_TIMEZONE,
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            });
            const reminderMessage = [
                '🏥 *Phadam Hospital Appointment Reminder*',
                '',
                `You have an upcoming appointment tomorrow.`,
                `Specialty: ${appointment.specialty}`,
                `Date: ${appointmentDate}`,
                `Time: ${appointmentTime}`,
                '',
                'Please contact the hospital if you need assistance or need to reschedule.',
            ].join('\n');
            try {
                /*
                 * Updated WhatsApp service signature.
                 *
                 * Old:
                 * sendWhatsAppMessage(patientPhone, reminderMessage)
                 *
                 * New:
                 * sendWhatsAppMessage({
                 *   recipientPhone: patientPhone,
                 *   messageText: reminderMessage,
                 * })
                 */
                const whatsappResult = await (0, whatsappService_1.sendWhatsAppMessage)({
                    recipientPhone: patientPhone,
                    messageText: reminderMessage,
                });
                console.info('[Cron Job] Reminder accepted by WhatsApp.', {
                    appointmentId: appointment.id,
                    patientId: appointment.patientId,
                    recipientPhone: patientPhone,
                    messageId: whatsappResult.messageId,
                    simulated: whatsappResult.simulated,
                });
            }
            catch (error) {
                if (error instanceof whatsappService_1.WhatsAppApiError) {
                    console.error('[Cron Job] WhatsApp reminder rejected.', {
                        appointmentId: appointment.id,
                        patientId: appointment.patientId,
                        recipientPhone: patientPhone,
                        status: error.status,
                        metaCode: error.metaCode,
                        metaDetails: error.metaDetails,
                        fbTraceId: error.fbTraceId,
                        error: error.message,
                    });
                }
                else {
                    console.error('[Cron Job] Failed to send appointment reminder.', {
                        appointmentId: appointment.id,
                        patientId: appointment.patientId,
                        recipientPhone: patientPhone,
                        error: error instanceof Error
                            ? error.message
                            : 'Unknown error',
                    });
                }
            }
        }
        console.info('[Cron Job] Appointment reminder check completed.');
    }
    catch (error) {
        console.error('[Cron Job] Failed to query or process appointment reminders.', error instanceof Error ? error.stack || error.message : error);
    }
}, {
    timezone: CRON_TIMEZONE,
});
/**
 * Central Express error handler.
 *
 * This catches, among other things:
 * - Invalid JSON bodies
 * - CORS rejection errors
 * - Unexpected route errors passed through next(error)
 */
app.use((error, _req, res, _next) => {
    console.error('[Express Error Handler]', error.message);
    if (error instanceof SyntaxError && 'body' in error) {
        return res.status(400).json({
            success: false,
            error: 'Invalid JSON request body.',
        });
    }
    if (error.message.includes('not allowed by CORS')) {
        return res.status(403).json({
            success: false,
            error: 'Request origin is not allowed.',
        });
    }
    return res.status(500).json({
        success: false,
        error: 'Internal server error.',
    });
});
const server = app.listen(PORT, () => {
    console.info('========================================');
    console.info(`🚀 ${APP_NAME} is running.`);
    console.info(`📍 Port: ${PORT}`);
    console.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.info(`🕗 Reminder Cron Timezone: ${CRON_TIMEZONE}`);
    console.info('========================================');
});
/**
 * Graceful shutdown.
 *
 * Stops Express from accepting new connections and disconnects Prisma
 * cleanly when the host, Docker container, PM2, Render, Railway, etc.
 * sends a termination signal.
 */
async function shutdown(signal) {
    console.info(`[Shutdown] ${signal} received. Closing server...`);
    server.close(async () => {
        try {
            await prisma_1.prisma.$disconnect();
            console.info('[Shutdown] Prisma disconnected.');
            console.info('[Shutdown] Server stopped successfully.');
            process.exit(0);
        }
        catch (error) {
            console.error('[Shutdown] Failed to disconnect Prisma cleanly.', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });
}
process.on('SIGINT', () => {
    void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});
