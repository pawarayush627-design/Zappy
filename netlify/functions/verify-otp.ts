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
    const otp = typeof payload.otp === 'string' ? payload.otp.trim() : '';

    if (!email || !otp) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ valid: false, reason: 'Email and 6-digit code are required.' }),
      };
    }

    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ valid: false, reason: 'Incorrect OTP. Please try again.' }),
      };
    }

    const registrationToken = `reg_netlify_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        valid: true,
        registrationToken,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        valid: false,
        reason: 'Verification error: ' + (err instanceof Error ? err.message : String(err)),
      }),
    };
  }
};
