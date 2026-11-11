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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
};

function getHmacSecret(): string {
  return (
    process.env.OTP_HMAC_SECRET ||
    process.env.SMTP_PASS ||
    'zappyfun-otp-hmac-secret-2026'
  ).trim();
}

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
    const email =
      typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const otp = typeof payload.otp === 'string' ? payload.otp.trim() : '';
    const challengeToken =
      typeof payload.challengeToken === 'string'
        ? payload.challengeToken.trim()
        : '';

    if (!email || !otp) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          valid: false,
          reason: 'Email and 6-digit code are required.',
        }),
      };
    }

    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          valid: false,
          reason: 'Incorrect OTP. Please try again.',
        }),
      };
    }

    if (!challengeToken || !challengeToken.includes('.')) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          valid: false,
          reason: 'No active verification challenge found. Please request a new code.',
        }),
      };
    }

    const [expiresStr, providedMac] = challengeToken.split('.');
    const expiresAtMs = Number(expiresStr);
    if (!expiresAtMs || !providedMac || Date.now() > expiresAtMs) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          valid: false,
          reason: 'This OTP has expired. Please request a new code.',
        }),
      };
    }

    const expectedMac = crypto
      .createHmac('sha256', getHmacSecret())
      .update(`otp:${email}:${otp}:${expiresAtMs}`)
      .digest('hex');

    if (
      providedMac.length !== expectedMac.length ||
      !crypto.timingSafeEqual(Buffer.from(providedMac), Buffer.from(expectedMac))
    ) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          valid: false,
          reason: 'Incorrect OTP. Please try again.',
        }),
      };
    }

    const tokenExpiresAt = Date.now() + 15 * 60 * 1000;
    const regMac = crypto
      .createHmac('sha256', getHmacSecret())
      .update(`reg:${email}:${tokenExpiresAt}`)
      .digest('hex');
    const registrationToken = `reg_netlify_${tokenExpiresAt}_${regMac}`;

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        valid: true,
        registrationToken,
      }),
    };
  } catch {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        valid: false,
        reason: 'Verification service encountered an error. Please try again.',
      }),
    };
  }
};
