"use strict";
// src/data/hospitalKnowledge.ts
//
// NOTE ON SCOPE: This file is a KNOWLEDGE BASE, not a chat/reply engine.
// It stores factual hospital data and exposes lookup/search helpers that
// return formatted text a calling layer (bot, webhook, UI, etc.) can send.
// It must never invent facts (doctor names, exact hours, undisclosed
// prices, etc.) that were not supplied in `hospitalKnowledge` below.
// Anywhere information is genuinely unknown, the helpers say so explicitly
// instead of guessing, and defer to contacting the hospital directly.
Object.defineProperty(exports, "__esModule", { value: true });
exports.hospitalKnowledge = void 0;
exports.searchKnowledgeBase = searchKnowledgeBase;
exports.getHospitalSummary = getHospitalSummary;
exports.hospitalKnowledge = {
    name: 'Phadam Hospital',
    legalName: 'The Phadam Hospital',
    motto: 'Your Health, Our Pride',
    founded: 'December 2016',
    description: 'Phadam Hospital is a modern healthcare facility providing affordable, patient-centered medical services for adults and children in Nairobi and its environs. The hospital combines qualified healthcare professionals, modern medical technology, advanced infrastructure, and compassionate nursing care.',
    mission: 'To improve the health of the community we serve through extraordinary healthcare, quality services, compassionate treatment, and care that goes beyond expectations.',
    scope: 'Phadam Hospital is committed to delivering safe, accessible, and consistently high-quality healthcare through skilled doctors, nurses, specialists, modern facilities, patient-centered care, ethical practice, continuous learning, and improved clinical outcomes.',
    values: [
        'Respect each person’s dignity.',
        'Act with integrity in all responsibilities.',
        'Serve with compassion that embraces each individual’s concerns and hopes.',
        'Commit to excellence through high standards of performance.',
        'Promote innovation in healthcare delivery.',
        'Work together through teamwork.',
    ],
    locations: [
        {
            branch: 'Phadam Hospital Nasra',
            address: 'Moi Drive, Nasra, Embakasi East, Nairobi',
            landmark: 'Along Kayole Spine Road, off Kangundo Road, near Mama Lucy Kibaki Hospital',
            phoneNumbers: ['0704 899856'],
        },
        {
            branch: 'Phadam Hospital Umoja',
            address: 'Umoja Innercore, along Moi Drive, Nairobi',
            landmark: 'Next to Unity Primary School',
            phoneNumbers: ['0718 589020', '0114 298041'],
        },
    ],
    services: [
        'Doctors consultation',
        'Antenatal clinic',
        'Postnatal clinic',
        'Maternity services',
        'Well-baby clinic',
        'Pediatric outpatient clinic',
        'Immunization',
        'Family planning',
        'Pharmacy',
        'Laboratory',
        'Radiology, including X-ray and ultrasound',
        'Inpatient services',
        'Endoscopy',
        'Colonoscopy',
        'High Dependency Unit',
        'Intensive Care Unit',
        'Newborn Unit',
        'Theatre services for minor and major surgeries',
        'Ambulance services',
        'Emergency services',
        'Physiotherapy',
        'Dermatology clinic',
        'Obstetrics and gynecology clinic',
        'Orthopedic clinic',
        'Ear, Nose and Throat clinic',
        'Dental clinic',
        'Optical clinic',
        'Psychology and counselling',
        'Nutrition clinic',
        'Surgical outpatient clinic',
        'Gynecology clinic',
        'Urology clinic',
    ],
    specialistClinics: [
        'Dermatology',
        'Obstetrics and Gynecology',
        'Orthopedics',
        'Ear, Nose and Throat',
        'Dental',
        'Optical',
        'Psychology and Counselling',
        'Nutrition',
        'Surgical Outpatient',
        'Gynecology',
        'Urology',
    ],
    departments: {
        Pharmacy: 'The Pharmacy Department provides pharmaceutical care, safe and timely dispensing of medicines, medication guidance, and education about proper use and possible side effects.',
        Laboratory: 'The Laboratory Unit operates 24/7 and provides routine and specialized tests using modern equipment. The unit maintains quality through continuous external quality assessments.',
        Maternity: 'The Maternity Department provides antenatal, delivery, and postnatal care. Services include pregnancy monitoring, investigations, antenatal profiling, health education, counselling, and postnatal support.',
        'Newborn Unit': 'The Newborn Unit provides specialized care for preterm, low-birth-weight, and critically ill babies. It has incubators, ventilators, and monitoring systems and is supported by neonatal nurses and pediatricians.',
        Pediatrics: 'The Pediatric Unit provides care for children from infancy to adolescence, including treatment of acute and chronic illnesses, monitoring, timely intervention, and family support.',
        'ICU and HDU': 'The ICU and HDU provide specialized care for critically ill medical, surgical, obstetric, and cancer patients using advanced monitoring equipment and dedicated critical-care teams.',
        Theatre: 'Phadam Hospital has two fully equipped operating theatres with modern technology, including a high-definition laparoscopic tower and C-arm machine. The theatres support minor and complex procedures and provide preoperative and postoperative care.',
        Emergency: 'The Ambulance and Emergency Unit provides 24/7 ambulance and emergency services for adults and children. The unit handles urgent medical and surgical emergencies with trained clinicians and paramedics.',
        Orthopedics: 'The Orthopedic Unit provides specialist orthopedic surgery, including total hip replacement, total knee replacement, spine surgery, and rehabilitation supported by physiotherapy.',
        Gynecology: 'The Gynecology Unit provides routine check-ups, reproductive health services, fertility assessment, management of gynecological conditions, and minor surgical procedures.',
        ENT: 'The ENT Unit provides diagnosis and treatment for ear, nose, and throat conditions in children and adults, including hearing assessments, allergy management, sinus care, throat care, and minor procedures.',
        Urology: 'The Urology Unit provides care for urinary tract and male reproductive health conditions, including kidney stones, urinary infections, prostate disorders, and other urological conditions.',
    },
    insuranceAccepted: [
        'SHA',
        'AON Minet',
        'KenGen',
        'Pacific Insurance Brokers',
        'Sanlam',
        'MUA',
        'Madison',
        'MTN',
        'Pioneer',
        'Sedgwick',
        'Laser Insurance Brokers',
        'Kenbright',
        'Kenyan Alliance',
        'Insurance for All (IFA – Afya Poa)',
        'M-TIBA',
        'Liaison Insurance',
        'GA',
        'First Assurance',
        'CIC General',
        'MTIBA Jubilee',
        'KEBS',
        'UAP',
        'Britam',
        'AAR',
    ],
    surgicalPrices: [
        { procedure: 'Feeding gastrostomy tube insertion/Jejunostomy', price: 'KSh 80,000' },
        { procedure: 'Adenoidectomy', price: 'KSh 65,000' },
        { procedure: 'Adenotonsillectomy', price: 'KSh 70,000' },
        { procedure: 'Tonsillectomy', price: 'KSh 50,000' },
        { procedure: 'Removal of foreign body from ear or nose under GA', price: 'KSh 40,000' },
        { procedure: 'Release of tongue tie in theatre', price: 'KSh 25,000' },
        { procedure: 'Appendicectomy', price: 'KSh 60,000' },
        { procedure: 'Herniotomy', price: 'KSh 50,000' },
        { procedure: 'Orchidopexy', price: 'KSh 50,000' },
        { procedure: 'Herniorrhaphy', price: 'KSh 50,000' },
        { procedure: 'Cholecystectomy', price: 'KSh 80,000' },
        { procedure: 'Exploratory laparotomy', price: 'KSh 60,000' },
        { procedure: 'Gastrojejunostomy', price: 'KSh 120,000' },
        { procedure: 'Haemorrhoidectomy', price: 'KSh 40,000' },
        { procedure: 'Lateral sphincterotomy', price: 'KSh 40,000' },
        { procedure: 'Repair of hiatus hernia', price: 'KSh 150,000' },
        { procedure: 'Repair of epigastric hernia', price: 'KSh 50,000' },
        { procedure: 'Repair of strangulated hernia', price: 'KSh 80,000' },
        { procedure: 'Repair of umbilical hernia with mesh', price: 'KSh 40,000' },
        { procedure: 'Tendon repair', price: 'KSh 120,000' },
        { procedure: 'Thyroidectomy', price: 'KSh 120,000' },
        { procedure: 'Colonoscopy', price: 'KSh 20,000' },
        { procedure: 'Oesophago-Gastro-Duodenoscopy (OGD)', price: 'KSh 12,000' },
        { procedure: 'Excision of lipoma/wide excision', price: 'KSh 30,000' },
        { procedure: 'Circumcision under GA', price: 'KSh 25,000' },
        { procedure: 'Surgical debridement/escharectomy/toileting', price: 'KSh 30,000' },
        { procedure: 'Laparoscopic Nissen’s fundoplication', price: 'KSh 250,000' },
        { procedure: 'Laparotomy: endometriosis surgery', price: 'KSh 120,000' },
        { procedure: 'Total abdominal hysterectomy', price: 'KSh 80,000' },
        { procedure: 'Myomectomy', price: 'KSh 80,000' },
        { procedure: 'Laparotomy for pelvic abscess', price: 'KSh 120,000' },
        { procedure: 'Laparotomy for ruptured ectopic pregnancy', price: 'KSh 120,000' },
        { procedure: 'Ovarian cystectomy', price: 'KSh 80,000' },
        { procedure: 'Tuboplasty', price: 'KSh 80,000' },
        { procedure: 'Repair of rectovaginal fistula', price: 'KSh 80,000' },
        { procedure: 'Bilateral tubal ligation', price: 'KSh 25,000' },
        { procedure: 'Cervical cerclage/insertion of MacDonald stitch', price: 'KSh 30,000' },
        { procedure: 'Dilatation and curettage', price: 'KSh 25,000' },
        { procedure: 'Bilateral tubal ligation done with caesarean section', price: 'KSh 15,000' },
        { procedure: 'Marsupialisation of Bartholin’s cyst/abscess', price: 'KSh 25,000' },
        { procedure: 'Retrieval of lost/fragmented IUCD', price: 'KSh 20,000' },
        { procedure: 'Below/above-knee amputation', price: 'KSh 110,000' },
        { procedure: 'Open reduction and internal fixation', price: 'KSh 130,000' },
        { procedure: 'Closed manipulation of dislocations/fractures', price: 'KSh 15,000' },
        { procedure: 'Excision of ingrown toenail under GA', price: 'KSh 25,000' },
        { procedure: 'Rotation flaps', price: 'KSh 100,000' },
        { procedure: 'Repair of bladder', price: 'KSh 80,000' },
        { procedure: 'Repair of ruptured urethra', price: 'KSh 120,000' },
        { procedure: 'Transurethral resection of bladder tumour (TURBT)', price: 'KSh 220,000' },
        { procedure: 'Transurethral resection of prostate (TURP)', price: 'KSh 190,000' },
        { procedure: 'Skin grafting below 10% TBSA', price: 'KSh 40,000' },
        { procedure: 'Skin grafting above 10% TBSA', price: 'KSh 80,000' },
        { procedure: 'Reduction mammoplasty', price: 'KSh 150,000' },
        { procedure: 'Cleft lip repair', price: 'KSh 50,000' },
        { procedure: 'Cleft palate repair', price: 'KSh 80,000' },
        { procedure: 'Cleft lip and palate repair', price: 'KSh 100,000' },
        { procedure: 'ACL/PCL surgery', price: 'KSh 250,000' },
        { procedure: 'Removal of hardware: wires', price: 'KSh 20,000' },
        { procedure: 'Removal of hardware: plates and nails', price: 'KSh 80,000' },
        { procedure: 'Caesarean section', price: 'KSh 45,000–75,000' },
        { procedure: 'Normal delivery/SVD', price: 'KSh 13,000–20,000' },
    ],
    leadership: [
        {
            role: 'Chief Executive Officer',
            name: 'Dr. Augustine Mwiti Mitugo',
            message: 'Phadam Hospital is committed to combining medical expertise, modern technology, patient safety, innovation, and compassionate service to make quality healthcare accessible and affordable.',
        },
        {
            role: 'Senior Hospital Administrator',
            name: 'Mrs. Veralyne Atinda',
            message: 'Phadam Hospital is committed to compassionate, patient-centered care grounded in excellence, integrity, innovation, modern technology, and accessible healthcare partnerships.',
        },
    ],
    bookingNotes: [
        'Prices should be confirmed with the hospital before treatment or admission.',
        'Final procedure charges may depend on the surgeon, anesthesia, medicines, investigations, implants, admission duration, and emergency status.',
        'Insurance members should confirm coverage and preauthorization requirements before a procedure.',
        'For emergencies, contact the nearest Phadam Hospital branch directly or use emergency services.',
        'Doctor names, consultation schedules, and exact clinic hours were not provided in the supplied hospital information and should not be invented.',
    ],
    // Explicit registry of things patients commonly ask that this knowledge
    // base deliberately does NOT answer with specifics, because that detail
    // was never supplied. Kept centralized so every "unknown" response is
    // worded consistently instead of being improvised in multiple places.
    unknownTopics: [
        'exact opening/visiting hours for each branch',
        'named doctors, specialists, or their individual schedules',
        'online or app-based appointment booking links',
        'non-surgical service fees (e.g. consultation, lab test, pharmacy item prices)',
        'bed/ward availability in real time',
        'which specific branch offers which specialist clinic',
    ],
};
// ---------------------------------------------------------------------------
// Text normalization & query understanding
// ---------------------------------------------------------------------------
const MAX_PROCEDURE_RESULTS = 12;
const MAX_SERVICE_RESULTS = 8;
const STOP_WORDS = new Set([
    'a',
    'am',
    'an',
    'and',
    'any',
    'are',
    'at',
    'can',
    'do',
    'does',
    'for',
    'get',
    'have',
    'how',
    'i',
    'in',
    'is',
    'it',
    'me',
    'my',
    'of',
    'on',
    'or',
    'please',
    'that',
    'the',
    'there',
    'this',
    'to',
    'want',
    'what',
    'when',
    'where',
    'which',
    'who',
    'will',
    'with',
    'you',
    'your',
]);
function normalizeText(value) {
    return value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s%/.-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Common ways real patients phrase things, mapped onto the hospital's own
 * vocabulary (procedure names, department names, service names) so matching
 * works even when the patient doesn't use the clinical term. This only
 * rewrites query text for matching purposes — it never adds new facts.
 */
const QUERY_SYNONYMS = [
    // Delivery / obstetrics
    [/\bc[\s-]?section(s)?\b/g, 'caesarean section'],
    [/\bcesarean(s)?\b/g, 'caesarean'],
    [/\bcaesarian(s)?\b/g, 'caesarean'],
    [/\bvaginal (delivery|birth)\b/g, 'normal delivery svd'],
    [/\bnatural (delivery|birth)\b/g, 'normal delivery svd'],
    [/\bgive birth\b/g, 'normal delivery svd'],
    [/\btubes tied\b/g, 'bilateral tubal ligation'],
    [/\btubal ligation\b/g, 'bilateral tubal ligation'],
    [/\bd\s*&\s*c\b/g, 'dilatation and curettage'],
    [/\bdnc\b/g, 'dilatation and curettage'],
    [/\bcoil removal\b/g, 'retrieval of lost fragmented iucd'],
    [/\biucd removal\b/g, 'retrieval of lost fragmented iucd'],
    [/\bwomb removal\b/g, 'total abdominal hysterectomy'],
    [/\bhysterectomy\b/g, 'total abdominal hysterectomy'],
    [/\bfibroid(s)? removal\b/g, 'myomectomy'],
    // General surgery
    [/\bgall\s?bladder removal\b/g, 'cholecystectomy'],
    [/\bgallbladder\b/g, 'cholecystectomy'],
    [/\bappendix removal\b/g, 'appendicectomy'],
    [/\bappendectomy\b/g, 'appendicectomy'],
    [/\btonsil(s)? removal\b/g, 'tonsillectomy'],
    [/\badenoid(s)? removal\b/g, 'adenoidectomy'],
    [/\bhernia (surgery|operation|repair)\b/g, 'hernia repair'],
    [/\bthyroid removal\b/g, 'thyroidectomy'],
    [/\bpiles (surgery|removal|operation)\b/g, 'haemorrhoidectomy'],
    [/\bhemorrhoid(s)?\b/g, 'haemorrhoidectomy'],
    [/\blipoma removal\b/g, 'excision of lipoma'],
    [/\bcircumcision\b/g, 'circumcision under ga'],
    // Orthopedics
    [/\bhip replacement\b/g, 'total hip replacement'],
    [/\bknee replacement\b/g, 'total knee replacement'],
    [/\bacl surgery\b/g, 'acl pcl surgery'],
    [/\bbroken bone\b/g, 'fracture'],
    [/\bplate removal\b/g, 'removal of hardware plates and nails'],
    // Urology
    [/\bprostate surgery\b/g, 'transurethral resection of prostate'],
    [/\bkidney stone(s)?\b/g, 'urology'],
    // Non-surgical clinics / services (route to department or service, not price)
    [/\btooth(ache)?|\bteeth\b/g, 'dental clinic'],
    [/\beye(s)?\b|\bvision\b|\bglasses\b/g, 'optical clinic'],
    [/\bskin\b|\brash\b|\bacne\b/g, 'dermatology clinic'],
    [/\bmental health\b|\btherapy\b|\bdepression\b|\banxiety\b/g, 'psychology and counselling'],
    [/\bdiet(ician)?\b|\bnutritionist\b|\bweight loss\b/g, 'nutrition clinic'],
    [/\bpregnant\b|\bpregnancy\b|\banc\b/g, 'antenatal maternity'],
    [/\bnewborn\b|\bpremature baby\b|\bpreterm baby\b/g, 'newborn unit'],
    [/\bx[\s-]?ray\b|\bimaging\b|\bscan\b/g, 'radiology'],
    [/\bblood test(s)?\b|\blab test(s)?\b/g, 'laboratory'],
    [/\bphysio(therapy)?\b/g, 'physiotherapy'],
    [/\bfamily planning\b|\bcontraceptive(s)?\b|\bbirth control\b/g, 'family planning'],
];
function expandQuerySynonyms(normalizedQuery) {
    return QUERY_SYNONYMS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), normalizedQuery);
}
function getSearchTerms(value) {
    return [
        ...new Set(normalizeText(value)
            .split(' ')
            .filter((term) => term.length >= 3 && !STOP_WORDS.has(term))),
    ];
}
function includesAny(text, keywords) {
    return keywords.some((keyword) => text.includes(keyword));
}
// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
function formatBranch(location) {
    return [
        `• *${location.branch}*`,
        `Address: ${location.address}`,
        location.landmark ? `Landmark: ${location.landmark}` : '',
        `Contact: ${location.phoneNumbers.join(', ')}`,
    ]
        .filter(Boolean)
        .join('\n');
}
function formatLocations(branchFilter) {
    const branches = branchFilter && branchFilter.length ? branchFilter : exports.hospitalKnowledge.locations;
    return [
        '📍 *Phadam Hospital Locations*',
        '',
        ...branches.map(formatBranch),
    ].join('\n\n');
}
function formatServices() {
    return [
        '🏥 *Our Services*',
        '',
        ...exports.hospitalKnowledge.services.map((service) => `• ${service}`),
        '',
        'Ask about any specific service (e.g. "do you have physiotherapy?") for a direct confirmation.',
    ].join('\n');
}
function formatInsuranceList() {
    return [
        '🛡️ *Insurance and Medical Cover Partners*',
        '',
        ...exports.hospitalKnowledge.insuranceAccepted.map((provider) => `• ${provider}`),
        '',
        'Please confirm eligibility and preauthorization requirements with the hospital before treatment.',
    ].join('\n');
}
function formatInsuranceConfirmation(matches) {
    return [
        '🛡️ *Insurance Confirmation*',
        '',
        `Yes — Phadam Hospital works with: ${matches.join(', ')}.`,
        '',
        'Please confirm your specific plan\'s eligibility and any preauthorization requirements directly with the hospital before your visit.',
    ].join('\n');
}
function formatAllDepartments() {
    return [
        '🏥 *Hospital Departments*',
        '',
        ...Object.entries(exports.hospitalKnowledge.departments).map(([department, description]) => `• *${department}*: ${description}`),
    ].join('\n');
}
function formatDepartment(department, description) {
    const lines = [`🏥 *${department} Department*`, '', description];
    if (department === 'Emergency') {
        lines.push('', '*Reach us directly for emergencies:*', ...exports.hospitalKnowledge.locations.map((location) => `• ${location.branch}: ${location.phoneNumbers.join(', ')}`));
    }
    lines.push('', 'Please contact the hospital branch for current availability, appointments, and clinician schedules.');
    return lines.join('\n');
}
function formatLeadership() {
    return [
        '👥 *Hospital Leadership*',
        '',
        ...exports.hospitalKnowledge.leadership.map((leader) => `• *${leader.name}* — ${leader.role}\n${leader.message}`),
    ].join('\n\n');
}
function formatSpecialistClinics() {
    return [
        '👨‍⚕️ *Specialist Clinics*',
        '',
        ...exports.hospitalKnowledge.specialistClinics.map((clinic) => `• ${clinic}`),
        '',
        'Doctor names and individual schedules were not provided. Please contact the hospital branch for current clinic availability.',
    ].join('\n');
}
function formatBooking() {
    return [
        '📅 *Booking / Appointments*',
        '',
        'To book a consultation, clinic visit, or procedure, please contact your nearest branch directly:',
        '',
        ...exports.hospitalKnowledge.locations.map((location) => `• *${location.branch}*: ${location.phoneNumbers.join(', ')}`),
        '',
        ...exports.hospitalKnowledge.bookingNotes.map((note) => `• ${note}`),
    ].join('\n');
}
function formatAbout() {
    return [
        `🏥 *${exports.hospitalKnowledge.name}*`,
        `_${exports.hospitalKnowledge.motto}_`,
        '',
        `*Founded:* ${exports.hospitalKnowledge.founded}`,
        '',
        exports.hospitalKnowledge.description,
        '',
        `*Mission:* ${exports.hospitalKnowledge.mission}`,
        '',
        `*Scope:* ${exports.hospitalKnowledge.scope}`,
        '',
        '*Core Values:*',
        ...exports.hospitalKnowledge.values.map((value) => `• ${value}`),
    ].join('\n');
}
function formatUnknown(topicHint) {
    return [
        "That detail wasn't included in the hospital information I have, so I won't guess.",
        topicHint ? `(Topic: ${topicHint})` : '',
        '',
        'Please contact a branch directly for this:',
        ...exports.hospitalKnowledge.locations.map((location) => `• ${location.branch}: ${location.phoneNumbers.join(', ')}`),
    ]
        .filter(Boolean)
        .join('\n');
}
// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------
function findMatchingProcedures(expandedQuery) {
    const searchTerms = getSearchTerms(expandedQuery);
    if (!searchTerms.length) {
        return [];
    }
    return exports.hospitalKnowledge.surgicalPrices
        .map((item) => {
        const procedureText = normalizeText(item.procedure);
        const score = searchTerms.reduce((total, term) => total + (procedureText.includes(term) ? 1 : 0), 0);
        return { item, score };
    })
        .filter(({ score }) => score > 0)
        .sort((first, second) => second.score - first.score)
        .map(({ item }) => item);
}
function formatPrices(expandedQuery) {
    const matches = findMatchingProcedures(expandedQuery);
    if (!matches.length) {
        return [
            '💰 *Procedure Prices*',
            '',
            'Please send the procedure name you want to enquire about.',
            '',
            'Examples:',
            '• Caesarean section price',
            '• Colonoscopy cost',
            '• Appendicectomy price',
            '• Tonsillectomy fee',
            '',
            'Note: only surgical/theatre procedure prices are listed here. Consultation fees, lab test prices, and pharmacy costs were not supplied — please confirm those directly with the hospital.',
            '',
            'Prices should be confirmed with the hospital before booking.',
        ].join('\n');
    }
    const displayedMatches = matches.slice(0, MAX_PROCEDURE_RESULTS);
    const hasMoreMatches = matches.length > MAX_PROCEDURE_RESULTS;
    return [
        '💰 *Matching Procedure Prices*',
        '',
        ...displayedMatches.map((item) => `• ${item.procedure}: *${item.price}*`),
        hasMoreMatches
            ? `\nI found ${matches.length} related procedures. Please send a more specific procedure name for a narrower result.`
            : '',
        '',
        'Prices should be confirmed with the hospital before booking.',
        'Final procedure charges may depend on the surgeon, anesthesia, medicines, investigations, implants, admission duration, and emergency status.',
    ]
        .filter(Boolean)
        .join('\n');
}
const DEPARTMENT_ALIASES = {
    Pharmacy: ['pharmacy', 'medicine', 'medicines', 'drug', 'drugs', 'prescription'],
    Laboratory: [
        'laboratory',
        'lab',
        'blood test',
        'blood tests',
        'medical test',
        'medical tests',
        'sample',
        'specimen',
    ],
    Maternity: [
        'maternity',
        'antenatal',
        'postnatal',
        'pregnancy',
        'pregnant',
        'delivery',
        'deliver',
        'labour',
        'labor',
        'anc',
    ],
    'Newborn Unit': ['newborn', 'nicu', 'premature baby', 'preterm baby', 'new born', 'incubator'],
    Pediatrics: ['pediatric', 'paediatric', 'child', 'children', 'baby', 'babies', 'kid', 'kids'],
    'ICU and HDU': [
        'icu',
        'hdu',
        'intensive care',
        'high dependency',
        'critical care',
        'ventilator',
    ],
    Theatre: ['theatre', 'theater', 'operation', 'operating room', 'surgery', 'operating theatre'],
    Emergency: [
        'emergency',
        'ambulance',
        'urgent',
        'accident',
        'critical emergency',
        'trauma',
        'casualty',
    ],
    Orthopedics: [
        'orthopedic',
        'orthopaedic',
        'bone',
        'bones',
        'fracture',
        'joint',
        'joints',
        'spine',
        'hip replacement',
        'knee replacement',
    ],
    Gynecology: [
        'gynecology',
        'gynaecology',
        'gynecologist',
        'gynaecologist',
        'women health',
        'womens health',
        'fertility',
    ],
    ENT: ['ent', 'ear', 'nose', 'throat', 'hearing', 'sinus', 'tonsil'],
    Urology: [
        'urology',
        'urologist',
        'urinary',
        'prostate',
        'kidney stone',
        'kidney stones',
        'bladder',
    ],
};
function findMatchingDepartment(expandedQuery) {
    for (const [department, description] of Object.entries(exports.hospitalKnowledge.departments)) {
        const searchValues = [normalizeText(department), ...(DEPARTMENT_ALIASES[department] ?? [])];
        if (searchValues.some((searchValue) => expandedQuery.includes(searchValue))) {
            return [department, description];
        }
    }
    return null;
}
function findMatchingServices(expandedQuery) {
    const searchTerms = getSearchTerms(expandedQuery);
    if (!searchTerms.length) {
        return [];
    }
    return exports.hospitalKnowledge.services
        .map((service) => {
        const serviceText = normalizeText(service);
        const score = searchTerms.reduce((total, term) => total + (serviceText.includes(term) ? 1 : 0), 0);
        return { service, score };
    })
        .filter(({ score }) => score > 0)
        .sort((first, second) => second.score - first.score)
        .map(({ service }) => service)
        .slice(0, MAX_SERVICE_RESULTS);
}
function formatServiceConfirmation(matches) {
    return [
        '✅ *Yes, we offer this*',
        '',
        ...matches.map((service) => `• ${service}`),
        '',
        'Please contact the hospital branch to check current availability and book.',
    ].join('\n');
}
/** Finds insurer names (from the accepted list) mentioned directly in the query. */
function findMatchingInsurers(expandedQuery) {
    return exports.hospitalKnowledge.insuranceAccepted.filter((provider) => {
        const normalizedProvider = normalizeText(provider).replace(/\s*\([^)]*\)/g, '').trim();
        return normalizedProvider.length > 1 && expandedQuery.includes(normalizedProvider);
    });
}
/** Finds a branch (or branches) explicitly named in the query. */
function findNamedBranches(expandedQuery) {
    return exports.hospitalKnowledge.locations.filter((location) => normalizeText(location.branch)
        .split(' ')
        .some((word) => word.length > 3 && expandedQuery.includes(word)));
}
// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
/**
 * Searches hospital information and returns a WhatsApp-ready response.
 * Returns null when no confident local answer is available. This function
 * only reads and formats the data above — it never fabricates details that
 * were not supplied (see `unknownTopics`).
 */
function searchKnowledgeBase(query) {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
        return null;
    }
    const expandedQuery = expandQuerySynonyms(normalizedQuery);
    // 1. Hours / availability questions we genuinely cannot answer.
    if (includesAny(expandedQuery, [
        'opening hour',
        'opening hours',
        'operating hour',
        'operating hours',
        'visiting hour',
        'visiting hours',
        'what time do you open',
        'what time do you close',
        'bed availability',
        'bed available',
        'ward availability',
    ])) {
        return formatUnknown('operating/visiting hours or real-time bed availability');
    }
    // 2. Locations / branch / contact.
    if (includesAny(expandedQuery, [
        'location',
        'locations',
        'branch',
        'branches',
        'where',
        'address',
        'contact',
        'phone',
        'telephone',
        'number',
        'directions',
        'how to reach',
    ]) ||
        includesAny(normalizedQuery, ['nasra', 'umoja'])) {
        const namedBranches = findNamedBranches(expandedQuery);
        return formatLocations(namedBranches.length ? namedBranches : undefined);
    }
    // 3. Insurance — check for a specific named insurer first.
    const matchedInsurers = findMatchingInsurers(expandedQuery);
    if (matchedInsurers.length) {
        return formatInsuranceConfirmation(matchedInsurers);
    }
    if (includesAny(expandedQuery, [
        'insurance',
        'cover',
        'covers',
        'medical cover',
        'preauthorization',
        'preauthorisation',
        'nhif',
        'sha',
    ])) {
        return formatInsuranceList();
    }
    // 4. Booking / appointments (explicit intent).
    if (includesAny(expandedQuery, [
        'book an appointment',
        'book appointment',
        'booking',
        'how do i book',
        'how to book',
        'make an appointment',
        'schedule an appointment',
        'reserve a slot',
    ])) {
        return formatBooking();
    }
    // 5. Procedure prices — explicit price language OR a direct procedure-name hit.
    const procedureMatches = findMatchingProcedures(expandedQuery);
    if (includesAny(expandedQuery, [
        'price',
        'prices',
        'cost',
        'costs',
        'fee',
        'fees',
        'charge',
        'charges',
        'how much',
        'ksh',
        'kes',
        'procedure',
    ]) ||
        procedureMatches.length > 0) {
        return formatPrices(expandedQuery);
    }
    // 6. Department match (most specific, detailed answer).
    const matchingDepartment = findMatchingDepartment(expandedQuery);
    if (matchingDepartment) {
        const [department, description] = matchingDepartment;
        return formatDepartment(department, description);
    }
    // 7. Specific service confirmation (e.g. "do you have physiotherapy?").
    const matchingServices = findMatchingServices(expandedQuery);
    if (matchingServices.length &&
        !includesAny(expandedQuery, ['service', 'services', 'offer', 'offers', 'offering'])) {
        return formatServiceConfirmation(matchingServices);
    }
    // 8. Doctor / specialist / general appointment-availability questions.
    if (includesAny(expandedQuery, [
        'doctor',
        'doctors',
        'specialist',
        'specialists',
        'consultant',
        'consultants',
        'availability',
        'available',
        'schedule',
        'schedules',
        'appointment',
        'appointments',
        'clinic hours',
        'clinic time',
    ])) {
        return formatSpecialistClinics();
    }
    // 9. Generic department listing.
    if (includesAny(expandedQuery, ['department', 'departments'])) {
        return formatAllDepartments();
    }
    // 10. Generic services listing.
    if (includesAny(expandedQuery, [
        'service',
        'services',
        'treatment',
        'treatments',
        'offer',
        'offers',
        'offering',
        'facility',
        'facilities',
        'what do you offer',
    ])) {
        return matchingServices.length ? formatServiceConfirmation(matchingServices) : formatServices();
    }
    // 11. Leadership.
    if (includesAny(expandedQuery, [
        'ceo',
        'administrator',
        'leadership',
        'management',
        'manager',
        'director',
    ])) {
        return formatLeadership();
    }
    // 12. About / mission / values / general hospital info.
    if (includesAny(expandedQuery, [
        'mission',
        'value',
        'values',
        'motto',
        'about',
        'founded',
        'history',
        'phadam',
        'hospital information',
        'hospital details',
    ])) {
        return formatAbout();
    }
    return null;
}
function getHospitalSummary() {
    return [
        `🏥 *${exports.hospitalKnowledge.name}*`,
        `_${exports.hospitalKnowledge.motto}_`,
        '',
        exports.hospitalKnowledge.description,
        '',
        'You can ask me about:',
        '• Locations and contacts (e.g. "Nasra branch contact")',
        '• Services and departments (e.g. "do you have physiotherapy?")',
        '• Insurance partners (e.g. "do you accept Britam?")',
        '• Surgical procedure prices (e.g. "cost of a caesarean section")',
        '• Specialist clinics',
        '• Booking an appointment',
        '• Mission, values, and hospital leadership',
    ].join('\n');
}
