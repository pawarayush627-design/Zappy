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
    const token =
      typeof payload.registrationToken === 'string'
        ? payload.registrationToken.trim()
        : '';

    if (!email || !token) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          valid: false,
          reason: 'Email and registration authorization token are required.',
        }),
      };
    }

    if (!token.startsWith('reg_netlify_')) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          valid: false,
          reason: 'Invalid registration authorization token format.',
        }),
      };
    }

    const parts = token.split('_');
    // Expected: reg_netlify_<expiresAt>_<mac>
    const expiresAtMs = Number(parts[2]);
    const providedMac = parts[3] || '';
    if (!expiresAtMs || !providedMac || Date.now() > expiresAtMs) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          valid: false,
          reason: 'Registration session expired. Please verify your email again.',
        }),
      };
    }

    const expectedMac = crypto
      .createHmac('sha256', getHmacSecret())
      .update(`reg:${email}:${expiresAtMs}`)
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
          reason: 'Invalid registration authorization token.',
        }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        valid: true,
        email,
      }),
    };
  } catch {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        valid: false,
        reason: 'Token validation error.',
      }),
    };
  }
};
