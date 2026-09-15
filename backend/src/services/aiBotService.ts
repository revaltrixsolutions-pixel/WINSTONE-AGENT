import { hospitalKnowledge, searchKnowledgeBase } from '../knowledge/hospitalData';

/**
 * ---------------------------------------------------------------------------
 * PUBLIC TYPES
 * ---------------------------------------------------------------------------
 * The bot now owns its own conversation state (keyed by patientId) instead of
 * relying on the caller to pass in `patientName` / `isReturning` /
 * `lastInteractionHours` on every turn. The caller only needs a stable
 * `patientId` (phone number, WhatsApp ID, session id, DB id — anything unique
 * per conversation) and the raw incoming `message`.
 *
 * This guarantees rule #1: the bot NEVER acts on anything until it has asked
 * the patient for their name in the chat itself, and every reply after that
 * uses exactly that name — never a name pulled from a CRM/profile elsewhere.
 * ---------------------------------------------------------------------------
 */
export type BotReplyInput = {
  /** Any stable identifier for this conversation (phone number, chat id, etc). */
  patientId: string;
  message: string;
};

export type AppointmentRequestData = {
  date?: string;
  time?: string;
  department?: string;
};

type ConversationStage =
  | 'awaiting_name'
  | 'menu'
  | 'collecting_appointment'
  | 'confirming_appointment'
  | 'human_handoff';

export type PatientSession = {
  name: string | null;
  stage: ConversationStage;
  appointment: Partial<AppointmentRequestData>;
  confirmedAppointment: AppointmentRequestData | null;
  lastActivityAt: number;
  contacted: boolean;
};

/** How long a chat can go quiet before we treat the next message as a "return visit". */
export const CONVERSATION_MEMORY_MINUTES = 3;
const SESSION_IDLE_MS = CONVERSATION_MEMORY_MINUTES * 60 * 1000;

const NAME_PROMPT = 'Before we continue, please tell me your full name.';
const DEFAULT_WELCOME = `Welcome to Phadam Hospital. ${NAME_PROMPT}`;

const NON_NAME_WORDS = new Set([
  'assign', 'me', 'help', 'please', 'book', 'appointment', 'appointments', 'need', 'visit',
  'hello', 'hi', 'hey', 'thanks', 'thank', 'you', 'yes', 'no', 'okay', 'ok', 'patient',
  'how', 'what', 'where', 'when', 'why', 'can', 'could', 'would', 'today', 'tomorrow',
]);

/**
 * ---------------------------------------------------------------------------
 * SESSION STORE
 * ---------------------------------------------------------------------------
 * In-memory per-patient state. Swap this Map for a DB/Redis-backed store in
 * production if the process can restart mid-conversation.
 * ---------------------------------------------------------------------------
 */
const sessions = new Map<string, PatientSession>();

function createSession(): PatientSession {
  return {
    name: null,
    stage: 'awaiting_name',
    appointment: {},
    confirmedAppointment: null,
    lastActivityAt: Date.now(),
    contacted: false,
  };
}

function getSession(patientId: string): PatientSession {
  let session = sessions.get(patientId);
  if (!session) {
    session = createSession();
    sessions.set(patientId, session);
  }
  return session;
}

/** Wipes a patient's conversation state (e.g. on explicit "start over" or logout). */
export function resetPatientSession(patientId: string): void {
  sessions.delete(patientId);
}

/** Read-only peek at a patient's current session, useful for admin/debug tooling. */
export function getPatientSessionSnapshot(patientId: string): PatientSession | null {
  const session = sessions.get(patientId);
  return session ? { ...session, appointment: { ...session.appointment } } : null;
}

/**
 * ---------------------------------------------------------------------------
 * TEXT HELPERS
 * ---------------------------------------------------------------------------
 */
function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeKeyword(text: string): string {
  return cleanText(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesWholeTerm(text: string, term: string): boolean {
  const normalizedTerm = normalizeKeyword(term);
  if (!normalizedTerm) return false;
  return new RegExp(`(?:^|\\s)${normalizedTerm.replace(/\s+/g, '\\s+')}(?:$|\\s)`, 'i').test(text);
}

function titleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.replace(/^\w/, (ch) => ch.toUpperCase()))
    .join(' ');
}

/**
 * ---------------------------------------------------------------------------
 * SERVICES / PRICING (kept from the original module, unchanged behaviour)
 * ---------------------------------------------------------------------------
 */
export const appointmentServiceOptions = [
  ...Object.keys(hospitalKnowledge.departments),
  ...hospitalKnowledge.specialistClinics,
].filter((service, index, services) => services.indexOf(service) === index);

export function getServicePrice(service: string): string {
  const match = hospitalKnowledge.surgicalPrices.find((item) =>
    item.procedure.toLowerCase().includes(service.toLowerCase()) ||
    service.toLowerCase().includes(item.procedure.toLowerCase()),
  );

  return match?.price || 'Price on request';
}

/**
 * ---------------------------------------------------------------------------
 * NAME HANDLING
 * ---------------------------------------------------------------------------
 */
export function extractPatientName(message: string): string | null {
  const patterns = [
    /(?:my name is|i am|i'm|call me|this is|name is)\s+([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,3})/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const cleaned = cleanText(match[1]);
      if (cleaned && cleaned.length > 1) {
        return titleCase(cleaned);
      }
    }
  }

  const text = normalizeKeyword(message);
  const words = text.split(' ').filter(Boolean);
  if (words.length >= 1 && words.length <= 4 && !words.some((word) => NON_NAME_WORDS.has(word))) {
    return titleCase(words.join(' '));
  }

  return null;
}

export function isUsablePatientName(name: string | null | undefined): boolean {
  if (!name) return false;
  const words = normalizeKeyword(name).split(' ').filter(Boolean);
  return words.length >= 1 &&
    words.length <= 4 &&
    words.every((word) => /^[a-z][a-z'-]*$/i.test(word)) &&
    !words.some((word) => NON_NAME_WORDS.has(word));
}

/**
 * ---------------------------------------------------------------------------
 * INTENT DETECTION
 * ---------------------------------------------------------------------------
 */
export function isHumanSupportRequest(message: string): boolean {
  return /\b(human|person|agent|staff|doctor|nurse|reception|receptionist|customer care|customer service|talk to|speak to|connect me|assign me|real person|live support|help desk)\b/i.test(message);
}

function isGreeting(normalized: string): boolean {
  return /^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(normalized);
}

function isBookingIntent(normalized: string): boolean {
  return /\b(book|appointment|schedule|visit|consult|consultation)\b/.test(normalized);
}

function isCancelIntent(normalized: string): boolean {
  return /\b(cancel|abort|never mind|nevermind|stop)\b/.test(normalized);
}

function isRestartIntent(normalized: string): boolean {
  return /\b(start over|restart|change details|change everything)\b/.test(normalized);
}

function isConfirmIntent(normalized: string): boolean {
  return normalized === 'yes' || /\b(confirm|correct|thats right|that is right|sure|okay book it|ok book it)\b/.test(normalized);
}

function isChangeFieldIntent(normalized: string): 'date' | 'time' | 'department' | null {
  if (/\bchange (the )?date\b/.test(normalized) || /\bdifferent date\b/.test(normalized)) return 'date';
  if (/\bchange (the )?time\b/.test(normalized) || /\bdifferent time\b/.test(normalized)) return 'time';
  if (/\bchange (the )?(department|service|clinic)\b/.test(normalized) || /\bdifferent (department|service)\b/.test(normalized)) return 'department';
  return null;
}

/**
 * ---------------------------------------------------------------------------
 * APPOINTMENT PARSING
 * ---------------------------------------------------------------------------
 */
const DEPARTMENT_SYNONYMS: Record<string, string[]> = {
  Maternity: ['maternity', 'obstetrics', 'obgyn', 'antenatal', 'delivery', 'labour', 'labor'],
  Pediatrics: ['pediatrics', 'paediatrics', 'pediatric', 'paediatric', 'child', 'children'],
  Emergency: ['emergency', 'ambulance', 'accident', 'trauma', 'casualty'],
  Laboratory: ['laboratory', 'lab', 'tests', 'blood test'],
  Pharmacy: ['pharmacy', 'medicine', 'drugs', 'prescription'],
  Radiology: ['radiology', 'x-ray', 'xray', 'scan', 'ultrasound', 'ct scan', 'mri'],
  Dental: ['dental', 'dentist', 'teeth'],
  Optical: ['optical', 'eye', 'eyes', 'ophthalmology', 'optician'],
  Physiotherapy: ['physiotherapy', 'physio', 'rehab', 'rehabilitation'],
};

function matchDepartment(lower: string): string | undefined {
  const known = [
    ...Object.keys(hospitalKnowledge.departments),
    ...hospitalKnowledge.specialistClinics,
  ];

  const direct = known.find((service) => includesWholeTerm(lower, service));
  if (direct) return direct;

  for (const [department, synonyms] of Object.entries(DEPARTMENT_SYNONYMS)) {
    if (synonyms.some((synonym) => includesWholeTerm(lower, synonym))) {
      return department;
    }
  }

  return undefined;
}

function matchDate(lower: string): string | undefined {
  const relative = lower.match(
    /(day after tomorrow|today|tomorrow|next week|next monday|next tuesday|next wednesday|next thursday|next friday|next saturday|next sunday|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  );
  if (relative) return relative[1];

  const numeric = lower.match(
    /\b(\d{1,2})\s*(?:st|nd|rd|th)?\s*(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i,
  );
  if (numeric) return numeric[0];

  const slashDate = lower.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (slashDate) return slashDate[0];

  return undefined;
}

function matchTime(lower: string): string | undefined {
  if (/\bnoon\b/.test(lower)) return '12:00 PM';
  if (/\bmidnight\b/.test(lower)) return '12:00 AM';

  const clock = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (clock) {
    const hour = Number(clock[1]).toString().padStart(2, '0');
    const minute = (clock[2] || '00').padStart(2, '0');
    return `${hour}:${minute} ${clock[3].toUpperCase()}`;
  }

  // Bare 24h-ish time like "14:00" or "9 o'clock" — assume AM before 8, PM otherwise,
  // since patients rarely book before 8am at a general clinic.
  const bareHour = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:o'?clock)?\b/);
  if (bareHour && Number(bareHour[1]) >= 1 && Number(bareHour[1]) <= 23 && !/\d{4}\b/.test(lower)) {
    const rawHour = Number(bareHour[1]);
    const hour12 = rawHour > 12 ? rawHour - 12 : rawHour;
    const meridiem = rawHour >= 13 || rawHour === 0 ? 'PM' : rawHour < 8 ? 'AM' : 'PM';
    const minute = (bareHour[2] || '00').padStart(2, '0');
    return `${hour12.toString().padStart(2, '0')}:${minute} ${meridiem}`;
  }

  return undefined;
}

export function parseAppointmentRequest(message: string): AppointmentRequestData {
  const lower = normalizeKeyword(message);
  return {
    department: matchDepartment(lower),
    date: matchDate(lower),
    time: matchTime(lower),
  };
}

/**
 * ---------------------------------------------------------------------------
 * KNOWLEDGE BASE / GENERAL Q&A
 * ---------------------------------------------------------------------------
 * Tries the structured knowledge base first, then falls back to a set of
 * conversational, on-brand answers so replies feel like a helpful front-desk
 * assistant rather than a keyword bot.
 * ---------------------------------------------------------------------------
 */
function getAnswerFromKnowledgeBase(message: string): string | null {
  const directAnswer = searchKnowledgeBase(message);
  if (directAnswer) return directAnswer;

  const lower = normalizeKeyword(message);

  if (lower.includes('price') || lower.includes('cost') || lower.includes('fee') || lower.includes('charge')) {
    return 'I can look up current prices for specific procedures — just tell me which one (for example, "cost of a caesarean section" or "price of an ultrasound") and I will get you a figure or connect you with billing for an exact quote.';
  }

  if (lower.includes('emergency') || lower.includes('ambulance') || (lower.includes('open') && lower.includes('24'))) {
    return 'Our Emergency and Ambulance Unit runs 24/7, every day of the year — you do not need an appointment for emergencies, just come straight in or call us for an ambulance.';
  }

  if (lower.includes('hours') || lower.includes('open') || lower.includes('close')) {
    return 'Emergency services run 24/7. Outpatient clinics and specialist consultations run on scheduled hours that vary by department — tell me which department and I can guide you on booking a slot.';
  }

  if (lower.includes('contact') || lower.includes('phone') || lower.includes('call')) {
    return `You can reach us at Phadam Hospital Nasra on ${hospitalKnowledge.locations[0].phoneNumbers.join(', ')}, or Phadam Hospital Umoja on ${hospitalKnowledge.locations[1].phoneNumbers.join(', ')}. Which branch do you need?`;
  }

  if (lower.includes('sha') || lower.includes('insurance') || lower.includes('cover') || lower.includes('nhif')) {
    return [
      'Yes — we accept SHA as well as several private medical insurance partners, including AON Minet, Sanlam, Britam, UAP, and CIC General.',
      '',
      'Please have your membership details and any required preauthorization ready before your visit, since coverage can vary by plan.',
    ].join('\n');
  }

  if (lower.includes('location') || lower.includes('where') || lower.includes('address') || lower.includes('branch') || lower.includes('directions')) {
    return [
      'We have two branches:',
      '',
      `• ${hospitalKnowledge.locations[0].branch}: ${hospitalKnowledge.locations[0].address} (near ${hospitalKnowledge.locations[0].landmark}) — ${hospitalKnowledge.locations[0].phoneNumbers.join(', ')}`,
      `• ${hospitalKnowledge.locations[1].branch}: ${hospitalKnowledge.locations[1].address} (near ${hospitalKnowledge.locations[1].landmark}) — ${hospitalKnowledge.locations[1].phoneNumbers.join(', ')}`,
    ].join('\n');
  }

  if (lower.includes('service') || lower.includes('offer') || lower.includes('department')) {
    return [
      'We offer general consultation, maternity, pediatrics, emergency care, pharmacy, laboratory, radiology, dental, optical, physiotherapy, and a range of specialist clinics.',
      '',
      'Tell me which one you need and I can either answer questions about it or start booking an appointment.',
    ].join('\n');
  }

  return null;
}

/**
 * ---------------------------------------------------------------------------
 * APPOINTMENT FLOW (state machine)
 * ---------------------------------------------------------------------------
 */
function summarizeAppointment(appointment: Partial<AppointmentRequestData>): string {
  const parts: string[] = [];
  if (appointment.department) parts.push(`department: ${appointment.department}`);
  if (appointment.date) parts.push(`date: ${appointment.date}`);
  if (appointment.time) parts.push(`time: ${appointment.time}`);
  return parts.join(', ');
}

function missingAppointmentFields(appointment: Partial<AppointmentRequestData>): string[] {
  const missing: string[] = [];
  if (!appointment.department) missing.push('department or service');
  if (!appointment.date) missing.push('preferred date');
  if (!appointment.time) missing.push('preferred time');
  return missing;
}

export function generateAppointmentCollectionPrompt(
  patientName: string,
  currentData: Partial<AppointmentRequestData> = {},
): string {
  const missing = missingAppointmentFields(currentData);

  if (!missing.length) {
    return `Thanks, ${patientName}. Please confirm: ${summarizeAppointment(currentData)}. Reply YES to confirm, or tell me what to change.`;
  }

  const known = summarizeAppointment(currentData);
  const knownLine = known ? ` So far I have ${known}.` : '';
  const askLine = missing.length === 1
    ? `Could you tell me your preferred ${missing[0]}?`
    : `Could you tell me the ${missing.join(', ')}?`;

  return `Sure, ${patientName} — let's get your appointment booked.${knownLine} ${askLine} You can also give me everything at once, for example: "tomorrow at 9am in Maternity".`;
}

/** Handles every message once we know the patient's name and the intent is appointment-related. */
function handleAppointmentFlow(session: PatientSession, patientName: string, text: string, normalized: string): string {
  if (isCancelIntent(normalized)) {
    session.appointment = {};
    session.stage = 'menu';
    return `No problem, ${patientName}. I have cancelled that request. Let me know if you would like to book something else.`;
  }

  if (isRestartIntent(normalized)) {
    session.appointment = {};
    session.stage = 'collecting_appointment';
    return `Okay, ${patientName}, let's start fresh. Which department or service is this appointment for?`;
  }

  const parsed = parseAppointmentRequest(text);

  if (session.stage === 'confirming_appointment') {
    const fieldToChange = isChangeFieldIntent(normalized);
    if (fieldToChange) {
      delete session.appointment[fieldToChange];
      session.stage = 'collecting_appointment';
      return `Sure — what would you like the ${fieldToChange} to be instead?`;
    }

    // Allow the patient to just state a new value instead of confirming.
    if (parsed.date) session.appointment.date = parsed.date;
    if (parsed.time) session.appointment.time = parsed.time;
    if (parsed.department) session.appointment.department = parsed.department;

    if (isConfirmIntent(normalized)) {
      const finalAppointment = session.appointment as AppointmentRequestData;
      session.confirmedAppointment = finalAppointment;
      session.appointment = {};
      session.stage = 'menu';
      return `You're all set, ${patientName}! Your appointment is booked for ${finalAppointment.date} at ${finalAppointment.time} in the ${finalAppointment.department} department. We look forward to seeing you.`;
    }

    if (parsed.date || parsed.time || parsed.department) {
      return `Got it. Please confirm the updated details: ${summarizeAppointment(session.appointment)}. Reply YES to confirm, or tell me what else to change.`;
    }

    return `Just to confirm, ${patientName}: ${summarizeAppointment(session.appointment)}. Reply YES to confirm, or tell me what to change.`;
  }

  // stage === 'collecting_appointment' (or transitioning into it)
  if (parsed.date) session.appointment.date = session.appointment.date ?? parsed.date;
  if (parsed.time) session.appointment.time = session.appointment.time ?? parsed.time;
  if (parsed.department) session.appointment.department = session.appointment.department ?? parsed.department;

  const missing = missingAppointmentFields(session.appointment);
  if (missing.length) {
    session.stage = 'collecting_appointment';
    return generateAppointmentCollectionPrompt(patientName, session.appointment);
  }

  session.stage = 'confirming_appointment';
  return `Thanks, ${patientName}. Please confirm: ${summarizeAppointment(session.appointment)}. Reply YES to confirm, or tell me what to change.`;
}

/**
 * ---------------------------------------------------------------------------
 * GREETING HELPERS
 * ---------------------------------------------------------------------------
 */
export function getKenyaGreeting(date: Date = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(date));

  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const MENU_LINE = 'You can book an appointment, ask about a department or service, check prices, get our locations, ask about SHA/insurance, or request a staff member.';

/**
 * ---------------------------------------------------------------------------
 * MAIN ENTRY POINT
 * ---------------------------------------------------------------------------
 * This function is the single source of truth for the conversation. It:
 *  1. Always requires a name captured through chat before anything else runs.
 *  2. Routes human-support requests to a handoff message.
 *  3. Greets naturally, distinguishing fresh vs. returning-after-a-gap chats.
 *  4. Runs the full appointment state machine when relevant.
 *  5. Falls back to the knowledge base, then a helpful generic fallback.
 * ---------------------------------------------------------------------------
 */
export function generateBotReply({ patientId, message }: BotReplyInput): string {
  const session = getSession(patientId);
  const now = Date.now();
  const wasIdleLongEnough = now - session.lastActivityAt >= SESSION_IDLE_MS;
  const isFirstMessageEver = !session.contacted;
  session.contacted = true;
  session.lastActivityAt = now;

  const text = cleanText(message || '');
  if (!text) {
    return session.name
      ? `Please tell me what you need today, ${session.name}. ${MENU_LINE}`
      : DEFAULT_WELCOME;
  }

  const normalized = normalizeKeyword(text);

  // ---- RULE #1: never proceed without a name captured through THIS chat ----
  if (!session.name) {
    const extracted = extractPatientName(text);
    if (extracted && isUsablePatientName(extracted)) {
      session.name = extracted;
      session.stage = 'menu';
      return [
        `Thank you, ${session.name}. ${getKenyaGreeting()}, and welcome to Phadam Hospital!`,
        '',
        MENU_LINE,
      ].join('\n');
    }
    return isFirstMessageEver ? DEFAULT_WELCOME : NAME_PROMPT;
  }

  const patientName = session.name;

  // ---- Human handoff always available, but only after we have a name ----
  if (isHumanSupportRequest(text)) {
    session.stage = 'human_handoff';
    return `Thank you, ${patientName}. I have flagged this chat for our staff. Please briefly describe what you need and someone will join the conversation shortly.`;
  }

  // ---- Greeting handling ----
  if (isGreeting(normalized) && session.stage !== 'collecting_appointment' && session.stage !== 'confirming_appointment') {
    if (wasIdleLongEnough) {
      return [
        `${getKenyaGreeting()}, ${patientName}. Welcome back to Phadam Hospital.`,
        '',
        MENU_LINE,
      ].join('\n');
    }
    return `${getKenyaGreeting()}, ${patientName}. ${MENU_LINE}`;
  }

  // ---- Appointment flow: enter it, or continue it if already in progress ----
  const inAppointmentFlow = session.stage === 'collecting_appointment' || session.stage === 'confirming_appointment';
  const parsedGuess = parseAppointmentRequest(text);
  const looksLikeAppointmentDetails = Boolean(parsedGuess.date || parsedGuess.time || parsedGuess.department);

  if (inAppointmentFlow || isBookingIntent(normalized) || looksLikeAppointmentDetails) {
    if (!inAppointmentFlow) {
      session.stage = 'collecting_appointment';
    }
    return handleAppointmentFlow(session, patientName, text, normalized);
  }

  // ---- Knowledge base / general Q&A ----
  const answer = getAnswerFromKnowledgeBase(text);
  if (answer) {
    return `${answer}\n\nWhat would you like to do next, ${patientName}?`;
  }

  return [
    `Thank you, ${patientName}.`,
    '',
    "I don't have a confident answer for that yet — one of our doctors or staff can help with anything medically specific.",
    MENU_LINE,
  ].join('\n');
}