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

  const passRaw = (
    process.env.SMPT_PASS ||
    process.env.SMTP_PASS ||
    process.env.SMTP_KEY ||
    ''
  ).trim();
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
 */
export function generateAndStoreOtp(email: string): string {
  const cleanEmail = email.trim().toLowerCase();
  // Cryptographically secure random 6-digit integer from 100000 to 999999
  const code = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

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

    // Exact plain-text template requested by user with {{OTP_CODE}} substituted
    const textTemplate = `Hey there! 👋

Welcome to ZappyFun! 🍿

We're excited to have you join us.

To finish creating your account, enter the verification code below.

YOUR EMAIL VERIFICATION CODE

${otp}

Enter this 6-digit code on the ZappyFun verification page to continue your registration.

Security Notice:

- This code expires in 10 minutes.
- Never share this code with anyone.
- If you didn't request a ZappyFun account, you can safely ignore this email.

Get ready to explore your favorite movies and shows!

Cheers,
The ZappyFun Team 🎬`;

    // Professional HTML template matching the exact text with ZappyFun OTT branding
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email to Join ZappyFun</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0A080F; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #FFFFFF;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0A080F; padding: 40px 16px;">
        <tr>
          <td align="center">
            <table width="100%" style="max-width: 520px; background-color: #15121D; border-radius: 24px; border: 1px solid #231E30; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.85);">
              <!-- Top Gradient Bar -->
              <tr>
                <td style="height: 6px; background: linear-gradient(90deg, #FFB800 0%, #FF5A36 35%, #FF168B 70%, #8B35FF 100%);"></td>
              </tr>
              <!-- Header -->
              <tr>
                <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #231E30;">
                  <span style="font-size: 28px; font-weight: 900; letter-spacing: 1px; color: #FF5A36; text-transform: uppercase;">
                    <span style="background: linear-gradient(135deg, #FFB800, #FF5A36, #FF168B, #8B35FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">ZAPPY</span><span style="color: #FFFFFF;">FUN</span>
                  </span>
                  <div style="font-size: 13px; color: #B8B4C2; margin-top: 6px; font-weight: 500;">Email Verification</div>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding: 32px;">
                  <p style="font-size: 16px; line-height: 1.6; color: #FFFFFF; margin: 0 0 16px 0; font-weight: 600;">
                    Hey there! 👋
                  </p>
                  <p style="font-size: 15px; line-height: 1.6; color: #FFFFFF; margin: 0 0 12px 0;">
                    Welcome to ZappyFun! 🍿
                  </p>
                  <p style="font-size: 14px; line-height: 1.6; color: #B8B4C2; margin: 0 0 20px 0;">
                    We're excited to have you join us.
                  </p>
                  <p style="font-size: 14px; line-height: 1.6; color: #B8B4C2; margin: 0 0 24px 0;">
                    To finish creating your account, enter the verification code below.
                  </p>

                  <!-- Verification Code Box -->
                  <div style="background: linear-gradient(135deg, rgba(255, 90, 54, 0.12), rgba(139, 53, 255, 0.08)); border: 1.5px solid #FF5A36; border-radius: 18px; padding: 24px 16px; text-align: center; margin: 0 0 24px 0;">
                    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #FFB800; margin-bottom: 10px;">
                      YOUR EMAIL VERIFICATION CODE
                    </div>
                    <div style="font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #FFFFFF; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; text-indent: 12px;">
                      ${otp}
                    </div>
                  </div>

                  <p style="font-size: 14px; line-height: 1.6; color: #B8B4C2; margin: 0 0 24px 0;">
                    Enter this 6-digit code on the ZappyFun verification page to continue your registration.
                  </p>

                  <!-- Security Notice Box -->
                  <div style="background-color: #0D0B12; border-left: 3px solid #FF5A36; border-radius: 8px; padding: 14px 18px; margin: 0 0 24px 0;">
                    <div style="font-size: 12px; font-weight: 700; color: #FFFFFF; margin-bottom: 6px;">Security Notice:</div>
                    <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #8E909D; line-height: 1.7;">
                      <li>This code expires in 10 minutes.</li>
                      <li>Never share this code with anyone.</li>
                      <li>If you didn't request a ZappyFun account, you can safely ignore this email.</li>
                    </ul>
                  </div>

                  <p style="font-size: 14px; line-height: 1.6; color: #FFFFFF; margin: 0 0 20px 0;">
                    Get ready to explore your favorite movies and shows!
                  </p>

                  <p style="font-size: 14px; line-height: 1.6; color: #B8B4C2; margin: 0;">
                    Cheers,<br>
                    <strong style="color: #FFFFFF;">The ZappyFun Team 🎬</strong>
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background-color: #0A080F; padding: 20px 32px; text-align: center; border-top: 1px solid #231E30;">
                  <p style="font-size: 11px; color: #7A7686; margin: 0;">
                    Sent securely by ZappyFun &bull; Verified delivery from <span style="color: #B8B4C2;">${config.user}</span>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    await transporter.sendMail({
      from: `ZappyFun <${config.user}>`,
      to: cleanEmail,
      subject: 'Verify Your Email to Join ZappyFun',
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
