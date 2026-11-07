import nodemailer from 'nodemailer';
import crypto from 'crypto';

interface NetlifyEvent {
  httpMethod: string;
  body: string | null;
  headers: Record<string, string | undefined>;
}

interface NetlifyResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

const SMTP_USER = 'ContactZappyFun@gmail.com';
const SMTP_PASS = 'tvsntsfykygvyskc';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const payload = event.body ? JSON.parse(event.body) : {};
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';

    if (!email || !email.includes('@')) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Valid email address is required.' }),
      };
    }

    const explicitOtp = typeof payload.otp === 'string' && /^\d{6}$/.test(payload.otp.trim())
      ? payload.otp.trim()
      : undefined;

    const otp = explicitOtp || crypto.randomInt(100000, 1000000).toString();
    const isReset = payload.purpose === 'reset';
    const resetUrl = typeof payload.resetUrl === 'string' ? payload.resetUrl.trim() : '';

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    const resetLinkLine =
      isReset && resetUrl
        ? `\nYou can also reset your password directly using this link:\n${resetUrl}\n`
        : '';

    const textTemplate = isReset
      ? `Your ZappyFun password reset code is: ${otp}
${resetLinkLine}
This code will expire in 10 minutes.

If you did not request a password reset, you can safely ignore this email.

— The ZappyFun Team`
      : `Your ZappyFun verification code is: ${otp}

This code will expire in 10 minutes.

If you did not request this verification code, you can safely ignore this email.

— The ZappyFun Team`;

    const subject = isReset
      ? `Your ZappyFun password reset code: ${otp}`
      : `Your ZappyFun verification code: ${otp}`;

    await transporter.sendMail({
      from: `ZappyFun <${SMTP_USER}>`,
      to: email,
      subject,
      text: textTemplate,
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: true,
        message: `6-digit ${isReset ? 'password reset' : 'verification'} code sent to ${email}.`,
      }),
    };
  } catch (err) {
    console.error('Netlify send-otp error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: false,
        error: 'Failed to send verification email. Please check your email address.',
      }),
    };
  }
};
