"use strict";
// src/data/hospitalKnowledge.ts
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
        {
            procedure: 'Feeding gastrostomy tube insertion/Jejunostomy',
            price: 'KSh 80,000',
        },
        {
            procedure: 'Adenoidectomy',
            price: 'KSh 65,000',
        },
        {
            procedure: 'Adenotonsillectomy',
            price: 'KSh 70,000',
        },
        {
            procedure: 'Tonsillectomy',
            price: 'KSh 50,000',
        },
        {
            procedure: 'Removal of foreign body from ear or nose under GA',
            price: 'KSh 40,000',
        },
        {
            procedure: 'Release of tongue tie in theatre',
            price: 'KSh 25,000',
        },
        {
            procedure: 'Appendicectomy',
            price: 'KSh 60,000',
        },
        {
            procedure: 'Herniotomy',
            price: 'KSh 50,000',
        },
        {
            procedure: 'Orchidopexy',
            price: 'KSh 50,000',
        },
        {
            procedure: 'Herniorrhaphy',
            price: 'KSh 50,000',
        },
        {
            procedure: 'Cholecystectomy',
            price: 'KSh 80,000',
        },
        {
            procedure: 'Exploratory laparotomy',
            price: 'KSh 60,000',
        },
        {
            procedure: 'Gastrojejunostomy',
            price: 'KSh 120,000',
        },
        {
            procedure: 'Haemorrhoidectomy',
            price: 'KSh 40,000',
        },
        {
            procedure: 'Lateral sphincterotomy',
            price: 'KSh 40,000',
        },
        {
            procedure: 'Repair of hiatus hernia',
            price: 'KSh 150,000',
        },
        {
            procedure: 'Repair of epigastric hernia',
            price: 'KSh 50,000',
        },
        {
            procedure: 'Repair of strangulated hernia',
            price: 'KSh 80,000',
        },
        {
            procedure: 'Repair of umbilical hernia with mesh',
            price: 'KSh 40,000',
        },
        {
            procedure: 'Tendon repair',
            price: 'KSh 120,000',
        },
        {
            procedure: 'Thyroidectomy',
            price: 'KSh 120,000',
        },
        {
            procedure: 'Colonoscopy',
            price: 'KSh 20,000',
        },
        {
            procedure: 'Oesophago-Gastro-Duodenoscopy (OGD)',
            price: 'KSh 12,000',
        },
        {
            procedure: 'Excision of lipoma/wide excision',
            price: 'KSh 30,000',
        },
        {
            procedure: 'Circumcision under GA',
            price: 'KSh 25,000',
        },
        {
            procedure: 'Surgical debridement/escharectomy/toileting',
            price: 'KSh 30,000',
        },
        {
            procedure: 'Laparoscopic Nissen’s fundoplication',
            price: 'KSh 250,000',
        },
        {
            procedure: 'Laparotomy: endometriosis surgery',
            price: 'KSh 120,000',
        },
        {
            procedure: 'Total abdominal hysterectomy',
            price: 'KSh 80,000',
        },
        {
            procedure: 'Myomectomy',
            price: 'KSh 80,000',
        },
        {
            procedure: 'Laparotomy for pelvic abscess',
            price: 'KSh 120,000',
        },
        {
            procedure: 'Laparotomy for ruptured ectopic pregnancy',
            price: 'KSh 120,000',
        },
        {
            procedure: 'Ovarian cystectomy',
            price: 'KSh 80,000',
        },
        {
            procedure: 'Tuboplasty',
            price: 'KSh 80,000',
        },
        {
            procedure: 'Repair of rectovaginal fistula',
            price: 'KSh 80,000',
        },
        {
            procedure: 'Bilateral tubal ligation',
            price: 'KSh 25,000',
        },
        {
            procedure: 'Cervical cerclage/insertion of MacDonald stitch',
            price: 'KSh 30,000',
        },
        {
            procedure: 'Dilatation and curettage',
            price: 'KSh 25,000',
        },
        {
            procedure: 'Bilateral tubal ligation done with caesarean section',
            price: 'KSh 15,000',
        },
        {
            procedure: 'Marsupialisation of Bartholin’s cyst/abscess',
            price: 'KSh 25,000',
        },
        {
            procedure: 'Retrieval of lost/fragmented IUCD',
            price: 'KSh 20,000',
        },
        {
            procedure: 'Below/above-knee amputation',
            price: 'KSh 110,000',
        },
        {
            procedure: 'Open reduction and internal fixation',
            price: 'KSh 130,000',
        },
        {
            procedure: 'Closed manipulation of dislocations/fractures',
            price: 'KSh 15,000',
        },
        {
            procedure: 'Excision of ingrown toenail under GA',
            price: 'KSh 25,000',
        },
        {
            procedure: 'Rotation flaps',
            price: 'KSh 100,000',
        },
        {
            procedure: 'Repair of bladder',
            price: 'KSh 80,000',
        },
        {
            procedure: 'Repair of ruptured urethra',
            price: 'KSh 120,000',
        },
        {
            procedure: 'Transurethral resection of bladder tumour (TURBT)',
            price: 'KSh 220,000',
        },
        {
            procedure: 'Transurethral resection of prostate (TURP)',
            price: 'KSh 190,000',
        },
        {
            procedure: 'Skin grafting below 10% TBSA',
            price: 'KSh 40,000',
        },
        {
            procedure: 'Skin grafting above 10% TBSA',
            price: 'KSh 80,000',
        },
        {
            procedure: 'Reduction mammoplasty',
            price: 'KSh 150,000',
        },
        {
            procedure: 'Cleft lip repair',
            price: 'KSh 50,000',
        },
        {
            procedure: 'Cleft palate repair',
            price: 'KSh 80,000',
        },
        {
            procedure: 'Cleft lip and palate repair',
            price: 'KSh 100,000',
        },
        {
            procedure: 'ACL/PCL surgery',
            price: 'KSh 250,000',
        },
        {
            procedure: 'Removal of hardware: wires',
            price: 'KSh 20,000',
        },
        {
            procedure: 'Removal of hardware: plates and nails',
            price: 'KSh 80,000',
        },
        {
            procedure: 'Caesarean section',
            price: 'KSh 45,000–75,000',
        },
        {
            procedure: 'Normal delivery/SVD',
            price: 'KSh 13,000–20,000',
        },
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
};
const MAX_PROCEDURE_RESULTS = 12;
const STOP_WORDS = new Set([
    'a',
    'an',
    'and',
    'are',
    'at',
    'can',
    'do',
    'for',
    'how',
    'i',
    'in',
    'is',
    'me',
    'of',
    'or',
    'the',
    'to',
    'what',
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
function formatLocations() {
    return [
        '📍 *Phadam Hospital Locations*',
        '',
        ...exports.hospitalKnowledge.locations.map((location) => [
            `• *${location.branch}*`,
            `Address: ${location.address}`,
            location.landmark ? `Landmark: ${location.landmark}` : '',
            `Contact: ${location.phoneNumbers.join(', ')}`,
        ]
            .filter(Boolean)
            .join('\n')),
    ].join('\n\n');
}
function formatServices() {
    return [
        '🏥 *Our Services*',
        '',
        ...exports.hospitalKnowledge.services.map((service) => `• ${service}`),
    ].join('\n');
}
function formatInsurance() {
    return [
        '🛡️ *Insurance and Medical Cover Partners*',
        '',
        ...exports.hospitalKnowledge.insuranceAccepted.map((provider) => `• ${provider}`),
        '',
        'Please confirm eligibility and preauthorization requirements before treatment.',
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
    return [
        `🏥 *${department} Department*`,
        '',
        description,
        '',
        'Please contact the hospital branch for current availability, appointments, and clinician schedules.',
    ].join('\n');
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
function findMatchingProcedures(query) {
    const searchTerms = getSearchTerms(query);
    if (!searchTerms.length) {
        return [];
    }
    return exports.hospitalKnowledge.surgicalPrices
        .map((item) => {
        const procedureText = normalizeText(item.procedure);
        const score = searchTerms.reduce((total, term) => {
            return total + (procedureText.includes(term) ? 1 : 0);
        }, 0);
        return {
            item,
            score,
        };
    })
        .filter(({ score }) => score > 0)
        .sort((first, second) => second.score - first.score)
        .map(({ item }) => item);
}
function formatPrices(query) {
    const matches = findMatchingProcedures(query);
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
function findMatchingDepartment(query) {
    const normalizedQuery = normalizeText(query);
    const departmentAliases = {
        Pharmacy: ['pharmacy', 'medicine', 'medicines', 'drug', 'drugs'],
        Laboratory: [
            'laboratory',
            'lab',
            'blood test',
            'blood tests',
            'medical test',
            'medical tests',
        ],
        Maternity: [
            'maternity',
            'antenatal',
            'postnatal',
            'pregnancy',
            'delivery',
            'deliver',
        ],
        'Newborn Unit': [
            'newborn',
            'nicu',
            'premature baby',
            'preterm baby',
            'new born',
        ],
        Pediatrics: [
            'pediatric',
            'paediatric',
            'child',
            'children',
            'baby',
            'babies',
        ],
        'ICU and HDU': [
            'icu',
            'hdu',
            'intensive care',
            'high dependency',
            'critical care',
        ],
        Theatre: [
            'theatre',
            'theater',
            'operation',
            'operating room',
            'surgery',
        ],
        Emergency: [
            'emergency',
            'ambulance',
            'urgent',
            'accident',
            'critical emergency',
        ],
        Orthopedics: [
            'orthopedic',
            'orthopaedic',
            'bone',
            'bones',
            'fracture',
            'joint',
            'joints',
        ],
        Gynecology: [
            'gynecology',
            'gynaecology',
            'gynecologist',
            'gynaecologist',
            'women health',
            'womens health',
        ],
        ENT: [
            'ent',
            'ear',
            'nose',
            'throat',
            'hearing',
            'sinus',
            'tonsil',
        ],
        Urology: [
            'urology',
            'urologist',
            'urinary',
            'prostate',
            'kidney stone',
            'kidney stones',
        ],
    };
    for (const [department, description] of Object.entries(exports.hospitalKnowledge.departments)) {
        const searchValues = [
            normalizeText(department),
            ...(departmentAliases[department] ?? []),
        ];
        if (searchValues.some((searchValue) => normalizedQuery.includes(searchValue))) {
            return [department, description];
        }
    }
    return null;
}
/**
 * Searches hospital information and returns a WhatsApp-ready response.
 * Returns null when no confident local answer is available.
 */
function searchKnowledgeBase(query) {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
        return null;
    }
    if (includesAny(normalizedQuery, [
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
        'nasra',
        'umoja',
    ])) {
        return formatLocations();
    }
    if (includesAny(normalizedQuery, [
        'insurance',
        'cover',
        'covers',
        'sha',
        'minet',
        'jubilee',
        'aar',
        'britam',
        'uap',
        'sanlam',
        'cic',
        'medical cover',
        'preauthorization',
        'preauthorisation',
    ])) {
        return formatInsurance();
    }
    const procedureMatches = findMatchingProcedures(query);
    if (includesAny(normalizedQuery, [
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
        return formatPrices(query);
    }
    const matchingDepartment = findMatchingDepartment(query);
    if (matchingDepartment) {
        const [department, description] = matchingDepartment;
        return formatDepartment(department, description);
    }
    if (includesAny(normalizedQuery, [
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
    if (includesAny(normalizedQuery, [
        'department',
        'departments',
    ])) {
        return formatAllDepartments();
    }
    if (includesAny(normalizedQuery, [
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
        return formatServices();
    }
    if (includesAny(normalizedQuery, [
        'ceo',
        'administrator',
        'leadership',
        'management',
        'manager',
        'director',
    ])) {
        return formatLeadership();
    }
    if (includesAny(normalizedQuery, [
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
        '• Locations and contacts',
        '• Services and departments',
        '• Insurance partners',
        '• Surgical prices',
        '• Specialist clinics',
        '• Mission and values',
        '• Hospital leadership',
    ].join('\n');
}
