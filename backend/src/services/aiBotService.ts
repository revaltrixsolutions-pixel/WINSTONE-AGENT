import { hospitalKnowledge, searchKnowledgeBase } from "../knowledge/hospitalData.js";

/* =========================================================
   CONFIG
========================================================= */

export const CONVERSATION_MEMORY_MINUTES = 3;

const sessions = new Map<string, PatientSession>();

/* =========================================================
   TYPES
========================================================= */

export type BotReplyInput = {
  patientId?: string;
  patientName?: string | null;
  message: string;
  isReturning?: boolean;
  lastInteractionHours?: number;
};

export type AppointmentRequestData = {
  date?: string;
  time?: string;
  department?: string;
  ready: boolean;
};

export type PatientSession = {
  patientName: string | null;
  lastInteraction: number;
  stage:
    | "awaiting_name"
    | "menu"
    | "collecting_appointment"
    | "confirming_appointment"
    | "human_handoff";
  appointment: Partial<AppointmentRequestData>;
};

export type AppointmentConversationState = {
  patientName: string;
  appointment: Partial<AppointmentRequestData>;
  completed: boolean;
  prompt: string;
  data: Partial<AppointmentRequestData> | null;
  awaitingConfirmation: boolean;
};

export const appointmentConversationState =
  new Map<string, AppointmentConversationState>();

/* =========================================================
   SERVICE PRICES
========================================================= */

export const appointmentServiceOptions: string[] = [
  "Maternity",
  "Pediatrics",
  "Emergency",
  "Laboratory",
  "Pharmacy",
  "Radiology",
  "Dental",
  "Optical",
  "Physiotherapy",
];

export function getServicePrice(department?: string): string {
  if (!department) return "0";

  const prices: Record<string, string> = {
    Maternity: "0",
    Pediatrics: "0",
    Emergency: "0",
    Laboratory: "0",
    Pharmacy: "0",
    Radiology: "0",
    Dental: "0",
    Optical: "0",
    Physiotherapy: "0",
  };

  const key = Object.keys(prices).find(
    (item) => item.toLowerCase() === department.toLowerCase(),
  );

  return key ? prices[key] : "0";
}

/* =========================================================
   CONVERSATION MEMORY
========================================================= */

export function isConversationStale(lastInteractionHours: number): boolean {
  return lastInteractionHours * 60 >= CONVERSATION_MEMORY_MINUTES;
}

export function resetPatientSession(patientId: string): void {
  sessions.delete(patientId);
  appointmentConversationState.delete(patientId);
}

export function getPatientSession(patientId: string): PatientSession | null {
  return sessions.get(patientId) || null;
}

export function getPatientSessionSnapshot(
  patientId: string,
): PatientSession | null {
  const session = sessions.get(patientId);

  if (!session) return null;

  return {
    ...session,
    appointment: { ...session.appointment },
  };
}

/* =========================================================
   NAME HANDLING
========================================================= */

const INVALID_NAMES = new Set([
  "assign",
  "patient",
  "user",
  "admin",
  "doctor",
  "nurse",
  "staff",
  "hello",
  "hi",
  "hey",
  "yes",
  "no",
  "okay",
  "ok",
]);

export function isUsablePatientName(name?: string | null): boolean {
  if (!name) return false;

  const cleaned = name.trim();

  if (cleaned.length < 2 || cleaned.length > 80) return false;

  if (INVALID_NAMES.has(cleaned.toLowerCase())) return false;

  if (!/[a-zA-Z]/.test(cleaned)) return false;

  return true;
}

export function extractPatientName(message: string): string | null {
  const text = message.trim();

  const patterns = [
    /\bmy name is\s+([a-zA-Z][a-zA-Z .'-]{1,70})/i,
    /\bmy full name is\s+([a-zA-Z][a-zA-Z .'-]{1,70})/i,
    /\bi am\s+([a-zA-Z][a-zA-Z .'-]{1,70})/i,
    /\bi'm\s+([a-zA-Z][a-zA-Z .'-]{1,70})/i,
    /\bthis is\s+([a-zA-Z][a-zA-Z .'-]{1,70})/i,
    /\bcall me\s+([a-zA-Z][a-zA-Z .'-]{1,70})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (!match?.[1]) continue;

    const name = match[1]
      .replace(/[.!?,;:]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (isUsablePatientName(name)) {
      return name;
    }
  }

  return null;
}

/* =========================================================
   HUMAN SUPPORT
========================================================= */

export function isHumanSupportRequest(message: string): boolean {
  const text = message.toLowerCase();

  return (
    /\bhuman\b/.test(text) ||
    /\breal person\b/.test(text) ||
    /\bstaff\b/.test(text) ||
    /\breception\b/.test(text) ||
    /\breceptionist\b/.test(text) ||
    /\btalk to (a )?(person|doctor|nurse)\b/.test(text) ||
    /\bspeak to (a )?(person|doctor|nurse)\b/.test(text) ||
    /\bagent\b/.test(text) ||
    /\bsomeone\b/.test(text)
  );
}

/* =========================================================
   DEPARTMENT PARSING
========================================================= */

const DEPARTMENTS: Array<{
  name: string;
  patterns: RegExp[];
}> = [
  {
    name: "Maternity",
    patterns: [
      /\bmaternity\b/i,
      /\bobstetrics\b/i,
      /\bobgyn\b/i,
      /\bantenatal\b/i,
      /\bdelivery\b/i,
      /\blabou?r\b/i,
    ],
  },
  {
    name: "Pediatrics",
    patterns: [
      /\bpediatrics\b/i,
      /\bpaediatrics\b/i,
      /\bpediatric\b/i,
      /\bpaediatric\b/i,
      /\bchild\b/i,
      /\bchildren\b/i,
    ],
  },
  {
    name: "Emergency",
    patterns: [
      /\bemergency\b/i,
      /\bambulance\b/i,
      /\baccident\b/i,
      /\btrauma\b/i,
      /\bcasualty\b/i,
    ],
  },
  {
    name: "Laboratory",
    patterns: [
      /\blaboratory\b/i,
      /\blab\b/i,
      /\btests?\b/i,
      /\bblood test\b/i,
    ],
  },
  {
    name: "Pharmacy",
    patterns: [
      /\bpharmacy\b/i,
      /\bmedicine(s)?\b/i,
      /\bdrugs?\b/i,
      /\bprescription\b/i,
    ],
  },
  {
    name: "Radiology",
    patterns: [
      /\bradiology\b/i,
      /\bx[- ]?ray\b/i,
      /\bscan\b/i,
      /\bultrasound\b/i,
      /\bct scan\b/i,
      /\bmri\b/i,
    ],
  },
  {
    name: "Dental",
    patterns: [/\bdental\b/i, /\bdentist\b/i, /\bteeth\b/i],
  },
  {
    name: "Optical",
    patterns: [
      /\boptical\b/i,
      /\beye\b/i,
      /\beyes\b/i,
      /\bophthalmology\b/i,
      /\boptician\b/i,
    ],
  },
  {
    name: "Physiotherapy",
    patterns: [
      /\bphysiotherapy\b/i,
      /\bphysio\b/i,
      /\brehab\b/i,
      /\brehabilitation\b/i,
    ],
  },
];

function extractDepartment(message: string): string | undefined {
  for (const department of DEPARTMENTS) {
    if (department.patterns.some((pattern) => pattern.test(message))) {
      return department.name;
    }
  }

  return undefined;
}

/* =========================================================
   DATE PARSING
========================================================= */

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function parseDateFromMessage(message: string): string | undefined {
  const text = message.toLowerCase();

  const now = new Date();

  if (/\btoday\b/.test(text)) {
    return formatDate(startOfDay(now));
  }

  if (/\btomorrow\b/.test(text)) {
    return formatDate(startOfDay(addDays(now, 1)));
  }

  if (/\bday after tomorrow\b/.test(text)) {
    return formatDate(startOfDay(addDays(now, 2)));
  }

  const weekdays: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  for (const [day, targetDay] of Object.entries(weekdays)) {
    if (new RegExp(`\\b${day}\\b`, "i").test(text)) {
      const currentDay = now.getDay();
      let diff = targetDay - currentDay;

      if (diff <= 0) diff += 7;

      if (/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(text)) {
        diff += 7;
      }

      return formatDate(startOfDay(addDays(now, diff)));
    }
  }

  const slashDate = text.match(
    /\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/,
  );

  if (slashDate) {
    const day = Number(slashDate[1]);
    const month = Number(slashDate[2]) - 1;

    let year = slashDate[3]
      ? Number(slashDate[3])
      : now.getFullYear();

    if (year < 100) year += 2000;

    const parsed = new Date(year, month, day);

    if (
      parsed.getFullYear() === year &&
      parsed.getMonth() === month &&
      parsed.getDate() === day
    ) {
      return formatDate(parsed);
    }
  }

  const monthNames: Record<string, number> = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };

  const monthMatch = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(\d{4}))?\b/i,
  );

  if (monthMatch) {
    const day = Number(monthMatch[1]);
    const month = monthNames[monthMatch[2].toLowerCase()];
    const year = monthMatch[3]
      ? Number(monthMatch[3])
      : now.getFullYear();

    const parsed = new Date(year, month, day);

    if (
      parsed.getFullYear() === year &&
      parsed.getMonth() === month &&
      parsed.getDate() === day
    ) {
      return formatDate(parsed);
    }
  }

  return undefined;
}

/* =========================================================
   TIME PARSING
========================================================= */

function normalizeTime(hour: number, minute: number, suffix?: string): string | undefined {
  let h = hour;

  if (suffix) {
    const normalized = suffix.toLowerCase();

    if (h < 1 || h > 12) return undefined;

    if (normalized === "am") {
      if (h === 12) h = 0;
    } else if (normalized === "pm") {
      if (h !== 12) h += 12;
    }
  } else {
    if (h < 0 || h > 23) return undefined;
  }

  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${
    h >= 12 ? "PM" : "AM"
  }`;
}

function parseTimeFromMessage(message: string): string | undefined {
  const text = message.toLowerCase();

  if (/\bmidnight\b/.test(text)) {
    return "12:00 AM";
  }

  if (/\bnoon\b/.test(text)) {
    return "12:00 PM";
  }

  const explicit = text.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
  );

  if (explicit) {
    return normalizeTime(
      Number(explicit[1]),
      Number(explicit[2] || 0),
      explicit[3],
    );
  }

  const twentyFourHour = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);

  if (twentyFourHour) {
    return normalizeTime(
      Number(twentyFourHour[1]),
      Number(twentyFourHour[2]),
    );
  }

  const bareHour = text.match(
    /\b(?:at|around|by)\s+([01]?\d|2[0-3])\b/i,
  );

  if (bareHour) {
    return normalizeTime(Number(bareHour[1]), 0);
  }

  return undefined;
}

/* =========================================================
   APPOINTMENT PARSER
========================================================= */

export function parseAppointmentRequest(
  message: string,
): AppointmentRequestData {
  const date = parseDateFromMessage(message);
  const time = parseTimeFromMessage(message);
  const department = extractDepartment(message);

  return {
    date,
    time,
    department,
    ready: Boolean(date && time && department),
  };
}

export function generateAppointmentCollectionPrompt(
  patientName: string,
  appointment: Partial<AppointmentRequestData>,
): string {
  const missing: string[] = [];

  if (!appointment.department) missing.push("department");
  if (!appointment.date) missing.push("date");
  if (!appointment.time) missing.push("time");

  if (missing.length === 0) {
    return `Thank you, ${patientName}. Please confirm your appointment details.`;
  }

  if (missing.length === 1) {
    if (missing[0] === "department") {
      return (
        `Thank you, ${patientName}. I have your preferred date and time. ` +
        `What department or service would you like for your appointment? ` +
        `Your appointment date and time will be confirmed after you select the department.`
      );
    }

    return `Thank you, ${patientName}. What is the ${missing[0]} you would like for your appointment?`;
  }

  if (missing.length === 2) {
    return `Thank you, ${patientName}. Please provide the ${missing[0]} and ${missing[1]} for your appointment, including the preferred date or time where applicable.`;
  }

  return `Sure, ${patientName}. I can help you book an appointment. Please provide the department, preferred date, and preferred time.`;
}

/* =========================================================
   APPOINTMENT CONVERSATION STATE
========================================================= */

export function updateAppointmentConversation(
  patientId: string,
  patientName: string,
  message: string,
): AppointmentConversationState {
  const existing = appointmentConversationState.get(patientId);
  const parsed = parseAppointmentRequest(message);

  const appointment: Partial<AppointmentRequestData> = {
    ...(existing?.appointment || {}),
    ...(parsed.date ? { date: parsed.date } : {}),
    ...(parsed.time ? { time: parsed.time } : {}),
    ...(parsed.department ? { department: parsed.department } : {}),
  };

  const completed = Boolean(
    appointment.date &&
      appointment.time &&
      appointment.department,
  );

  let prompt: string;
  let awaitingConfirmation = false;

  if (!completed) {
    prompt = generateAppointmentCollectionPrompt(
      patientName,
      appointment,
    );
  } else {
    prompt =
      `Thank you, ${patientName}. I have your appointment request as follows:\n\n` +
      `• Department: ${appointment.department}\n` +
      `• Date: ${appointment.date}\n` +
      `• Time: ${appointment.time}\n\n` +
      `Is this correct? Please reply Yes to confirm or No to make changes.`;

    awaitingConfirmation = true;
  }

  const state: AppointmentConversationState = {
    patientName,
    appointment,
    completed,
    prompt,
    data: appointment,
    awaitingConfirmation,
  };

  appointmentConversationState.set(patientId, state);

  return state;
}

/* =========================================================
   KENYA GREETING
========================================================= */

export function getKenyaGreeting(date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-KE", {
      timeZone: "Africa/Nairobi",
      hour: "numeric",
      hour12: false,
    }).format(date),
  );

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";

  return "Good evening";
}

/* =========================================================
   BOT RESPONSES
========================================================= */

const NAME_PROMPT =
  "Welcome to Phadam Hospital. Before we continue, please tell me your full name. What is your name?";

const MENU_PROMPT = (name: string) =>
  `${getKenyaGreeting()}, ${name}. How may I help you today? You can ask about our services, prices, location, SHA/insurance, book an appointment, or request our staff.`;

function isGreeting(message: string): boolean {
  return /^(hi|hello|hey|good morning|good afternoon|good evening|mambo|sasa|habari)\b/i.test(
    message.trim(),
  );
}

function isBookingIntent(message: string): boolean {
  return (
    /\bbook\b/i.test(message) ||
    /\bbooking\b/i.test(message) ||
    /\bappointment\b/i.test(message) ||
    /\bschedule\b/i.test(message) ||
    /\bsee a doctor\b/i.test(message) ||
    /\bvisit\b/i.test(message)
  );
}

function answerKnowledgeBase(
  name: string,
  message: string,
): string | null {
  try {
    const result = searchKnowledgeBase(message);

    if (!result) return null;

    if (typeof result === "string") {
      if (/\bsha\b|\binsurance\b|\bmedical cover\b/i.test(message)) {
        return `Yes, ${name}. ${result}\n\nPhadam Hospital is located in Kenya. Please confirm eligibility and preauthorization requirements before treatment.`;
      }

      return `Yes, ${name}. ${result}`;
    }

    if (typeof result === "object" && result !== null) {
      const answer = (result as { answer?: unknown }).answer;

      if (typeof answer === "string") {
        return `Yes, ${name}. ${answer}`;
      }
    }
  } catch {
    // Fall through to the safe response below.
  }

  const text = message.toLowerCase();

  if (/\bsha\b|\binsurance\b|\bmedical cover\b/.test(text)) {
    return `Yes, ${name}. Phadam Hospital accepts SHA/insurance services. The hospital is located in Kenya, and our staff can guide you on eligibility and the required process.`;
  }

  if (/\blocation\b|\bwhere are you\b|\baddress\b|\blocated\b/.test(text)) {
    return `Yes, ${name}. Phadam Hospital is located in Kenya. Our reception team can provide the exact location and directions.`;
  }

  if (/\bprice\b|\bcost\b|\bcharges\b|\bfee\b|\bhow much\b/.test(text)) {
    return `Yes, ${name}. Please tell me the specific service you need and I can help you with the available service information.`;
  }

  if (/\bservices?\b|\btreat\b|\bdepartment\b/.test(text)) {
    return `Yes, ${name}. We can help with our hospital services and departments. Tell me what service you need, or I can connect you with our staff.`;
  }

  if (/\bemergency\b|\bambulance\b/.test(text)) {
    return `If this is an emergency, ${name}, please contact the hospital emergency team immediately or go to the nearest emergency department.`;
  }

  if (/\bhours?\b|\bopen\b|\bclosing\b/.test(text)) {
    return `Our staff can confirm the current operating hours for you, ${name}.`;
  }

  return null;
}

export function generateBotReply(input: BotReplyInput): string {
  const message = input.message.trim();

  /*
   * Legacy/test mode:
   * When no patientId is supplied, patientName is allowed to seed
   * a temporary session so existing unit tests and integrations work.
   */
  if (!input.patientId) {
    if (!input.patientName) {
      if (!message) return NAME_PROMPT;

      const extracted = extractPatientName(message);

      if (!extracted) {
        return NAME_PROMPT;
      }

      return MENU_PROMPT(extracted);
    }

    const name = input.patientName;

    if (isHumanSupportRequest(message)) {
      return `Of course, ${name}. I can help connect you with our staff. Please wait while your request is directed to the hospital team.`;
    }

    if (isGreeting(message)) {
      if (input.isReturning) {
        return `Welcome back, ${name}. ${MENU_PROMPT(name)}`;
      }

      return MENU_PROMPT(name);
    }

    if (isBookingIntent(message)) {
      const parsed = parseAppointmentRequest(message);

      if (!parsed.ready) {
        return generateAppointmentCollectionPrompt(name, parsed);
      }

      return (
        `Sure, ${name}. I have your appointment request for ` +
        `${parsed.department} on ${parsed.date} at ${parsed.time}. ` +
        `Please confirm these details.`
      );
    }

    return (
      answerKnowledgeBase(name, message) ||
      `I'm sorry, ${name}. I don't have enough information to answer that. Would you like me to connect you with a doctor or our hospital staff?`
    );
  }

  /* =======================================================
     PRODUCTION SESSION MODE
  ======================================================= */

  const patientId = input.patientId;
  const now = Date.now();

  let session = sessions.get(patientId);

  if (
    session &&
    now - session.lastInteraction >
      CONVERSATION_MEMORY_MINUTES * 60 * 1000
  ) {
    sessions.delete(patientId);
    appointmentConversationState.delete(patientId);
    session = undefined;
  }

  if (!session) {
    session = {
      patientName: null,
      lastInteraction: now,
      stage: "awaiting_name",
      appointment: {},
    };

    sessions.set(patientId, session);
  }

  session.lastInteraction = now;

  if (session.stage === "awaiting_name") {
    const extracted = extractPatientName(message);

    if (!extracted) {
      return NAME_PROMPT;
    }

    session.patientName = extracted;
    session.stage = "menu";

    return MENU_PROMPT(extracted);
  }

  const name = session.patientName || "there";

  if (isHumanSupportRequest(message)) {
    session.stage = "human_handoff";

    return `Of course, ${name}. I will direct your request to our hospital staff. Please wait for assistance.`;
  }

  if (
    session.stage === "human_handoff" &&
    !isGreeting(message)
  ) {
    return `Your request has been directed to our staff, ${name}. Please wait for assistance.`;
  }

  if (isGreeting(message)) {
    session.stage = "menu";

    if (input.isReturning) {
      return `Welcome back, ${name}. ${MENU_PROMPT(name)}`;
    }

    return MENU_PROMPT(name);
  }

  const parsed = parseAppointmentRequest(message);

  if (
    session.stage === "collecting_appointment" ||
    isBookingIntent(message) ||
    parsed.date ||
    parsed.time ||
    parsed.department
  ) {
    session.stage = "collecting_appointment";

    const appointment = {
      ...session.appointment,
      ...(parsed.date ? { date: parsed.date } : {}),
      ...(parsed.time ? { time: parsed.time } : {}),
      ...(parsed.department
        ? { department: parsed.department }
        : {}),
    };

    session.appointment = appointment;

    if (!appointment.date || !appointment.time || !appointment.department) {
      return generateAppointmentCollectionPrompt(
        name,
        appointment,
      );
    }

    session.stage = "confirming_appointment";

    return (
      `Thank you, ${name}. I have your appointment request as follows:\n\n` +
      `• Department: ${appointment.department}\n` +
      `• Date: ${appointment.date}\n` +
      `• Time: ${appointment.time}\n\n` +
      `Is this correct? Please reply Yes to confirm or No to make changes.`
    );
  }

  if (session.stage === "confirming_appointment") {
    if (/^(yes|yeah|yep|correct|confirm|confirmed|okay|ok)$/i.test(message)) {
      session.stage = "menu";

      return `Thank you, ${name}. Your appointment request has been confirmed and will be sent to the hospital team for processing.`;
    }

    if (/^(no|nope|change|edit|wrong)$/i.test(message)) {
      session.stage = "collecting_appointment";
      session.appointment = {};

      return generateAppointmentCollectionPrompt(
        name,
        session.appointment,
      );
    }
  }

  const answer = answerKnowledgeBase(name, message);

  if (answer) {
    return answer;
  }

  return (
    `I'm sorry, ${name}. I don't have enough information to answer that accurately. ` +
    `Would you like me to connect you with a doctor or our hospital staff?`
  );
}
