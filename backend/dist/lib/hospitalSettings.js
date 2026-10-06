"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHospitalSettings = getHospitalSettings;
exports.getHospitalPhoneNumber = getHospitalPhoneNumber;
exports.setHospitalPhoneNumber = setHospitalPhoneNumber;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const SETTINGS_FILE = node_path_1.default.resolve(process.cwd(), 'data', 'hospital-settings.json');
async function ensureSettingsFile() {
    const dir = node_path_1.default.dirname(SETTINGS_FILE);
    await promises_1.default.mkdir(dir, { recursive: true });
    try {
        await promises_1.default.access(SETTINGS_FILE);
    }
    catch {
        await promises_1.default.writeFile(SETTINGS_FILE, JSON.stringify({ hospitalPhoneNumber: '' }, null, 2), 'utf8');
    }
}
function normalizePhoneNumber(value) {
    return value.replace(/\D/g, '');
}
async function getHospitalSettings() {
    await ensureSettingsFile();
    try {
        const raw = await promises_1.default.readFile(SETTINGS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            hospitalPhoneNumber: typeof parsed.hospitalPhoneNumber === 'string' ? parsed.hospitalPhoneNumber : '',
        };
    }
    catch {
        return { hospitalPhoneNumber: '' };
    }
}
async function getHospitalPhoneNumber() {
    const settings = await getHospitalSettings();
    return settings.hospitalPhoneNumber ?? '';
}
async function setHospitalPhoneNumber(phoneNumber) {
    const clean = normalizePhoneNumber(phoneNumber);
    const nextSettings = {
        hospitalPhoneNumber: clean,
    };
    await ensureSettingsFile();
    await promises_1.default.writeFile(SETTINGS_FILE, JSON.stringify(nextSettings, null, 2), 'utf8');
    return clean;
}
