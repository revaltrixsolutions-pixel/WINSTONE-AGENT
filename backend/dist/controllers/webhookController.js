"use strict";

// backend/src/controllers/webhookController.ts

import { prisma } from "../lib/prisma.js";

import {
  appointmentServiceOptions,
  extractPatientName,
  generateBotReply,
  getKenyaGreeting,
  getServicePrice,
  isConversationStale,
  isHumanSupportRequest,
  isUsablePatientName,
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
   APPOINTMENT SELECTION STATE

   This is intentionally separate from the old AI appointment conversation.

   WhatsApp interactive IDs are authoritative:

   service_xxx
   date_today
   date_tomorrow
   date_next_week
   time_09_00_am

   The booking is created as soon as service + date + time are available.
========================================================================== */

type BookingSelection = {
  service?: string;
  date?: string;
  time?: string;
};

const bookingSelections = new Map<string, BookingSelection>();

/* ==========================================================================
   GENERAL HELPERS
========================================================================== */

function normalizePhoneNumber(phoneNumber: string): string {
  return String(phoneNumber || "").replace(/\D/g, "");
}

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

function formatKenyaDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

async function getLastInteractionHours(
  patientId: string,
): Promise<number> {
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

  return (
    (Date.now() - new Date(lastMessage.timestamp).getTime()) /
    (1000 * 60 * 60)
  );
}

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

function isAppointmentLookupRequest(
  message: string,
): boolean {
  const normalized = String(message || "")
    .toLowerCase()
    .trim();

  return (
    /\b(my|our|the)\b.*\b(appointment|appointments|booking|bookings|visit|visits)\b/i.test(
      normalized,
    ) ||
    /\b(appointment|appointments|booking|bookings|visit|visits)\b.*\b(details|status|when|date|time|schedule|scheduled|confirm|check|see)\b/i.test(
      normalized,
    ) ||
    /\b(when|where|what time)\b.*\b(appointment|visit|doctor|clinic)\b/i.test(
      normalized,
    ) ||
    /\b(scheduled|upcoming|confirmed)\b.*\b(appointment|visit|booking)\b/i.test(
      normalized,
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
    return `${patientName}, I could not find an upcoming appointment under this WhatsApp number. Would you like to book one?`;
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

  return `${getKenyaGreeting()}, ${patientName}.

Here are your upcoming appointment details:

${details}

You can book another appointment anytime by selecting "Book appointment".`;
}

/* ==========================================================================
   DATE/TIME PARSING
========================================================================== */

/**
 * Converts appointment date + time into a real Date.
 *
 * The server is expected to run in a timezone that is compatible with the
 * application's appointment handling. The explicit Kenya calculations below
 * prevent the interactive values from being interpreted as arbitrary strings.
 */
function parseAppointmentDate(
  dateText: string,
  timeText: string,
): Date {
  const normalizedDate = String(dateText || "")
    .toLowerCase()
    .trim();

  const normalizedTime = String(timeText || "")
    .toLowerCase()
    .trim();

  const now = new Date();

  let hour = 9;
  let minute = 0;

  /* ---------------------------------------------------------------
     TIME
  ---------------------------------------------------------------- */

  if (normalizedTime.includes("noon")) {
    hour = 12;
    minute = 0;
  } else if (normalizedTime.includes("midnight")) {
    hour = 0;
    minute = 0;
  } else {
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
  }

  /* ---------------------------------------------------------------
     DATE
  ---------------------------------------------------------------- */

  const dateOnly = new Date(now);

  dateOnly.setHours(0, 0, 0, 0);

  if (
    normalizedDate.includes("today") ||
    normalizedDate === "date_today"
  ) {
    dateOnly.setHours(hour, minute, 0, 0);

    return dateOnly;
  }

  if (
    normalizedDate.includes("tomorrow") ||
    normalizedDate === "date_tomorrow"
  ) {
    dateOnly.setDate(dateOnly.getDate() + 1);
    dateOnly.setHours(hour, minute, 0, 0);

    return dateOnly;
  }

  if (
    normalizedDate.includes("next week") ||
    normalizedDate === "date_next_week"
  ) {
    dateOnly.setDate(dateOnly.getDate() + 7);
    dateOnly.setHours(hour, minute, 0, 0);

    return dateOnly;
  }

  /* ---------------------------------------------------------------
     WEEKDAYS
  ---------------------------------------------------------------- */

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

    dateOnly.setDate(
      dateOnly.getDate() + daysUntil,
    );

    dateOnly.setHours(hour, minute, 0, 0);

    return dateOnly;
  }

  /* ---------------------------------------------------------------
     DD/MM/YYYY
     DD-MM-YYYY
     DD/MM
     DD-MM
  ---------------------------------------------------------------- */

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

    if (
      directDate.getFullYear() === year &&
      directDate.getMonth() === month &&
      directDate.getDate() === day
    ) {
      return directDate;
    }
  }

  /* ---------------------------------------------------------------
     15 September 2026
     15 Sep 2026
     15th September 2026
  ---------------------------------------------------------------- */

  const monthDateMatch = normalizedDate.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)(?:\s+(\d{4}))?\b/i,
  );

  if (monthDateMatch) {
    const day = Number(monthDateMatch[1]);

    const monthNames: Record<string, number> = {
      january: 0,
      jan: 0,

      february: 1,
      feb: 1,

      march: 2,
      mar: 2,

      april: 3,
      apr: 3,

      may: 4,

      june: 5,
      jun: 5,

      july: 6,
      jul: 6,

      august: 7,
      aug: 7,

      september: 8,
      sep: 8,
      sept: 8,

      october: 9,
      oct: 9,

      november: 10,
      nov: 10,

      december: 11,
      dec: 11,
    };

    const month =
      monthNames[
        monthDateMatch[2].toLowerCase()
      ];

    const year = monthDateMatch[3]
      ? Number(monthDateMatch[3])
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

    if (
      directDate.getFullYear() === year &&
      directDate.getMonth() === month &&
      directDate.getDate() === day
    ) {
      return directDate;
    }
  }

  /* ---------------------------------------------------------------
     ISO / normal JavaScript date
  ---------------------------------------------------------------- */

  const directDate = new Date(normalizedDate);

  if (!Number.isNaN(directDate.getTime())) {
    directDate.setHours(hour, minute, 0, 0);

    return directDate;
  }

  /* ---------------------------------------------------------------
     Fallback
  ---------------------------------------------------------------- */

  dateOnly.setHours(hour, minute, 0, 0);

  return dateOnly;
}

/* ==========================================================================
   APPOINTMENT INTENT
========================================================================== */

function isBookAppointmentRequest(
  message: string,
): boolean {
  const normalized = String(message || "")
    .toLowerCase()
    .trim();

  return (
    normalized === "book appointment" ||
    normalized === "appointments" ||
    normalized === "appointment" ||
    normalized === "booking" ||
    normalized === "book" ||
    /\bbook\s+(an?\s+)?appointment\b/i.test(
      normalized,
    ) ||
    /\bschedule\s+(an?\s+)?appointment\b/i.test(
      normalized,
    )
  );
}

function isAppointmentSelection(
  message: string,
): boolean {
  const normalized = String(message || "")
    .toLowerCase()
    .trim();

  return (
    normalized.startsWith("service_") ||
    normalized.startsWith("date_") ||
    normalized.startsWith("time_")
  );
}

/* ==========================================================================
   WHATSAPP APPOINTMENT MENUS
========================================================================== */

function buildServiceMenu() {
  const rows = appointmentServiceOptions
    .map((service) => ({
      id: `service_${service
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")}`,

      title: service.slice(0, 24),

      description:
        `${getServicePrice(service)} + KSh 1,000 consultation`.slice(
          0,
          72,
        ),
    }))
    .slice(0, 10);

  return {
    type: "list",

    body: {
      text:
        "Book your Phadam Hospital appointment.\n\nStep 1 of 3: Select the department or service you need.",
    },

    action: {
      button: "Choose service",

      sections: [
        {
          title: "Hospital services",
          rows,
        },
      ],
    },
  };
}

function buildDateMenu() {
  return {
    type: "list",

    body: {
      text:
        "Step 2 of 3: Select your preferred appointment date.",
    },

    action: {
      button: "Choose date",

      sections: [
        {
          title: "Appointment date",

          rows: [
            {
              id: "date_today",
              title: "Today",
              description: "Book for today",
            },

            {
              id: "date_tomorrow",
              title: "Tomorrow",
              description: "Book for tomorrow",
            },

            {
              id: "date_next_week",
              title: "Next week",
              description: "Book seven days from today",
            },
          ],
        },
      ],
    },
  };
}

function buildTimeMenu() {
  return {
    type: "list",

    body: {
      text:
        "Step 3 of 3: Select your preferred appointment time.",
    },

    action: {
      button: "Choose time",

      sections: [
        {
          title: "Available appointment times",

          rows: [
            {
              id: "time_09_00_am",
              title: "09:00 AM",
            },

            {
              id: "time_11_00_am",
              title: "11:00 AM",
            },

            {
              id: "time_01_00_pm",
              title: "01:00 PM",
            },

            {
              id: "time_03_00_pm",
              title: "03:00 PM",
            },

            {
              id: "time_05_00_pm",
              title: "05:00 PM",
            },
          ],
        },
      ],
    },
  };
}

/* ==========================================================================
   PATIENT MAIN MENU
========================================================================== */

function buildPatientMenu() {
  return {
    type: "list",

    body: {
      text:
        "Welcome to Phadam Hospital. Choose what you need below. You can select an option instead of typing.",
    },

    action: {
      button: "Hospital menu",

      sections: [
        {
          title: "How can we help?",

          rows: [
            {
              id: "menu_appointments",
              title: "Book appointment",
              description:
                "Choose service, date and time",
            },

            {
              id: "menu_scheduled",
              title: "My appointments",
              description:
                "View your scheduled appointments",
            },

            {
              id: "menu_services",
              title: "Our services",
              description:
                "Browse hospital services",
            },

            {
              id: "menu_departments",
              title: "Departments",
              description:
                "View hospital departments",
            },

            {
              id: "menu_locations",
              title: "Locations and contacts",
              description:
                "Find hospital locations",
            },

            {
              id: "menu_prices",
              title: "Prices and fees",
              description:
                "View available prices",
            },

            {
              id: "menu_insurance",
              title: "SHA and insurance",
              description:
                "Check accepted medical covers",
            },

            {
              id: "menu_human",
              title: "Speak to staff",
              description:
                "Request human assistance",
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
      text:
        "Choose a topic and I will show you the exact Phadam Hospital information.",
    },

    action: {
      button: "Choose topic",

      sections: [
        {
          title: "Hospital information",

          rows: [
            {
              id: "menu_services",
              title: "Services",
              description:
                "Clinical and support services",
            },

            {
              id: "menu_departments",
              title: "Departments",
              description:
                "Department information",
            },

            {
              id: "menu_specialists",
              title: "Specialist clinics",
              description:
                "Specialist care options",
            },

            {
              id: "menu_locations",
              title: "Locations",
              description:
                "Branches and contacts",
            },

            {
              id: "menu_prices",
              title: "Prices",
              description:
                "Procedures and fees",
            },

            {
              id: "menu_insurance",
              title: "SHA and insurance",
              description:
                "Accepted medical covers",
            },

            {
              id: "menu_about",
              title: "About Phadam",
              description:
                "Mission and hospital information",
            },

            {
              id: "menu_human",
              title: "Speak to staff",
              description:
                "Request human assistance",
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

function normalizeInteractiveSelection(
  message: string,
): string {
  const normalized = String(message || "")
    .trim();

  const selections: Record<string, string> = {
    menu_appointments: "book appointment",

    menu_scheduled:
      "show my scheduled appointments",

    menu_services:
      "show our services",

    menu_departments:
      "show our departments",

    menu_specialists:
      "show our specialist clinics",

    menu_locations:
      "show our locations and contacts",

    menu_prices:
      "show prices and fees",

    menu_insurance:
      "show SHA and insurance",

    menu_about:
      "show hospital information",

    menu_human:
      "I want to speak to a human staff member",

    date_today: "today",

    date_tomorrow: "tomorrow",

    date_next_week: "next week",
  };

  if (selections[normalized]) {
    return selections[normalized];
  }

  if (
    normalized
      .toLowerCase()
      .startsWith("time_")
  ) {
    return normalized
      .slice("time_".length)
      .replace(/_/g, " ");
  }

  if (
    normalized
      .toLowerCase()
      .startsWith("service_")
  ) {
    return normalized
      .slice("service_".length)
      .replace(/_/g, " ");
  }

  return normalized;
}

/* ==========================================================================
   SAVE BOT MESSAGE
========================================================================== */

async function saveBotMessage(
  patientId: string,
  body: string,
): Promise<void> {
  await prisma.messageLog.create({
    data: {
      patientId,
      sender: "BOT",
      body,
      timestamp: new Date(),
    },
  });
}

/* ==========================================================================
   SEND APPOINTMENT MENU
========================================================================== */

async function sendAppointmentMenu(
  patient: PatientForBot,
): Promise<void> {
  try {
    const menu = buildServiceMenu();

    await sendWhatsAppMessage({
      recipientPhone: patient.phoneNumber,
      interactive: menu,
    });

    await saveBotMessage(
      patient.id,
      menu.body.text,
    );
  } catch (error) {
    console.error(
      "[WhatsApp Appointment Service Menu Failed]",
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

/* ==========================================================================
   START BOOKING
========================================================================== */

async function startAppointmentBooking(
  patient: PatientForBot,
): Promise<void> {
  bookingSelections.set(patient.id, {});

  await sendAppointmentMenu(patient);
}

/* ==========================================================================
   PROCESS APPOINTMENT SELECTION
========================================================================== */

async function processAppointmentSelection(
  patient: PatientForBot,
  rawSelection: string,
): Promise<boolean> {
  const selection = String(rawSelection || "")
    .trim();

  if (!isAppointmentSelection(selection)) {
    return false;
  }

  const selectionLower = selection.toLowerCase();

  let booking =
    bookingSelections.get(patient.id);

  if (!booking) {
    booking = {};
    bookingSelections.set(
      patient.id,
      booking,
    );
  }

  /* ------------------------------------------------------------------
     SERVICE
  ------------------------------------------------------------------ */

  if (
    selectionLower.startsWith("service_")
  ) {
    const service = normalizeInteractiveSelection(
      selection,
    ).trim();

    if (!service) {
      await sendWhatsAppMessage({
        recipientPhone: patient.phoneNumber,
        messageText:
          "Please select a valid hospital service.",
      });

      return true;
    }

    booking.service = service;
    booking.date = undefined;
    booking.time = undefined;

    bookingSelections.set(
      patient.id,
      booking,
    );

    const menu = buildDateMenu();

    await sendWhatsAppMessage({
      recipientPhone: patient.phoneNumber,
      interactive: menu,
    });

    await saveBotMessage(
      patient.id,
      menu.body.text,
    );

    console.info(
      "[WhatsApp Appointment Service Selected]",
      {
        patientId: patient.id,
        service,
      },
    );

    return true;
  }

  /* ------------------------------------------------------------------
     DATE
  ------------------------------------------------------------------ */

  if (
    selectionLower.startsWith("date_")
  ) {
    if (!booking.service) {
      await sendAppointmentMenu(patient);
      return true;
    }

    const date =
      normalizeInteractiveSelection(
        selection,
      ).trim();

    booking.date = date;
    booking.time = undefined;

    bookingSelections.set(
      patient.id,
      booking,
    );

    const menu = buildTimeMenu();

    await sendWhatsAppMessage({
      recipientPhone: patient.phoneNumber,
      interactive: menu,
    });

    await saveBotMessage(
      patient.id,
      menu.body.text,
    );

    console.info(
      "[WhatsApp Appointment Date Selected]",
      {
        patientId: patient.id,
        service: booking.service,
        date,
      },
    );

    return true;
  }

  /* ------------------------------------------------------------------
     TIME
  ------------------------------------------------------------------ */

  if (
    selectionLower.startsWith("time_")
  ) {
    if (
      !booking.service ||
      !booking.date
    ) {
      await sendAppointmentMenu(patient);
      return true;
    }

    const time =
      normalizeInteractiveSelection(
        selection,
      ).trim();

    booking.time = time;

    bookingSelections.set(
      patient.id,
      booking,
    );

    /* ---------------------------------------------------------------
       ALL THREE VALUES NOW EXIST.

       CREATE THE APPOINTMENT IMMEDIATELY.
    ---------------------------------------------------------------- */

    const service =
      booking.service;

    const date =
      booking.date;

    const slotTime =
      parseAppointmentDate(
        date,
        time,
      );

    if (
      Number.isNaN(
        slotTime.getTime(),
      ) ||
      slotTime.getTime() < Date.now()
    ) {
      bookingSelections.delete(
        patient.id,
      );

      const retryText =
        `${patient.fullName || "Patient"}, the selected appointment time is no longer available because it has passed. Please start again and choose a future date and time.`;

      await sendWhatsAppMessage({
        recipientPhone:
          patient.phoneNumber,
        messageText: retryText,
      });

      await saveBotMessage(
        patient.id,
        retryText,
      );

      return true;
    }

    try {
      const appointment =
        await prisma.appointment.create({
          data: {
            patientId:
              patient.id,

            doctorName:
              "To be assigned",

            specialty:
              service,

            servicePrice:
              getServicePrice(service),

            consultationFee:
              "KSh 1,000",

            slotTime,

            status:
              "CONFIRMED",
          },
        });

      const confirmationText =
        [
          `✅ Appointment booked successfully, ${patient.fullName || "Patient"}.`,
          "",
          `Department: ${service}`,
          `Date: ${date}`,
          `Time: ${time}`,
          `Doctor: To be assigned`,
          `Service price: ${getServicePrice(service)}`,
          `Consultation fee: KSh 1,000`,
          `Status: CONFIRMED`,
          `Reference: ${appointment.id.slice(0, 8)}`,
          "",
          "Your appointment has been recorded in the hospital system.",
        ].join("\n");

      await sendWhatsAppMessage({
        recipientPhone:
          patient.phoneNumber,
        messageText:
          confirmationText,
      });

      await saveBotMessage(
        patient.id,
        confirmationText,
      );

      console.info(
        "[WhatsApp Appointment Created Immediately]",
        {
          patientId:
            patient.id,

          appointmentId:
            appointment.id,

          service,

          date,

          time,

          slotTime:
            slotTime.toISOString(),
        },
      );

      bookingSelections.delete(
        patient.id,
      );
    } catch (error) {
      console.error(
        "[WhatsApp Appointment Creation Failed]",
        {
          patientId:
            patient.id,

          service,

          date,

          time,

          error:
            error instanceof Error
              ? error.message
              : error,
        },
      );

      const failureText =
        `${patient.fullName || "Patient"}, I could not complete the appointment booking right now. Please try again or select "Speak to staff".`;

      try {
        await sendWhatsAppMessage({
          recipientPhone:
            patient.phoneNumber,
          messageText:
            failureText,
        });

        await saveBotMessage(
          patient.id,
          failureText,
        );
      } catch (sendError) {
        console.error(
          "[WhatsApp Booking Failure Message Failed]",
          {
            patientId:
              patient.id,

            error:
              sendError instanceof Error
                ? sendError.message
                : sendError,
          },
        );
      }
    }

    return true;
  }

  return false;
}

/* ==========================================================================
   BOT REPLY
========================================================================== */

async function sendBotReply(
  patient: PatientForBot,
  incomingMessage: string,
): Promise<void> {
  const rawMessage =
    String(incomingMessage || "")
      .trim();

  if (!rawMessage) {
    return;
  }

  /* ------------------------------------------------------------------
     HUMAN AGENT ACTIVE
  ------------------------------------------------------------------ */

  if (
    patient.chatStatus ===
    "AGENT_ACTIVE"
  ) {
    const hoursSinceAgentMessage =
      await getLastAgentInteractionHours(
        patient.id,
      );

    if (
      !Number.isFinite(
        hoursSinceAgentMessage,
      ) ||
      hoursSinceAgentMessage <
        3 / 60
    ) {
      console.info(
        "[WhatsApp Bot Suppressed] Chat is actively assigned to staff.",
        {
          patientId:
            patient.id,

          hoursSinceAgentMessage,
        },
      );

      return;
    }
  }

  /* ------------------------------------------------------------------
     NAME
  ------------------------------------------------------------------ */

  const normalizedMessage =
    normalizeInteractiveSelection(
      rawMessage,
    );

  const patientName =
    isUsablePatientName(
      patient.fullName,
    )
      ? patient.fullName
      : extractPatientName(
          normalizedMessage,
        );

  const hasPatientName =
    !!patientName &&
    patientName !== "Patient";

  /* ------------------------------------------------------------------
     APPOINTMENT INTERACTIVE SELECTIONS MUST BE PROCESSED FIRST.
  ------------------------------------------------------------------ */

  if (
    isAppointmentSelection(
      rawMessage,
    )
  ) {
    await processAppointmentSelection(
      patient,
      rawMessage,
    );

    return;
  }

  /* ------------------------------------------------------------------
     BOOK APPOINTMENT
  ------------------------------------------------------------------ */

  if (
    isBookAppointmentRequest(
      normalizedMessage,
    )
  ) {
    await startAppointmentBooking(
      patient,
    );

    return;
  }

  /* ------------------------------------------------------------------
     PATIENT MENU
  ------------------------------------------------------------------ */

  const nameWasJustCaptured =
    (
      patient as PatientForBot & {
        nameWasJustCaptured?: boolean;
      }
    ).nameWasJustCaptured ===
    true;

  if (
    nameWasJustCaptured
  ) {
    const menu =
      buildPatientMenu();

    try {
      await sendWhatsAppMessage({
        recipientPhone:
          patient.phoneNumber,
        interactive:
          menu,
      });

      await saveBotMessage(
        patient.id,
        menu.body.text,
      );
    } catch (error) {
      console.error(
        "[WhatsApp Initial Menu Send Failed]",
        {
          patientId:
            patient.id,

          error:
            error instanceof Error
              ? error.message
              : error,
        },
      );
    }

    return;
  }

  /* ------------------------------------------------------------------
     KNOWLEDGE MENUS
  ------------------------------------------------------------------ */

  if (
    normalizedMessage ===
      "show our services" ||
    normalizedMessage ===
      "show our departments" ||
    normalizedMessage ===
      "show our specialist clinics" ||
    normalizedMessage ===
      "show prices and fees" ||
    normalizedMessage ===
      "show SHA and insurance" ||
    normalizedMessage ===
      "show hospital information"
  ) {
    const menu =
      buildKnowledgeMenu();

    try {
      await sendWhatsAppMessage({
        recipientPhone:
          patient.phoneNumber,
        interactive:
          menu,
      });

      await saveBotMessage(
        patient.id,
        menu.body.text,
      );
    } catch (error) {
      console.error(
        "[WhatsApp Knowledge Menu Send Failed]",
        {
          patientId:
            patient.id,

          error:
            error instanceof Error
              ? error.message
              : error,
        },
      );
    }

    return;
  }

  /* ------------------------------------------------------------------
     APPOINTMENT LOOKUP
  ------------------------------------------------------------------ */

  const appointmentLookupReply =
    hasPatientName
      ? await getAppointmentLookupReply(
          patient.id,
          patientName!,
          normalizedMessage,
        )
      : null;

  if (
    appointmentLookupReply
  ) {
    try {
      await sendWhatsAppMessage({
        recipientPhone:
          patient.phoneNumber,

        messageText:
          appointmentLookupReply,
      });

      await saveBotMessage(
        patient.id,
        appointmentLookupReply,
      );
    } catch (error) {
      console.error(
        "[WhatsApp Appointment Lookup Reply Failed]",
        {
          patientId:
            patient.id,

          error:
            error instanceof Error
              ? error.message
              : error,
        },
      );
    }

    return;
  }

  /* ------------------------------------------------------------------
     HUMAN SUPPORT
  ------------------------------------------------------------------ */

  if (
    isHumanSupportRequest(
      normalizedMessage,
    )
  ) {
    const humanReply =
      hasPatientName
        ? `Thanks, ${patientName}. I have asked our staff to help you. Please briefly describe what you need, and a staff member will introduce themselves here shortly.`
        : "I can connect you with a human staff member. Please reply with your full name and briefly tell me what you need help with.";

    if (hasPatientName) {
      try {
        await prisma.patient.update({
          where: {
            id: patient.id,
          },

          data: {
            chatStatus:
              "PENDING_AGENT",
          },
        });
      } catch (error) {
        console.error(
          "[WhatsApp Human Handoff Status Update Failed]",
          {
            patientId:
              patient.id,

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

        messageText:
          humanReply,
      });

      await saveBotMessage(
        patient.id,
        humanReply,
      );
    } catch (error) {
      console.error(
        "[WhatsApp Human Handoff Reply Failed]",
        {
          patientId:
            patient.id,

          error:
            error instanceof Error
              ? error.message
              : error,
        },
      );
    }

    return;
  }

  /* ------------------------------------------------------------------
     NORMAL AI / KNOWLEDGE RESPONSE
  ------------------------------------------------------------------ */

  const lastInteractionHours =
    await getLastInteractionHours(
      patient.id,
    );

  const replyText =
    generateBotReply({
      patientName:
        patientName || null,

      message:
        normalizedMessage,

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

        messageText:
          replyText,
      });

    await saveBotMessage(
      patient.id,
      replyText,
    );

    console.info(
      "[WhatsApp Auto Reply Sent]",
      {
        patientId:
          patient.id,

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
    if (
      error instanceof
      WhatsAppApiError
    ) {
      console.error(
        "[WhatsApp Auto Reply API Error]",
        {
          patientId:
            patient.id,

          recipientPhone:
            patient.phoneNumber,

          status:
            error.status,

          metaCode:
            error.metaCode,

          metaType:
            error.metaType,

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
        patientId:
          patient.id,

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
  if (
    message.type === "text"
  ) {
    return (
      message.text?.body?.trim() ||
      ""
    );
  }

  if (
    message.type === "button"
  ) {
    return (
      message.button?.payload?.trim() ||
      message.button?.text?.trim() ||
      "[Button response]"
    );
  }

  if (
    message.type ===
    "interactive"
  ) {
    if (
      message.interactive?.type ===
      "button_reply"
    ) {
      return (
        message.interactive
          .button_reply?.id
          ?.trim() ||
        message.interactive
          .button_reply?.title
          ?.trim() ||
        "[Interactive button response]"
      );
    }

    if (
      message.interactive?.type ===
      "list_reply"
    ) {
      return (
        message.interactive
          .list_reply?.id
          ?.trim() ||
        message.interactive
          .list_reply?.title
          ?.trim() ||
        message.interactive
          .list_reply?.description
          ?.trim() ||
        "[Interactive list response]"
      );
    }

    return "[Interactive WhatsApp response]";
  }

  if (
    message.type === "image"
  ) {
    const caption =
      message.image?.caption?.trim();

    return caption
      ? `[Image] ${caption}`
      : "[Image received]";
  }

  if (
    message.type === "document"
  ) {
    const filename =
      message.document?.filename?.trim();

    const caption =
      message.document?.caption?.trim();

    if (
      filename &&
      caption
    ) {
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

  if (
    message.type === "audio"
  ) {
    return "[Voice note received]";
  }

  if (
    message.type === "video"
  ) {
    const caption =
      message.video?.caption?.trim();

    return caption
      ? `[Video] ${caption}`
      : "[Video received]";
  }

  if (
    message.type === "location"
  ) {
    const name =
      message.location?.name?.trim();

    const address =
      message.location?.address?.trim();

    if (
      name &&
      address
    ) {
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
  const contact =
    contacts.find(
      (item) => {
        const contactNumber =
          normalizePhoneNumber(
            item.wa_id || "",
          );

        return (
          contactNumber ===
          phoneNumber
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
        object:
          payload?.object,

        entryCount:
          Array.isArray(
            payload?.entry,
          )
            ? payload.entry.length
            : 0,
      },
    );

    /* ----------------------------------------------------------------
       ONLY WHATSAPP BUSINESS WEBHOOKS
    ---------------------------------------------------------------- */

    if (
      payload?.object !==
      "whatsapp_business_account"
    ) {
      console.warn(
        "[WhatsApp Webhook Ignored] Unexpected webhook object.",
        {
          object:
            payload?.object,
        },
      );

      res.sendStatus(200);
      return;
    }

    const entries =
      Array.isArray(
        payload.entry,
      )
        ? payload.entry
        : [];

    for (
      const entry of entries
    ) {
      const changes =
        Array.isArray(
          entry.changes,
        )
          ? entry.changes
          : [];

      for (
        const change of changes
      ) {
        if (
          change.field !==
          "messages"
        ) {
          console.info(
            "[WhatsApp Webhook Ignored] Unsupported event field.",
            {
              field:
                change.field,
            },
          );

          continue;
        }

        const value =
          change.value;

        if (!value) {
          continue;
        }

        const contacts =
          Array.isArray(
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

        /* ------------------------------------------------------------
           MESSAGE STATUS EVENTS
        ------------------------------------------------------------ */

        for (
          const status of statuses
        ) {
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

        /* ------------------------------------------------------------
           PATIENT MESSAGES
        ------------------------------------------------------------ */

        for (
          const incomingMessage of incomingMessages
        ) {
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

          /* ----------------------------------------------------------
             META DUPLICATE PROTECTION
          ---------------------------------------------------------- */

          if (
            whatsappMessageId
          ) {
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

            if (
              alreadyProcessed
            ) {
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

          /* ----------------------------------------------------------
             FIND PATIENT
          ---------------------------------------------------------- */

          let patient =
            await prisma.patient.findFirst(
              {
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
              },
            );

          /* ----------------------------------------------------------
             CREATE PATIENT IF NEW
          ---------------------------------------------------------- */

          if (!patient) {
            patient =
              await prisma.patient.create(
                {
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
                },
              );

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

          /* ----------------------------------------------------------
             PATIENT NAME DETECTION
          ---------------------------------------------------------- */

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

          /* ----------------------------------------------------------
             SECONDARY DUPLICATE PROTECTION
          ---------------------------------------------------------- */

          const duplicateWindowEnd =
            new Date(
              sentAt.getTime() +
                60_000,
            );

          const duplicateWindowStart =
            new Date(
              sentAt.getTime() -
                60_000,
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

          if (
            duplicateMessage
          ) {
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

          /* ----------------------------------------------------------
             SAVE PATIENT MESSAGE FIRST
          ---------------------------------------------------------- */

          const [
            savedMessage,
            updatedPatient,
          ] =
            await prisma.$transaction(
              [
                prisma.messageLog.create(
                  {
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
                  },
                ),

                prisma.patient.update(
                  {
                    where: {
                      id:
                        patient.id,
                    },

                    data: {
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
                      fullName: true,
                    },
                  },
                ),
              ],
            );

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

          /* ----------------------------------------------------------
             BOT PROCESSING
          ---------------------------------------------------------- */

          await sendBotReply(
            {
              id:
                updatedPatient.id,

              phoneNumber:
                updatedPatient.phoneNumber,

              fullName:
                updatedPatient.fullName,

              chatStatus:
                updatedPatient.chatStatus,

              assignedTo:
                updatedPatient.assignedTo,
            },

            messageBody,
          );
        }
      }
    }

    /* ----------------------------------------------------------------
       META MUST RECEIVE HTTP 200
    ---------------------------------------------------------------- */

    res.sendStatus(200);
  } catch (error) {
    console.error(
      "[WhatsApp Webhook Controller Error]",
      error instanceof Error
        ? error.stack ||
          error.message
        : error,
    );

    res.status(500).json({
      success: false,

      error:
        "Unable to process incoming WhatsApp webhook event.",
    });
  }
}