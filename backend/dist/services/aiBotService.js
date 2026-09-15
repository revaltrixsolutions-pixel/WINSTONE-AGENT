import {
  hospitalKnowledge,
  searchKnowledgeBase,
} from '../knowledge/hospitalData';

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

export type AppointmentConversationState = {
  patientName: string;
  appointment: Partial<AppointmentRequestData>;
};

/* =========================================================
   SETTINGS
========================================================= */

export const CONVERSATION_MEMORY_MINUTES = 3;

const SESSION_IDLE_MS =
  CONVERSATION_MEMORY_MINUTES * 60 * 1000;

const NAME_PROMPT =
  'Before we continue, please tell me your full name.';

const DEFAULT_WELCOME =
  `Welcome to Phadam Hospital. ${NAME_PROMPT}`;

const MENU_LINE =
  'You can book an appointment, ask about a department or service, check prices, get our locations, ask about SHA/insurance, or request a staff member.';

/* =========================================================
   SESSION STORE
========================================================= */

const sessions = new Map<string, PatientSession>();

export const appointmentConversationState =
  new Map<string, AppointmentConversationState>();

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

export function resetPatientSession(
  patientId: string,
): void {
  sessions.delete(patientId);
  appointmentConversationState.delete(patientId);
}

export function getPatientSessionSnapshot(
  patientId: string,
): PatientSession | null {
  const session = sessions.get(patientId);

  if (!session) {
    return null;
  }

  return {
    ...session,
    appointment: {
      ...session.appointment,
    },
    confirmedAppointment: session.confirmedAppointment
      ? {
          ...session.confirmedAppointment,
        }
      : null,
  };
}

/* =========================================================
   CONVERSATION AGE
========================================================= */

export function isConversationStale(
  lastInteractionHours: number,
): boolean {
  if (!Number.isFinite(lastInteractionHours)) {
    return false;
  }

  return (
    lastInteractionHours * 60 >=
    CONVERSATION_MEMORY_MINUTES
  );
}

/* =========================================================
   TEXT HELPERS
========================================================= */

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeKeyword(text: string): string {
  return cleanText(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
}

function includesWholeTerm(
  text: string,
  term: string,
): boolean {
  const normalizedText = normalizeKeyword(text);
  const normalizedTerm = normalizeKeyword(term);

  if (!normalizedTerm) {
    return false;
  }

  const pattern = normalizedTerm
    .split(/\s+/)
    .map(escapeRegExp)
    .join('\\s+');

  return new RegExp(
    `(?:^|\\s)${pattern}(?:$|\\s)`,
    'i',
  ).test(normalizedText);
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word.charAt(0).toUpperCase() +
      word.slice(1).toLowerCase(),
    )
    .join(' ');
}

/* =========================================================
   SERVICES / PRICING
========================================================= */

export const appointmentServiceOptions = [
  ...Object.keys(hospitalKnowledge.departments),
  ...hospitalKnowledge.specialistClinics,
].filter(
  (service, index, services) =>
    services.indexOf(service) === index,
);

export function getServicePrice(
  service: string,
): string {
  const normalizedService =
    normalizeKeyword(service);

  if (!normalizedService) {
    return 'Price on request';
  }

  const match =
    hospitalKnowledge.surgicalPrices.find(
      (item) => {
        const procedure =
          normalizeKeyword(item.procedure);

        return (
          procedure.includes(normalizedService) ||
          normalizedService.includes(procedure)
        );
      },
    );

  return match?.price || 'Price on request';
}

/* =========================================================
   NAME HANDLING
========================================================= */

const NON_NAME_WORDS = new Set([
  'assign',
  'me',
  'help',
  'please',
  'book',
  'appointment',
  'appointments',
  'need',
  'visit',
  'hello',
  'hi',
  'hey',
  'thanks',
  'thank',
  'you',
  'yes',
  'no',
  'okay',
  'ok',
  'patient',
  'patients',
  'hospital',
  'phadam',
  'phadam hospital',
  'revaltrix',
  'revaltrix solutions',
  'solutions',
  'today',
  'tomorrow',
  'morning',
  'afternoon',
  'evening',
  'date',
  'time',
  'department',
  'service',
  'emergency',
  'maternity',
  'pediatrics',
  'laboratory',
  'pharmacy',
  'radiology',
  'dental',
  'optical',
  'physiotherapy',
  'what',
  'where',
  'when',
  'why',
  'how',
  'can',
  'could',
  'would',
]);

export function isUsablePatientName(
  name: string | null | undefined,
): boolean {
  if (!name) {
    return false;
  }

  const normalized = normalizeKeyword(name);

  if (!normalized) {
    return false;
  }

  if (
    normalized === 'revaltrix solutions' ||
    normalized === 'revaltrix' ||
    normalized === 'phadam hospital' ||
    normalized === 'phadam' ||
    normalized === 'hospital' ||
    normalized === 'solutions'
  ) {
    return false;
  }

  const words = normalized
    .split(' ')
    .filter(Boolean);

  if (words.length < 1 || words.length > 4) {
    return false;
  }

  if (
    words.some((word) =>
      NON_NAME_WORDS.has(word),
    )
  ) {
    return false;
  }

  return words.every((word) =>
    /^[a-z][a-z'-]*$/i.test(word),
  );
}

export function extractPatientName(
  message: string,
): string | null {
  const cleaned = cleanText(message);

  const explicitPatterns = [
    /(?:my name is|i am|i'm|call me|this is|name is)\s+(.+?)(?:[.!?,]|$)/i,
  ];

  for (const pattern of explicitPatterns) {
    const match = cleaned.match(pattern);

    if (!match?.[1]) {
      continue;
    }

    const candidateText = cleanText(match[1]);

    const candidate = titleCase(
      candidateText,
    );

    if (isUsablePatientName(candidate)) {
      return candidate;
    }
  }

  const normalized = normalizeKeyword(cleaned);

  const words = normalized
    .split(' ')
    .filter(Boolean);

  if (
    words.length >= 1 &&
    words.length <= 4 &&
    !words.some((word) =>
      NON_NAME_WORDS.has(word),
    )
  ) {
    const candidate = titleCase(
      words.join(' '),
    );

    if (isUsablePatientName(candidate)) {
      return candidate;
    }
  }

  return null;
}

/* =========================================================
   INTENT DETECTION
========================================================= */

export function isHumanSupportRequest(
  message: string,
): boolean {
  return /\b(human|person|agent|staff|doctor|nurse|reception|receptionist|customer care|customer service|talk to|speak to|connect me|assign me|real person|live support|help desk)\b/i.test(
    message,
  );
}

function isGreeting(
  normalized: string,
): boolean {
  return /^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(
    normalized,
  );
}

function isBookingIntent(
  normalized: string,
): boolean {
  return /\b(book|appointment|appointments|schedule|visit|consult|consultation)\b/.test(
    normalized,
  );
}

function isCancelIntent(
  normalized: string,
): boolean {
  return /\b(cancel|abort|never mind|nevermind|stop)\b/.test(
    normalized,
  );
}

function isRestartIntent(
  normalized: string,
): boolean {
  return /\b(start over|restart|change everything)\b/.test(
    normalized,
  );
}

function isConfirmIntent(
  normalized: string,
): boolean {
  return (
    normalized === 'yes' ||
    normalized === 'y' ||
    /\b(confirm|confirmed|correct|thats right|that's right|that is right|sure|okay book it|ok book it|book it)\b/.test(
      normalized,
    )
  );
}

function isChangeFieldIntent(
  normalized: string,
): 'date' | 'time' | 'department' | null {
  if (
    /\b(change|modify|update)\s+(the\s+)?date\b/.test(
      normalized,
    ) ||
    /\bdifferent date\b/.test(normalized)
  ) {
    return 'date';
  }

  if (
    /\b(change|modify|update)\s+(the\s+)?time\b/.test(
      normalized,
    ) ||
    /\bdifferent time\b/.test(normalized)
  ) {
    return 'time';
  }

  if (
    /\b(change|modify|update)\s+(the\s+)?(department|service|clinic)\b/.test(
      normalized,
    ) ||
    /\bdifferent (department|service|clinic)\b/.test(
      normalized,
    )
  ) {
    return 'department';
  }

  return null;
}

/* =========================================================
   APPOINTMENT PARSING
========================================================= */

const DEPARTMENT_SYNONYMS: Record<
  string,
  string[]
> = {
  Maternity: [
    'maternity',
    'obstetrics',
    'obgyn',
    'antenatal',
    'delivery',
    'labour',
    'labor',
  ],

  Pediatrics: [
    'pediatrics',
    'paediatrics',
    'pediatric',
    'paediatric',
    'child',
    'children',
  ],

  Emergency: [
    'emergency',
    'ambulance',
    'accident',
    'trauma',
    'casualty',
  ],

  Laboratory: [
    'laboratory',
    'lab',
    'tests',
    'blood test',
  ],

  Pharmacy: [
    'pharmacy',
    'medicine',
    'medicines',
    'drugs',
    'prescription',
  ],

  Radiology: [
    'radiology',
    'x-ray',
    'xray',
    'scan',
    'ultrasound',
    'ct scan',
    'mri',
  ],

  Dental: [
    'dental',
    'dentist',
    'teeth',
  ],

  Optical: [
    'optical',
    'eye',
    'eyes',
    'ophthalmology',
    'optician',
  ],

  Physiotherapy: [
    'physiotherapy',
    'physio',
    'rehab',
    'rehabilitation',
  ],
};

function matchDepartment(
  text: string,
): string | undefined {
  const lower = normalizeKeyword(text);

  const known = [
    ...Object.keys(
      hospitalKnowledge.departments,
    ),
    ...hospitalKnowledge.specialistClinics,
  ];

  const direct = known.find((service) =>
    includesWholeTerm(lower, service),
  );

  if (direct) {
    return direct;
  }

  for (const [
    department,
    synonyms,
  ] of Object.entries(
    DEPARTMENT_SYNONYMS,
  )) {
    if (
      synonyms.some((synonym) =>
        includesWholeTerm(
          lower,
          synonym,
        ),
      )
    ) {
      return department;
    }
  }

  return undefined;
}

function matchDate(
  text: string,
): string | undefined {
  const lower = normalizeKeyword(text);

  const relative = lower.match(
    /\b(day after tomorrow|today|tomorrow|next week|next monday|next tuesday|next wednesday|next thursday|next friday|next saturday|next sunday|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  );

  if (relative) {
    return titleCase(relative[1]);
  }

  const monthDate = lower.match(
    /\b\d{1,2}(?:st|nd|rd|th)?(?:\s+of)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i,
  );

  if (monthDate) {
    return titleCase(
      monthDate[0],
    );
  }

  const slashDate = lower.match(
    /\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/,
  );

  if (slashDate) {
    return slashDate[0];
  }

  return undefined;
}

function matchTime(
  text: string,
): string | undefined {
  const lower = normalizeKeyword(text);

  if (/\bnoon\b/.test(lower)) {
    return '12:00 PM';
  }

  if (/\bmidnight\b/.test(lower)) {
    return '12:00 AM';
  }

  const clock = lower.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
  );

  if (clock) {
    const hour = Number(clock[1]);
    const minute = Number(
      clock[2] || '00',
    );

    if (
      hour < 1 ||
      hour > 12 ||
      minute > 59
    ) {
      return undefined;
    }

    return (
      `${hour.toString().padStart(2, '0')}:` +
      `${minute.toString().padStart(2, '0')} ` +
      `${clock[3].toUpperCase()}`
    );
  }

  const twentyFourHour = lower.match(
    /\b([01]?\d|2[0-3]):([0-5]\d)\b/,
  );

  if (twentyFourHour) {
    const hour24 = Number(
      twentyFourHour[1],
    );

    const minute = Number(
      twentyFourHour[2],
    );

    const meridiem =
      hour24 >= 12 ? 'PM' : 'AM';

    const hour12 =
      hour24 % 12 || 12;

    return (
      `${hour12.toString().padStart(2, '0')}:` +
      `${minute.toString().padStart(2, '0')} ` +
      meridiem
    );
  }

  /*
   * A bare number is accepted as a time only when it is
   * clearly being supplied as an appointment time.
   *
   * 1–7  => AM
   * 8–12 => PM
   * 13–23 => PM converted from 24-hour format
   */
  const bareHour = lower.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(?:o'?clock)?\b/,
  );

  if (
    bareHour &&
    !/\b\d{4}\b/.test(lower)
  ) {
    const rawHour = Number(
      bareHour[1],
    );

    const minute = Number(
      bareHour[2] || '00',
    );

    if (
      rawHour < 1 ||
      rawHour > 23 ||
      minute > 59
    ) {
      return undefined;
    }

    const hour12 =
      rawHour > 12
        ? rawHour - 12
        : rawHour;

    const meridiem =
      rawHour >= 13
        ? 'PM'
        : rawHour < 8
          ? 'AM'
          : 'PM';

    return (
      `${hour12.toString().padStart(2, '0')}:` +
      `${minute.toString().padStart(2, '0')} ` +
      meridiem
    );
  }

  return undefined;
}

export function parseAppointmentRequest(
  message: string,
): AppointmentRequestData {
  const department =
    matchDepartment(message);

  const date =
    matchDate(message);

  const time =
    matchTime(message);

  return {
    department,
    date,
    time,
    ready: Boolean(
      department &&
      date &&
      time,
    ),
  };
}

/* =========================================================
   LEGACY APPOINTMENT STATE
========================================================= */

export function updateAppointmentConversation(
  patientId: string,
  patientName: string,
  message: string,
): AppointmentConversationState {
  const existing =
    appointmentConversationState.get(
      patientId,
    );

  const parsed =
    parseAppointmentRequest(message);

  const existingAppointment =
    existing?.appointment || {};

  const appointment: Partial<AppointmentRequestData> =
    {
      ...existingAppointment,

      ...(parsed.date
        ? {
            date: parsed.date,
          }
        : {}),

      ...(parsed.time
        ? {
            time: parsed.time,
          }
        : {}),

      ...(parsed.department
        ? {
            department:
              parsed.department,
          }
        : {}),
    };

  appointment.ready = Boolean(
    appointment.department &&
    appointment.date &&
    appointment.time,
  );

  const state: AppointmentConversationState = {
    patientName,
    appointment,
  };

  appointmentConversationState.set(
    patientId,
    state,
  );

  return state;
}

/* =========================================================
   KNOWLEDGE BASE
========================================================= */

function getAnswerFromKnowledgeBase(
  message: string,
): string | null {
  const lower =
    normalizeKeyword(message);

  /*
   * Handle SHA/insurance directly before the generic
   * knowledge-base search so the answer always contains
   * the hospital-location guidance expected for this intent.
   */
  if (
    /\b(sha|insurance|medical cover|cover|nhif)\b/i.test(
      lower,
    )
  ) {
    return [
      'Yes — we accept SHA as well as several private medical insurance partners, including AON Minet, Sanlam, Britam, UAP, and CIC General.',
      '',
      'Please have your membership details and any required preauthorization ready before your visit, since coverage can vary by plan.',
      '',
      'Phadam Hospital has branches in Nasra and Umoja, Kenya. Please confirm the branch and eligibility requirements before treatment.',
    ].join('\n');
  }

  const directAnswer =
    searchKnowledgeBase(message);

  if (directAnswer) {
    return directAnswer;
  }

  if (
    lower.includes('price') ||
    lower.includes('cost') ||
    lower.includes('fee') ||
    lower.includes('charge')
  ) {
    return (
      'I can look up current prices for specific procedures. ' +
      'Tell me the procedure or service you need and I can give you the available price or connect you with billing for an exact quote.'
    );
  }

  if (
    lower.includes('emergency') ||
    lower.includes('ambulance') ||
    (
      lower.includes('open') &&
      lower.includes('24')
    )
  ) {
    return (
      'Our Emergency and Ambulance Unit runs 24/7. ' +
      'You do not need an appointment for an emergency. ' +
      'Please come straight in or contact the hospital for ambulance assistance.'
    );
  }

  if (
    lower.includes('hours') ||
    lower.includes('open') ||
    lower.includes('close')
  ) {
    return (
      'Emergency services run 24/7. ' +
      'Outpatient clinics and specialist consultations operate on scheduled hours that vary by department.'
    );
  }

  if (
    lower.includes('contact') ||
    lower.includes('phone') ||
    lower.includes('call')
  ) {
    return (
      `You can reach Phadam Hospital Nasra on ` +
      `${hospitalKnowledge.locations[0].phoneNumbers.join(', ')}, ` +
      `or Phadam Hospital Umoja on ` +
      `${hospitalKnowledge.locations[1].phoneNumbers.join(', ')}. ` +
      `Which branch do you need?`
    );
  }

  if (
    lower.includes('location') ||
    lower.includes('where') ||
    lower.includes('address') ||
    lower.includes('branch') ||
    lower.includes('directions')
  ) {
    return [
      'We have two branches:',
      '',
      `• ${hospitalKnowledge.locations[0].branch}: ${hospitalKnowledge.locations[0].address} (near ${hospitalKnowledge.locations[0].landmark}) — ${hospitalKnowledge.locations[0].phoneNumbers.join(', ')}`,
      `• ${hospitalKnowledge.locations[1].branch}: ${hospitalKnowledge.locations[1].address} (near ${hospitalKnowledge.locations[1].landmark}) — ${hospitalKnowledge.locations[1].phoneNumbers.join(', ')}`,
    ].join('\n');
  }

  if (
    lower.includes('service') ||
    lower.includes('offer') ||
    lower.includes('department')
  ) {
    return [
      'We offer general consultation, maternity, pediatrics, emergency care, pharmacy, laboratory, radiology, dental, optical, physiotherapy, and a range of specialist clinics.',
      '',
      'Tell me which one you need and I can either answer questions about it or start booking an appointment.',
    ].join('\n');
  }

  return null;
}

/* =========================================================
   APPOINTMENT HELPERS
========================================================= */

function summarizeAppointment(
  appointment: Partial<AppointmentRequestData>,
): string {
  const parts: string[] = [];

  if (appointment.department) {
    parts.push(
      `department: ${appointment.department}`,
    );
  }

  if (appointment.date) {
    parts.push(
      `date: ${appointment.date}`,
    );
  }

  if (appointment.time) {
    parts.push(
      `time: ${appointment.time}`,
    );
  }

  return parts.join(', ');
}

function missingAppointmentFields(
  appointment: Partial<AppointmentRequestData>,
): Array<'department or service' | 'preferred date' | 'preferred time'> {
  const missing: Array<
    'department or service' |
    'preferred date' |
    'preferred time'
  > = [];

  if (!appointment.department) {
    missing.push('department or service');
  }

  if (!appointment.date) {
    missing.push('preferred date');
  }

  if (!appointment.time) {
    missing.push('preferred time');
  }

  return missing;
}

export function generateAppointmentCollectionPrompt(
  patientName: string,
  currentData: Partial<AppointmentRequestData> = {},
): string {
  const missing =
    missingAppointmentFields(
      currentData,
    );

  if (!missing.length) {
    return (
      `Thanks, ${patientName}. Please confirm: ` +
      `${summarizeAppointment(currentData)}. ` +
      `Reply YES to confirm, or tell me what to change.`
    );
  }

  const known =
    summarizeAppointment(currentData);

  const knownLine = known
    ? `So far I have ${known}.`
    : '';

  if (
    !currentData.department &&
    currentData.date &&
    currentData.time
  ) {
    return (
      `Thank you, ${patientName}. ` +
      `I have your preferred date and time: ` +
      `${currentData.date} at ${currentData.time}. ` +
      `What department or service would you like for your appointment? ` +
      `Once you select the department, I will show you the complete booking details.`
    );
  }

  if (
    !currentData.date &&
    currentData.department &&
    currentData.time
  ) {
    return (
      `Thank you, ${patientName}. ` +
      `I have ${currentData.department} and ` +
      `${currentData.time}. ` +
      `What date would you prefer for the appointment?`
    );
  }

  if (
    !currentData.time &&
    currentData.department &&
    currentData.date
  ) {
    return (
      `Thank you, ${patientName}. ` +
      `I have ${currentData.department} for ${currentData.date}. ` +
      `What time would you prefer?`
    );
  }

  if (!currentData.department) {
    return (
      `Sure, ${patientName} — let's get your appointment booked. ` +
      `${knownLine ? `${knownLine} ` : ''}` +
      `What department or service would you like? ` +
      `You can also provide the date and time together, for example: ` +
      `"tomorrow at 9am in Maternity".`
    );
  }

  if (!currentData.date) {
    return (
      `Sure, ${patientName}. ` +
      `${knownLine ? `${knownLine} ` : ''}` +
      `What date would you prefer for the appointment?`
    );
  }

  if (!currentData.time) {
    return (
      `Sure, ${patientName}. ` +
      `${knownLine ? `${knownLine} ` : ''}` +
      `What time would you prefer for the appointment?`
    );
  }

  return (
    `Sure, ${patientName}. ` +
    `${knownLine} ` +
    `Please provide the remaining appointment details.`
  );
}

/* =========================================================
   APPOINTMENT FLOW
========================================================= */

function handleAppointmentFlow(
  session: PatientSession,
  patientName: string,
  text: string,
  normalized: string,
): string {
  if (isCancelIntent(normalized)) {
    session.appointment = {};
    session.stage = 'menu';

    return (
      `No problem, ${patientName}. ` +
      `I have cancelled that appointment request. ` +
      `Let me know if you would like to book another appointment.`
    );
  }

  if (isRestartIntent(normalized)) {
    session.appointment = {};
    session.stage =
      'collecting_appointment';

    return (
      `Okay, ${patientName}, let's start fresh. ` +
      `Which department or service would you like to book?`
    );
  }

  const parsed =
    parseAppointmentRequest(text);

  /*
   * =======================================================
   * CONFIRMING
   * =======================================================
   */

  if (
    session.stage ===
    'confirming_appointment'
  ) {
    const fieldToChange =
      isChangeFieldIntent(normalized);

    if (fieldToChange) {
      delete session.appointment[
        fieldToChange
      ];

      session.stage =
        'collecting_appointment';

      return generateAppointmentCollectionPrompt(
        patientName,
        session.appointment,
      );
    }

    if (parsed.department) {
      session.appointment.department =
        parsed.department;
    }

    if (parsed.date) {
      session.appointment.date =
        parsed.date;
    }

    if (parsed.time) {
      session.appointment.time =
        parsed.time;
    }

    const ready = Boolean(
      session.appointment.department &&
      session.appointment.date &&
      session.appointment.time,
    );

    session.appointment.ready =
      ready;

    if (
      isConfirmIntent(normalized) &&
      ready
    ) {
      const finalAppointment: AppointmentRequestData =
        {
          department:
            session.appointment
              .department!,
          date:
            session.appointment.date!,
          time:
            session.appointment.time!,
          ready: true,
        };

      session.confirmedAppointment =
        finalAppointment;

      /*
       * Keep the confirmed appointment available
       * for the webhook/controller to consume.
       */
      session.appointment = {
        ...finalAppointment,
      };

      session.stage =
        'confirming_appointment';

      return [
        `Thank you, ${patientName}.`,
        '',
        'Your appointment details are:',
        `• Department: ${finalAppointment.department}`,
        `• Date: ${finalAppointment.date}`,
        `• Time: ${finalAppointment.time}`,
        '',
        'Your appointment has been confirmed. Our hospital team will complete the final scheduling/doctor assignment.',
      ].join('\n');
    }

    if (
      parsed.department ||
      parsed.date ||
      parsed.time
    ) {
      session.stage =
        'confirming_appointment';

      return [
        `Got it, ${patientName}.`,
        '',
        `Please confirm the updated details:`,
        summarizeAppointment(
          session.appointment,
        ),
        '',
        'Reply YES to confirm, or tell me what you would like to change.',
      ].join('\n');
    }

    return [
      `Just to confirm, ${patientName}:`,
      '',
      summarizeAppointment(
        session.appointment,
      ),
      '',
      'Reply YES to confirm, or tell me what you would like to change.',
    ].join('\n');
  }

  /*
   * =======================================================
   * COLLECTING
   * =======================================================
   *
   * IMPORTANT:
   * Every message updates the SAME session.
   *
   * Emergency
   *   -> department saved
   *
   * Today
   *   -> date added to existing department
   *
   * 09:00 AM
   *   -> time added to existing department/date
   *
   * The bot therefore never sends "09:00 AM" into the
   * generic knowledge-base flow.
   */

  if (parsed.department) {
    session.appointment.department =
      parsed.department;
  }

  if (parsed.date) {
    session.appointment.date =
      parsed.date;
  }

  if (parsed.time) {
    session.appointment.time =
      parsed.time;
  }

  const ready = Boolean(
    session.appointment.department &&
    session.appointment.date &&
    session.appointment.time,
  );

  session.appointment.ready =
    ready;

  if (!ready) {
    session.stage =
      'collecting_appointment';

    return generateAppointmentCollectionPrompt(
      patientName,
      session.appointment,
    );
  }

  session.stage =
    'confirming_appointment';

  return [
    `Thanks, ${patientName}.`,
    '',
    'Please confirm your appointment details:',
    `• Department: ${session.appointment.department}`,
    `• Date: ${session.appointment.date}`,
    `• Time: ${session.appointment.time}`,
    '',
    'Reply YES to confirm, or tell me what you would like to change.',
  ].join('\n');
}

/* =========================================================
   KENYA GREETING
========================================================= */

export function getKenyaGreeting(
  date: Date = new Date(),
): string {
  const hour = Number(
    new Intl.DateTimeFormat(
      'en-GB',
      {
        timeZone: 'Africa/Nairobi',
        hour: '2-digit',
        hourCycle: 'h23',
      },
    ).format(date),
  );

  if (hour < 12) {
    return 'Good morning';
  }

  if (hour < 18) {
    return 'Good afternoon';
  }

  return 'Good evening';
}

/* =========================================================
   MAIN BOT
========================================================= */

export function generateBotReply(
  input: BotReplyInput,
): string {
  const {
    patientId,
    patientName: legacyPatientName,
    message,
    isReturning,
    lastInteractionHours,
  } = input;

  const effectivePatientId =
    patientId ||
    `legacy:${legacyPatientName || 'anonymous'}`;

  const session =
    getSession(effectivePatientId);

  /*
   * Legacy/test mode only.
   */
  if (
    !patientId &&
    !session.name &&
    legacyPatientName &&
    isUsablePatientName(
      legacyPatientName,
    )
  ) {
    session.name =
      titleCase(
        cleanText(
          legacyPatientName,
        ),
      );

    session.stage = 'menu';
  }

  const now = Date.now();

  let wasIdleLongEnough =
    now - session.lastActivityAt >=
    SESSION_IDLE_MS;

  if (
    typeof isReturning === 'boolean'
  ) {
    wasIdleLongEnough =
      isReturning;
  }

  if (
    typeof lastInteractionHours ===
      'number' &&
    Number.isFinite(
      lastInteractionHours,
    )
  ) {
    wasIdleLongEnough =
      isConversationStale(
        lastInteractionHours,
      );
  }

  /*
   * Do not wipe appointment state merely because the
   * user has been idle for a few minutes. The appointment
   * state belongs to the current patient session.
   */
  const isFirstMessageEver =
    !session.contacted;

  session.contacted = true;
  session.lastActivityAt = now;

  const text =
    cleanText(message || '');

  if (!text) {
    return session.name
      ? `Please tell me what you need today, ${session.name}. ${MENU_LINE}`
      : DEFAULT_WELCOME;
  }

  const normalized =
    normalizeKeyword(text);

  /*
   * =======================================================
   * NAME FIRST
   * =======================================================
   */

  if (!session.name) {
    const extracted =
      extractPatientName(text);

    if (
      extracted &&
      isUsablePatientName(extracted)
    ) {
      session.name =
        extracted;

      session.stage = 'menu';

      return [
        `Thank you, ${session.name}. ${getKenyaGreeting()}, and welcome to Phadam Hospital!`,
        '',
        MENU_LINE,
      ].join('\n');
    }

    return isFirstMessageEver
      ? DEFAULT_WELCOME
      : NAME_PROMPT;
  }

  const currentPatientName =
    session.name;

  /*
   * =======================================================
   * HUMAN HANDOFF
   * =======================================================
   */

  if (
    isHumanSupportRequest(text) &&
    session.stage !==
      'confirming_appointment'
  ) {
    session.stage =
      'human_handoff';

    return (
      `Thank you, ${currentPatientName}. ` +
      `I have flagged this chat for our staff. ` +
      `Please briefly describe what you need and someone will join the conversation shortly.`
    );
  }

  /*
   * =======================================================
   * APPOINTMENT FLOW MUST BE CHECKED BEFORE GREETING,
   * GENERAL Q&A, OR FALLBACK.
   * =======================================================
   */

  const inAppointmentFlow =
    session.stage ===
      'collecting_appointment' ||
    session.stage ===
      'confirming_appointment';

  const parsedGuess =
    parseAppointmentRequest(text);

  const looksLikeAppointmentDetails =
    Boolean(
      parsedGuess.department ||
      parsedGuess.date ||
      parsedGuess.time,
    );

  if (
    inAppointmentFlow ||
    isBookingIntent(normalized) ||
    looksLikeAppointmentDetails
  ) {
    if (!inAppointmentFlow) {
      session.stage =
        'collecting_appointment';
    }

    return handleAppointmentFlow(
      session,
      currentPatientName,
      text,
      normalized,
    );
  }

  /*
   * =======================================================
   * GREETING
   * =======================================================
   */

  if (isGreeting(normalized)) {
    if (wasIdleLongEnough) {
      return [
        `${getKenyaGreeting()}, ${currentPatientName}. Welcome back to Phadam Hospital.`,
        '',
        MENU_LINE,
      ].join('\n');
    }

    return (
      `${getKenyaGreeting()}, ${currentPatientName}. ` +
      `${MENU_LINE}`
    );
  }

  /*
   * =======================================================
   * KNOWLEDGE BASE
   * =======================================================
   */

  const answer =
    getAnswerFromKnowledgeBase(text);

  if (answer) {
    return [
      answer,
      '',
      `What would you like to do next, ${currentPatientName}?`,
    ].join('\n');
  }

  /*
   * =======================================================
   * SAFE FALLBACK
   * =======================================================
   */

  return [
    `Thank you, ${currentPatientName}.`,
    '',
    `I don't have a confident answer for that yet — one of our doctors or staff can help with anything medically specific.`,
    '',
    MENU_LINE,
  ].join('\n');
}