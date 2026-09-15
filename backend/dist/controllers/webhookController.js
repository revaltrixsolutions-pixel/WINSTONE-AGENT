"use strict";

// backend/src/controllers/webhookController.ts

import { prisma } from "../lib/prisma.js";
import {
  appointmentConversationState,
  appointmentServiceOptions,
  extractPatientName,
  generateBotReply,
  getKenyaGreeting,
  getServicePrice,
  isConversationStale,
  isHumanSupportRequest,
  isUsablePatientName,
  parseAppointmentRequest,
  updateAppointmentConversation,
} from "../services/aiBotService.js";
import {
  sendWhatsAppMessage,
  WhatsAppApiError,
} from "../services/whatsappService.js";

/* ==========================================================================
   TYPES
========================================================================== */

type WhatsAppContact = {
  wa_id?: string;
  profile?: {
    name?: string;
  };
};

type WhatsAppMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;

  text?: {
    body?: string;
  };

  button?: {
    text?: string;
    payload?: string;
  };

  interactive?: {
    type?: string;
    button_reply?: {
      id?: string;
      title?: string;
    };
    list_reply?: {
      id?: string;
      title?: string;
      description?: string;
    };
  };

  image?: {
    caption?: string;
  };

  document?: {
    filename?: string;
    caption?: string;
  };

  audio?: {
    id?: string;
  };

  video?: {
    caption?: string;
  };

  location?: {
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
};

type WhatsAppWebhookPayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        contacts?: WhatsAppContact[];
        messages?: WhatsAppMessage[];
        statuses?: Array<{
          id?: string;
          status?: string;
          recipient_id?: string;
          errors?: Array<{
            error_data?: {
              details?: string;
            };
            message?: string;
          }>;
        }>;
      };
    }>;
  }>;
};

type PatientForBot = {
  id: string;
  phoneNumber: string;
  fullName: string | null;
  chatStatus: string;
  assignedTo?: string | null;
};

/* ==========================================================================
   HELPERS
========================================================================== */

/**
 * Converts a phone number into digits only.
 *
 * +254 712 345 678 -> 254712345678
 * 254712345678     -> 254712345678
 */
function normalizePhoneNumber(phoneNumber: string): string {
  return String(phoneNumber || "").replace(/\D/g, "");
}

/**
 * Convert a WhatsApp/Meta Unix timestamp to Date.
 */
function getWebhookMessageDate(timestamp?: string): Date {
  if (!timestamp) {
    return new Date();
  }

  const timestampSeconds = Number(timestamp);

  if (!Number.isFinite(timestampSeconds)) {
    return new Date();
  }

  return new Date(timestampSeconds * 1000);
}

/**
 * Convert a date to Kenya time for patient-facing appointment details.
 */
function formatKenyaDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

/**
 * Get the last interaction time for a patient.
 */
async function getLastInteractionHours(patientId: string): Promise<number> {
  const lastMessage = await prisma.messageLog.findFirst({
    where: {
      patientId,
    },
    orderBy: {
      timestamp: "desc",
    },
    select: {
      timestamp: true,
    },
  });

  if (!lastMessage?.timestamp) {
    return Number.POSITIVE_INFINITY;
  }

  const diffMs =
    Date.now() - new Date(lastMessage.timestamp).getTime();

  return diffMs / (1000 * 60 * 60);
}

/**
 * Get the last staff/agent interaction time.
 */
async function getLastAgentInteractionHours(
  patientId: string,
): Promise<number> {
  const lastAgentMessage = await prisma.messageLog.findFirst({
    where: {
      patientId,
      sender: "AGENT",
    },
    orderBy: {
      timestamp: "desc",
    },
    select: {
      timestamp: true,
    },
  });

  if (!lastAgentMessage?.timestamp) {
    return Number.POSITIVE_INFINITY;
  }

  return (
    (Date.now() - new Date(lastAgentMessage.timestamp).getTime()) /
    (1000 * 60 * 60)
  );
}

/* ==========================================================================
   APPOINTMENT LOOKUP
========================================================================== */

function isAppointmentLookupRequest(message: string): boolean {
  return (
    /\b(my|our|the)\b.*\b(appointment|appointments|booking|bookings|visit|visits)\b/i.test(
      message,
    ) ||
    /\b(appointment|appointments|booking|bookings|visit|visits)\b.*\b(details|status|when|date|time|schedule|scheduled|confirm|check|see)\b/i.test(
      message,
    ) ||
    /\b(when|where|what time)\b.*\b(appointment|visit|doctor|clinic)\b/i.test(
      message,
    ) ||
    /\b(scheduled|upcoming|confirmed)\b.*\b(appointment|visit|booking)\b/i.test(
      message,
    )
  );
}

async function getAppointmentLookupReply(
  patientId: string,
  patientName: string,
  message: string,
): Promise<string | null> {
  if (!isAppointmentLookupRequest(message)) {
    return null;
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      patientId,
      slotTime: {
        gte: new Date(),
      },
      status: {
        not: "CANCELLED",
      },
    },
    orderBy: {
      slotTime: "asc",
    },
    take: 5,
  });

  if (!appointments.length) {
    return `${patientName}, I could not find an upcoming appointment under this WhatsApp number. Would you like to book one? Please send the date, time, and department, for example: tomorrow at 9am in Maternity.`;
  }

  const details = appointments
    .map((appointment, index) =>
      [
        `${index + 1}. ${formatKenyaDateTime(appointment.slotTime)}`,
        `Department: ${appointment.specialty}`,
        `Doctor: ${appointment.doctorName}`,
        `Status: ${appointment.status}`,
        `Reference: ${appointment.id.slice(0, 8)}`,
      ].join("\n"),
    )
    .join("\n\n");

  return `${getKenyaGreeting()}, ${patientName}. Here are your upcoming appointment details:\n\n${details}\n\nWhat would you like to do next: keep this appointment, book another one, or speak with staff?`;
}

/* ==========================================================================
   APPOINTMENT DATE/TIME PARSING
========================================================================== */

function parseAppointmentDate(
  dateText: string,
  timeText: string,
): Date {
  const normalizedDate = String(dateText || "").toLowerCase().trim();
  const normalizedTime = String(timeText || "").toLowerCase().trim();

  const now = new Date();

  let hour = 9;
  let minute = 0;

  const timeMatch = normalizedTime.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
  );

  if (timeMatch) {
    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2] || 0);

    const meridiem = timeMatch[3].toLowerCase();

    if (meridiem === "pm" && hour < 12) {
      hour += 12;
    }

    if (meridiem === "am" && hour === 12) {
      hour = 0;
    }
  } else {
    const bareTimeMatch = normalizedTime.match(
      /\b(\d{1,2})(?::(\d{2}))?\b/,
    );

    if (bareTimeMatch) {
      hour = Number(bareTimeMatch[1]);
      minute = Number(bareTimeMatch[2] || 0);

      if (hour >= 1 && hour <= 7) {
        hour += 12;
      }
    }
  }

  const dateOnly = new Date(now);

  dateOnly.setHours(0, 0, 0, 0);

  if (normalizedDate.includes("today")) {
    dateOnly.setHours(hour, minute, 0, 0);
    return dateOnly;
  }

  if (normalizedDate.includes("tomorrow")) {
    dateOnly.setDate(dateOnly.getDate() + 1);
    dateOnly.setHours(hour, minute, 0, 0);
    return dateOnly;
  }

  if (normalizedDate.includes("next week")) {
    dateOnly.setDate(dateOnly.getDate() + 7);
    dateOnly.setHours(hour, minute, 0, 0);
    return dateOnly;
  }

  const weekdays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  const weekdayIndex = weekdays.findIndex((day) =>
    normalizedDate.includes(day),
  );

  if (weekdayIndex >= 0) {
    const currentIndex = dateOnly.getDay();

    const daysUntil =
      (weekdayIndex - currentIndex + 7) % 7 || 7;

    dateOnly.setDate(dateOnly.getDate() + daysUntil);
    dateOnly.setHours(hour, minute, 0, 0);

    return dateOnly;
  }

  const numericDateMatch = normalizedDate.match(
    /\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/,
  );

  if (numericDateMatch) {
    const day = Number(numericDateMatch[1]);
    const month = Number(numericDateMatch[2]) - 1;

    let year = numericDateMatch[3]
      ? Number(numericDateMatch[3])
      : now.getFullYear();

    if (year < 100) {
      year += 2000;
    }

    const directDate = new Date(
      year,
      month,
      day,
      hour,
      minute,
      0,
      0,
    );

    if (!Number.isNaN(directDate.getTime())) {
      return directDate;
    }
  }

  const monthMatch = normalizedDate.match(
    /\b(\d{1,2})\s*(?:st|nd|rd|th)?\s*(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{4})?\b/i,
  );

  if (monthMatch) {
    const day = Number(monthMatch[1]);

    const months: Record<string, number> = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };

    const month = months[monthMatch[2].slice(0, 3).toLowerCase()];
    const year = monthMatch[3]
      ? Number(monthMatch[3])
      : now.getFullYear();

    const directDate = new Date(
      year,
      month,
      day,
      hour,
      minute,
      0,
      0,
    );

    if (!Number.isNaN(directDate.getTime())) {
      return directDate;
    }
  }

  const directDate = new Date(normalizedDate);

  if (!Number.isNaN(directDate.getTime())) {
    directDate.setHours(hour, minute, 0, 0);
    return directDate;
  }

  dateOnly.setHours(hour, minute, 0, 0);

  return dateOnly;
}

/* ==========================================================================
   WHATSAPP INTERACTIVE UI
========================================================================== */

function buildAppointmentInteractive(
  prompt: string,
  appointmentState: {
    department?: string;
    date?: string;
    time?: string;
    awaitingConfirmation?: boolean;
  },
) {
  if (appointmentState.awaitingConfirmation) {
    return {
      type: "button",
      body: {
        text: prompt,
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "appointment_confirm",
              title: "Confirm",
            },
          },
          {
            type: "reply",
            reply: {
              id: "appointment_change",
              title: "Change details",
            },
          },
        ],
      },
    };
  }

  if (!appointmentState.department) {
    const rows = appointmentServiceOptions
      .map((service) => ({
        id: `service_${service
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")}`,
        title: service.slice(0, 24),
        description: `${getServicePrice(service)} + KSh 1,000 consultation`,
      }))
      .slice(0, 10);

    return {
      type: "list",
      body: {
        text: `${prompt} The menu shows the most requested services. If yours is not listed, reply with the service name.`,
      },
      action: {
        button: "Choose a service",
        sections: [
          {
            title: "Hospital services",
            rows,
          },
        ],
      },
    };
  }

  if (!appointmentState.date) {
    return {
      type: "list",
      body: {
        text: prompt,
      },
      action: {
        button: "Choose a date",
        sections: [
          {
            title: "Appointment date",
            rows: [
              {
                id: "date_today",
                title: "Today",
              },
              {
                id: "date_tomorrow",
                title: "Tomorrow",
              },
              {
                id: "date_next_week",
                title: "Next week",
              },
            ],
          },
        ],
      },
    };
  }

  if (!appointmentState.time) {
    return {
      type: "list",
      body: {
        text: prompt,
      },
      action: {
        button: "Choose a time",
        sections: [
          {
            title: "Available times",
            rows: [
              "09:00 AM",
              "11:00 AM",
              "01:00 PM",
              "03:00 PM",
              "05:00 PM",
            ].map((time) => ({
              id: `time_${time
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "_")}`,
              title: time,
            })),
          },
        ],
      },
    };
  }

  return undefined;
}

function buildPatientMenu() {
  return {
    type: "list",
    body: {
      text: "Welcome to Phadam Hospital. Choose what you need below. You only need to type your name; all other options can be selected.",
    },
    action: {
      button: "Open hospital menu",
      sections: [
        {
          title: "How can we help?",
          rows: [
            {
              id: "menu_appointments",
              title: "Book appointment",
              description: "Choose service, date and time",
            },
            {
              id: "menu_scheduled",
              title: "My appointments",
              description: "View scheduled appointments",
            },
            {
              id: "menu_services",
              title: "Our services",
              description: "Browse hospital services",
            },
            {
              id: "menu_departments",
              title: "Departments",
              description: "View hospital departments",
            },
            {
              id: "menu_locations",
              title: "Locations and contacts",
              description: "Find our branches",
            },
            {
              id: "menu_prices",
              title: "Prices and fees",
              description: "View available prices",
            },
            {
              id: "menu_insurance",
              title: "SHA and insurance",
              description: "Check accepted covers",
            },
            {
              id: "menu_human",
              title: "Speak to staff",
              description: "Request human assistance",
            },
          ],
        },
      ],
    },
  };
}

function buildKnowledgeMenu() {
  return {
    type: "list",
    body: {
      text: "Choose a topic and I will show the exact Phadam Hospital information.",
    },
    action: {
      button: "Choose a topic",
      sections: [
        {
          title: "Hospital information",
          rows: [
            {
              id: "menu_services",
              title: "Services",
              description: "Clinical and support services",
            },
            {
              id: "menu_departments",
              title: "Departments",
              description: "Department information",
            },
            {
              id: "menu_specialists",
              title: "Specialist clinics",
              description: "Specialist care options",
            },
            {
              id: "menu_locations",
              title: "Locations",
              description: "Branches and contacts",
            },
            {
              id: "menu_prices",
              title: "Prices",
              description: "Procedures and fees",
            },
            {
              id: "menu_insurance",
              title: "SHA and insurance",
              description: "Accepted medical covers",
            },
            {
              id: "menu_about",
              title: "About Phadam",
              description: "Mission, values and leadership",
            },
            {
              id: "menu_human",
              title: "Speak to staff",
              description: "Request human help",
            },
          ],
        },
      ],
    },
  };
}

/* ==========================================================================
   INTERACTIVE SELECTION NORMALIZATION
========================================================================== */

function normalizeInteractiveSelection(message: string): string {
  const selections: Record<string, string> = {
    menu_appointments: "book appointment",
    menu_scheduled: "show my scheduled appointments",
    menu_services: "show our services",
    menu_departments: "show our departments",
    menu_specialists: "show our specialist clinics",
    menu_locations: "show our locations and contacts",
    menu_prices: "show prices and fees",
    menu_insurance: "show SHA and insurance",
    menu_about: "show hospital information",
    menu_human: "I want to speak to a human staff member",

    appointment_confirm: "confirm",
    appointment_change: "change details",

    date_today: "today",
    date_tomorrow: "tomorrow",
    date_next_week: "next week",
  };

  if (selections[message]) {
    return selections[message];
  }

  if (message.startsWith("time_")) {
    return message
      .slice("time_".length)
      .replaceAll("_", " ");
  }

  if (message.startsWith("service_")) {
    return message
      .slice("service_".length)
      .replaceAll("_", " ");
  }

  return message;
}

/* ==========================================================================
   BOT REPLY
========================================================================== */

async function sendBotReply(
  patient: PatientForBot,
  incomingMessage: string,
): Promise<void> {
  const effectiveMessage =
    normalizeInteractiveSelection(incomingMessage).trim();

  if (!effectiveMessage) {
    return;
  }

  const patientName =
    (isUsablePatientName(patient.fullName)
      ? patient.fullName
      : extractPatientName(effectiveMessage)) || "Patient";

  const hasPatientName = patientName !== "Patient";

  const bookingIntent =
    /\b(book|appointment|visit|consult|schedule|booking|doctor appointment)\b/i.test(
      effectiveMessage,
    );

  const appointmentDetails =
    parseAppointmentRequest(effectiveMessage);

  const existingAppointmentState =
    appointmentConversationState.get(patient.id);

  /*
   * IMPORTANT:
   * Do not destroy appointment state merely because the next message
   * does not contain the word "appointment".
   *
   * Messages such as:
   *   Emergency
   *   Today
   *   Tomorrow
   *   09:00 AM
   *   Confirm
   *
   * are all valid appointment-flow messages.
   */
  const appointmentFlowActive =
    !!existingAppointmentState &&
    !existingAppointmentState.completed;

  if (
    patient.chatStatus === "AGENT_ACTIVE"
  ) {
    const hoursSinceAgentMessage =
      await getLastAgentInteractionHours(patient.id);

    if (
      !Number.isFinite(hoursSinceAgentMessage) ||
      hoursSinceAgentMessage < 3 / 60
    ) {
      console.info("[WhatsApp Bot Suppressed] Chat is assigned to staff.", {
        patientId: patient.id,
        hoursSinceAgentMessage,
      });

      return;
    }
  }

  /*
   * If a name was just captured, show the main menu.
   */
  const nameWasJustCaptured =
    (patient as PatientForBot & {
      nameWasJustCaptured?: boolean;
    }).nameWasJustCaptured === true;

  if (nameWasJustCaptured) {
    const menu = buildPatientMenu();

    try {
      await sendWhatsAppMessage({
        recipientPhone: patient.phoneNumber,
        interactive: menu,
      });

      await prisma.messageLog.create({
        data: {
          patientId: patient.id,
          sender: "BOT",
          body: menu.body.text,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error(
        "[WhatsApp Initial Menu Send Failed]",
        {
          patientId: patient.id,
          error:
            error instanceof Error
              ? error.message
              : error,
        },
      );
    }

    return;
  }

  /*
   * Knowledge menu selections.
   */
  if (
    effectiveMessage === "show our services" ||
    effectiveMessage === "show our departments" ||
    effectiveMessage ===
      "show our specialist clinics" ||
    effectiveMessage === "show prices and fees" ||
    effectiveMessage === "show SHA and insurance" ||
    effectiveMessage ===
      "show hospital information"
  ) {
    const menu = buildKnowledgeMenu();

    try {
      await sendWhatsAppMessage({
        recipientPhone: patient.phoneNumber,
        interactive: menu,
      });
    } catch (error) {
      console.error(
        "[WhatsApp Knowledge Menu Send Failed]",
        {
          patientId: patient.id,
          error:
            error instanceof Error
              ? error.message
              : error,
        },
      );
    }

    return;
  }

  /*
   * Appointment lookup must happen before starting a new booking.
   */
  const appointmentLookupReply = hasPatientName
    ? await getAppointmentLookupReply(
        patient.id,
        patientName,
        effectiveMessage,
      )
    : null;

  if (
    appointmentLookupReply &&
    !appointmentFlowActive
  ) {
    try {
      const whatsappResult =
        await sendWhatsAppMessage({
          recipientPhone: patient.phoneNumber,
          messageText: appointmentLookupReply,
        });

      await prisma.messageLog.create({
        data: {
          patientId: patient.id,
          sender: "BOT",
          body: appointmentLookupReply,
          timestamp: new Date(),
        },
      });

      console.info(
        "[WhatsApp Appointment Lookup Reply Sent]",
        {
          patientId: patient.id,
          messageId: whatsappResult.messageId,
        },
      );
    } catch (error) {
      console.error(
        "[WhatsApp Appointment Lookup Reply Failed]",
        {
          patientId: patient.id,
          error:
            error instanceof Error
              ? error.message
              : error,
        },
      );
    }

    return;
  }

  /*
   * APPOINTMENT FLOW
   *
   * This is deliberately before human-support detection.
   *
   * Otherwise words such as "doctor" or "staff" in an appointment
   * conversation can accidentally terminate the booking flow.
   */
  if (
    hasPatientName &&
    (
      bookingIntent ||
      appointmentFlowActive ||
      !!appointmentDetails.date ||
      !!appointmentDetails.time ||
      !!appointmentDetails.department
    )
  ) {
    const appointmentState =
      updateAppointmentConversation(
        patient.id,
        patientName,
        effectiveMessage,
      );

    /*
     * Appointment is not yet complete.
     */
    if (!appointmentState.completed) {
      const replyText =
        appointmentState.prompt;

      const interactive =
        buildAppointmentInteractive(
          replyText,
          {
            ...appointmentState.data,
            awaitingConfirmation:
              appointmentState.awaitingConfirmation,
          },
        );

      try {
        await sendWhatsAppMessage({
          recipientPhone: patient.phoneNumber,
          messageText: replyText,
          interactive,
        });

        await prisma.messageLog.create({
          data: {
            patientId: patient.id,
            sender: "BOT",
            body: replyText,
            timestamp: new Date(),
          },
        });

        console.info(
          "[WhatsApp Appointment Prompt Sent]",
          {
            patientId: patient.id,
            prompt: replyText,
            awaitingConfirmation:
              appointmentState.awaitingConfirmation,
            appointmentData:
              appointmentState.data,
          },
        );
      } catch (error) {
        console.error(
          "[WhatsApp Appointment Prompt Failed]",
          {
            patientId: patient.id,
            error:
              error instanceof Error
                ? error.message
                : error,
          },
        );
      }

      return;
    }

    /*
     * Appointment flow is complete.
     *
     * Only create the DB appointment after the patient has confirmed.
     */
    const date =
      appointmentState.data?.date;

    const time =
      appointmentState.data?.time;

    const department =
      appointmentState.data?.department;

    if (!date || !time || !department) {
      console.error(
        "[WhatsApp Booking Invalid Completed State]",
        {
          patientId: patient.id,
          appointmentState,
        },
      );

      appointmentConversationState.delete(
        patient.id,
      );

      return;
    }

    const slotTime =
      parseAppointmentDate(date, time);

    /*
     * Prevent accidentally creating appointments
     * in the past.
     */
    if (
      Number.isNaN(slotTime.getTime()) ||
      slotTime.getTime() < Date.now()
    ) {
      const retryText =
        `${patientName}, that appointment time has already passed. Please choose a future date and time.`;

      appointmentConversationState.delete(
        patient.id,
      );

      try {
        await sendWhatsAppMessage({
          recipientPhone:
            patient.phoneNumber,
          messageText: retryText,
        });

        await prisma.messageLog.create({
          data: {
            patientId: patient.id,
            sender: "BOT",
            body: retryText,
            timestamp: new Date(),
          },
        });
      } catch (error) {
        console.error(
          "[WhatsApp Invalid Appointment Reply Failed]",
          {
            patientId: patient.id,
            error:
              error instanceof Error
                ? error.message
                : error,
          },
        );
      }

      return;
    }

    try {
      const appointment =
        await prisma.appointment.create({
          data: {
            patientId: patient.id,
            doctorName: "To be assigned",
            specialty: department,
            servicePrice:
              getServicePrice(department),
            consultationFee:
              "KSh 1,000",
            slotTime,
            status: "CONFIRMED",
          },
        });

      const confirmationText =
        `Thank you, ${patientName}. Your appointment has been booked for ${date} at ${time} in the ${department} department. Your appointment reference is ${appointment.id.slice(0, 8)}.`;

      await sendWhatsAppMessage({
        recipientPhone:
          patient.phoneNumber,
        messageText: confirmationText,
      });

      await prisma.messageLog.create({
        data: {
          patientId: patient.id,
          sender: "BOT",
          body: confirmationText,
          timestamp: new Date(),
        },
      });

      console.info(
        "[WhatsApp Booking Saved]",
        {
          patientId: patient.id,
          appointmentId: appointment.id,
          date,
          time,
          department,
        },
      );

      /*
       * Clear the in-memory appointment state after
       * successful database creation.
       */
      appointmentConversationState.delete(
        patient.id,
      );
    } catch (error) {
      console.error(
        "[WhatsApp Booking Save Failed]",
        {
          patientId: patient.id,
          error:
            error instanceof Error
              ? error.message
              : error,
        },
      );

      try {
        await sendWhatsAppMessage({
          recipientPhone:
            patient.phoneNumber,
          messageText:
            `${patientName}, I could not complete the booking right now. Please try again or ask to speak with hospital staff.`,
        });
      } catch (sendError) {
        console.error(
          "[WhatsApp Booking Failure Reply Failed]",
          {
            patientId: patient.id,
            error:
              sendError instanceof Error
                ? sendError.message
                : sendError,
          },
        );
      }
    }

    return;
  }

  /*
   * Human support.
   */
  if (isHumanSupportRequest(effectiveMessage)) {
    const humanReply = hasPatientName
      ? `Thanks, ${patientName}. I have asked our staff to help you. Please briefly describe what you need, and a staff member will introduce themselves here shortly.`
      : "I can connect you with a human staff member. Before I send the request, please reply with your full name and briefly tell me what you need help with.";

    if (hasPatientName) {
      try {
        await prisma.patient.update({
          where: {
            id: patient.id,
          },
          data: {
            chatStatus: "PENDING_AGENT",
          },
        });
      } catch (error) {
        console.error(
          "[WhatsApp Human Handoff Status Update Failed]",
          {
            patientId: patient.id,
            error:
              error instanceof Error
                ? error.message
                : error,
          },
        );
      }
    }

    try {
      await sendWhatsAppMessage({
        recipientPhone:
          patient.phoneNumber,
        messageText: humanReply,
      });

      await prisma.messageLog.create({
        data: {
          patientId: patient.id,
          sender: "BOT",
          body: humanReply,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error(
        "[WhatsApp Human Handoff Reply Failed]",
        {
          patientId: patient.id,
          error:
            error instanceof Error
              ? error.message
              : error,
        },
      );
    }

    return;
  }

  /*
   * Normal AI/knowledge-base response.
   */
  const lastInteractionHours =
    await getLastInteractionHours(patient.id);

  const replyText = generateBotReply({
    patientName:
      patientName || null,
    message: effectiveMessage,
    isReturning:
      isConversationStale(
        lastInteractionHours,
      ),
    lastInteractionHours,
  });

  if (!replyText.trim()) {
    return;
  }

  try {
    const whatsappResult =
      await sendWhatsAppMessage({
        recipientPhone:
          patient.phoneNumber,
        messageText: replyText,
      });

    await prisma.messageLog.create({
      data: {
        patientId: patient.id,
        sender: "BOT",
        body: replyText,
        timestamp: new Date(),
      },
    });

    console.info(
      "[WhatsApp Auto Reply Sent]",
      {
        patientId: patient.id,
        recipientPhone:
          patient.phoneNumber,
        messageId:
          whatsappResult.messageId,
        simulated:
          whatsappResult.simulated,
        patientName:
          patientName || null,
      },
    );
  } catch (error) {
    if (error instanceof WhatsAppApiError) {
      console.error(
        "[WhatsApp Auto Reply API Error]",
        {
          patientId: patient.id,
          recipientPhone:
            patient.phoneNumber,
          status: error.status,
          metaCode: error.metaCode,
          metaType: error.metaType,
          metaDetails:
            error.metaDetails,
          fbTraceId:
            error.fbTraceId,
        },
      );

      return;
    }

    console.error(
      "[WhatsApp Auto Reply Send Failed]",
      {
        patientId: patient.id,
        recipientPhone:
          patient.phoneNumber,
        error:
          error instanceof Error
            ? error.message
            : error,
      },
    );
  }
}

/* ==========================================================================
   WHATSAPP MESSAGE BODY
========================================================================== */

function getMessageBody(
  message: WhatsAppMessage,
): string {
  if (message.type === "text") {
    return (
      message.text?.body?.trim() || ""
    );
  }

  if (message.type === "button") {
    return (
      message.button?.text?.trim() ||
      message.button?.payload?.trim() ||
      "[Button response]"
    );
  }

  if (message.type === "interactive") {
    if (
      message.interactive?.type ===
      "button_reply"
    ) {
      return (
        message.interactive.button_reply?.id?.trim() ||
        message.interactive.button_reply?.title?.trim() ||
        "[Interactive button response]"
      );
    }

    if (
      message.interactive?.type ===
      "list_reply"
    ) {
      return (
        message.interactive.list_reply?.id?.trim() ||
        message.interactive.list_reply?.title?.trim() ||
        message.interactive.list_reply?.description?.trim() ||
        "[Interactive list response]"
      );
    }

    return "[Interactive WhatsApp response]";
  }

  if (message.type === "image") {
    const caption =
      message.image?.caption?.trim();

    return caption
      ? `[Image] ${caption}`
      : "[Image received]";
  }

  if (message.type === "document") {
    const filename =
      message.document?.filename?.trim();

    const caption =
      message.document?.caption?.trim();

    if (filename && caption) {
      return `[Document: ${filename}] ${caption}`;
    }

    if (filename) {
      return `[Document received: ${filename}]`;
    }

    if (caption) {
      return `[Document] ${caption}`;
    }

    return "[Document received]";
  }

  if (message.type === "audio") {
    return "[Voice note received]";
  }

  if (message.type === "video") {
    const caption =
      message.video?.caption?.trim();

    return caption
      ? `[Video] ${caption}`
      : "[Video received]";
  }

  if (message.type === "location") {
    const name =
      message.location?.name?.trim();

    const address =
      message.location?.address?.trim();

    if (name && address) {
      return `[Location] ${name} — ${address}`;
    }

    if (name) {
      return `[Location] ${name}`;
    }

    if (address) {
      return `[Location] ${address}`;
    }

    return "[Location received]";
  }

  return `[Unsupported WhatsApp message type: ${
    message.type || "unknown"
  }]`;
}

/* ==========================================================================
   CONTACT PROFILE
========================================================================== */

function getContactProfileName(
  contacts: WhatsAppContact[],
  phoneNumber: string,
): string | null {
  const contact = contacts.find(
    (item) => {
      const contactNumber =
        normalizePhoneNumber(
          item.wa_id || "",
        );

      return (
        contactNumber === phoneNumber
      );
    },
  );

  return (
    contact?.profile?.name?.trim() ||
    null
  );
}

/* ==========================================================================
   WEBHOOK CONTROLLER
========================================================================== */

/**
 * POST /api/whatsapp/webhook
 *
 * Receives WhatsApp events from Meta.
 */
export async function handleWhatsAppWebhook(
  req: any,
  res: any,
): Promise<void> {
  try {
    const payload =
      req.body as WhatsAppWebhookPayload;

    console.info(
      "[WhatsApp Webhook Received]",
      {
        object: payload?.object,
        entryCount:
          Array.isArray(payload?.entry)
            ? payload.entry.length
            : 0,
      },
    );

    /*
     * Ignore non-WhatsApp webhook events.
     */
    if (
      payload?.object !==
      "whatsapp_business_account"
    ) {
      console.warn(
        "[WhatsApp Webhook Ignored] Unexpected webhook object.",
        {
          object: payload?.object,
        },
      );

      res.sendStatus(200);
      return;
    }

    const entries = Array.isArray(
      payload.entry,
    )
      ? payload.entry
      : [];

    for (const entry of entries) {
      const changes = Array.isArray(
        entry.changes,
      )
        ? entry.changes
        : [];

      for (const change of changes) {
        if (change.field !== "messages") {
          console.info(
            "[WhatsApp Webhook Ignored] Unsupported event field.",
            {
              field: change.field,
            },
          );

          continue;
        }

        const value = change.value;

        if (!value) {
          continue;
        }

        const contacts = Array.isArray(
          value.contacts,
        )
          ? value.contacts
          : [];

        const incomingMessages =
          Array.isArray(
            value.messages,
          )
            ? value.messages
            : [];

        const statuses =
          Array.isArray(
            value.statuses,
          )
            ? value.statuses
            : [];

        /*
         * Delivery/read status events.
         */
        for (const status of statuses) {
          console.info(
            "[WhatsApp Message Status Update]",
            {
              whatsappMessageId:
                status.id,
              status:
                status.status,
              recipientPhone:
                status.recipient_id,
              error:
                status.errors?.[0]
                  ?.error_data
                  ?.details ||
                status.errors?.[0]
                  ?.message ||
                null,
            },
          );
        }

        /*
         * Patient messages.
         */
        for (const incomingMessage of incomingMessages) {
          const senderPhoneRaw =
            incomingMessage.from?.trim();

          const whatsappMessageId =
            incomingMessage.id?.trim();

          const messageType =
            incomingMessage.type ||
            "unknown";

          if (!senderPhoneRaw) {
            console.warn(
              "[WhatsApp Incoming Message Ignored] Missing sender phone number.",
              {
                whatsappMessageId,
                messageType,
              },
            );

            continue;
          }

          const senderPhone =
            normalizePhoneNumber(
              senderPhoneRaw,
            );

          if (!senderPhone) {
            console.warn(
              "[WhatsApp Incoming Message Ignored] Invalid sender phone number.",
              {
                senderPhoneRaw,
                whatsappMessageId,
              },
            );

            continue;
          }

          const messageBody =
            getMessageBody(
              incomingMessage,
            );

          if (!messageBody) {
            console.warn(
              "[WhatsApp Incoming Message Ignored] Empty message body.",
              {
                senderPhoneLast4:
                  senderPhone.slice(-4),
                whatsappMessageId,
                messageType,
              },
            );

            continue;
          }

          const sentAt =
            getWebhookMessageDate(
              incomingMessage.timestamp,
            );

          /*
           * Strong duplicate protection using Meta's
           * WhatsApp message ID.
           */
          if (whatsappMessageId) {
            const alreadyProcessed =
              await prisma.messageLog.findUnique(
                {
                  where: {
                    whatsappMessageId,
                  },
                  select: {
                    id: true,
                  },
                },
              );

            if (alreadyProcessed) {
              console.info(
                "[WhatsApp Duplicate Event Ignored]",
                {
                  whatsappMessageId,
                },
              );

              continue;
            }
          }

          const profileName =
            getContactProfileName(
              contacts,
              senderPhone,
            );

          console.info(
            "[WhatsApp Incoming Message]",
            {
              senderPhoneLast4:
                senderPhone.slice(-4),
              whatsappMessageId,
              messageType,
              profileName,
              messageBody,
            },
          );

          /*
           * Find patient using normalized international
           * WhatsApp phone number.
           */
          let patient =
            await prisma.patient.findFirst({
              where: {
                phoneNumber:
                  senderPhone,
              },
              select: {
                id: true,
                phoneNumber: true,
                chatStatus: true,
                assignedTo: true,
                fullName: true,
              },
            });

          /*
           * Create first-time patient.
           */
          if (!patient) {
            patient =
              await prisma.patient.create({
                data: {
                  phoneNumber:
                    senderPhone,
                  chatStatus:
                    "PENDING_AGENT",
                },
                select: {
                  id: true,
                  phoneNumber: true,
                  chatStatus: true,
                  assignedTo: true,
                  fullName: true,
                },
              });

            console.info(
              "[WhatsApp New Patient Created]",
              {
                patientId:
                  patient.id,
                phoneLast4:
                  senderPhone.slice(-4),
                profileName,
              },
            );
          }

          /*
           * Detect patient name from:
           * 1. Existing DB name
           * 2. "My name is..."
           * 3. WhatsApp profile name
           */
          const storedName =
            isUsablePatientName(
              patient.fullName,
            )
              ? patient.fullName
              : null;

          const profileNameCandidate =
            isUsablePatientName(
              profileName,
            )
              ? profileName
              : null;

          const messageName =
            extractPatientName(
              messageBody,
            );

          const detectedName =
            storedName ||
            messageName ||
            profileNameCandidate;

          if (
            detectedName &&
            detectedName !==
              patient.fullName
          ) {
            patient =
              await prisma.patient.update(
                {
                  where: {
                    id: patient.id,
                  },
                  data: {
                    fullName:
                      detectedName,
                  },
                  select: {
                    id: true,
                    phoneNumber: true,
                    chatStatus: true,
                    assignedTo: true,
                    fullName: true,
                  },
                },
              );
          }

          /*
           * Prevent duplicate patient messages when Meta
           * retries an event without a usable message ID.
           */
          const duplicateWindowEnd =
            new Date(
              sentAt.getTime() + 60_000,
            );

          const duplicateWindowStart =
            new Date(
              sentAt.getTime() - 60_000,
            );

          const duplicateMessage =
            await prisma.messageLog.findFirst(
              {
                where: {
                  patientId:
                    patient.id,
                  sender:
                    "PATIENT",
                  body:
                    messageBody,
                  timestamp: {
                    gte:
                      duplicateWindowStart,
                    lte:
                      duplicateWindowEnd,
                  },
                },
                select: {
                  id: true,
                },
              },
            );

          if (duplicateMessage) {
            console.info(
              "[WhatsApp Incoming Message Duplicate Ignored]",
              {
                patientId:
                  patient.id,
                duplicateMessageLogId:
                  duplicateMessage.id,
                whatsappMessageId,
              },
            );

            continue;
          }

          /*
           * Save incoming patient message.
           *
           * This is what makes the message available to:
           *
           * GET /api/agent/chats
           */
          const [
            savedMessage,
            updatedPatient,
          ] = await prisma.$transaction([
            prisma.messageLog.create({
              data: {
                patientId:
                  patient.id,
                sender:
                  "PATIENT",
                body:
                  messageBody,
                whatsappMessageId:
                  whatsappMessageId ||
                  undefined,
                timestamp:
                  sentAt,
              },
            }),

            prisma.patient.update({
              where: {
                id: patient.id,
              },
              data: {
                /*
                 * Do not steal a conversation already
                 * actively assigned to a human agent.
                 */
                chatStatus:
                  patient.chatStatus ===
                  "AGENT_ACTIVE"
                    ? "AGENT_ACTIVE"
                    : "PENDING_AGENT",
              },
              select: {
                id: true,
                phoneNumber: true,
                chatStatus: true,
                assignedTo: true,
              },
            }),
          ]);

          console.info(
            "[WhatsApp Incoming Message Saved]",
            {
              patientId:
                updatedPatient.id,
              messageLogId:
                savedMessage.id,
              senderPhoneLast4:
                senderPhone.slice(-4),
              whatsappMessageId,
              messageType,
              chatStatus:
                updatedPatient.chatStatus,
              assignedTo:
                updatedPatient.assignedTo,
            },
          );

          /*
           * Bot processing is intentionally AFTER the
           * incoming message has been persisted.
           */
          await sendBotReply(
            {
              id:
                patient.id,
              phoneNumber:
                patient.phoneNumber,
              fullName:
                patient.fullName ||
                detectedName ||
                null,
              chatStatus:
                patient.chatStatus,
              assignedTo:
                patient.assignedTo,
            },
            messageBody,
          );
        }
      }
    }

    /*
     * Meta expects HTTP 200.
     */
    res.sendStatus(200);
  } catch (error) {
    console.error(
      "[WhatsApp Webhook Controller Error]",
      error instanceof Error
        ? error.stack ||
          error.message
        : error,
    );

    /*
     * Returning 500 tells Meta that processing failed,
     * allowing Meta to retry the webhook.
     */
    res.status(500).json({
      success: false,
      error:
        "Unable to process incoming WhatsApp webhook event.",
    });
  }
}