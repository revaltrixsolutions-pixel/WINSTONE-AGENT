// src/index.ts

import express from 'express';
import dotenv from 'dotenv';
import cors, { type CorsOptions } from 'cors';
import cron from 'node-cron';

import webhookRouter from './routes/webhookRoutes';
import publicApiRouter from './routes/publicApiRoutes';
import agentRouter from './routes/agentRoutes';

import { prisma } from './lib/prisma';
import {
  sendWhatsAppMessage,
  WhatsAppApiError,
} from './services/whatsappService';

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 5000);
const APP_NAME = 'Phadam Medical Automation Engine';
const CRON_TIMEZONE = 'Africa/Nairobi';

/* =========================================================
   STARTUP VALIDATION
   ========================================================= */

if (Number.isNaN(PORT) || PORT <= 0) {
  throw new Error(
    `[Startup Error]: Invalid PORT value "${process.env.PORT}".`,
  );
}

/* =========================================================
   CORS CONFIGURATION
   ========================================================= */

/**
 * Production frontend:
 * https://phadam-whats-app.vercel.app
 *
 * Production backend:
 * https://phadamwhatsapp.onrender.com
 *
 * Render environment variables supported:
 *
 * FRONTEND_URL=https://phadam-whats-app.vercel.app
 *
 * FRONTEND_URLS=https://example1.com,https://example2.com
 */

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://phadam-whats-app.vercel.app',
];

const environmentOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS?.split(',') ?? []),
];

const normalizeOrigin = (origin: string): string =>
  origin.trim().replace(/\/+$/, '');

const allowedOrigins = [
  ...defaultAllowedOrigins,
  ...environmentOrigins,
]
  .filter((origin): origin is string => Boolean(origin))
  .map(normalizeOrigin)
  .filter(
    (origin, index, origins) =>
      origins.indexOf(origin) === index,
  );

console.info('[CORS] Allowed origins:', allowedOrigins);

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    /*
     * Requests without Origin include:
     *
     * - Meta WhatsApp webhooks
     * - cURL
     * - Postman
     * - Render health checks
     * - Server-to-server requests
     */
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);

    if (allowedOrigins.includes(normalizedOrigin)) {
      console.info('[CORS Allowed]', {
        origin: normalizedOrigin,
      });

      return callback(null, true);
    }

    console.warn('[CORS Blocked]', {
      origin: normalizedOrigin,
      allowedOrigins,
    });

    /*
     * Return an error so the application does not silently
     * allow an unknown browser origin.
     */
    return callback(
      new Error(
        `Origin "${normalizedOrigin}" is not allowed by CORS.`,
      ),
    );
  },

  credentials: true,

  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-api-key',
    'x-hub-signature-256',
  ],

  exposedHeaders: [
    'Content-Length',
    'Content-Type',
  ],

  optionsSuccessStatus: 204,
};

/*
 * CORS middleware must be registered before the routes.
 */
app.use(cors(corsOptions));

/*
 * Explicit OPTIONS/preflight handling.
 */
app.options('*', cors(corsOptions));

/* =========================================================
   BODY PARSER
   ========================================================= */

app.use(
  express.json({
    limit: '1mb',
  }),
);

/* =========================================================
   REQUEST LOGGING
   ========================================================= */

app.use((req, _res, next) => {
  console.info('[HTTP Request]', {
    method: req.method,
    path: req.path,
    origin: req.headers.origin || 'none',
    userAgent: req.headers['user-agent'] || 'unknown',
  });

  next();
});

/* =========================================================
   ROUTES
   ========================================================= */

/*
 * WhatsApp / Meta webhook
 *
 * GET:
 * Meta webhook verification
 *
 * POST:
 * Incoming WhatsApp messages and status updates
 */
app.use('/webhook', webhookRouter);

/*
 * Public API
 */
app.use('/api/v1', publicApiRouter);

/*
 * Agent dashboard API
 *
 * GET  /api/agent/chats
 * POST /api/agent/assign
 * POST /api/agent/reply
 */
app.use('/api/agent', agentRouter);

/* =========================================================
   ROOT HEALTH CHECK
   ========================================================= */

app.get('/', (_req, res) => {
  return res.status(200).json({
    success: true,
    service: APP_NAME,
    status: 'running',
    environment:
      process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

/* =========================================================
   DATABASE HEALTH CHECK
   ========================================================= */

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json({
      success: true,
      service: APP_NAME,
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      '[Health Check Error]',
      error instanceof Error
        ? error.message
        : error,
    );

    return res.status(503).json({
      success: false,
      service: APP_NAME,
      status: 'unhealthy',
      database: 'unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

/* =========================================================
   DAILY APPOINTMENT REMINDERS
   ========================================================= */

/**
 * Runs every day at 8:00 AM Nairobi time.
 *
 * Cron:
 * 0 8 * * *
 */

cron.schedule(
  '0 8 * * *',
  async () => {
    console.info(
      '[Cron Job] Starting appointment reminder check for tomorrow.',
    );

    try {
      const startOfTomorrow = new Date();

      startOfTomorrow.setDate(
        startOfTomorrow.getDate() + 1,
      );

      startOfTomorrow.setHours(0, 0, 0, 0);

      const endOfTomorrow = new Date(
        startOfTomorrow,
      );

      endOfTomorrow.setHours(
        23,
        59,
        59,
        999,
      );

      const appointments =
        await prisma.appointment.findMany({
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

      console.info(
        `[Cron Job] Found ${appointments.length} confirmed appointment(s) scheduled for tomorrow.`,
      );

      for (const appointment of appointments) {
        const patientPhone =
          appointment.patient?.phoneNumber?.trim();

        if (!patientPhone) {
          console.warn(
            '[Cron Job] Appointment skipped: patient has no phone number.',
            {
              appointmentId: appointment.id,
              patientId: appointment.patientId,
            },
          );

          continue;
        }

        const appointmentDate =
          appointment.slotTime.toLocaleDateString(
            'en-KE',
            {
              timeZone: CRON_TIMEZONE,
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            },
          );

        const appointmentTime =
          appointment.slotTime.toLocaleTimeString(
            'en-KE',
            {
              timeZone: CRON_TIMEZONE,
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            },
          );

        const reminderMessage = [
          '🏥 *Phadam Hospital Appointment Reminder*',
          '',
          'You have an upcoming appointment tomorrow.',
          `Specialty: ${appointment.specialty}`,
          `Date: ${appointmentDate}`,
          `Time: ${appointmentTime}`,
          '',
          'Please contact the hospital if you need assistance or need to reschedule.',
        ].join('\n');

        try {
          const whatsappResult =
            await sendWhatsAppMessage({
              recipientPhone: patientPhone,
              messageText: reminderMessage,
            });

          console.info(
            '[Cron Job] Reminder accepted by WhatsApp.',
            {
              appointmentId: appointment.id,
              patientId: appointment.patientId,
              recipientPhone: patientPhone,
              messageId:
                whatsappResult.messageId,
              simulated:
                whatsappResult.simulated,
            },
          );
        } catch (error) {
          if (
            error instanceof WhatsAppApiError
          ) {
            console.error(
              '[Cron Job] WhatsApp reminder rejected.',
              {
                appointmentId:
                  appointment.id,
                patientId:
                  appointment.patientId,
                recipientPhone:
                  patientPhone,
                status: error.status,
                metaCode:
                  error.metaCode,
                metaDetails:
                  error.metaDetails,
                fbTraceId:
                  error.fbTraceId,
                error: error.message,
              },
            );
          } else {
            console.error(
              '[Cron Job] Failed to send appointment reminder.',
              {
                appointmentId:
                  appointment.id,
                patientId:
                  appointment.patientId,
                recipientPhone:
                  patientPhone,
                error:
                  error instanceof Error
                    ? error.message
                    : 'Unknown error',
              },
            );
          }
        }
      }

      console.info(
        '[Cron Job] Appointment reminder check completed.',
      );
    } catch (error) {
      console.error(
        '[Cron Job] Failed to query or process appointment reminders.',
        error instanceof Error
          ? error.stack ||
            error.message
          : error,
      );
    }
  },
  {
    timezone: CRON_TIMEZONE,
  },
);

/* =========================================================
   404 HANDLER
   ========================================================= */

app.use((req, res) => {
  console.warn('[404 Not Found]', {
    method: req.method,
    path: req.path,
  });

  return res.status(404).json({
    success: false,
    error: 'Route not found.',
    path: req.path,
  });
});

/* =========================================================
   CENTRAL ERROR HANDLER
   ========================================================= */

app.use(
  (
    error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(
      '[Express Error Handler]',
      error.message,
    );

    /*
     * Invalid JSON
     */
    if (
      error instanceof SyntaxError &&
      'body' in error
    ) {
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON request body.',
      });
    }

    /*
     * CORS error
     */
    if (
      error.message
        .toLowerCase()
        .includes('cors') ||
      error.message
        .toLowerCase()
        .includes('origin')
    ) {
      return res.status(403).json({
        success: false,
        error: 'Request origin is not allowed.',
      });
    }

    /*
     * General server error
     */
    return res.status(500).json({
      success: false,
      error: 'Internal server error.',
    });
  },
);

/* =========================================================
   START SERVER
   ========================================================= */

const server = app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.info(
      '========================================',
    );

    console.info(
      `🚀 ${APP_NAME} is running.`,
    );

    console.info(
      `📍 Port: ${PORT}`,
    );

    console.info(
      `🌍 Environment: ${
        process.env.NODE_ENV ||
        'development'
      }`,
    );

    console.info(
      `🕗 Reminder Cron Timezone: ${CRON_TIMEZONE}`,
    );

    console.info(
      `🌐 Frontend origins configured: ${allowedOrigins.join(
        ', ',
      )}`,
    );

    console.info(
      '========================================',
    );
  },
);

/* =========================================================
   GRACEFUL SHUTDOWN
   ========================================================= */

async function shutdown(
  signal: string,
): Promise<void> {
  console.info(
    `[Shutdown] ${signal} received. Closing server...`,
  );

  server.close(async () => {
    try {
      await prisma.$disconnect();

      console.info(
        '[Shutdown] Prisma disconnected.',
      );

      console.info(
        '[Shutdown] Server stopped successfully.',
      );

      process.exit(0);
    } catch (error) {
      console.error(
        '[Shutdown] Failed to disconnect Prisma cleanly.',
        error instanceof Error
          ? error.message
          : error,
      );

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