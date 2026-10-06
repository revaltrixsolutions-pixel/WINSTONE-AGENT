import {
  getKnowledgeSuggestions,
  hospitalKnowledge,
  searchKnowledgeBase,
} from "../knowledge/hospitalData.js";

export const CONVERSATION_MEMORY_MINUTES = 15;

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

export type ConversationStage =
  | "awaiting_name"
  | "menu"
  | "collecting_appointment"
  | "confirming_appointment"
  | "human_handoff";

export type PatientSession = {
  patientName: string | null;
  lastInteraction: number;
  stage: ConversationStage;
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

/**
 * Kept for backward compatibility with any caller that reads this map
 * directly. It is now written as a mirror of `sessions` every time
 * `updateAppointmentConversation` runs, rather than being its own
 * independent store — see the CHANGELOG above for why that mattered.
 */
export const appointmentConversationState =
  new Map<string, AppointmentConversationState>();

/* =========================================================
   BOOKABLE DEPARTMENTS
   Derived from the real hospital knowledge base so the booking
   flow never drifts out of sync with what the hospital actually
   offers. No department name here is invented.
========================================================= */

export const appointmentServiceOptions: string[] = Array.from(
  new Set([
    "General Consultation",
    ...hospitalKnowledge.services,
    ...hospitalKnowledge.specialistClinics,
  ]),
).map((service) => service.trim()).filter(Boolean);

/**
 * Returns the standard consultation-fee quote for a bookable
 * department/service, or null for a department this hospital doesn't
 * take bookings for (or one that isn't a "consultation" in the usual
 * sense, e.g. Pharmacy). This used to unconditionally return null,
 * which is why booking flows were displaying the literal text "null"
 * next to a chosen department. Surgical procedure prices are handled
 * separately via the knowledge base's procedure-price search, since
 * those vary per procedure rather than being a flat fee.
 */
export function getServicePrice(department?: string): string | null {
  if (!department) return null;
  const normalizedDepartment = department.toLowerCase();
  const matchingFee = Object.entries(hospitalKnowledge.bookingFees).find(
    ([service]) => service.toLowerCase() === normalizedDepartment,
  );
  return matchingFee?.[1] ?? null;
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
  "fine",
  "sure",
  "good",
  "great",
  "here",
  "back",
  "done",
  "busy",
]);

// Words that commonly follow "I am" / "I'm" without actually introducing a
// name (e.g. "I'm fine", "I'm not sure", "I'm here for a checkup"). If a
// captured candidate starts with one of these, we treat it as a false
// match rather than a name.
const NON_NAME_LEAD_WORDS = new Set([
  "fine",
  "good",
  "great",
  "okay",
  "ok",
  "ready",
  "here",
  "busy",
  "sick",
  "tired",
  "sorry",
  "sure",
  "done",
  "back",
  "home",
  "waiting",
  "calling",
  "asking",
  "trying",
  "looking",
  "feeling",
  "well",
  "alright",
  "available",
  "free",
  "new",
  "returning",
  "not",
  "still",
  "already",
  "just",
  "also",
]);

export function isUsablePatientName(name?: string | null): boolean {
  if (!name) return false;

  const cleaned = name.trim();

  if (cleaned.length < 2 || cleaned.length > 80) return false;

  if (INVALID_NAMES.has(cleaned.toLowerCase())) return false;

  if (!/[a-zA-Z]/.test(cleaned)) return false;

  return true;
}

function startsWithNonNameWord(name: string): boolean {
  const firstWord = name.trim().split(/\s+/)[0]?.toLowerCase();
  return Boolean(firstWord && NON_NAME_LEAD_WORDS.has(firstWord));
}

export function extractPatientName(message: string): string | null {
  const text = message.trim();

  // Reliable, explicit introductions. Checked first and not subject to
  // the "non-name lead word" filter below.
  const explicitPatterns = [
    /\bmy name is\s+([a-zA-Z][a-zA-Z .'-]{1,70})/i,
    /\bmy full name is\s+([a-zA-Z][a-zA-Z .'-]{1,70})/i,
    /\bthis is\s+([a-zA-Z][a-zA-Z .'-]{1,70})/i,
    /\bcall me\s+([a-zA-Z][a-zA-Z .'-]{1,70})/i,
    /\byou can call me\s+([a-zA-Z][a-zA-Z .'-]{1,70})/i,
    /\bthey call me\s+([a-zA-Z][a-zA-Z .'-]{1,70})/i,
    /\bname\s*[:\-]\s*([a-zA-Z][a-zA-Z .'-]{1,70})/i,
  ];

  for (const pattern of explicitPatterns) {
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

  // Ambiguous introductions ("I am X" / "I'm X"). These frequently pick up
  // non-name phrases ("I'm fine", "I'm not sure"), so we filter those out.
  const ambiguousPatterns = [
    /\bi am\s+([a-zA-Z][a-zA-Z .'-]{1,70})/i,
    /\bi'm\s+([a-zA-Z][a-zA-Z .'-]{1,70})/i,
  ];

  for (const pattern of ambiguousPatterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;

    const name = match[1]
      .replace(/[.!?,;:]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (startsWithNonNameWord(name)) continue;

    if (isUsablePatientName(name)) {
      return name;
    }
  }

  return null;
}

/* =========================================================
   HUMAN SUPPORT
========================================================= */

const HUMAN_SUPPORT_PATTERNS: RegExp[] = [
  /\b(talk|speak|chat)\s+to\s+(a\s+)?(human|real\s+person|person|someone|somebody|staff|receptionist|agent|doctor|nurse)\b/i,
  /\bconnect me (with|to)\s+(a\s+)?(human|person|someone|somebody|staff|agent|receptionist)\b/i,
  /\breal\s+person\b/i,
  /\b(human|live\s+agent|real\s+agent|actual\s+person)\b/i,
  /\b(need|want|request|connect me to)\s+(an?\s+)?(agent|staff|reception|receptionist|doctor|nurse|clinician)\b/i,
  /\b(agent|staff|reception|receptionist)\b.*\b(help|assist|talk|speak|contact|connect|call|chat)\b/i,
  /\b(help|assist|talk|speak|contact|connect|call|chat)\b.*\b(agent|staff|reception|receptionist)\b/i,
  /\b(doctor|nurse|clinician|medical officer)\b.*\b(please|now|available|help|speak|talk|contact|connect|call|chat)\b/i,
  /\b(please|need|want|can i|could i|may i)\b.*\b(doctor|nurse|clinician|medical officer)\b/i,
  /\breceptionist\b/i,
  /\bhuman\s+(agent|support|help|being)\b/i,
  /\b(need|want)\s+(a\s+)?(human|real person|staff member|live agent)\b/i,
  /\btransfer me to (staff|reception|a human)\b/i,
];

export function isHumanSupportRequest(message: string): boolean {
  return HUMAN_SUPPORT_PATTERNS.some((pattern) => pattern.test(message));
}

/* =========================================================
   MEDICAL ADVICE / SYMPTOM REDIRECT

   This bot answers questions about the hospital (services, prices,
   locations, insurance, booking). It does not, and should not, attempt
   to give medical advice, a diagnosis, or treatment/medication guidance
   over chat. Any message that looks like a symptom report or a request
   for medical advice is redirected straight to hospital staff, with
   direct facility contact numbers, instead of being sent through the
   knowledge base or the generic fallback reply.
========================================================= */

const SYMPTOM_PATTERNS: RegExp[] = [
  /\bi feel\b/i,
  /\bi'?m feeling\b/i,
  /\bi have (a |an )?(pain|fever|headache|cough|cold|flu|rash|swelling|dizziness|nausea|infection)\b/i,
  /\bdizzy|dizziness\b/i,
  /\bheadache(s)?\b/i,
  /\bfever(ish)?\b/i,
  /\bvomit(ing)?\b/i,
  /\bnausea(ted)?\b/i,
  /\bpain(ful)?\b/i,
  /\bbleeding\b/i,
  /\bswelling|swollen\b/i,
  /\bsymptom(s)?\b/i,
  /\bunwell\b/i,
  /\b(i'?m|feeling) sick\b/i,
  /\bwhat (can|should) i (do|take)\b/i,
  /\bis it normal (to|that)\b/i,
  /\bshortness of breath|can'?t breathe|difficulty breathing\b/i,
  /\bchest pain\b/i,
  /\bwhat medicine (should|can) i\b/i,
  /\bwhat (drug|dosage|dose) (should|can) i\b/i,
  /\bdiagnos(e|is|ed)\b/i,
  /\brash\b/i,
  /\bstomach ache|stomachache|abdominal pain\b/i,
  /\b(acne|keloid|vitiligo|hair loss|dark spots?|skin tags?|warts?|ingrown nails?)\b/i,
  /\bwhat causes?\b|\bwhy (?:is|are|do|does|am)\b/i,
  /\bwhat treatment\b|\bhow (?:can|do) i treat\b|\bshould i take\b/i,
  /\bdo you (?:treat|diagnose)|\bmedical advice\b/i,
];

const URGENT_SYMPTOM_PATTERNS: RegExp[] = [
  /\bchest pain\b/i,
  /\bcan'?t breathe|difficulty breathing|shortness of breath\b/i,
  /\bunconscious|passed out|fainted|not responding\b/i,
  /\bsevere bleeding|bleeding heavily|heavy bleeding|won'?t stop bleeding\b/i,
  /\bsuicid|self[\s-]?harm\b/i,
  /\bstroke|seizure|convuls/i,
  /\bsevere allergic reaction|anaphyla/i,
  /\bin labou?r\b/i,
];

export function isMedicalSymptomRequest(message: string): boolean {
  return SYMPTOM_PATTERNS.some((pattern) => pattern.test(message));
}

function isSupportedMedicalFaq(message: string): boolean {
  return (
    (/\bdo you treat\b/i.test(message) &&
      /\b(skin|rash|acne|keloid|vitiligo|hair loss|dark spots?|skin tags?|warts?|ingrown nails?)\b/i.test(message)) ||
    (/\bdo you remove\b/i.test(message) &&
      /\b(skin tags?|keloids?|warts?|ingrown nails?)\b/i.test(message)) ||
    /\bskin analysis\b/i.test(message) ||
    /\bwhat causes? (?:the )?dark spots?\b/i.test(message) ||
    /\bwhat causes? acne keloidalis(?: nuchae)?\b/i.test(message)
  );
}

function isUrgentSymptomRequest(message: string): boolean {
  return URGENT_SYMPTOM_PATTERNS.some((pattern) => pattern.test(message));
}

function formatMedicalAdviceRedirect(name: string, message: string): string {
  const contactLines = hospitalKnowledge.locations
    .map((location) => `• ${location.branch}: ${location.phoneNumbers.join(", ")}`)
    .join("\n");

  if (isUrgentSymptomRequest(message)) {
    return (
      `${name}, this sounds urgent. Please call our Emergency line or go to the nearest branch right away — I can't provide emergency medical care over chat.\n\n` +
      `📞 *Emergency Contacts*\n${contactLines}\n\n` +
      `If you or someone with you is in immediate danger, please contact emergency services or go to the nearest hospital now.`
    );
  }

  return (
    'Thank you for your question. For this enquiry, please call the doctor directly on 0708130100 or 0726244040.'
  );
}

/* =========================================================
   CONTROL COMMANDS (cancel / restart / menu)
========================================================= */

function isCancelCommand(message: string): boolean {
  return (
    /^(cancel|stop|never\s?mind|forget it|start over|restart|clear it)\b/i.test(message.trim()) ||
    /\b(cancel|cancelled|cancelling|reschedule|rescheduling|rebook|rebooking|move my appointment|change my appointment|change appointment|remove my booking|drop my booking|cancel my appointment|reschedule my appointment)\b/i.test(message)
  );
}

function isMenuCommand(message: string): boolean {
  const text = message.trim().toLowerCase();

  return /^(menu|main menu|help|options|home|main|start|restart|begin|back)\b/i.test(text) ||
    /\b(main menu|start over|go back|show menu|menu please)\b/i.test(text);
}

/* =========================================================
   DEPARTMENT PARSING
   Every canonical name below comes directly from
   `hospitalKnowledge` (departments + specialistClinics), so the
   parser can never route a patient to a department that doesn't
   actually exist at the hospital.
========================================================= */

const DEPARTMENTS: Array<{ name: string; patterns: RegExp[] }> = [
  {
    name: "Well Baby Clinic",
    patterns: [
      /\bwell[ -]?baby\b/i,
      /\bbaby clinic\b/i,
      /\binfant clinic\b/i,
    ],
  },
  {
    name: "Antenatal Clinic",
    patterns: [
      /\bantenatal\b/i,
      /\bprenatal\b/i,
      /\bantenatal clinic\b/i,
      /\banc\b/i,
      /\bpregnan(t|cy)\b/i,
      /\bmaternity\b/i,
    ],
  },
  {
    name: "Family Planning Services",
    patterns: [/\bfamily planning\b/i, /\bbirth control\b/i, /\bcontraception\b/i],
  },
  {
    name: "Ultrasound Services",
    patterns: [/\bultrasound\b/i, /\bsonography\b/i, /\bpregnancy scan\b/i],
  },
  {
    name: "ECG/ECHO",
    patterns: [/\becg\b/i, /\becho\b/i, /\belectrocardiogram\b/i, /\bechocardiogram\b/i],
  },
  {
    name: "General Consultation",
    patterns: [
      /\b(doctors?|general|routine)\s+consultation\b/i,
      /\bmedical consultation\b/i,
      /\bclinic visit\b/i,
      /\bconsultation visit\b/i,
      /\bsee a doctor\b/i,
      /\bconsultation\b/i,
    ],
  },
  {
    name: "Obstetrics and Gynecology",
    patterns: [
      /\bobstetrics\b/i,
      /\bob[\s-]?gyn\b/i,
      /\bobstetrics\s+and\s+gynecolog/i,
      /\bgynecolog\b/i,
    ],
  },
  {
    name: "Gynecology",
    patterns: [
      /\bgynecology\b/i,
      /\bgynaecology\b/i,
      /\bgynecolog\b/i,
      /\bgynecologist\b/i,
      /\bgynaecologist\b/i,
      /\bwomen'?s health\b/i,
      /\bfertility\b/i,
      /\bpap smear\b/i,
    ],
  },
  {
    name: "Pediatrics",
    patterns: [
      /\bpediatric(s)?\b/i,
      /\bpaediatric(s)?\b/i,
      /\bchild\b/i,
      /\bchildren\b/i,
      /\bkid(s)?\b/i,
      /\bbaby\b/i,
      /\bbabies\b/i,
      /\bimmunization\b/i,
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
      /\bblood test(s)?\b/i,
      /\blab test(s)?\b/i,
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
      /\bx[\s-]?ray\b/i,
      /\bultrasound\b/i,
      /\bct scan\b/i,
      /\bmri\b/i,
      /\bscan\b/i,
    ],
  },
  {
    name: "Dental",
    patterns: [/\bdental\b/i, /\bdentist\b/i, /\bteeth\b/i, /\btooth(ache)?\b/i],
  },
  {
    name: "Optical",
    patterns: [
      /\boptical\b/i,
      /\beye(s)?\b/i,
      /\bophthalmology\b/i,
      /\boptician\b/i,
      /\bvision\b/i,
      /\bglasses\b/i,
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
  {
    name: "Dermatology",
    patterns: [/\bdermatology\b/i, /\bskin\b/i, /\brash\b/i, /\bacne\b/i],
  },
  {
    name: "Orthopedics",
    patterns: [
      /\borthopedic(s)?\b/i,
      /\borthopaedic(s)?\b/i,
      /\bbone(s)?\b/i,
      /\bfracture\b/i,
      /\bjoint(s)?\b/i,
      /\bspine\b/i,
      /\bhip replacement\b/i,
      /\bknee replacement\b/i,
    ],
  },
  {
    name: "Ear, Nose and Throat",
    patterns: [
      /\bent\b/i,
      /\bear(s)?\b/i,
      /\bnose\b/i,
      /\bthroat\b/i,
      /\bsinus\b/i,
      /\btonsil(s)?\b/i,
      /\bhearing\b/i,
    ],
  },
  {
    name: "Psychology and Counselling",
    patterns: [
      /\bpsychology\b/i,
      /\bcounsel(l)?ing\b/i,
      /\bmental health\b/i,
      /\btherapy\b/i,
      /\bdepression\b/i,
      /\banxiety\b/i,
    ],
  },
  {
    name: "Nutrition",
    patterns: [
      /\bnutrition\b/i,
      /\bdiet(ician)?\b/i,
      /\bnutritionist\b/i,
      /\bweight loss\b/i,
    ],
  },
  {
    name: "Surgical Outpatient",
    patterns: [
      /\bsurgical outpatient\b/i,
      /\bminor surgery\b/i,
      /\bday surgery\b/i,
      /\boutpatient surgery\b/i,
    ],
  },
  {
    name: "Urology",
    patterns: [
      /\burology\b/i,
      /\burologist\b/i,
      /\burinary\b/i,
      /\bprostate\b/i,
      /\bkidney stone(s)?\b/i,
      /\bbladder\b/i,
    ],
  },
];

function extractDepartment(message: string): string | undefined {
  const normalizedMessage = message.trim().toLowerCase();
  const exactService = appointmentServiceOptions.find((service) =>
    normalizedMessage.includes(service.toLowerCase()),
  );

  if (exactService) return exactService;

  const departmentAliases: Record<string, string> = {
    Maternity: "Antenatal Clinic",
    "Obstetrics and Gynecology": "Gynecology",
    Pediatrics: "Pediatric Clinic",
    Emergency: "Urgent Care Centre",
    Laboratory: "Laboratory Services",
    "Surgical Outpatient": "Minor Surgery",
    Dermatology: "Dermatologist",
    Nutrition: "Nutritionist",
    "Psychology and Counselling": "Counseling",
  };

  for (const department of DEPARTMENTS) {
    if (department.patterns.some((pattern) => pattern.test(message))) {
      const resolvedName = departmentAliases[department.name] ?? department.name;
      const bookableOption = appointmentServiceOptions.find(
        (service) => service.toLowerCase() === resolvedName.toLowerCase(),
      );
      if (bookableOption) return bookableOption;
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

  if (/\btoday\b/.test(text)) return formatDate(startOfDay(now));
  if (/\btomorrow\b/.test(text)) return formatDate(startOfDay(addDays(now, 1)));
  if (/\bday after tomorrow\b/.test(text)) return formatDate(startOfDay(addDays(now, 2)));

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

      if (
        new RegExp(
          `\\bnext\\s+${day}\\b`,
          "i",
        ).test(text)
      ) {
        diff += 7;
      }

      return formatDate(startOfDay(addDays(now, diff)));
    }
  }

  const slashDate = text.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);

  if (slashDate) {
    const day = Number(slashDate[1]);
    const month = Number(slashDate[2]) - 1;
    let year = slashDate[3] ? Number(slashDate[3]) : now.getFullYear();
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
    const year = monthMatch[3] ? Number(monthMatch[3]) : now.getFullYear();

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
  } else if (h < 0 || h > 23) {
    return undefined;
  }

  const displayHour = h % 12 || 12;
  return `${String(displayHour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${
    h >= 12 ? "PM" : "AM"
  }`;
}

function parseTimeFromMessage(message: string): string | undefined {
  const text = message.toLowerCase();

  if (/\bmidnight\b/.test(text)) return "12:00 AM";
  if (/\bnoon\b/.test(text)) return "12:00 PM";

  const explicit = text.match(/\b(\d{1,2})(?::(\d{2}))?(?:\s+(\d{2}))?\s*(am|pm)\b/i);
  if (explicit) {
    const hour = Number(explicit[1]);
    const minute = explicit[2] ? Number(explicit[2]) : explicit[3] ? Number(explicit[3]) : 0;
    return normalizeTime(hour, minute, explicit[4]);
  }

  const twentyFourHour = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFourHour) {
    return normalizeTime(Number(twentyFourHour[1]), Number(twentyFourHour[2]));
  }

  const bareHour = text.match(/\b(?:at|around|by)\s+([01]?\d|2[0-3])\b/i);
  if (bareHour) {
    return normalizeTime(Number(bareHour[1]), 0);
  }

  return undefined;
}

/* =========================================================
   APPOINTMENT PARSER
========================================================= */

export function parseAppointmentRequest(message: string): AppointmentRequestData {
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

function departmentHint(department?: string): string {
  if (!department) return "";
  const description = (hospitalKnowledge.departments as Record<string, string>)[department];
  return description ? ` (${description.split(". ")[0]}.)` : "";
}

/**
 * Friendly one-line acknowledgement shown as soon as a department is
 * known, quoting its consultation fee. This is what replaces the old
 * "null + KSh 1,000 consultation" text: `getServicePrice` no longer
 * returns null for a bookable department, and this line is generated
 * centrally instead of being pieced together at each call site.
 */
function departmentPriceLine(department?: string): string {
  if (!department) return "";

  const price = getServicePrice(department);

  return price
    ? `Great, ${department} it is! Listed fee: ${price} (tests, procedures, or medication may be charged separately). `
    : `Great, ${department} it is! `;
}

function fullDepartmentListBlock(): string {
  return (
    `\n\nHere is our full list of bookable services/departments:\n` +
    appointmentServiceOptions.map((department) => `• ${department}`).join("\n") +
    `\n\nJust reply with the one you'd like.`
  );
}

export function generateAppointmentCollectionPrompt(
  patientName: string,
  appointment: Partial<AppointmentRequestData>,
): string {
  const intakeDetails =
    `Please include your full name, phone number, preferred date and time, and reason for the visit (department or clinic and what you need help with).`;
  const missing: string[] = [];

  if (!appointment.department) missing.push("department");
  if (!appointment.date) missing.push("date");
  if (!appointment.time) missing.push("time");

  const priceLine = departmentPriceLine(appointment.department);

  if (missing.length === 0) {
    return `${priceLine}Thank you, ${patientName}. Please confirm your appointment details.\n\n${intakeDetails}`;
  }

  if (missing.length === 1) {
    if (missing[0] === "department") {
      return (
        `Thank you, ${patientName}. I have your preferred date and time. ` +
        `Which department or clinic would you like to see?\n\n${intakeDetails}`
      );
    }

    return (
      `${priceLine}Now, what ${missing[0]} would you like for your ${appointment.department} appointment?` +
      departmentHint(appointment.department) +
      `\n\n${intakeDetails}`
    );
  }

  if (missing.length === 2) {
    if (missing.includes("department")) {
      const other = missing.find((item) => item !== "department") as string;
      return (
        `Thank you, ${patientName}. Please share your preferred ${other}, and let me know which department or clinic you'd like to see for your appointment.\n\n${intakeDetails}`
      );
    }

    return `${priceLine}Please share the ${missing[0]} and ${missing[1]} for your appointment (e.g. "tomorrow at 10am").\n\n${intakeDetails}`;
  }

  return (
    `Sure, I can help you book an appointment. ` +
    `Please provide:\n` +
    `1. Your full name\n` +
    `2. Your phone number\n` +
    `3. Your preferred date and time\n` +
    `4. Your reason for the visit (department or clinic, and what you need help with)\n\n` +
    `For example: "Mary Wanjiku, 0712345678, Dermatology on Friday at 2pm, acne consultation". ` +
    `I’ll guide you through the booking step by step and share any listed fee for the service you choose.`
  );
}

/* =========================================================
   APPOINTMENT CONVERSATION STATE (standalone helper API)

   Kept for backward compatibility with any code calling this function
   directly instead of `generateBotReply`. It now reads and writes
   through the same `sessions` map that `generateBotReply` uses, so the
   two entry points can never end up with a different view of a given
   patient's in-progress booking.
========================================================= */

export function updateAppointmentConversation(
  patientId: string,
  patientName: string,
  message: string,
): AppointmentConversationState {
  const now = Date.now();
  let session = sessions.get(patientId);

  if (session && now - session.lastInteraction > CONVERSATION_MEMORY_MINUTES * 60 * 1000) {
    session = undefined;
  }

  if (!session) {
    session = {
      patientName,
      lastInteraction: now,
      stage: "collecting_appointment",
      appointment: {},
    };
  } else {
    session.patientName = session.patientName || patientName;
    session.lastInteraction = now;
  }

  const parsed = parseAppointmentRequest(message);

  const appointment: Partial<AppointmentRequestData> = {
    ...session.appointment,
    ...(parsed.date ? { date: parsed.date } : {}),
    ...(parsed.time ? { time: parsed.time } : {}),
    ...(parsed.department ? { department: parsed.department } : {}),
  };

  const completed = Boolean(appointment.date && appointment.time && appointment.department);

  let prompt: string;
  let awaitingConfirmation = false;

  if (!completed) {
    prompt = generateAppointmentCollectionPrompt(patientName, appointment);
    session.stage = "collecting_appointment";
  } else {
    prompt = renderAppointmentSummary(patientName, appointment);
    session.stage = "confirming_appointment";
    awaitingConfirmation = true;
  }

  session.appointment = appointment;
  sessions.set(patientId, session);

  const state: AppointmentConversationState = {
    patientName,
    appointment,
    completed,
    prompt,
    data: appointment,
    awaitingConfirmation,
  };

  // Mirrored for backward compatibility only — `sessions` is authoritative.
  appointmentConversationState.set(patientId, state);

  return state;
}

function renderAppointmentSummary(
  name: string,
  appointment: Partial<AppointmentRequestData>,
): string {
  const price = getServicePrice(appointment.department);

  return (
    `Thank you, ${name}. Here is your appointment request:\n\n` +
    `• Department: ${appointment.department}\n` +
    `• Date: ${appointment.date}\n` +
    `• Time: ${appointment.time}\n` +
    (price ? `• Listed fee: ${price}\n` : '') +
    `\nThe hospital team will confirm availability and any additional charges.\n\n` +
    `Are these details correct? Reply *Yes* to submit the request or *No* to change them.`
  );
}

function generateBookingReference(): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `WMC-${random}`;
}

/**
 * Final success message sent once the patient confirms their appointment
 * details. Previously this was a single generic sentence with no details
 * in it at all ("Your appointment request has been confirmed..."), which
 * is what made bookings feel like they hadn't actually gone through.
 */
function renderAppointmentSuccess(
  name: string,
  appointment: Partial<AppointmentRequestData>,
): string {
  const reference = generateBookingReference();
  const price = getServicePrice(appointment.department);
  const contactLines = hospitalKnowledge.locations
    .map((location) => `• ${location.branch}: ${location.phoneNumbers.join(", ")}`)
    .join("\n");

  return (
    `✅ *Appointment Request Received*\n\n` +
    `Thank you, ${name} — your request has been sent to the Winston Medical Centre team for processing.\n\n` +
    `• Booking reference: *${reference}*\n` +
    `• Department: ${appointment.department}\n` +
    `• Date: ${appointment.date}\n` +
    `• Time: ${appointment.time}\n` +
    (price ? `• Listed fee: ${price} (additional services may cost extra)\n` : '') +
    `\nOur staff will contact you to confirm availability. If you need to reach us sooner, please call Winston Medical Centre:\n` +
    contactLines +
    `\n\nSay "menu" any time if you need anything else.`
  );
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
   BOT COPY
========================================================= */

const NAME_PROMPT =
  "Welcome to Winston Medical Centre. Before we continue, please tell me your full name. What is your name?";

const MENU_PROMPT = (name: string) =>
  `${getKenyaGreeting()}, ${name}. How can I help you today?\n\n` +
  `You can ask me about:\n` +
  `• Our services, departments, or specialist clinics\n` +
  `• Clinic, outpatient, urgent-care, and laboratory services\n` +
  `• Listed consultation, clinic, ultrasound, and laboratory fees (say "price list")\n` +
  `• Location, phone numbers, email, and directions\n` +
  `• Appointment requests and booking details\n` +
  `• Speaking with our hospital staff\n\n` +
  `If you're feeling unwell or need medical advice, just tell me and I'll connect you directly with our clinical team instead of guessing.`;

function isGreeting(message: string): boolean {
  const text = message.trim().toLowerCase();

  return /^(hi|hello|hey|hi there|hello there|good morning|good afternoon|good evening|good day|morning|afternoon|evening|mambo|sasa|habari|yo|sup)\b/i.test(
    text,
  ) || /\b(hi there|hello there|good morning|good afternoon|good evening)\b/i.test(text);
}

function getExactClinicFaqAnswer(message: string): string | null {
  const normalized = message
    .toLowerCase()
    .replace(/[?!.]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (/^hello$/.test(normalized)) {
    return 'Hello too \nWelcome, how can I help you today?\nDo you have any enquiry you want to make?';
  }

  if (/\bmicro[\s-]?needling\b|\bmicroneedling\b/.test(normalized)) {
    return 'Yes we do micro needling at a cost of KSH.22,000/= per session';
  }

  if (
    /\bskin tags?\b/.test(normalized) &&
    /\bkeloids?\b/.test(normalized) &&
    /\bwarts?\b/.test(normalized) &&
    /\bingrown nails?\b/.test(normalized)
  ) {
    return 'Yes we handle this condition but after doctor has reviewed it and and decides on treatment plan.\nVisit us for clinical evaluation first .';
  }

  if (/\bdark spots?\b/.test(normalized) && /\bcauses?\b/.test(normalized)) {
    return 'Dark spots has so many causes and treatment depends with the causative agent and wether it is superficial or deep dark spot.\nThe causes ranges from post inflammatory reaction, sunburn, drugs, skin infections,ance, and trauma, hormonal and some genetical conditions.\nWe recommend you visit and see our dermatologist for guidance on the appropriate treatment plan for your dark spots.';
  }

  if (/\bsha\b/.test(normalized)) {
    return "No we don't accept SHA for dermatology services.\nWe only use Cash.";
  }

  if (/\binsurance\b/.test(normalized)) {
    return 'At the moment we do accept GA INSURANCE, KENYAN ALLIANCE,MTIBA under GA INSURANCE.\nsome major insurance companies will be onboarded soon.';
  }

  if (
    /\b(?:share|send)\b/.test(normalized) &&
    /\b(?:picture|photo|image)\b/.test(normalized) &&
    /\bskin\b/.test(normalized)
  ) {
    return 'Yes you can but we recommend you call the doctor directly on his number first.\n0708130100/0726244040';
  }

  if (/\bacne keloidalis(?: nuchae)?\b/.test(normalized)) {
    return 'This is mostly caused by inflammation of hair follicles after clear shaving, irritation by certain types of shirt collar or plastic caps and helmets,genetics resulting in ingrown hair within the hair follicles and colonization by propionibacterium..';
  }

  return null;
}

function isBookingIntent(message: string): boolean {
  const text = message.trim();

  return (
    /\bbook(ing)?\b/i.test(text) ||
    /\bshow\s+(my|the)\s+appointment(s)?\b/i.test(text) ||
    /\bappointment history\b/i.test(text) ||
    /\bhistory of my appointment\b/i.test(text) ||
    /\b(reschedule|rescheduling|rebook|rebooking|change my appointment|change appointment)\b/i.test(text) ||
    /\bavailable appointment(s)?\b/i.test(text) ||
    /\bappointment\b/i.test(text) ||
    /\bappointments?\b/i.test(text) ||
    /\bconsult(ation)?\b/i.test(text) ||
    /\bcheckup\b/i.test(text) ||
    /\bvisit\b/i.test(text) ||
    /\bslot\b/i.test(text) ||
    /\bslots?\b/i.test(text) ||
    /\bschedule\b/i.test(text) ||
    /\bsee a doctor\b/i.test(text) ||
    /\bsee doctor\b/i.test(text) ||
    /\bmeet a doctor\b/i.test(text) ||
    /\bsee a specialist\b/i.test(text) ||
    /\b(?:see|book|talk to|get)\s+(?:dr\.?|doctor)\s+[a-z][a-z.'-]+\b/i.test(text) ||
    /\b(?:book|schedule|see|talk to|get)\s+(?:a\s+)?(?:doctor|specialist|clinic)\b/i.test(text) ||
    /\b(?:schedule|book)\s+me\b/i.test(text) ||
    /\b(?:what|which)\s+(?:times?|slots?)\s+(?:are|is)\s+available\b/i.test(text) ||
    /\b(?:when|where)\s+can\s+i\s+get\s+(?:an?\s+)?(?:appointment|booking|slot)\b/i.test(text) ||
    /\b(?:is there|do you have)\s+(?:an?\s+)?(?:opening|free slot|available slot)\b/i.test(text) ||
    /\b(?:i|we)\s+(?:want|need|would\s+like)\s+to\s+(?:schedule|arrange|book|make|do)\b/i.test(text) ||
    /\b(?:can|could|would)\s+i\s+(?:make|do|schedule|arrange)\b/i.test(text) ||
    /\b(?:help|please help)\s+(?:me|us)\s+(?:make|do|schedule|arrange)\b/i.test(text) ||
    /\b(?:book|make|schedule|arrange)\s+(?:for me|me)\b/i.test(text) ||
    /\bbook a (visit|slot)\b/i.test(text) ||
    /\bneed (an? )?(appointment|visit|consultation|doctor|checkup|slot)\b/i.test(text) ||
    /\b(?:i|we)\s+(?:want|need|would\s+like|would\s+love|hope to)\s+(?:to\s+)?(?:book|schedule|reserve|arrange|set up|do)\b/i.test(text) ||
    /\b(?:i|we)\s+(?:want|need|would\s+like)\s+(?:to\s+)?do\s+(?:an?\s+)?(?:booking|appointment|visit|consultation|slot)\b/i.test(text) ||
    /\b(?:help|guide|assist|show)\s+(?:me|us)\s+(?:how\s+to\s+)?(?:book|schedule|reserve|arrange)\b/i.test(text) ||
    /\b(?:help|guide|assist)\s+(?:me|us)\s+(?:to\s+)?(?:book|schedule|reserve|arrange)\b/i.test(text) ||
    /\b(?:help|guide|assist)\s+(?:me|us)\s+(?:with|to)\s+(?:booking|an appointment|a visit|a consultation|appointment booking)\b/i.test(text) ||
    /\b(?:i|we)\s+want\s+to\s+do\s+booking\b/i.test(text) ||
    /\bi\s+want\s+to\s+to\s+book\b/i.test(text) ||
    /\bi\s+want\s+to\s+book\b/i.test(text) ||
    /\bi'd like to book\b/i.test(text) ||
    /\bi would like to book\b/i.test(text) ||
    /\bbook me\b/i.test(text) ||
    /\b(?:reserve|arrange|set up|schedule|book)\s+(an? )?(appointment|visit|consultation|checkup|slot)\b/i.test(text) ||
    /\bcan i do it (tomorrow|today|next week|on [a-z]+)?\b/i.test(text) ||
    /\bcan i (book|schedule|reserve|arrange)\b/i.test(text) ||
    /\bmake appointment\b/i.test(text) ||
    /\bwould like an appointment\b/i.test(text) ||
    /\bneed to see a doctor\b/i.test(text) ||
    /\bneed a doctor\b/i.test(text) ||
    /\b(?:i|we)\s+need\s+to\s+see\s+(?:the\s+)?doctor\b/i.test(text) ||
    /\bcan\s+i\s+come\s+in\b/i.test(text) ||
    /\bwhen\s+can\s+i\s+(?:come|visit)\b/i.test(text) ||
    /\bi need a consultation\b/i.test(text) ||
    /\bcan i get a same day appointment\b/i.test(text) ||
    /\bsame day appointment\b/i.test(text) ||
    /\bcan i book today\b/i.test(text) ||
    /\bbook for today\b/i.test(text)
  );
}

function isAppointmentHistoryRequest(message: string): boolean {
  return /\b(?:can i get|show|view|check|what is)\s+(?:my\s+)?(?:appointment|booking)\s+(?:history|records?)\b/i.test(message) ||
    /\b(?:my appointment history|appointment history|my booking history|show my appointments|my appointments|upcoming appointments|scheduled appointments)\b/i.test(message);
}

function isAffirmative(message: string): boolean {
  const text = message.trim().toLowerCase();

  return (
    /^(yes|yeah|yep|yup|correct|confirm(ed)?|okay|ok|sure|right|that'?s right|sawa|thanks|thank you|thankyou|nice|great|perfect|sounds good|alright|all good|yes please|go ahead|please proceed)$/i.test(text) ||
    /\b(yes please|okay thanks|thanks a lot|thank you very much|all good|sounds good|go ahead|please proceed|sure thing|no problem|perfectly)\b/i.test(text)
  );
}

function isNegative(message: string): boolean {
  const text = message.trim().toLowerCase();

  return (
    /^(no|nope|nah|change|edit|wrong|not correct|that'?s wrong|incorrect|not now|no thanks|not really|never mind)$/i.test(text) ||
    /\b(no thanks|not really|not now|never mind|change it|wrong one)\b/i.test(text)
  );
}

/**
 * Looks up an answer in the hospital knowledge base and returns it,
 * lightly personalized. Returns null when the knowledge base has no
 * confident answer — callers decide what to do next (usually: offer to
 * connect the patient with staff) rather than this function inventing
 * a generic filler reply.
 */
function answerKnowledgeBase(name: string, message: string): string | null {
  let result: string | null = null;

  try {
    result = searchKnowledgeBase(message);
  } catch {
    result = null;
  }

  if (!result) return null;

  // Keep the reply feeling natural and conversational in both short
  // answers and structured knowledge responses. This also matches the
  // hospital bot's more human-style chat behavior that users expect.
  const trimmed = result.trim();
  if (!trimmed) return null;

  const looksStructured = /^[\p{Emoji}\p{So}]/u.test(trimmed) || trimmed.includes("\n\n•") || trimmed.includes("\n•");

  if (looksStructured) {
    return trimmed;
  }

  if (/^(yes|no)\b/i.test(trimmed)) {
    const [, answer, explanation = ''] = trimmed.match(/^(yes|no)\b\s*,?\s*(.*)$/i) ?? [];
    return explanation ? `${answer}, ${name}, ${explanation}` : `${answer}, ${name}.`;
  }

  return `${name}, ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
}

function getCommonPatientReply(name: string, message: string): string | null {
  const text = message.trim();

  const replyMap: Array<{ pattern: RegExp; reply: string }> = [
    { pattern: /\b(thank you|thanks|thankyou|many thanks|appreciate it)\b/i, reply: `${name}, you’re very welcome. I’m glad to help.` },
    { pattern: /\b(okay|ok|alright|sure|nice|great|perfect|sounds good|all good|yes please)\b/i, reply: `${name}, great. I can help with the next step.` },
    { pattern: /\b(show my appointment history|appointment history|my appointment history|show my appointments|my appointments|upcoming appointments|scheduled appointments)\b/i, reply: `${name}, I can help with your appointment history. Please tell me if you want your upcoming bookings, past visits, or to reschedule one of them.` },
    { pattern: /\b(reschedule my appointment|reschedule appointment|need to reschedule|change my appointment|change appointment|move my appointment)\b/i, reply: `${name}, no problem. Please share the new date and time, or tell me the department, and I’ll help update your appointment.` },
    { pattern: /\b(available appointment|available appointments|next available slot|next slots|open times|what slots are free)\b/i, reply: `${name}, I can't verify live appointment slots here. Please call Winston Medical Centre on 0726 244040 or 0708 130100 to confirm availability.` },
    { pattern: /\b(i am running late|i'm late|im late|running late)\b/i, reply: `${name}, no problem. Please let our front desk know as soon as you can, and we’ll do our best to keep your appointment updated.` },
    { pattern: /\b(can you confirm my appointment|please confirm my appointment|confirm my appointment|appointment confirmation|check my appointment)\b/i, reply: `${name}, I can help with that. Please tell me the department, date, or visit you want confirmed, and I’ll check the details for you.` },
    { pattern: /\b(is there a doctor available now|doctor available now|is a doctor available|any doctor available)\b/i, reply: `${name}, I don't have live clinician availability. Please call Winston Medical Centre on 0726 244040 or 0708 130100 to check.` },
    { pattern: /\b(i need a female doctor|female doctor|woman doctor|lady doctor)\b/i, reply: `${name}, we can help with that. Please tell me the department or service you need, and I’ll guide you to the most suitable doctor or booking option.` },
    { pattern: /\b(i need to speak to a doctor|speak to the doctor|talk to the doctor|talk to a doctor|need a doctor)\b/i, reply: `${name}, I can connect you with our clinical team. Please tell me the department or concern, and I’ll guide you to the right next step.` },
    { pattern: /\b(where are you located|where is the clinic|clinic location|branch location|where is your hospital|your location)\b/i, reply: `${name}, Winston Medical Centre is at Standard Drive Estate, along Nyayo Gate B Road, about 400 metres from Fedha Stage in Tassia Estate, Nairobi. Call 0726 244040 or 0708 130100.` },
    { pattern: /\b(when are you open|what time do you open|opening hours|working hours|are you open on weekends|weekend opening hours)\b/i, reply: `${name}, we are open daily, Monday to Saturday from 8:00 AM to 5:00 PM. Sunday and public-holiday appointments can be arranged by calling 0726 244040 or 0708 130100.` },
    { pattern: /\b(what services do you have|what departments do you have|services available|departments available|what clinics do you have)\b/i, reply: `${name}, Winston Medical Centre offers General Outpatient Care, General Medicine, Minor Surgery, Gynecology, urgent care, pharmacy, laboratory, antenatal and well-baby clinics, ultrasound, counseling, maternal and child healthcare, physiotherapy, ECG/ECHO, pediatric care, circumcision, and family planning.` },
    { pattern: /\b(i want to cancel|cancel my appointment|cancel appointment|need to cancel|i need to cancel)\b/i, reply: `${name}, no problem. I can help you cancel or reschedule. Please tell me the department and the day or time you’d like to change.` },
    { pattern: /\b(do you accept sha|accept sha|insurance|nhif|do you take insurance|do you accept insurance)\b/i, reply: `${name}, our accepted insurance partners include GA Insurance, Kenyan Alliance, and MTIBA under GA Insurance. Dermatology services are cash-only and do not accept SHA. Please call 0726 244040 or 0708 130100 to confirm cover for your service.` },
    { pattern: /\b(how do i book|how can i book|how to book|how do i schedule|how to schedule)\b/i, reply: `${name}, I can help with that. Just tell me the department, preferred date, and time, and I’ll prepare the booking details for you.` },
    { pattern: /\b(do you have same day appointment|same day appointment|can i get a same day appointment|same day booking)\b/i, reply: `${name}, I can't verify same-day availability here. Please call Winston Medical Centre on 0726 244040 or 0708 130100 to confirm.` },
    { pattern: /\b(i need urgent care|urgent care|emergency|very urgent|i need help now)\b/i, reply: `${name}, Winston Medical Centre has an Urgent Care Centre with a Local Injuries Unit and Medical Assessment Unit. For urgent help, call 0726 244040 or 0708 130100.` },
    { pattern: /\b(i am not feeling well|not feeling well|i feel unwell|i feel sick|i'm sick)\b/i, reply: `${name}, I’m sorry to hear that. Please tell me the main concern or department you need, and I’ll guide you to the right support or appointment.` },
    { pattern: /\b(can i come tomorrow|come tomorrow|can i book tomorrow|book for tomorrow)\b/i, reply: `${name}, I can submit an appointment request for tomorrow, but the hospital team must confirm availability. Which clinic or service and what time would you prefer?` },
    { pattern: /\b(i have pain|mild pain|severe pain|i am in pain|i have a headache|i have stomach pain)\b/i, reply: `${name}, I’m sorry you’re in pain. Please let me know the department or concern, and I’ll guide you to the right care or appointment option.` },
    { pattern: /\b(can i get a referral|need a referral|i need a referral letter|referral)\b/i, reply: `${name}, I can help with the next step. Please tell me the department or doctor you need, and I’ll guide you on the referral process.` },
    { pattern: /\b(what is the cost|what does it cost|how much does it cost|what is the consultation fee|consultation fee)\b/i, reply: `${name}, a general consultation is ${hospitalKnowledge.consultationFee}. Fees vary by service; tell me the clinic or test for its listed price, or say "price list" for all supplied prices.` },
    { pattern: /\b(where is the nearest branch|nearest branch|which branch is closest|closest branch)\b/i, reply: `${name}, Winston Medical Centre is at Standard Drive Estate, along Nyayo Gate B Road, about 400 metres from Fedha Stage in Tassia Estate, Nairobi.` },
    { pattern: /\b(can i book online|book online|online booking|do you have online booking)\b/i, reply: `${name}, yes, you can start the booking with me here. Just share the department, date, and preferred time, and I’ll help you complete it.` },
    { pattern: /\b(i need a follow up|follow up appointment|need follow up|i want a follow up)\b/i, reply: `${name}, I can help you arrange a follow-up. Please tell me the department and the day or time that works best for you.` },
    { pattern: /\b(please call me back|call me back|can you call me|call me)\b/i, reply: `${name}, of course. Please share the best time or number to reach you, and our team will get in touch as soon as possible.` },
    { pattern: /\b(i am here|i'm here|arrived|here for appointment)\b/i, reply: `${name}, thank you for letting me know. Please check in with the reception desk or tell me the department and time of your appointment so I can help.` },
    { pattern: /\b(what is the procedure|what does the procedure involve|procedure details|what happens in the procedure)\b/i, reply: `${name}, I’d be happy to explain the process. Please tell me the service or procedure name, and I’ll guide you with the right information.` },
    { pattern: /\b(can you help me choose a doctor|help me choose a doctor|which doctor should i choose|doctor recommendation|recommended doctor)\b/i, reply: `${name}, I can help narrow it down. Please tell me the department, your concern, and whether you prefer a male or female doctor, and I’ll guide you.` },
    { pattern: /\b(do you have a doctor for my child|pediatrician|paediatrician|child doctor|doctor for my baby|kids doctor)\b/i, reply: `${name}, Winston Medical Centre has a Pediatric Clinic and Well Baby Clinic. The listed paediatrician fee is KSh 1,500; please contact the hospital to confirm clinic availability.` },
    { pattern: /\b(i want to reschedule|reschedule my appointment|need to reschedule|change my appointment)\b/i, reply: `${name}, no problem. I can help you reschedule. Please share the new day and time, or tell me the department and I’ll help update it.` },
    { pattern: /\b(are you open on weekends|weekend appointments|can i book on saturday|can i book on sunday)\b/i, reply: `${name}, we are open Monday to Saturday, 8:00 AM to 5:00 PM. Sunday and public-holiday appointments can be arranged by calling 0726 244040 or 0708 130100.` },
    { pattern: /\b(maternity|pregnancy|antenatal|delivery|obstetrics|gynecology)\b/i, reply: `${name}, Winston Medical Centre offers an Antenatal Clinic, Maternal & Child Healthcare Clinic, and Gynecology. Which service would you like to ask about or request an appointment for?` },
    { pattern: /\b(do you have lab tests|lab tests|blood test|labs|laboratory services)\b/i, reply: `${name}, yes, we do offer laboratory services and diagnostic tests. I can help you identify the right department or service for your request.` },
    { pattern: /\b(i am unable to come|can't make it|cannot come|i can’t make it|unable to attend)\b/i, reply: `${name}, I’m sorry to hear that. Please let me know if you’d like to reschedule or cancel, and I’ll help with the next step.` },
    { pattern: /\b(what does sha cover|does sha cover this|sha cover|insurance coverage)\b/i, reply: `${name}, we do not accept SHA for dermatology services, which are cash-only. For cover for another service, please call 0726 244040 or 0708 130100 to check.` },
    { pattern: /\b(can my family come|family appointment|book for my family|my husband|my wife|my child)\b/i, reply: `${name}, yes, we can help with family and dependent appointments. Please tell me the department and the number of patients, and I’ll guide you through the booking.` },
    { pattern: /\b(i need an appointment for my mother|appointment for my father|visit for my parent|for my family member)\b/i, reply: `${name}, absolutely. Please share the department, the patient’s name if it’s different, and the preferred date or time, and I’ll help you arrange it.` },
    { pattern: /\b(hey there|hi there|hello there|good morning|good afternoon|good evening)\b/i, reply: `${name}, hello. How can I help you today?` },
    { pattern: /\b(i am here for consultation|for consultation|for check up|check up appointment|doctor visit)\b/i, reply: `${name}, I can help with that. Please tell me the department and your preferred time, and I’ll guide you through the booking.` },
    { pattern: /\b(i need a doctor for my pregnancy|pregnancy checkup|prenatal care|antenatal appointment)\b/i, reply: `${name}, we can help with prenatal and maternity care. Please tell me whether this is an antenatal checkup or a general obstetrics visit, and I’ll guide you appropriately.` },
    { pattern: /\b(dental|teeth|tooth pain|dentist)\b/i, reply: `${name}, dental care is not listed among the services I have for Winston Medical Centre. Please call 0726 244040 or 0708 130100 to confirm whether it is available.` },
  ];

  for (const entry of replyMap) {
    if (entry.pattern.test(text)) {
      return entry.reply;
    }
  }

  return null;
}

/* =========================================================
   CORE CONVERSATION TURN
   Shared by both "legacy" (stateless) and session-backed modes so
   the two never drift apart or handle the same input differently.
========================================================= */

type TurnState = {
  patientName: string;
  stage: ConversationStage;
  appointment: Partial<AppointmentRequestData>;
};

type TurnResult = {
  reply: string;
  state: TurnState;
};

function processTurn(state: TurnState, message: string, isReturning?: boolean): TurnResult {
  const name = state.patientName;

  if (isHumanSupportRequest(message) && !isBookingIntent(message)) {
    return {
      reply: `Of course, ${name}. I'll direct your request about a doctor or hospital staff member to our team — please hold on for assistance.`,
      state: { ...state, stage: "human_handoff" },
    };
  }

  if (state.stage === "human_handoff" && !isGreeting(message) && !isMenuCommand(message)) {
    return {
      reply: `Your request has already been passed to our staff, ${name}. Please wait for assistance, or say "menu" to continue chatting with me.`,
      state,
    };
  }

  if ((isGreeting(message) || isMenuCommand(message)) && !isBookingIntent(message)) {
    if (/^hello[?!.\s]*$/i.test(message.trim())) {
      return {
        reply: `Hello too, ${name}! Welcome. How can I help you today? Do you have any enquiry?`,
        state: { ...state, stage: "menu" },
      };
    }

    return {
      reply: isReturning && isGreeting(message) ? `Welcome back, ${name}. ${MENU_PROMPT(name)}` : MENU_PROMPT(name),
      state: { ...state, stage: "menu" },
    };
  }

  if (isCancelCommand(message)) {
    return {
      reply: `No problem, ${name}. I've cleared that request. ${MENU_PROMPT(name)}`,
      state: { ...state, stage: "menu", appointment: {} },
    };
  }

  if (
    /\b(sunday|public holidays?)\b/i.test(message) &&
    /\b(appointment|book|open|visit|available)\b/i.test(message)
  ) {
    const answer = answerKnowledgeBase(name, message);
    if (answer) {
      return { reply: answer, state: { ...state, stage: "menu" } };
    }
  }

  if (
    /\b(?:online|virtual)\s+(?:consultation|consult)\b|\b(?:consultation|consult)\s+(?:online|virtual)\b/i.test(message) &&
    !/\b(book|schedule|appointment)\b/i.test(message)
  ) {
    const answer = answerKnowledgeBase(name, message);
    if (answer) {
      return { reply: answer, state: { ...state, stage: "menu" } };
    }
  }

  if (
    /\b(?:how much|price|cost|fee|charge|charges|pricing)\b/i.test(message) &&
    /\b(?:consult(?:ation)?|clinic|dermatolog|skin specialist|gynecolog|gynaecolog|paediatrician|pediatrician|nutritionist)\b/i.test(message)
  ) {
    const answer = answerKnowledgeBase(name, message);
    if (answer) {
      return { reply: answer, state };
    }
  }

  if (isAppointmentHistoryRequest(message)) {
    return {
      reply:
        `${name}, I can look up your appointment history. In WhatsApp, I’ll show your recent records and their status. ` +
        `You can then keep an appointment, reschedule it, book another one, or speak with staff.`,
      state: { ...state, stage: "menu" },
    };
  }

  // Medical symptom / advice questions are redirected to human clinical
  // staff rather than answered here. Skipped while the patient is already
  // mid-way through booking an appointment, so a stray word like "pain"
  // in an appointment reason doesn't derail an in-progress booking.
  if (
    state.stage !== "collecting_appointment" &&
    state.stage !== "confirming_appointment" &&
    !isBookingIntent(message) &&
    !isSupportedMedicalFaq(message) &&
    isMedicalSymptomRequest(message)
  ) {
    return {
      reply: formatMedicalAdviceRedirect(name, message),
      state: { ...state, stage: "menu" },
    };
  }

  if (state.stage === "confirming_appointment") {
    if (isAffirmative(message)) {
      const confirmedAppointment = state.appointment;
      return {
        reply: renderAppointmentSuccess(name, confirmedAppointment),
        state: { ...state, stage: "menu", appointment: {} },
      };
    }

    if (isNegative(message)) {
      return {
        reply: generateAppointmentCollectionPrompt(name, {}),
        state: { ...state, stage: "collecting_appointment", appointment: {} },
      };
    }

    // Fall through: treat the message as new appointment info rather than
    // forcing a strict yes/no, in case the patient just restates a change.
  }

  const parsed = parseAppointmentRequest(message);
  const inAppointmentFlow =
    state.stage === "collecting_appointment" ||
    state.stage === "confirming_appointment" ||
    isBookingIntent(message) ||
    /\b(can|could|would) (i|we) (do|book|schedule|reserve)\b/i.test(message) ||
    /\b(?:help|guide|assist)\s+(?:me|us)\s+(?:with|to)\s+(?:booking|book|schedule|reserve|arrange)\b/i.test(message) ||
    /\b(?:i|we)\s+(?:want|need|would\s+like)\s+(?:to\s+)?(?:do|book|schedule|reserve|arrange|set up)\b/i.test(message) ||
    /\b(?:i want|i need|can i|could i|would i|can we|could we)\s+(?:to\s+)?(?:book|schedule|reserve|change|cancel)\b/i.test(message);

  if (inAppointmentFlow) {
    const appointment: Partial<AppointmentRequestData> = {
      ...state.appointment,
      ...(parsed.date ? { date: parsed.date } : {}),
      ...(parsed.time ? { time: parsed.time } : {}),
      ...(parsed.department ? { department: parsed.department } : {}),
    };

    if (!appointment.date || !appointment.time || !appointment.department) {
      return {
        reply: generateAppointmentCollectionPrompt(name, appointment),
        state: { ...state, stage: "collecting_appointment", appointment },
      };
    }

    return {
      reply: renderAppointmentSummary(name, appointment),
      state: { ...state, stage: "confirming_appointment", appointment },
    };
  }

  const answer = answerKnowledgeBase(name, message);

  if (answer) {
    return { reply: answer, state: { ...state, stage: "menu" } };
  }

  const commonReply = getCommonPatientReply(name, message);
  if (commonReply) {
    return {
      reply: commonReply,
      state: { ...state, stage: "menu" },
    };
  }

  if (/\b(cost|price|fee|charges|how much|consultation fee|pricing|what does it cost|how much is it|what is the cost|what is the price)\b/i.test(message)) {
    return {
      reply:
        `${name}, a general consultation is ${hospitalKnowledge.consultationFee}. Fees vary by service; tell me the clinic or test for its listed price, or say "price list" for supplied prices.`,
      state,
    };
  }

  if (/\b(tomorrow|today|next week|next monday|next tuesday|next wednesday|next thursday|next friday|next saturday|next sunday|later this week|this week|next month|weekend|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(message)) {
    return {
      reply:
        `${name}, I can help with that. Please share the department and the time you prefer, and I’ll build the appointment details for you.`,
      state: { ...state, stage: "collecting_appointment", appointment: state.appointment },
    };
  }

  if (/\b(open|opening|hours|working hours|when are you open|what time do you open|clinic hours|operating hours|available|availability|are you open|is the clinic open)\b/i.test(message)) {
    return {
      reply:
        `${name}, we are open daily, Monday to Saturday from 8:00 AM to 5:00 PM. Sunday and public-holiday appointments can be arranged by calling 0726 244040 or 0708 130100.`,
      state: { ...state, stage: "menu" },
    };
  }

  if (/\b(insurance|sha|nhif|coverage|cover|medical cover|accept insurance|do you accept sha|do you accept insurance)\b/i.test(message)) {
    return {
      reply:
        `${name}, our accepted insurance partners include GA Insurance, Kenyan Alliance, and MTIBA under GA Insurance. Dermatology services are cash-only and do not accept SHA. Please call 0726 244040 or 0708 130100 to confirm cover for your service.`,
      state: { ...state, stage: "menu" },
    };
  }

  if (/\b(change.*time|different time|can.*time.*change|need.*another time|reschedule.*appointment|change.*appointment|move.*appointment|another day|different day)\b/i.test(message)) {
    return {
      reply:
        `${name}, no problem. I can help you change the appointment time or date. Please share the new day and time, or tell me the department and I’ll help update it.`,
      state: { ...state, stage: "collecting_appointment", appointment: state.appointment },
    };
  }

  if (isAppointmentHistoryRequest(message)) {
    return {
      reply:
        `${name}, I can look up your appointment history. Please tell me whether you want your upcoming bookings, recent visits, or a reschedule for one of them.`,
      state: { ...state, stage: "menu" },
    };
  }

  if (/\b(reschedule my appointment|reschedule appointment|need to reschedule|change my appointment|change appointment|move my appointment)\b/i.test(message)) {
    return {
      reply:
        `${name}, I can help submit a reschedule request. Please share the new date and time; the hospital team must confirm availability.`,
      state: { ...state, stage: "collecting_appointment", appointment: state.appointment },
    };
  }

  if (/\b(available appointment|available appointments|next available slot|open slots|available slots|next available appointment)\b/i.test(message)) {
    return {
      reply:
        `${name}, I can't verify live appointment slots here. Please call Winston Medical Centre on 0726 244040 or 0708 130100 to confirm availability.`,
      state: { ...state, stage: "collecting_appointment", appointment: state.appointment },
    };
  }

  return {
    reply: 'Thank you for your question. For this enquiry, please call the doctor directly on 0708130100 or 0726244040.',
    state,
  };
}

/* =========================================================
   PUBLIC ENTRY POINT
========================================================= */

export function generateBotReply(input: BotReplyInput): string {
  const message = input.message.trim();
  const exactFaqAnswer = getExactClinicFaqAnswer(message);

  if (exactFaqAnswer) {
    return exactFaqAnswer;
  }

  /*
   * Legacy/stateless mode:
   * When no patientId is supplied, patientName is used to seed a
   * one-off turn so existing unit tests and simple integrations work
   * without session storage. No conversation memory persists here.
   *
   * IMPORTANT: production/WhatsApp integrations must always pass a
   * stable `patientId` for every message from the same conversation.
   * Without it, each call starts from a blank slate (stage "menu",
   * appointment {}), so a multi-step booking (department → date → time
   * → confirm) can never actually complete — every reply after the
   * first will look like a brand-new request instead of a continuation.
   */
  if (!input.patientId) {
    const extracted = extractPatientName(message);
    const resolvedName = extracted || input.patientName;

    if (!resolvedName) {
      if (!message) return NAME_PROMPT;
      if (isBookingIntent(message)) {
        return generateAppointmentCollectionPrompt("there", {});
      }
      if (isUrgentSymptomRequest(message)) {
        return formatMedicalAdviceRedirect("there", message);
      }
      return isGreeting(message)
        ? NAME_PROMPT
        : 'Thank you for your question. For this enquiry, please call the doctor directly on 0708130100 or 0726244040.';
    }

    const state: TurnState = {
      patientName: resolvedName,
      stage: "menu",
      appointment: {},
    };

    return processTurn(state, message, input.isReturning).reply;
  }

  /* =======================================================
     SESSION-BACKED MODE (production)
  ======================================================= */

  const patientId = input.patientId;
  const now = Date.now();

  let session = sessions.get(patientId);

  if (session && now - session.lastInteraction > CONVERSATION_MEMORY_MINUTES * 60 * 1000) {
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

  const extractedName = extractPatientName(message);

  if (session.stage === "awaiting_name") {
    if (!extractedName) {
      if (isBookingIntent(message)) {
        session.stage = "collecting_appointment";
        return generateAppointmentCollectionPrompt("there", {});
      }

      if (isUrgentSymptomRequest(message)) {
        return formatMedicalAdviceRedirect("there", message);
      }

      return isGreeting(message)
        ? NAME_PROMPT
        : 'Thank you for your question. For this enquiry, please call the doctor directly on 0708130100 or 0726244040.';
    }

    session.patientName = extractedName;
    session.stage = "menu";

    return MENU_PROMPT(extractedName);
  }

  if (extractedName) {
    session.patientName = extractedName;
  }

  const turnState: TurnState = {
    patientName: session.patientName || extractedName || "there",
    stage: session.stage,
    appointment: session.appointment,
  };

  const { reply, state } = processTurn(turnState, message, input.isReturning);

  session.stage = state.stage;
  session.appointment = state.appointment;

  return reply;
}