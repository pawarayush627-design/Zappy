import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REGISTERED_FILE = path.resolve(__dirname, '../../registered-emails.json');

const INITIAL_EMAILS = [
  'pawarayushai1@gmail.com',
  'admin@zappy.app',
];

let cachedEmails: Set<string> | null = null;

function loadEmails(): Set<string> {
  if (cachedEmails) return cachedEmails;
  const set = new Set<string>(INITIAL_EMAILS);

  try {
    if (fs.existsSync(REGISTERED_FILE)) {
      const raw = fs.readFileSync(REGISTERED_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const item of list) {
          if (typeof item === 'string' && item.trim()) {
            set.add(item.trim().toLowerCase());
          }
        }
      }
    } else {
      fs.writeFileSync(REGISTERED_FILE, JSON.stringify(Array.from(set), null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('Could not read registered-emails.json:', err);
  }

  cachedEmails = set;
  return set;
}

export function isEmailRegisteredOnServer(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  const set = loadEmails();
  return set.has(email.trim().toLowerCase());
}

export function recordRegisteredEmail(email: string): void {
  if (!email || !email.includes('@')) return;
  const clean = email.trim().toLowerCase();
  const set = loadEmails();
  if (set.has(clean)) return;

  set.add(clean);
  try {
    fs.writeFileSync(REGISTERED_FILE, JSON.stringify(Array.from(set), null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to update registered-emails.json:', err);
  }
}
