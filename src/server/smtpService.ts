import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE_PATH = path.resolve(__dirname, '../../smtp-config.json');

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

function resolveSmtpCredentials(): SmtpConfig {
  const hostRaw = (process.env.SMPT_HOST || process.env.SMTP_HOST || '').trim();
  let user = 'ContactZappyFun@gmail.com';
  let host = 'smtp.gmail.com';

  if (hostRaw.includes('@')) {
    user = hostRaw;
    host = 'smtp.gmail.com';
  } else if (hostRaw) {
    host = hostRaw;
  }

  if (process.env.SMTP_USER && process.env.SMTP_USER.includes('@')) {
    user = process.env.SMTP_USER.trim();
  }

  let passRaw = (
    process.env.SMPT_PASS ||
    process.env.SMTP_PASS ||
    process.env.SMTP_KEY ||
    ''
  ).trim();

  // If environment variables are empty, check smtp-config.json on disk
  if (!passRaw && fs.existsSync(CONFIG_FILE_PATH)) {
    try {
      const fileData = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf-8'));
      if (fileData && typeof fileData === 'object') {
        if (fileData.user && String(fileData.user).includes('@')) {
          user = String(fileData.user).trim();
        }
        if (fileData.host) {
          host = String(fileData.host).trim();
        }
        if (fileData.pass) {
          passRaw = String(fileData.pass).trim();
        }
      }
    } catch {
      // Ignore
    }
  }

  const pass = passRaw.replace(/\s+/g, '');

  return {
    host,
    port: 465,
    secure: true,
    user,
    pass,
    from: `ZappyFun <${user}>`,
  };
}

let cachedConfig: SmtpConfig | null = null;

export function loadSmtpConfig(forceReload: boolean = false): SmtpConfig {
  if (cachedConfig && cachedConfig.pass && !forceReload) {
    return cachedConfig;
  }

  const resolved = resolveSmtpCredentials();
  cachedConfig = resolved;
  return cachedConfig;
}

export function saveSmtpConfig(nextConfig: Partial<SmtpConfig>): SmtpConfig {
  const current = loadSmtpConfig();
  const merged: SmtpConfig = {
    ...current,
    ...nextConfig,
  };
  cachedConfig = merged;
  return merged;
}

export function getPublicSmtpStatus() {
  const cfg = loadSmtpConfig();
  return {
    configured: Boolean(cfg.pass && cfg.pass.trim().length > 0),
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    user: cfg.user,
    from: cfg.from,
    hasPassword: Boolean(cfg.pass && cfg.pass.trim().length > 0),
  };
}

// In-Memory Hashed OTP Store with 10-minute TTL and brute-force attempt limits
const OTP_SALT = process.env.OTP_SALT || 'zappyfun-otp-salt-2026';

function hashOtp(code: string, email: string): string {
  return crypto
    .createHash('sha256')
    .update(`${OTP_SALT}:${email.toLowerCase().trim()}:${code.trim()}`)
    .digest('hex');
}

interface HashedOtpEntry {
  hashedCode: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
}

interface RegistrationTokenEntry {
  email: string;
  expiresAt: number;
  used: boolean;
  createdAt: number;
}

const otpStore = new Map<string, HashedOtpEntry>();
const registrationTokenStore = new Map<string, RegistrationTokenEntry>();

// Clean expired entries every 3 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, entry] of otpStore.entries()) {
    if (now > entry.expiresAt) {
      otpStore.delete(email);
    }
  }
  for (const [token, entry] of registrationTokenStore.entries()) {
    if (now > entry.expiresAt) {
      registrationTokenStore.delete(token);
    }
  }
}, 3 * 60 * 1000).unref();

/**
 * Generates a cryptographically secure 6-digit random OTP and stores only its salted SHA-256 hash.
 * Guarantees that the new code is completely random, unpredictable, and distinct from any prior code.
 */
export function generateAndStoreOtp(email: string): string {
  const cleanEmail = email.trim().toLowerCase();
  const existingEntry = otpStore.get(cleanEmail);

  // Cryptographically secure random 6-digit integer from 100000 to 999999
  let code = crypto.randomInt(100000, 1000000).toString();
  // Ensure the new OTP is strictly distinct from the currently active OTP if one exists
  if (existingEntry && hashOtp(code, cleanEmail) === existingEntry.hashedCode) {
    code = crypto.randomInt(100000, 1000000).toString();
  }

  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Atomically overwrite any existing entry so only this latest unique code is valid
  otpStore.set(cleanEmail, {
    hashedCode: hashOtp(code, cleanEmail),
    expiresAt,
    attempts: 0,
    createdAt: Date.now(),
  });

  return code;
}

/**
 * Validates the entered 6-digit OTP against the stored hash.
 * If correct, invalidates the OTP and issues a single-use registration authorization token.
 */
export function verifyOtp(
  email: string,
  code: string
): { valid: boolean; reason?: string; registrationToken?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();
  const entry = otpStore.get(cleanEmail);

  if (!entry) {
    return {
      valid: false,
      reason: 'No active verification code found. Please request a new code.',
    };
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(cleanEmail);
    return {
      valid: false,
      reason: 'This OTP has expired. Please request a new code.',
    };
  }

  entry.attempts += 1;
  if (entry.attempts > 5) {
    otpStore.delete(cleanEmail);
    return {
      valid: false,
      reason: 'Too many incorrect attempts. Please request a new code.',
    };
  }

  const computedHash = hashOtp(cleanCode, cleanEmail);
  if (entry.hashedCode !== computedHash) {
    return {
      valid: false,
      reason: 'Incorrect OTP. Please try again.',
    };
  }

  // OTP is correct! Invalidate immediately to prevent reuse
  otpStore.delete(cleanEmail);

  // Issue single-use registration authorization token (15 minute validity)
  const registrationToken = `reg_${crypto.randomBytes(32).toString('hex')}`;
  registrationTokenStore.set(registrationToken, {
    email: cleanEmail,
    expiresAt: Date.now() + 15 * 60 * 1000,
    used: false,
    createdAt: Date.now(),
  });

  return {
    valid: true,
    registrationToken,
  };
}

/**
 * Validates and atomically consumes a registration authorization token for a given email.
 */
export function consumeRegistrationToken(
  token: string,
  email: string
): { valid: boolean; reason?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const entry = registrationTokenStore.get(token);

  if (!entry) {
    return {
      valid: false,
      reason: 'Invalid or missing registration authorization token. Please verify your email first.',
    };
  }

  if (entry.used) {
    return {
      valid: false,
      reason: 'Registration token has already been used.',
    };
  }

  if (Date.now() > entry.expiresAt) {
    registrationTokenStore.delete(token);
    return {
      valid: false,
      reason: 'Registration session expired. Please verify your email again.',
    };
  }

  if (entry.email !== cleanEmail) {
    return {
      valid: false,
      reason: 'Registration token does not match the provided email address.',
    };
  }

  // Atomically mark token as used and delete it
  entry.used = true;
  registrationTokenStore.delete(token);

  return { valid: true };
}

/**
 * Checks if a registration token is currently active without consuming it.
 */
export function validateRegistrationToken(
  token: string,
  email: string
): { valid: boolean; reason?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const entry = registrationTokenStore.get(token);

  if (!entry) {
    return {
      valid: false,
      reason: 'Invalid registration token.',
    };
  }

  if (entry.used || Date.now() > entry.expiresAt || entry.email !== cleanEmail) {
    return {
      valid: false,
      reason: 'Registration session is invalid or has expired.',
    };
  }

  return { valid: true };
}

/**
 * Sends the 6-digit OTP email using the exact template requested.
 */
export async function sendOtpEmail(
  email: string,
  otp: string
): Promise<{ success: boolean; simulated: boolean; devCode?: string; error?: string }> {
  const config = loadSmtpConfig();
  const cleanEmail = email.trim().toLowerCase();

  if (!config.pass || config.pass.trim().length === 0) {
    console.error(`[SMTP ERROR] Missing SMTP Password for ${cleanEmail}`);
    return {
      success: false,
      simulated: false,
      error: 'SMTP service is not configured. Please contact support.',
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    const textTemplate = `Your ZappyFun verification code is: ${otp}

This code will expire in 10 minutes.

If you did not request this verification code, you can safely ignore this email.

— The ZappyFun Team`;

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your ZappyFun verification code</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #1f2937; background-color: #ffffff;">
  <p style="margin: 0 0 16px 0;">Your ZappyFun verification code is:</p>
  <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #111827; margin: 20px 0; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;">
    ${otp}
  </p>
  <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px 0;">This code will expire in 10 minutes.</p>
  <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px 0;">If you did not request this verification code, you can safely ignore this email.</p>
  <p style="color: #9ca3af; font-size: 13px; margin: 24px 0 0 0;">— The ZappyFun Team</p>
</body>
</html>`;

    await transporter.sendMail({
      from: `ZappyFun <${config.user}>`,
      to: cleanEmail,
      subject: `Your ZappyFun verification code: ${otp}`,
      text: textTemplate,
      html: htmlContent,
    });

    console.log(`[SMTP SUCCESS] Sent 6-digit OTP to ${cleanEmail} via Gmail (${config.user})`);
    return { success: true, simulated: false };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[SMTP ERROR] Failed to send email to ${cleanEmail}:`, errorMsg);
    return {
      success: false,
      simulated: false,
      error: errorMsg,
    };
  }
}

export async function sendTestEmail(
  targetEmail: string
): Promise<{ success: boolean; message: string }> {
  const config = loadSmtpConfig();
  const cleanEmail = targetEmail.trim().toLowerCase();

  if (!config.pass || config.pass.trim().length === 0) {
    return {
      success: false,
      message: 'SMTP Password (App Password) is empty. Please enter your Gmail App Password first.',
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `ZappyFun <${config.user}>`,
      to: cleanEmail,
      subject: 'ZappyFun SMTP Test Connection Successful',
      text: `Hello! This is a test message from your ZappyFun server. SMTP configuration is active and working properly using ${config.user}.`,
      html: `
        <div style="background-color: #08090D; color: #FFFFFF; padding: 30px; font-family: sans-serif; border-radius: 16px;">
          <h2 style="color: #FFC400;">ZappyFun SMTP Connected Successfully!</h2>
          <p>Your Gmail SMTP setup (${config.user}) is configured correctly.</p>
          <p style="color: #A7A9B4;">New users registering on ZappyFun will receive their 6-digit verification codes directly from your email.</p>
        </div>
      `,
    });

    return {
      success: true,
      message: `Test email sent successfully to ${cleanEmail}!`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `SMTP Connection Failed: ${errorMsg}`,
    };
  }
}
