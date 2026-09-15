import { hospitalKnowledge, searchKnowledgeBase } from '../knowledge/hospitalData';

export type BotReplyInput = {
  patientName: string | null;
  message: string;
  isReturning: boolean;
  lastInteractionHours: number;
};

export type AppointmentRequestData = {
  date?: string;
  time?: string;
  department?: string;
  ready: boolean;
};

export const appointmentServiceOptions = [
  ...Object.keys(hospitalKnowledge.departments),
  ...hospitalKnowledge.specialistClinics,
].filter((service, index, services) => services.indexOf(service) === index);

function includesWholeTerm(text: string, term: string): boolean {
  const normalizedTerm = normalizeKeyword(term);
  return new RegExp(`(?:^|\\s)${normalizedTerm.replace(/\\s+/g, '\\s+')}(?:$|\\s)`, 'i').test(text);
}

export const appointmentConversationState = new Map<string, Partial<AppointmentRequestData>>();

export const CONVERSATION_MEMORY_MINUTES = 3;

const DEFAULT_WELCOME =
  'Welcome to Phadam Hospital. We are here to help you with your care needs. What is your name?';

const NON_NAME_WORDS = new Set([
  'assign', 'me', 'help', 'please', 'book', 'appointment', 'appointments', 'need', 'visit',
  'hello', 'hi', 'hey', 'thanks', 'thank', 'you', 'yes', 'no', 'okay', 'patient',
  'how', 'what', 'where', 'when', 'why', 'can', 'could', 'would',
]);

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

export function extractPatientName(message: string): string | null {
  const text = normalizeKeyword(message);
  const patterns = [
    /(?:my name is|i am|i'm|call me|this is|name is)\s+([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,3})/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const cleaned = cleanText(match[1]).replace(/^\s+|\s+$/g, '');
      if (cleaned && cleaned.length > 1) {
        return cleaned;
      }
    }
  }

  const words = text.split(' ').filter(Boolean);
  if (words.length >= 2 && words.length <= 4 && !words.some((word) => NON_NAME_WORDS.has(word))) {
    return words.map((word) => word.replace(/^\w/, (ch) => ch.toUpperCase())).join(' ');
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

export function isConversationStale(lastInteractionHours: number): boolean {
  return Number.isFinite(lastInteractionHours) &&
    lastInteractionHours >= CONVERSATION_MEMORY_MINUTES / 60;
}

export function isHumanSupportRequest(message: string): boolean {
  return /\b(human|person|agent|staff|doctor|nurse|reception|receptionist|customer care|customer service|talk to|speak to|connect me|assign me|real person|live support|help desk)\b/i.test(message);
}

export function parseAppointmentRequest(message: string): AppointmentRequestData {
  const lower = normalizeKeyword(message);
  const departmentMatch =
    Object.keys(hospitalKnowledge.departments).find((department) => includesWholeTerm(lower, department)) ||
    (includesWholeTerm(lower, 'maternity') ? 'Maternity' : undefined) ||
    (includesWholeTerm(lower, 'pediatric') || includesWholeTerm(lower, 'paediatric') ? 'Pediatrics' : undefined) ||
    (includesWholeTerm(lower, 'emergency') ? 'Emergency' : undefined) ||
    (includesWholeTerm(lower, 'laboratory') || includesWholeTerm(lower, 'lab') ? 'Laboratory' : undefined) ||
    (includesWholeTerm(lower, 'pharmacy') ? 'Pharmacy' : undefined) ||
    appointmentServiceOptions.find((service) => includesWholeTerm(lower, service));

  const timeMatch = lower.match(/(\d{1,2})(?::?(\d{2}))?\s*(am|pm|a\.m|p\.m)?/i);
  const dateMatch =
    lower.match(/(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i) ||
    lower.match(/\b(\d{1,2})\s*(?:st|nd|rd|th)?\s*(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i);

  const normalizedTime = timeMatch
    ? `${Number(timeMatch[1]).toString().padStart(2, '0')}:${(timeMatch[2] || '00').padStart(2, '0')} ${timeMatch[3] ? timeMatch[3].toUpperCase() : 'AM'}`
    : undefined;

  const normalizedDate = dateMatch ? (dateMatch[1] || dateMatch[0]) : undefined;

  return {
    date: normalizedDate,
    time: normalizedTime,
    department: departmentMatch,
    ready: Boolean(normalizedDate && normalizedTime && departmentMatch),
  };
}

export function generateAppointmentCollectionPrompt(
  patientName: string,
  currentData: Partial<AppointmentRequestData> = {},
): string {
  const missing: string[] = [];

  if (!currentData.date) missing.push('date');
  if (!currentData.time) missing.push('time');
  if (!currentData.department) missing.push('department');

  if (!missing.length) {
    return `Thank you, ${patientName}. Your appointment request is ready. Please confirm the details: date ${currentData.date}, time ${currentData.time}, department ${currentData.department}.`;
  }

  const message = missing.length === 1
    ? `Please tell me the ${missing[0]} for your appointment.`
    : `Please tell me the ${missing.join(', ')} for your appointment.`;

  return `Yes, ${patientName}, you can book an appointment here. ${message} You can choose a service from the menu, then reply with a date and time. You can also reply with all three together, for example: tomorrow at 9am in Maternity.`;
}

export function updateAppointmentConversation(
  patientId: string,
  patientName: string,
  message: string,
): {
  prompt: string;
  completed: boolean;
  data?: {
    date: string;
    time: string;
    department: string;
  };
  awaitingConfirmation?: boolean;
} {
  const current = appointmentConversationState.get(patientId) ?? {};
  const parsed = parseAppointmentRequest(message);

  const next = {
    date: current.date ?? parsed.date,
    time: current.time ?? parsed.time,
    department: current.department ?? parsed.department,
  };

  const shouldConfirm = Boolean(next.date && next.time && next.department);

  const normalizedMessage = normalizeKeyword(message);

  if (normalizedMessage.includes('change details') || normalizedMessage.includes('start over')) {
    appointmentConversationState.delete(patientId);
    return {
      prompt: `Okay, ${patientName}. Let us start your appointment request again. Please choose a service, then provide your preferred date and time.`,
      completed: false,
    };
  }

  if (normalizedMessage.includes('confirm') || normalizedMessage === 'yes') {
    appointmentConversationState.delete(patientId);
    return {
      prompt: `Thank you, ${patientName}. Your appointment is now booked for ${next.date} at ${next.time} in ${next.department}.`,
      completed: true,
      data: {
        date: next.date as string,
        time: next.time as string,
        department: next.department as string,
      },
    };
  }

  const missing = [
    !next.date ? 'date' : null,
    !next.time ? 'time' : null,
    !next.department ? 'department' : null,
  ].filter(Boolean) as string[];

  if (missing.length) {
    appointmentConversationState.set(patientId, next);
    return {
      prompt: generateAppointmentCollectionPrompt(patientName, next),
      completed: false,
    };
  }

  if (shouldConfirm) {
    appointmentConversationState.set(patientId, next);
    return {
      prompt: `Please confirm your appointment: ${next.date} at ${next.time} in the ${next.department} department. Reply YES to confirm or tell me to change it.`,
      completed: false,
      awaitingConfirmation: true,
    };
  }

  appointmentConversationState.delete(patientId);

  return {
    prompt: `Thank you, ${patientName}. Your appointment is now booked for ${next.date} at ${next.time} in ${next.department}.`,
    completed: true,
    data: {
      date: next.date as string,
      time: next.time as string,
      department: next.department as string,
    },
  };
}

function getAnswerFromKnowledgeBase(message: string): string | null {
  const directAnswer = searchKnowledgeBase(message);
  if (directAnswer) {
    return directAnswer;
  }

  const normalized = normalizeKeyword(message);
  const lower = normalized.toLowerCase();

  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(lower)) {
    return null;
  }

  if (lower.includes('assign') || lower.includes('staff') || lower.includes('doctor')) {
    return 'I can connect you with our staff. Please tell me your name and briefly describe what you need help with. A staff member will then assist you.';
  }

  if (lower.includes('how is this') || lower.includes('how are you') || lower === 'how is it') {
    return 'I am here and ready to help. You can ask about services, SHA or insurance, locations, appointments, departments, prices, or request a staff member. What would you like help with?';
  }

  if (lower.includes('price') || lower.includes('cost') || lower.includes('fee') || lower.includes('charge')) {
    return 'I can help you check available service information and current surgical prices. Please tell me the procedure or department you are asking about, or ask to speak with staff for the latest quote.';
  }

  if (lower.includes('open') || lower.includes('hours') || lower.includes('24') || lower.includes('emergency')) {
    return 'Our Emergency and Ambulance Unit operates 24/7. For a scheduled service, tell me the department and I will guide you on the next step.';
  }

  if (lower.includes('contact') || lower.includes('phone') || lower.includes('call')) {
    return `You can contact Phadam Hospital Nasra on ${hospitalKnowledge.locations[0].phoneNumbers.join(', ')} or Umoja on ${hospitalKnowledge.locations[1].phoneNumbers.join(', ')}. Which branch or service do you need?`;
  }

  if (lower.includes('sha') || lower.includes('insurance') || lower.includes('cover')) {
    return [
      'Yes, we accept SHA and several other medical insurance partners.',
      '',
      'We also work with AON Minet, Sanlam, Britam, UAP, CIC General, and more.',
      '',
      'Please confirm your cover and preauthorization requirements before treatment.',
    ].join('\n');
  }

  if (lower.includes('location') || lower.includes('where') || lower.includes('address') || lower.includes('branch')) {
    return [
      'We are located at two main branches:',
      '',
      `• ${hospitalKnowledge.locations[0].branch}: ${hospitalKnowledge.locations[0].address}`,
      `  Landmark: ${hospitalKnowledge.locations[0].landmark}`,
      `  Contact: ${hospitalKnowledge.locations[0].phoneNumbers.join(', ')}`,
      '',
      `• ${hospitalKnowledge.locations[1].branch}: ${hospitalKnowledge.locations[1].address}`,
      `  Landmark: ${hospitalKnowledge.locations[1].landmark}`,
      `  Contact: ${hospitalKnowledge.locations[1].phoneNumbers.join(', ')}`,
    ].join('\n');
  }

  if (lower.includes('book') || lower.includes('appointment') || lower.includes('visit') || lower.includes('consult')) {
    return [
      'Yes, we offer appointments and consultations.',
      '',
      'You may visit any of our hospital branches or contact the hospital directly for current doctor schedules and availability.',
      '',
      'What time would you like to visit us?',
    ].join('\n');
  }

  if (lower.includes('service') || lower.includes('offer') || lower.includes('department')) {
    return [
      'We offer general consultation, maternity, pediatric, emergency, pharmacy, laboratory, radiology, dental, optical, physiotherapy, and specialist clinics.',
      '',
      'Please tell us the service or department you need, and we will guide you.',
    ].join('\n');
  }

  return null;
}

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

export function generateBotReply({
  patientName,
  message,
  isReturning,
  lastInteractionHours,
}: BotReplyInput): string {
  const text = cleanText(message || '');
  const normalized = normalizeKeyword(text);

  if (!text) {
    return 'Please tell me what you need today. You can ask about appointments, services, SHA, locations, prices, or staff assistance.';
  }

  if (!patientName) {
    if (isHumanSupportRequest(text)) {
      return 'I can connect you with a human staff member. Please reply with your full name and briefly tell me what you need help with so I can send the request to the team.';
    }
    return `${DEFAULT_WELCOME} You can reply with your full name.`;
  }

  if (isHumanSupportRequest(text)) {
    return `Thank you, ${patientName}. I have asked our staff to help you. Please briefly describe what you need, and a staff member will introduce themselves here shortly.`;
  }

  const isGreeting = /^(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(normalized);
  const appointmentRequest = parseAppointmentRequest(text);

  if (isGreeting && (isReturning || isConversationStale(lastInteractionHours))) {
    return [
      `${getKenyaGreeting()}, ${patientName}. Welcome back to Phadam Hospital.`,
      '',
      'What would you like to do next: book an appointment, ask about a service, check an appointment, or speak with staff?',
    ].join('\n');
  }

  if (isGreeting) {
    return [
      `${getKenyaGreeting()}, ${patientName}.`,
      '',
      'How can I help you next? You can book an appointment, ask about a service, check an appointment, or speak with staff.',
    ].join('\n');
  }

  if (appointmentRequest.ready) {
    return `Thank you, ${patientName}. I have noted your appointment for ${appointmentRequest.date} at ${appointmentRequest.time} in the ${appointmentRequest.department} department. Please confirm, and I will book it for you.`;
  }

  const answer = getAnswerFromKnowledgeBase(text);
  if (answer) {
    const lines = answer.split('\n');
    const final = lines.map((line) => line.trim()).filter(Boolean);

    if (final[0]?.toLowerCase().includes('yes') || final[0]?.toLowerCase().includes('we are located')) {
      return `${answer}\n\nWhat would you like to do next? I can help with an appointment, another department, or staff assistance.`;
    }

    if (normalized.includes('sha') || normalized.includes('insurance') || normalized.includes('cover')) {
      return [
        `Yes, ${patientName} we accept SHA and other insurance partners at Phadam Hospital.`,
        '',
        `${patientName}, we are located at Phadam Hospital with branches in Nasra and Umoja.`,
        '',
        answer,
      ].join('\n');
    }

    if (
      normalized.includes('where') ||
      normalized.includes('location') ||
      normalized.includes('address') ||
      normalized.includes('branch')
    ) {
      return `${patientName}, we are located at Phadam Hospital.\n\n${answer}\n\nWhich branch or service would you like help with next?`;
    }

    if (
      normalized.includes('appointment') ||
      normalized.includes('visit') ||
      normalized.includes('book') ||
      normalized.includes('consult')
    ) {
      return generateAppointmentCollectionPrompt(patientName, {
        date: appointmentRequest.date,
        time: appointmentRequest.time,
        department: appointmentRequest.department,
      });
    }

    return `${answer}\n\nWhat would you like to do next?`;
  }

  const fallback = [
    `Thank you, ${patientName}.`,
    '',
    'I am sorry, I may not have enough information for that question.',
    'Please speak with one of our doctors or staff members if you need personal medical guidance. You can also ask about appointments, services, SHA or insurance, locations, departments, or prices. What would you like help with next?',
  ].join('\n');
  return fallback;
}
