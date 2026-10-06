export interface HospitalLocation {
  branch: string;
  address: string;
  landmark?: string;
  phoneNumbers: string[];
}

export interface SurgicalPrice {
  procedure: string;
  price: string;
  keywords?: string[];
}

export interface HospitalLeader {
  role: string;
  name: string;
  message: string;
}

export interface HospitalKnowledge {
  name: string;
  legalName: string;
  motto: string;
  founded: string;
  registrationNumber: string;
  beds: number;
  emails: string[];
  postalAddress: string;
  history: string;
  description: string;
  mission: string;
  vision: string;
  scope: string;
  values: string[];
  objectives: string[];
  goals: string[];
  corporateResponsibility: string[];
  locations: HospitalLocation[];
  services: string[];
  specialistClinics: string[];
  departments: Record<string, string>;
  insuranceAccepted: string[];
  surgicalPrices: SurgicalPrice[];
  bookingFees: Record<string, string>;
  leadership: HospitalLeader[];
  bookingNotes: string[];
  unknownTopics: string[];
  consultationFee: string;
  openingHours: string;
  holidayAppointmentNote: string;
  virtualConsultationFee: string;
  virtualConsultationNote: string;
  dermatologyCareNote: string;
  skinAnalysisNote: string;
  treatmentPricingNote: string;
  dermatologyInsuranceNote: string;
  skinLesionAssessmentNote: string;
  darkSpotsNote: string;
  acneKeloidalisNuchaeNote: string;
  skinImageNote: string;
}

export const hospitalKnowledge: HospitalKnowledge = {
  name: 'Winston Medical Centre',
  legalName: 'Winston Medical Centre',
  motto: 'Affordable, accessible and quality healthcare',
  founded: '2016',
  registrationNumber: 'CPR 017141',
  beds: 2,
  emails: ['winstonmedicalcentre01@gmail.com'],
  postalAddress: 'P.O. Box 1022-00606, Nairobi',
  history: 'Winston Medical Centre opened in 2016 to provide quality, affordable healthcare to the surrounding community. It is a registered private hospital administered in accordance with the Medical Practitioners and Dentists Board; management approval was granted in 2016.',
  consultationFee: 'KSh 500',
  openingHours: 'Monday to Saturday, 8:00 AM to 5:00 PM',
  holidayAppointmentNote: 'Appointments can also be booked on Sundays and public holidays. Please call 0726 244040 or 0708 130100 directly to arrange one at a convenient time.',
  virtualConsultationFee: 'KSh 1,000',
  virtualConsultationNote: 'Virtual consultations are available. Please call 0726 244040 or 0708 130100 for guidance and arrangements.',
  dermatologyCareNote: 'Our dermatologist handles all skin conditions. A dermatologist must first perform a clinical and physical examination before making a diagnosis or recommending treatment.',
  skinAnalysisNote: 'We do not offer skin analysis. Our dermatologists use clinical and physical examination to assess skin conditions; AI-dependent skin analysis, often relied on by cosmetic outlets, can be misleading and may lead to misdiagnosis.',
  treatmentPricingNote: 'Treatment costs depend on the treatment plan recommended by the doctor after examining you. Please visit and see a doctor before asking for a treatment cost.',
  dermatologyInsuranceNote: 'We do not accept SHA for dermatology services. Dermatology services are cash-only. For other services, please call 0726 244040 or 0708 130100 to confirm cover.',
  skinLesionAssessmentNote: 'Yes, we assess and manage skin tags, keloids, warts, and ingrown nails, but a doctor must examine the condition and decide on the appropriate treatment plan. Please visit us for a clinical evaluation first.',
  darkSpotsNote: 'Dark spots can have many causes, including post-inflammatory changes, sunburn, medicines, skin infections, acne, trauma, hormonal factors, or genetic conditions. The appropriate treatment depends on the cause and whether the pigmentation is superficial or deeper. Please see our dermatologist for an assessment and suitable treatment plan.',
  acneKeloidalisNuchaeNote: 'Acne keloidalis nuchae is associated with inflammation of hair follicles. Possible contributing factors include close shaving, friction or irritation from collars, caps or helmets, ingrown hairs, genetics, and bacterial colonisation, including Propionibacterium. A dermatologist can assess your individual condition and advise on care.',
  skinImageNote: 'You may share a photo, but please call the doctor directly first for guidance on 0708 130100 or 0726 244040. A photo cannot replace a clinical examination.',
  description: 'Winston Medical Centre is located at Standard Drive, Fedha, Embakasi, Nairobi. It has two beds and provides general outpatient care, inpatient care in General Medicine, Minor Surgery and Gynecology, and an Urgent Care Centre incorporating a Local Injuries Unit and Medical Assessment Unit.',
  mission: 'Provide affordable, accessible and quality healthcare services.',
  vision: 'To be among the leading providers of accessible, quality and innovative healthcare services in the country.',
  scope: 'The centre is dedicated to welcoming, accessible, safe, affordable and respectful healthcare. Patients, families, community representatives and leaders are active partners in its operations and improvement work.',
  values: [
    'Professionalism',
    'Equality',
    'Integrity',
    'Committed service',
    'The client’s health is our priority',
    'Moral and ethical uprightness',
    'Professional excellence through exceptional standards',
    'Client satisfaction',
  ],
  objectives: ['Make available a well-equipped and efficient healthcare facility that provides a high standard of patient care.'],
  goals: [
    'Improve quality care at the most appropriate cost.',
    'Offer exemplary, state-of-the-art medical practice.',
    'Maintain a strong social responsibility agenda.',
    'Provide corporate clients with a total medical solution.',
    'Adopt appropriate new therapies as they become available.',
    'Improve chronic-disease care transitions and coordination across primary, hospital and post-hospital care.',
    'Promote evidence-based medicine through clinical guidelines, outcome monitoring and continuous improvement.',
    'Pursue National Hospital Insurance Fund outpatient facility accreditation.',
  ],
  corporateResponsibility: [
    'Subsidized services for people in need in the local area.',
    'Subsidized healthcare for orphans in partnership with WAYAAP (Women and Youth Against AIDS and Poverty).',
    'Free medical checkups and medication in Tassia slum every three months.',
  ],
  locations: [
    {
      branch: 'Winston Medical Centre',
      address: 'Standard Drive, Fedha, Embakasi, Nairobi',
      landmark: 'Standard Drive Estate, along Nyayo Gate B Road, 400 metres from Fedha Stage. Direction: Fedha Stage.',
      phoneNumbers: ['0726 244040', '0708 130100'],
    },
  ],
  services: [
    'General Outpatient Care',
    'General Medicine',
    'Minor Surgery',
    'Gynecology',
    'Urgent Care Centre',
    'Local Injuries Unit',
    'Medical Assessment Unit',
    'Pharmacy',
    'Laboratory Services',
    'Antenatal Clinic',
    'Well Baby Clinic',
    'Ultrasound Services',
    'Counseling',
    'Maternal & Child Healthcare Clinic',
    'Physiotherapy',
    'ECG/ECHO',
    'Pediatric Clinic',
    'Circumcision',
    'Family Planning Services',
  ],
  specialistClinics: ['Gynecologist', 'Paediatrician', 'Dermatologist', 'Nutritionist'],
  departments: {
    'General Outpatient Care': 'General outpatient consultations and care are available. The listed general consultation fee is KSh 500; investigations, medicines and other services are priced separately.',
    'General Medicine': 'General Medicine is one of the hospital’s inpatient specialties. The centre has two beds; real-time bed availability is not provided here.',
    'Minor Surgery': 'Minor Surgery is an inpatient specialty. Specific procedure prices are not included in the supplied price list and should be confirmed with the hospital.',
    Gynecology: 'Gynecology is an inpatient specialty and a listed clinic service. The listed gynecologist fee is KSh 1,500.',
    'Urgent Care Centre': 'The Urgent Care Centre incorporates a Local Injuries Unit and a Medical Assessment Unit.',
    'Local Injuries Unit': 'The Local Injuries Unit is part of the Urgent Care Centre.',
    'Medical Assessment Unit': 'The Medical Assessment Unit is part of the Urgent Care Centre.',
    Pharmacy: 'Pharmacy services are available. Individual medicine prices were not supplied.',
    'Laboratory Services': 'Laboratory services are available, and the supplied price list includes individual test prices. Ask about a specific test or request the full price list.',
    'Antenatal Clinic': 'Antenatal care is available. An antenatal visit is listed at KSh 300; the ANC profile is listed separately at KSh 2,500.',
    'Well Baby Clinic': 'A Well Baby Clinic is available. The listed fee is KSh 200.',
    'Ultrasound Services': 'Ultrasound services are available. The listed price is KSh 2,000.',
    Counseling: 'Counseling is available. The listed fee is KSh 500.',
    'Maternal & Child Healthcare Clinic': 'Maternal and Child Healthcare services are available at the centre.',
    Physiotherapy: 'Physiotherapy is available. The listed fee is KSh 1,500.',
    'ECG/ECHO': 'ECG and ECHO services are available. A price was not included in the supplied list.',
    'Pediatric Clinic': 'A Pediatric Clinic is available. The listed paediatrician fee is KSh 1,500; a Well Baby Clinic is also available.',
    Circumcision: 'Circumcision is available. The listed price is KSh 1,000.',
    'Family Planning Services': 'Family planning services are available. A price was not included in the supplied list.',
  },
  insuranceAccepted: ['GA Insurance', 'Kenyan Alliance', 'MTIBA (under GA Insurance)'],
  surgicalPrices: [
    { procedure: 'Microneedling', price: 'KSh 22,000 per session', keywords: ['micro needling', 'micro-needling', 'microneedle', 'microneedling session'] },
    { procedure: 'Counseling', price: 'KSh 500', keywords: ['counselling', 'therapy', 'counselor', 'counsellor'] },
    { procedure: 'Ultrasound', price: 'KSh 2,000', keywords: ['scan', 'sonography', 'pregnancy scan'] },
    { procedure: 'ANC profile', price: 'KSh 2,500', keywords: ['antenatal profile', 'antenatal test profile', 'pregnancy profile'] },
    { procedure: 'Antenatal visit', price: 'KSh 300', keywords: ['antenatal clinic visit', 'prenatal visit', 'anc visit'] },
    { procedure: 'Well Baby Clinic', price: 'KSh 200', keywords: ['well-baby clinic', 'baby clinic', 'infant clinic', 'child wellness'] },
    { procedure: 'BP check', price: 'KSh 50', keywords: ['blood pressure', 'blood pressure check', 'bp checkup'] },
    { procedure: 'Physiotherapy', price: 'KSh 1,500', keywords: ['physio', 'physical therapy', 'rehabilitation'] },
    { procedure: 'Nebulisation', price: 'KSh 1,000', keywords: ['nebulization', 'nebuliser', 'nebulizer'] },
    { procedure: 'Circumcision', price: 'KSh 1,000', keywords: ['male circumcision'] },
    { procedure: 'Gynecologist', price: 'KSh 1,500', keywords: ['gynecology', 'gynaecology', 'gynaecologist', 'gynecologist consultation', 'gynaecologist consultation', 'women’s health doctor', 'ob-gyn', 'obgyn'] },
    { procedure: 'Paediatrician', price: 'KSh 1,500', keywords: ['pediatrician', 'paediatrician consultation', 'pediatrician consultation', 'children’s doctor', 'child specialist'] },
    { procedure: 'Dermatologist', price: 'KSh 1,000', keywords: ['dermatology', 'skin specialist', 'skin doctor'] },
    { procedure: 'Nutritionist', price: 'KSh 1,000', keywords: ['nutrition', 'dietitian', 'dietician', 'nutrition consultation'] },
    { procedure: 'Rota virus test', price: 'KSh 1,000', keywords: ['rotavirus', 'rota virus'] },
    { procedure: 'BS for MPs', price: 'KSh 200', keywords: ['blood smear for malaria', 'malaria parasite test', 'mp test'] },
    { procedure: 'Urinalysis', price: 'KSh 300', keywords: ['urine test', 'urine analysis'] },
    { procedure: 'VDRL', price: 'KSh 500', keywords: ['vdrl test'] },
    { procedure: 'Widal test', price: 'KSh 300', keywords: ['typhoid test'] },
    { procedure: 'S.A.T', price: 'KSh 600', keywords: ['sat test'] },
    { procedure: 'Pregnancy test', price: 'KSh 200', keywords: ['pregnancy test', 'pregnancy testing'] },
    { procedure: 'HIV test', price: 'KSh 250', keywords: ['hiv screening', 'hiv test'] },
    { procedure: 'FHG', price: 'KSh 1,000', keywords: ['fhg test'] },
    { procedure: 'H. pylori test', price: 'KSh 600', keywords: ['h pylori', 'helicobacter pylori'] },
    { procedure: 'RBS', price: 'KSh 200', keywords: ['random blood sugar', 'blood sugar test'] },
    { procedure: 'Stool for O/C', price: 'KSh 300', keywords: ['stool test', 'stool ova and cysts', 'ova and cysts'] },
    { procedure: 'R factor', price: 'KSh 500', keywords: ['r factor test'] },
    { procedure: 'Brucellosis test', price: 'KSh 500', keywords: ['brucella test'] },
    { procedure: 'ESR', price: 'KSh 300', keywords: ['erythrocyte sedimentation rate'] },
    { procedure: 'G. staining', price: 'KSh 500', keywords: ['gram staining', 'gram stain', 'g staining'] },
    { procedure: 'CBC', price: 'KSh 1,000', keywords: ['complete blood count', 'full blood count', 'fbc'] },
    { procedure: 'Blood grouping', price: 'KSh 300', keywords: ['blood group', 'blood type'] },
    { procedure: 'Hepatitis A test', price: 'KSh 1,000', keywords: ['hepatitis a'] },
    { procedure: 'Hepatitis B test', price: 'KSh 1,000', keywords: ['hepatitis b'] },
    { procedure: 'Hepatitis C test', price: 'KSh 1,000', keywords: ['hepatitis c'] },
    { procedure: 'PSA', price: 'KSh 1,000', keywords: ['prostate-specific antigen', 'prostate test'] },
  ],
  bookingFees: {
    'General Consultation': 'KSh 500',
    'General Outpatient Care': 'KSh 500',
    'General Medicine': 'KSh 500',
    'Counseling': 'KSh 500',
    'Obstetrics and Gynecology': 'KSh 1,500',
    'Antenatal Clinic': 'KSh 300',
    'Well Baby Clinic': 'KSh 200',
    'Ultrasound Services': 'KSh 2,000',
    Physiotherapy: 'KSh 1,500',
    Gynecology: 'KSh 1,500',
    Gynecologist: 'KSh 1,500',
    Paediatrician: 'KSh 1,500',
    'Pediatric Clinic': 'KSh 1,500',
    Dermatologist: 'KSh 1,000',
    Nutritionist: 'KSh 1,000',
    Circumcision: 'KSh 1,000',
  },
  leadership: [
    {
      role: 'Director',
      name: 'Jesse Ouma Obengo',
      message: 'Winston Medical Centre is committed to providing affordable, accessible and quality healthcare services.',
    },
  ],
  bookingNotes: [
    'To request an appointment, share the service or clinic, preferred date and preferred time.',
    'Appointment availability and clinician schedules must be confirmed with the hospital.',
    'Listed prices should be confirmed with the hospital; tests, medication, procedures and admission may be charged separately.',
    'For urgent care, contact Winston Medical Centre directly on 0726 244040 or 0708 130100.',
  ],
  unknownTopics: [
    'named doctors and clinician schedules',
    'live appointment slots and real-time bed availability',
    'unlisted service, medication and procedure prices',
  ],
};

// Departments where a flat "consultation fee" framing doesn't really apply
// (e.g. you don't "consult" the pharmacy — you fill a prescription there).
// These are excluded from the consultation-fee line in department/service
// responses so we don't imply a fee structure that doesn't make sense.
const NON_CONSULTATION_DEPARTMENTS = new Set(['Pharmacy', 'Laboratory Services']);

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
  'much',
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
  // Generic descriptor words that, on their own, don't identify a specific
  // service/procedure/department. Without excluding these, a broad request
  // like "get me a list of all your services" would incorrectly match only
  // the handful of services whose *name* literally contains the word
  // "services" (e.g. "Maternity services", "Ambulance services"), instead
  // of being recognized as a request for the full list.
  'service',
  'services',
  'treatment',
  'treatments',
  'offer',
  'offers',
  'offering',
  'facility',
  'facilities',
  'price',
  'prices',
  'cost',
  'costs',
  'fee',
  'fees',
  'charge',
  'charges',
  'test',
  'tests',
  'list',
  'all',
  'full',
  'complete',
  'every',
]);

function normalizeText(value: string): string {
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
const QUERY_SYNONYMS: Array<[RegExp, string]> = [
  // Winston service names and common patient wording
  [/\b(general|doctor|medical) (check[ -]?up|consultation|consult)\b/g, 'general consultation'],
  [/\b(outpatient|out patient|walk[ -]?in clinic)\b/g, 'general outpatient care'],
  [/\b(prenatal|pregnancy check[ -]?up|maternity clinic)\b/g, 'antenatal clinic'],
  [/\b(well-baby|well baby|baby wellness|infant clinic)\b/g, 'well baby clinic'],
  [/\b(paediatrics|pediatrics|children clinic|child clinic|kids clinic)\b/g, 'pediatric clinic'],
  [/\b(gynaecology|gynaecologist|gynecologist|ob[ -]?gyn|obstetrics)\b/g, 'gynecology'],
  [/\b(counsell?ing|counselor|counsellor)\b/g, 'counseling'],
  [/\b(mch|maternal and child health|mother and child clinic)\b/g, 'maternal child healthcare clinic'],
  [/\b(ecg|echo|electrocardiogram|echocardiogram)\b/g, 'ecg echo'],
  [/\b(birth control|contraception|contraceptives)\b/g, 'family planning'],
  [/\b(minor injury|injuries|accident injury)\b/g, 'local injuries unit'],
  [/\b(urgent|emergency) care\b/g, 'urgent care centre'],
  [/\b(medical assessment|acute assessment)\b/g, 'medical assessment unit'],
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

function expandQuerySynonyms(normalizedQuery: string): string {
  return QUERY_SYNONYMS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    normalizedQuery,
  );
}

function getSearchTerms(value: string): string[] {
  return [
    ...new Set(
      normalizeText(value)
        .split(' ')
        .filter((term) => term.length >= 3 && !STOP_WORDS.has(term)),
    ),
  ];
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatBranch(location: HospitalLocation): string {
  return [
    `• *${location.branch}*`,
    `Address: ${location.address}`,
    location.landmark ? `Landmark: ${location.landmark}` : '',
    `Contact: ${location.phoneNumbers.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatLocations(branchFilter?: HospitalLocation[]): string {
  const branches = branchFilter && branchFilter.length ? branchFilter : hospitalKnowledge.locations;
  return [
    `📍 *${hospitalKnowledge.name} Location*`,
    '',
    `We have ${hospitalKnowledge.locations.length === 1 ? 'one branch' : `${hospitalKnowledge.locations.length} branches`}, in Nairobi.`,
    ...branches.map(formatBranch),
    '',
    `Email: ${hospitalKnowledge.emails.join(', ')}`,
    `Postal address: ${hospitalKnowledge.postalAddress}`,
  ].join('\n\n');
}

function formatOpeningHours(): string {
  return [
    '🕒 *Opening Hours*',
    '',
    `Our regular opening hours are ${hospitalKnowledge.openingHours}.`,
    hospitalKnowledge.holidayAppointmentNote,
  ].join('\n');
}

function formatServices(): string {
  return [
    '🏥 *Our Services*',
    '',
    ...hospitalKnowledge.services.map((service) => `• ${service}`),
    '',
    `General consultation: *${hospitalKnowledge.consultationFee}*. Fees for other services vary.`,
    'Ask about a service or test for its listed fee, reply "price list" for the supplied price list, or "book appointment" to request a visit.',
  ].join('\n');
}

function formatInsuranceList(): string {
  if (!hospitalKnowledge.insuranceAccepted.length) {
    return [
      '🛡️ *Insurance and Medical Cover*',
      '',
      'I don’t have a confirmed list of accepted insurance providers or plans. Please contact Winston Medical Centre to check your specific cover.',
      ...hospitalKnowledge.locations.map((location) => location.phoneNumbers.join(', ')),
    ].join('\n');
  }

  return [
    '🛡️ *Insurance and Medical Cover Partners*',
    '',
    ...hospitalKnowledge.insuranceAccepted.map((provider) => `• ${provider}`),
    '',
    'Some additional major insurance providers are expected to be onboarded soon.',
    'Please confirm eligibility and preauthorization requirements with the hospital before treatment.',
  ].join('\n');
}

function formatInsuranceConfirmation(matches: string[]): string {
  const branchList = hospitalKnowledge.locations
    .map((location) => `${location.branch} (${location.address})`)
    .join('; ');

  return [
    '🛡️ *Insurance Confirmation*',
    '',
    `Yes — ${hospitalKnowledge.name} works with: ${matches.join(', ')}. Our location is ${branchList}.`,
    '',
    'Please confirm your specific plan\'s eligibility and any preauthorization requirements directly with the hospital before your visit.',
  ].join('\n');
}

function formatAllDepartments(): string {
  return [
    '🏥 *Hospital Departments*',
    '',
    ...Object.entries(hospitalKnowledge.departments).map(
      ([department, description]) => `• *${department}*: ${description}`,
    ),
    '',
    'Fees vary by service. Ask about a specific clinic, service or laboratory test for its listed price.',
  ].join('\n');
}

function formatDepartment(department: string, description: string): string {
  const lines = [`🏥 *${department} Department*`, '', description];

  if (department === 'Urgent Care Centre' || department === 'Local Injuries Unit') {
    lines.push(
      '',
      '*Contact Winston Medical Centre:*',
      ...hospitalKnowledge.locations.map(
        (location) => `• ${location.branch}: ${location.phoneNumbers.join(', ')}`,
      ),
    );
  }

  if (!NON_CONSULTATION_DEPARTMENTS.has(department) && !hospitalKnowledge.bookingFees[department]) {
    lines.push(
      '',
      'Please ask for a specific service or test to see whether its price is listed.',
    );
  }

  lines.push(
    '',
    'Please contact the hospital to confirm current availability and clinician schedules, or reply "book appointment" to send an appointment request.',
  );

  return lines.join('\n');
}

function formatLeadership(): string {
  return [
    '👥 *Hospital Leadership*',
    '',
    ...hospitalKnowledge.leadership.map(
      (leader) => `• *${leader.name}* — ${leader.role}\n${leader.message}`,
    ),
  ].join('\n\n');
}

function formatSpecialistClinics(): string {
  return [
    '👨‍⚕️ *Specialist Clinics*',
    '',
    ...hospitalKnowledge.specialistClinics.map((clinic) => `• ${clinic}`),
    '',
    'Fees vary by clinic. Doctor names, schedules and live availability were not provided; please contact the hospital to confirm.',
  ].join('\n');
}

function formatBooking(): string {
  return [
    '📅 *Booking / Appointments*',
    '',
    'To book a consultation, clinic visit, or procedure, please contact your nearest branch directly, or just reply "book appointment" and I can take your details right here:',
    '',
    ...hospitalKnowledge.locations.map(
      (location) => `• *${location.branch}*: ${location.phoneNumbers.join(', ')}`,
    ),
    '',
    ...hospitalKnowledge.bookingNotes.map((note) => `• ${note}`),
  ].join('\n');
}

function formatAbout(): string {
  return [
    `🏥 *${hospitalKnowledge.name}*`,
    `_${hospitalKnowledge.motto}_`,
    '',
    `*Founded:* ${hospitalKnowledge.founded}`,
    `*Registration:* ${hospitalKnowledge.registrationNumber}`,
    `*Beds:* ${hospitalKnowledge.beds}`,
    '',
    `*History:* ${hospitalKnowledge.history}`,
    '',
    hospitalKnowledge.description,
    '',
    `*Mission:* ${hospitalKnowledge.mission}`,
    '',
    `*Vision:* ${hospitalKnowledge.vision}`,
    '',
    `*Scope:* ${hospitalKnowledge.scope}`,
    '',
    '*Core Values:*',
    ...hospitalKnowledge.values.map((value) => `• ${value}`),
    '',
    '*Goals:*',
    ...hospitalKnowledge.goals.map((goal) => `• ${goal}`),
    '',
    '*Community Responsibility:*',
    ...hospitalKnowledge.corporateResponsibility.map((item) => `• ${item}`),
  ].join('\n');
}

const GENERAL_KNOWLEDGE_SUGGESTIONS = [
  'clinic and specialist services',
  'consultation, test, and procedure prices',
  'appointments and opening hours',
  'location, directions, and contact details',
  'insurance and medical cover',
];

export function getKnowledgeSuggestions(query: string): string[] {
  const queryTerms = getSearchTerms(expandQuerySynonyms(normalizeText(query)));
  const candidates = [
    ...hospitalKnowledge.services,
    ...hospitalKnowledge.specialistClinics,
    ...Object.keys(hospitalKnowledge.departments),
    ...hospitalKnowledge.surgicalPrices.map((item) => item.procedure),
  ];
  const scores = new Map<string, number>();

  for (const candidate of candidates) {
    const candidateTerms = getSearchTerms(normalizeText(candidate));
    const score = queryTerms.reduce(
      (total, queryTerm) => total + Number(candidateTerms.some((candidateTerm) =>
        candidateTerm.includes(queryTerm) ||
        queryTerm.includes(candidateTerm) ||
        (queryTerm.length >= 5 && candidateTerm.startsWith(queryTerm.slice(0, 5))) ||
        (candidateTerm.length >= 5 && queryTerm.startsWith(candidateTerm.slice(0, 5))),
      )),
      0,
    );

    if (score > 0) scores.set(candidate, score);
  }

  const relevant = [...scores.entries()]
    .sort((first, second) => second[1] - first[1])
    .slice(0, 3)
    .map(([candidate]) => candidate);

  return relevant.length ? relevant : GENERAL_KNOWLEDGE_SUGGESTIONS;
}

function formatUnknown(topicHint?: string): string {
  const suggestions = getKnowledgeSuggestions(topicHint ?? '');
  return [
    topicHint
      ? `I can’t confirm current information about ${topicHint}.`
      : "I couldn’t match that question to a specific answer, and I don’t want to guess.",
    '',
    `Did you mean one of these? ${suggestions.join('; ')}? Tell me which topic you meant and I’ll guide you.`,
    '',
    'For confirmation or help from staff, please contact Winston Medical Centre:',
    ...hospitalKnowledge.locations.map(
      (location) => `• ${location.branch}: ${location.phoneNumbers.join(', ')}`,
    ),
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Full service and laboratory price list, for patients who explicitly
 * ask for "the price list" / "all prices" rather than a specific
 * procedure. Complements `formatPrices`, which narrows to a specific
 * procedure when one is named.
 */
function formatFullPriceList(): string {
  return [
    '💰 *Winston Medical Centre Price List*',
    '',
    `General consultation: *${hospitalKnowledge.consultationFee}*.`,
    '',
    '*Listed service and laboratory prices:*',
    ...hospitalKnowledge.surgicalPrices.map((item) => `• ${item.procedure}: *${item.price}*`),
    '',
    'Prices should be confirmed with the hospital before booking.',
    'Prices should be confirmed with the hospital. Unlisted services, medicines and procedures may have separate charges.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

function findMatchingProcedures(expandedQuery: string): SurgicalPrice[] {
  const searchTerms = getSearchTerms(expandedQuery);

  if (!searchTerms.length) {
    return [];
  }

  return hospitalKnowledge.surgicalPrices
    .map((item) => {
      const procedureText = normalizeText([item.procedure, ...(item.keywords ?? [])].join(' '));
      const score = searchTerms.reduce(
        (total, term) => total + (procedureText.includes(term) ? 1 : 0),
        0,
      );
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((first, second) => second.score - first.score)
    .map(({ item }) => item);
}

function formatPrices(expandedQuery: string): string {
  const matches = findMatchingProcedures(expandedQuery);

  if (!matches.length) {
    return [
      '💰 *Service and Laboratory Prices*',
      '',
      `General consultation: *${hospitalKnowledge.consultationFee}*.`,
      '',
      'Send a service or laboratory test name for its listed price, or reply "price list" to see all supplied prices.',
      '',
      'Examples:',
      '• Ultrasound price',
      '• Antenatal visit fee',
      '• CBC test cost',
      '• Physiotherapy fee',
      '',
      'Only supplied prices are listed here. Contact the hospital for unlisted tests, medicines, services or procedures.',
      '',
      'Prices should be confirmed with the hospital before booking.',
    ].join('\n');
  }

  const displayedMatches = matches.slice(0, MAX_PROCEDURE_RESULTS);
  const hasMoreMatches = matches.length > MAX_PROCEDURE_RESULTS;

  return [
    '💰 *Matching Service and Test Prices*',
    '',
    ...displayedMatches.map((item) => `• ${item.procedure}: *${item.price}*`),
    hasMoreMatches
      ? `\nI found ${matches.length} related prices. Please send a more specific service or test name, or reply "price list" to see all supplied prices.`
      : '',
    '',
    'Prices should be confirmed with the hospital before booking.',
    'Please confirm the final price with the hospital. Unlisted related services or materials may be charged separately.',
  ]
    .filter(Boolean)
    .join('\n');
}

const DEPARTMENT_ALIASES: Record<string, string[]> = {
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

function findMatchingDepartment(
  expandedQuery: string,
): [department: string, description: string] | null {
  for (const [department, description] of Object.entries(hospitalKnowledge.departments)) {
    const searchValues = [normalizeText(department), ...(DEPARTMENT_ALIASES[department] ?? [])];

    if (searchValues.some((searchValue) => expandedQuery.includes(searchValue))) {
      return [department, description];
    }
  }

  return null;
}

function findMatchingServices(expandedQuery: string): string[] {
  const searchTerms = getSearchTerms(expandedQuery);

  if (!searchTerms.length) {
    return [];
  }

  return hospitalKnowledge.services
    .map((service) => {
      const serviceText = normalizeText(service);
      const score = searchTerms.reduce(
        (total, term) => total + (serviceText.includes(term) ? 1 : 0),
        0,
      );
      return { service, score };
    })
    .filter(({ score }) => score > 0)
    .sort((first, second) => second.score - first.score)
    .map(({ service }) => service)
    .slice(0, MAX_SERVICE_RESULTS);
}

function formatServiceConfirmation(matches: string[]): string {
  return [
    '✅ *Yes, we offer this*',
    '',
    ...matches.map((service) => `• ${service}`),
    '',
    'Listed fees vary by service. Tell me the clinic or test, or reply "price list" to see the supplied prices.',
    'Please contact the hospital to confirm availability, or reply "book appointment" to send an appointment request.',
  ].join('\n');
}

/** Finds insurer names (from the accepted list) mentioned directly in the query. */
function findMatchingInsurers(expandedQuery: string): string[] {
  return hospitalKnowledge.insuranceAccepted.filter((provider) => {
    const normalizedProvider = normalizeText(provider).replace(/\s*\([^)]*\)/g, '').trim();
    return normalizedProvider.length > 1 && expandedQuery.includes(normalizedProvider);
  });
}

/** Finds a branch (or branches) explicitly named in the query. */
function findNamedBranches(expandedQuery: string): HospitalLocation[] {
  return hospitalKnowledge.locations.filter((location) =>
    normalizeText(location.branch)
      .split(' ')
      .some((word) => word.length > 3 && expandedQuery.includes(word)),
  );
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
export function searchKnowledgeBase(query: string): string | null {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return null;
  }

  if (includesAny(normalizedQuery, ['skin analysis', 'analyze my skin', 'analyse my skin'])) {
    return hospitalKnowledge.skinAnalysisNote;
  }

  if (includesAny(normalizedQuery, ['share a picture', 'share picture', 'send a picture', 'send picture', 'skin photo', 'photo of my skin', 'picture of my skin'])) {
    return hospitalKnowledge.skinImageNote;
  }

  const expandedQuery = expandQuerySynonyms(normalizedQuery);

  if (
    /\b(consult|consultation)\b/i.test(normalizedQuery) &&
    includesAny(normalizedQuery, ['how much', 'price', 'cost', 'fee', 'charge', 'charges', 'pricing']) &&
    !includesAny(normalizedQuery, ['online', 'virtual']) &&
    !includesAny(expandedQuery, [
      'dermatolog',
      'skin specialist',
      'skin doctor',
      'gynecolog',
      'gynaecolog',
      'paediatrician',
      'pediatrician',
      'nutritionist',
    ])
  ) {
    return `General consultation: *${hospitalKnowledge.consultationFee}*.`;
  }

  if (includesAny(normalizedQuery, ['acne keloidalis nuchae', 'acne keloidalis'])) {
    return hospitalKnowledge.acneKeloidalisNuchaeNote;
  }

  if (
    /\b(do you treat|treat this condition|handles?|manage)\b/i.test(normalizedQuery) &&
    includesAny(expandQuerySynonyms(normalizedQuery), [
      'dark spot',
      'acne',
      'keloid',
      'vitiligo',
      'hair loss',
      'skin condition',
    ])
  ) {
    return hospitalKnowledge.dermatologyCareNote;
  }

  if (includesAny(expandedQuery, ['dark spot', 'dark spots', 'hyperpigmentation'])) {
    return hospitalKnowledge.darkSpotsNote;
  }

  if (
    includesAny(expandedQuery, ['skin tag', 'skin tags', 'wart', 'warts', 'ingrown nail', 'ingrown nails']) &&
    includesAny(expandedQuery, ['remove', 'removal', 'treat', 'treatment', 'handle', 'do you', 'can you'])
  ) {
    return hospitalKnowledge.skinLesionAssessmentNote;
  }

  if (
    includesAny(expandedQuery, ['price', 'prices', 'cost', 'fee', 'fees', 'charge', 'charges', 'how much']) &&
    includesAny(expandedQuery, ['dermatolog', 'skin specialist', 'skin doctor'])
  ) {
    return formatPrices(expandedQuery);
  }

  if (includesAny(expandedQuery, ['how many beds', 'bed count', 'number of beds', 'registration number', 'hospital registration'])) {
    return formatAbout();
  }

  if (includesAny(expandedQuery, ['sha', 'social health authority'])) {
    return hospitalKnowledge.dermatologyInsuranceNote;
  }

  if (
    includesAny(expandedQuery, [
      'online consultation',
      'virtual consultation',
      'online consult',
      'virtual consult',
    ])
  ) {
    if (includesAny(expandedQuery, ['price', 'cost', 'fee', 'charge', 'how much', 'ksh', 'kes'])) {
      return `Virtual or online consultation costs ${hospitalKnowledge.virtualConsultationFee}. ${hospitalKnowledge.virtualConsultationNote}`;
    }
    return hospitalKnowledge.virtualConsultationNote;
  }

  const matchingProcedures = findMatchingProcedures(expandedQuery);
  if (
    matchingProcedures.some((procedure) => procedure.procedure.toLowerCase() === 'microneedling')
  ) {
    const microneedling = matchingProcedures.find(
      (procedure) => procedure.procedure.toLowerCase() === 'microneedling',
    );
    if (microneedling) {
      return `Yes, we do microneedling at a cost of ${microneedling.price}.`;
    }
  }

  if (includesAny(expandedQuery, ['not in nairobi', 'outside nairobi', 'away from nairobi', 'not based in nairobi'])) {
    return `If you are outside Nairobi, we can arrange a virtual consultation, or you can visit us at a convenient time. ${hospitalKnowledge.virtualConsultationNote}`;
  }

  if (
    includesAny(expandedQuery, [
      'dermatolog',
      'skin condition',
      'skin problem',
      'dark spot',
      'acne',
      'keloid',
      'vitiligo',
      'hair loss',
      'rash',
    ]) &&
    includesAny(expandedQuery, ['treat', 'handle', 'condition', 'doctor', 'clinic', 'skin', 'dermatolog'])
  ) {
    return hospitalKnowledge.dermatologyCareNote;
  }

  if (
    includesAny(expandedQuery, [
      'how much do you charge',
      'how much is treatment',
      'treatment cost',
      'cost of treatment',
      'price of treatment',
    ]) &&
    !findMatchingProcedures(expandedQuery).length
  ) {
    return hospitalKnowledge.treatmentPricingNote;
  }

  if (
    includesAny(expandedQuery, [
      'consultation fee',
      'consultation fees',
      'general consultation',
      'consultation cost',
      'consultation charge',
    ]) &&
    !includesAny(expandedQuery, [
      'dermatolog',
      'skin specialist',
      'skin doctor',
      'gynecolog',
      'gynaecolog',
      'paediatrician',
      'pediatrician',
      'nutritionist',
    ])
  ) {
    return `General consultation: *${hospitalKnowledge.consultationFee}*.`;
  }

  // 1. Confirmed hours and availability questions.
  if (
    (includesAny(expandedQuery, ['sunday', 'public holiday']) &&
      includesAny(expandedQuery, ['appointment', 'book', 'open', 'visit', 'available'])) ||
    includesAny(expandedQuery, [
      'opening hour',
      'opening hours',
      'operating hour',
      'operating hours',
      'what time do you open',
      'what time do you close',
      'what time are you open',
      'when are you open',
      'working hours',
      'clinic hours',
      'are you open',
      'bed availability',
      'bed available',
      'ward availability',
    ])
  ) {
    if (includesAny(expandedQuery, ['bed availability', 'bed available', 'ward availability'])) {
      return formatUnknown('real-time bed availability');
    }
    return formatOpeningHours();
  }

  // 2. Locations / branch / contact.
  if (
    includesAny(expandedQuery, [
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
      'email',
      'mail address',
      'postal address',
      'post office box',
      'tassia',
      'fedha',
    ])
  ) {
    const namedBranches = findNamedBranches(expandedQuery);
    return formatLocations(namedBranches.length ? namedBranches : undefined);
  }

  // 3. Insurance — check for a specific named insurer first.
  const matchedInsurers = findMatchingInsurers(expandedQuery);
  if (matchedInsurers.length) {
    return formatInsuranceConfirmation(matchedInsurers);
  }

  if (
    includesAny(expandedQuery, [
      'insurance',
      'cover',
      'covers',
      'medical cover',
      'preauthorization',
      'preauthorisation',
      'nhif',
      'sha',
    ])
  ) {
    return formatInsuranceList();
  }

  // 4. Booking / appointments (explicit intent).
  if (
    includesAny(expandedQuery, [
      'book an appointment',
      'book appointment',
      'booking',
      'how do i book',
      'how to book',
      'make an appointment',
      'schedule an appointment',
      'reserve a slot',
    ])
  ) {
    return formatBooking();
  }

  // 5. Full price list — explicit "give me everything" request, checked
  // before the narrower single-procedure price lookup below.
  if (
    includesAny(expandedQuery, [
      'price list',
      'full price',
      'prices list',
      'complete price',
      'every price',
      'all prices',
      'all your prices',
      'all procedure prices',
    ])
  ) {
    return formatFullPriceList();
  }

  // 6. Procedure prices — explicit price language OR a direct procedure-name hit.
  const procedureMatches = findMatchingProcedures(expandedQuery);
  if (
    includesAny(expandedQuery, [
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
    procedureMatches.length > 0
  ) {
    return formatPrices(expandedQuery);
  }

  // 7. Department match (most specific, detailed answer).
  const matchingDepartment = findMatchingDepartment(expandedQuery);
  if (matchingDepartment) {
    const [department, description] = matchingDepartment;
    return formatDepartment(department, description);
  }

  // 8. Specific service confirmation (e.g. "do you have physiotherapy?").
  const matchingServices = findMatchingServices(expandedQuery);
  if (matchingServices.length) {
    return formatServiceConfirmation(matchingServices);
  }

  // 9. Doctor / specialist / general appointment-availability questions.
  if (
    includesAny(expandedQuery, [
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
      'operating hours',
      'opening hours',
      'when are you open',
      'when do you open',
      'when is the clinic open',
    ])
  ) {
    return formatSpecialistClinics();
  }

  // 10. Generic department listing.
  if (includesAny(expandedQuery, ['department', 'departments'])) {
    return formatAllDepartments();
  }

  // 11. Generic services listing. By this point `matchingServices` reflects
  // real, specific term overlap (generic words like "service"/"all"/"list"
  // are excluded from matching — see STOP_WORDS), so an empty result here
  // means the request was genuinely broad and should get the full list.
  if (
    includesAny(expandedQuery, [
      'what do you offer',
      'what services',
      'services do you have',
      'services you offer',
      'what is available',
      'what can you help me with',
      'what treatments do you have',
      'what departments do you have',
      'which services do you provide',
    ]) ||
    matchingServices.length
  ) {
    return matchingServices.length ? formatServiceConfirmation(matchingServices) : formatServices();
  }

  // 12. Leadership.
  if (
    includesAny(expandedQuery, [
      'ceo',
      'administrator',
      'leadership',
      'management',
      'manager',
      'director',
    ])
  ) {
    return formatLeadership();
  }

  // 13. About / mission / values / general hospital info.
  if (
    includesAny(expandedQuery, [
      'mission',
      'vision',
      'value',
      'values',
      'motto',
      'about',
      'founded',
      'history',
      'registration',
      'registered',
      'beds',
      'objective',
      'objectives',
      'goals',
      'community responsibility',
      'winston',
      'hospital information',
      'hospital details',
    ])
  ) {
    return formatAbout();
  }

  return null;
}

export function getHospitalSummary(): string {
  return [
    `🏥 *${hospitalKnowledge.name}*`,
    `_${hospitalKnowledge.motto}_`,
    '',
    hospitalKnowledge.description,
    '',
    'You can ask me about:',
    '• Location and contacts (e.g. "Fedha Stage directions", "phone number", or "email")',
    '• Services and departments (e.g. "do you have physiotherapy?")',
    '• Insurance and medical cover information',
    '• Service and laboratory prices (e.g. "ultrasound cost" or "CBC price") or "price list"',
    '• General consultation and clinic fees',
    '• Specialist clinics',
    '• Booking an appointment',
    '• Mission, values, and hospital leadership',
    '',
    'If you\'re feeling unwell or need medical advice, just tell me and I\'ll connect you directly with our clinical team.',
  ].join('\n');
}