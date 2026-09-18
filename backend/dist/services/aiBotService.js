"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appointmentServiceOptions = exports.appointmentConversationState = exports.CONVERSATION_MEMORY_MINUTES = void 0;
exports.getServicePrice = getServicePrice;
exports.isConversationStale = isConversationStale;
exports.resetPatientSession = resetPatientSession;
exports.getPatientSession = getPatientSession;
exports.getPatientSessionSnapshot = getPatientSessionSnapshot;
exports.isUsablePatientName = isUsablePatientName;
exports.extractPatientName = extractPatientName;
exports.isHumanSupportRequest = isHumanSupportRequest;
exports.parseAppointmentRequest = parseAppointmentRequest;
exports.generateAppointmentCollectionPrompt = generateAppointmentCollectionPrompt;
exports.updateAppointmentConversation = updateAppointmentConversation;
exports.getKenyaGreeting = getKenyaGreeting;
exports.generateBotReply = generateBotReply;
const hospitalData_js_1 = require("../knowledge/hospitalData.js");
/* =========================================================
   CONFIG
========================================================= */
exports.CONVERSATION_MEMORY_MINUTES = 3;
const sessions = new Map();
exports.appointmentConversationState = new Map();
/* =========================================================
   BOOKABLE DEPARTMENTS
   Derived from the real hospital knowledge base so the booking
   flow never drifts out of sync with what the hospital actually
   offers. No department name here is invented.
========================================================= */
exports.appointmentServiceOptions = Array.from(new Set([
    "Maternity",
    "Pediatrics",
    "Emergency",
    "Laboratory",
    "Pharmacy",
    "Radiology",
    "Physiotherapy",
    ...hospitalData_js_1.hospitalKnowledge.specialistClinics,
]));
/**
 * Returns the published price for a bookable department/service, or null
 * when no price has been supplied. Consultation and most non-surgical
 * service fees were never given to us — we say so rather than implying
 * they're free or guessing a number. Surgical procedure prices are
 * handled separately via the knowledge base's procedure-price search.
 */
function getServicePrice(_department) {
    // No consultation/clinic-visit price list was supplied for any
    // department. Returning null (rather than a fabricated "0" or a
    // number) lets callers correctly say "please confirm with reception"
    // instead of implying the visit is free.
    return null;
}
/* =========================================================
   CONVERSATION MEMORY
========================================================= */
function isConversationStale(lastInteractionHours) {
    return lastInteractionHours * 60 >= exports.CONVERSATION_MEMORY_MINUTES;
}
function resetPatientSession(patientId) {
    sessions.delete(patientId);
    exports.appointmentConversationState.delete(patientId);
}
function getPatientSession(patientId) {
    return sessions.get(patientId) || null;
}
function getPatientSessionSnapshot(patientId) {
    const session = sessions.get(patientId);
    if (!session)
        return null;
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
function isUsablePatientName(name) {
    if (!name)
        return false;
    const cleaned = name.trim();
    if (cleaned.length < 2 || cleaned.length > 80)
        return false;
    if (INVALID_NAMES.has(cleaned.toLowerCase()))
        return false;
    if (!/[a-zA-Z]/.test(cleaned))
        return false;
    return true;
}
function startsWithNonNameWord(name) {
    const firstWord = name.trim().split(/\s+/)[0]?.toLowerCase();
    return Boolean(firstWord && NON_NAME_LEAD_WORDS.has(firstWord));
}
function extractPatientName(message) {
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
        if (!match?.[1])
            continue;
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
        if (!match?.[1])
            continue;
        const name = match[1]
            .replace(/[.!?,;:]+$/g, "")
            .replace(/\s+/g, " ")
            .trim();
        if (startsWithNonNameWord(name))
            continue;
        if (isUsablePatientName(name)) {
            return name;
        }
    }
    return null;
}
/* =========================================================
   HUMAN SUPPORT
========================================================= */
const HUMAN_SUPPORT_PATTERNS = [
    /\b(talk|speak|chat)\s+to\s+(a\s+)?(human|real\s+person|person|someone|somebody|staff|receptionist|agent|doctor|nurse)\b/i,
    /\bconnect me (with|to)\s+(a\s+)?(human|person|someone|somebody|staff|agent|receptionist)\b/i,
    /\breal\s+person\b/i,
    /\breceptionist\b/i,
    /\bhuman\s+(agent|support|help|being)\b/i,
    /\b(need|want)\s+(a\s+)?(human|real person|staff member|live agent)\b/i,
    /\btransfer me to (staff|reception|a human)\b/i,
];
function isHumanSupportRequest(message) {
    return HUMAN_SUPPORT_PATTERNS.some((pattern) => pattern.test(message));
}
/* =========================================================
   CONTROL COMMANDS (cancel / restart / menu)
========================================================= */
function isCancelCommand(message) {
    return /^(cancel|stop|never\s?mind|forget it|start over|restart)\b/i.test(message.trim());
}
function isMenuCommand(message) {
    return /^(menu|main menu|help|options)\b/i.test(message.trim());
}
/* =========================================================
   DEPARTMENT PARSING
   Every canonical name below comes directly from
   `hospitalKnowledge` (departments + specialistClinics), so the
   parser can never route a patient to a department that doesn't
   actually exist at the hospital.
========================================================= */
const DEPARTMENTS = [
    {
        name: "Maternity",
        patterns: [
            /\bmaternity\b/i,
            /\bantenatal\b/i,
            /\bpostnatal\b/i,
            /\banc\b/i,
            /\bdelivery\b/i,
            /\blabou?r\b/i,
            /\bpregnan(t|cy)\b/i,
            /\bc[\s-]?section\b/i,
            /\bcaesarean\b/i,
            /\bcesarean\b/i,
        ],
    },
    {
        name: "Obstetrics and Gynecology",
        patterns: [/\bobstetrics\b/i, /\bob[\s-]?gyn\b/i],
    },
    {
        name: "Gynecology",
        patterns: [
            /\bgynecology\b/i,
            /\bgynaecology\b/i,
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
function extractDepartment(message) {
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
function formatDate(date) {
    return date.toISOString().slice(0, 10);
}
function startOfDay(date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}
function parseDateFromMessage(message) {
    const text = message.toLowerCase();
    const now = new Date();
    if (/\btoday\b/.test(text))
        return formatDate(startOfDay(now));
    if (/\btomorrow\b/.test(text))
        return formatDate(startOfDay(addDays(now, 1)));
    if (/\bday after tomorrow\b/.test(text))
        return formatDate(startOfDay(addDays(now, 2)));
    const weekdays = {
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
            if (diff <= 0)
                diff += 7;
            if (new RegExp(`\\bnext\\s+${day}\\b`, "i").test(text)) {
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
        if (year < 100)
            year += 2000;
        const parsed = new Date(year, month, day);
        if (parsed.getFullYear() === year &&
            parsed.getMonth() === month &&
            parsed.getDate() === day) {
            return formatDate(parsed);
        }
    }
    const monthNames = {
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
    const monthMatch = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(\d{4}))?\b/i);
    if (monthMatch) {
        const day = Number(monthMatch[1]);
        const month = monthNames[monthMatch[2].toLowerCase()];
        const year = monthMatch[3] ? Number(monthMatch[3]) : now.getFullYear();
        const parsed = new Date(year, month, day);
        if (parsed.getFullYear() === year &&
            parsed.getMonth() === month &&
            parsed.getDate() === day) {
            return formatDate(parsed);
        }
    }
    return undefined;
}
/* =========================================================
   TIME PARSING
========================================================= */
function normalizeTime(hour, minute, suffix) {
    let h = hour;
    if (suffix) {
        const normalized = suffix.toLowerCase();
        if (h < 1 || h > 12)
            return undefined;
        if (normalized === "am") {
            if (h === 12)
                h = 0;
        }
        else if (normalized === "pm") {
            if (h !== 12)
                h += 12;
        }
    }
    else if (h < 0 || h > 23) {
        return undefined;
    }
    return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function parseTimeFromMessage(message) {
    const text = message.toLowerCase();
    if (/\bmidnight\b/.test(text))
        return "12:00 AM";
    if (/\bnoon\b/.test(text))
        return "12:00 PM";
    const explicit = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (explicit) {
        return normalizeTime(Number(explicit[1]), Number(explicit[2] || 0), explicit[3]);
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
function parseAppointmentRequest(message) {
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
function departmentHint(department) {
    if (!department)
        return "";
    const description = hospitalData_js_1.hospitalKnowledge.departments[department];
    return description ? ` (${description.split(". ")[0]}.)` : "";
}
function generateAppointmentCollectionPrompt(patientName, appointment) {
    const missing = [];
    if (!appointment.department)
        missing.push("department");
    if (!appointment.date)
        missing.push("date");
    if (!appointment.time)
        missing.push("time");
    if (missing.length === 0) {
        return `Thank you, ${patientName}. Please confirm your appointment details.`;
    }
    if (missing.length === 1) {
        if (missing[0] === "department") {
            return (`Thank you, ${patientName}. I have your preferred date and time. ` +
                `Which department or clinic would you like to see (e.g. Maternity, Pediatrics, Dental, Optical)?`);
        }
        return `Thank you, ${patientName}. What ${missing[0]} would you like for your ${appointment.department} appointment?${departmentHint(appointment.department)}`;
    }
    if (missing.length === 2) {
        return `Thank you, ${patientName}. Please share the ${missing[0]} and ${missing[1]} for your appointment (e.g. "Maternity tomorrow at 10am").`;
    }
    return `Sure, ${patientName}. I can help you book an appointment. Please tell me the department, preferred date, and preferred time — for example: "Dental appointment on Friday at 2pm".`;
}
/* =========================================================
   APPOINTMENT CONVERSATION STATE (standalone helper API)
========================================================= */
function updateAppointmentConversation(patientId, patientName, message) {
    const existing = exports.appointmentConversationState.get(patientId);
    const parsed = parseAppointmentRequest(message);
    const appointment = {
        ...(existing?.appointment || {}),
        ...(parsed.date ? { date: parsed.date } : {}),
        ...(parsed.time ? { time: parsed.time } : {}),
        ...(parsed.department ? { department: parsed.department } : {}),
    };
    const completed = Boolean(appointment.date && appointment.time && appointment.department);
    let prompt;
    let awaitingConfirmation = false;
    if (!completed) {
        prompt = generateAppointmentCollectionPrompt(patientName, appointment);
    }
    else {
        prompt = renderAppointmentSummary(patientName, appointment);
        awaitingConfirmation = true;
    }
    const state = {
        patientName,
        appointment,
        completed,
        prompt,
        data: appointment,
        awaitingConfirmation,
    };
    exports.appointmentConversationState.set(patientId, state);
    return state;
}
function renderAppointmentSummary(name, appointment) {
    return (`Thank you, ${name}. Here is your appointment request:\n\n` +
        `• Department: ${appointment.department}\n` +
        `• Date: ${appointment.date}\n` +
        `• Time: ${appointment.time}\n\n` +
        `Note: exact consultation fees were not published to me — reception will confirm the cost when you arrive or call ahead.\n\n` +
        `Is this correct? Reply *Yes* to confirm or *No* to change it.`);
}
/* =========================================================
   KENYA GREETING
========================================================= */
function getKenyaGreeting(date = new Date()) {
    const hour = Number(new Intl.DateTimeFormat("en-KE", {
        timeZone: "Africa/Nairobi",
        hour: "numeric",
        hour12: false,
    }).format(date));
    if (hour < 12)
        return "Good morning";
    if (hour < 18)
        return "Good afternoon";
    return "Good evening";
}
/* =========================================================
   BOT COPY
========================================================= */
const NAME_PROMPT = "Welcome to Phadam Hospital. Before we continue, please tell me your full name. What is your name?";
const MENU_PROMPT = (name) => `${getKenyaGreeting()}, ${name}. How can I help you today?\n\n` +
    `You can ask me about:\n` +
    `• Our services, departments, or specialist clinics\n` +
    `• Surgical procedure prices (e.g. "cost of a caesarean section")\n` +
    `• Locations and contacts (Nasra or Umoja)\n` +
    `• SHA / insurance partners\n` +
    `• Booking an appointment\n` +
    `• Speaking with our hospital staff`;
function isGreeting(message) {
    return /^(hi|hello|hey|good morning|good afternoon|good evening|mambo|sasa|habari)\b/i.test(message.trim());
}
function isBookingIntent(message) {
    return (/\bbook(ing)?\b/i.test(message) ||
        /\bappointment\b/i.test(message) ||
        /\bschedule\b/i.test(message) ||
        /\bsee a doctor\b/i.test(message) ||
        /\bconsult(ation)?\b/i.test(message) ||
        /\bbook a (visit|slot)\b/i.test(message));
}
function isAffirmative(message) {
    return /^(yes|yeah|yep|yup|correct|confirm(ed)?|okay|ok|sure|right|that'?s right|sawa)$/i.test(message.trim());
}
function isNegative(message) {
    return /^(no|nope|nah|change|edit|wrong|not correct|that'?s wrong|incorrect)$/i.test(message.trim());
}
/**
 * Looks up an answer in the hospital knowledge base and returns it,
 * lightly personalized. Returns null when the knowledge base has no
 * confident answer — callers decide what to do next (usually: offer to
 * connect the patient with staff) rather than this function inventing
 * a generic filler reply.
 */
function answerKnowledgeBase(name, message) {
    let result = null;
    try {
        result = (0, hospitalData_js_1.searchKnowledgeBase)(message);
    }
    catch {
        result = null;
    }
    if (!result)
        return null;
    // The knowledge base already returns well-formatted, self-explanatory
    // text (with its own headers/emoji). Prepending "Yes, {name}." in front
    // of a heading reads oddly, so we only add a light personal touch when
    // the response is a short, conversational-style line rather than a
    // structured list/heading.
    const looksStructured = /^[\p{Emoji}\p{So}]/u.test(result) || result.includes("\n\n•") || result.includes("\n•");
    if (looksStructured) {
        return result;
    }
    return `${name}, ${result.charAt(0).toLowerCase()}${result.slice(1)}`;
}
function processTurn(state, message, isReturning) {
    const name = state.patientName;
    if (isHumanSupportRequest(message)) {
        return {
            reply: `Of course, ${name}. I'll direct your request to our hospital staff — please hold on for assistance.`,
            state: { ...state, stage: "human_handoff" },
        };
    }
    if (state.stage === "human_handoff" && !isGreeting(message) && !isMenuCommand(message)) {
        return {
            reply: `Your request has already been passed to our staff, ${name}. Please wait for assistance, or say "menu" to continue chatting with me.`,
            state,
        };
    }
    if (isGreeting(message) || isMenuCommand(message)) {
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
    if (state.stage === "confirming_appointment") {
        if (isAffirmative(message)) {
            return {
                reply: `Thank you, ${name}. Your appointment request has been confirmed and sent to the hospital team for processing.`,
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
    const inAppointmentFlow = state.stage === "collecting_appointment" ||
        state.stage === "confirming_appointment" ||
        isBookingIntent(message);
    if (inAppointmentFlow) {
        const appointment = {
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
    return {
        reply: `I'm sorry, ${name}, I don't have that information on hand. ` +
            `Would you like me to connect you with our hospital staff, or ask about something else — our services, prices, locations, or insurance?`,
        state,
    };
}
/* =========================================================
   PUBLIC ENTRY POINT
========================================================= */
function generateBotReply(input) {
    const message = input.message.trim();
    /*
     * Legacy/stateless mode:
     * When no patientId is supplied, patientName is used to seed a
     * one-off turn so existing unit tests and simple integrations work
     * without session storage. No conversation memory persists here.
     */
    if (!input.patientId) {
        if (!input.patientName) {
            if (!message)
                return NAME_PROMPT;
            const extracted = extractPatientName(message);
            return extracted ? MENU_PROMPT(extracted) : NAME_PROMPT;
        }
        const state = {
            patientName: input.patientName,
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
    if (session && now - session.lastInteraction > exports.CONVERSATION_MEMORY_MINUTES * 60 * 1000) {
        sessions.delete(patientId);
        exports.appointmentConversationState.delete(patientId);
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
    const turnState = {
        patientName: session.patientName || "there",
        stage: session.stage,
        appointment: session.appointment,
    };
    const { reply, state } = processTurn(turnState, message, input.isReturning);
    session.stage = state.stage;
    session.appointment = state.appointment;
    return reply;
}
