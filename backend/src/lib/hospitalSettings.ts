import fs from 'node:fs/promises';
import path from 'node:path';

const SETTINGS_FILE = path.resolve(process.cwd(), 'data', 'hospital-settings.json');

export type HospitalSettings = {
  hospitalPhoneNumber?: string;
};

async function ensureSettingsFile(): Promise<void> {
  const dir = path.dirname(SETTINGS_FILE);
  await fs.mkdir(dir, { recursive: true });

  try {
    await fs.access(SETTINGS_FILE);
  } catch {
    await fs.writeFile(SETTINGS_FILE, JSON.stringify({ hospitalPhoneNumber: '' }, null, 2), 'utf8');
  }
}

function normalizePhoneNumber(value: string): string {
  return value.replace(/\D/g, '');
}

export async function getHospitalSettings(): Promise<HospitalSettings> {
  await ensureSettingsFile();

  try {
    const raw = await fs.readFile(SETTINGS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<HospitalSettings>;
    return {
      hospitalPhoneNumber: typeof parsed.hospitalPhoneNumber === 'string' ? parsed.hospitalPhoneNumber : '',
    };
  } catch {
    return { hospitalPhoneNumber: '' };
  }
}

export async function getHospitalPhoneNumber(): Promise<string> {
  const settings = await getHospitalSettings();
  return settings.hospitalPhoneNumber ?? '';
}

export async function setHospitalPhoneNumber(phoneNumber: string): Promise<string> {
  const clean = normalizePhoneNumber(phoneNumber);

  const nextSettings: HospitalSettings = {
    hospitalPhoneNumber: clean,
  };

  await ensureSettingsFile();
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(nextSettings, null, 2), 'utf8');

  return clean;
}
