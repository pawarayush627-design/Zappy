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

    if (!email || !email.includes('@')) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Valid email address is required.' }),
      };
    }

    const isAdmin =
      email === 'pawarayushai1@gmail.com' || email === 'admin@zappy.app';

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        email,
        registered: isAdmin ? true : null,
        hasPassword: isAdmin ? true : false,
        isGithubOnly: false,
        fallbackToClient: !isAdmin,
      }),
    };
  } catch {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Failed to verify email status.',
        fallbackToClient: true,
      }),
    };
  }
};
