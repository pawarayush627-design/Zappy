import { initializeApp, getApps, App as AdminApp } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import type express from 'express';

const ALLOWED_ADMIN_EMAILS = new Set([
  'pawarayushai1@gmail.com',
  'admin@zappy.app',
]);

const SUPPORTED_FIREBASE_PROJECT_IDS = ['aibharix', 'zappyfun'] as const;

function getOrInitAdminApps(): AdminApp[] {
  const existing = getApps();
  const apps: AdminApp[] = [];

  for (const projectId of SUPPORTED_FIREBASE_PROJECT_IDS) {
    const appName = `firebase-admin-${projectId}`;
    let found = existing.find((a) => a.name === appName);
    if (!found) {
      found = initializeApp({ projectId }, appName);
    }
    apps.push(found);
  }
  return apps;
}

export interface VerifiedAdminIdentity {
  uid: string;
  email: string;
  emailVerified: boolean;
  projectId: string;
}

export type TokenVerifierFn = (
  idToken: string
) => Promise<DecodedIdToken | null>;

/**
 * Default verifier using the official Firebase Admin SDK getAuth().verifyIdToken().
 * Checks cryptographic RS256 signature, expiration, audience, and issuer against
 * the configured Firebase projects ('aibharix' and 'zappyfun').
 */
export async function defaultFirebaseAdminTokenVerifier(
  idToken: string
): Promise<DecodedIdToken | null> {
  const adminApps = getOrInitAdminApps();
  for (const adminApp of adminApps) {
    try {
      const decoded = await getAuth(adminApp).verifyIdToken(idToken, false);
      if (decoded && decoded.uid) {
        return decoded;
      }
    } catch {
      // Try next configured project if token belongs to secondary project
    }
  }
  return null;
}

/**
 * Extracts and verifies a Firebase Bearer ID token from an Express request,
 * ensuring the caller is a cryptographically verified administrator.
 * Never trusts client-supplied headers like x-admin-email or x-admin-uid.
 */
export async function verifyAdminRequest(
  req: Pick<express.Request, 'headers'>,
  verifier: TokenVerifierFn = defaultFirebaseAdminTokenVerifier
): Promise<
  | { authorized: true; admin: VerifiedAdminIdentity }
  | { authorized: false; statusCode: 401 | 403; error: string }
> {
  const authHeader = req.headers.authorization;
  if (
    !authHeader ||
    typeof authHeader !== 'string' ||
    !authHeader.toLowerCase().startsWith('bearer ')
  ) {
    return {
      authorized: false,
      statusCode: 401,
      error: 'Missing or malformed Authorization Bearer token.',
    };
  }

  const rawToken = authHeader.slice(7).trim();
  if (!rawToken) {
    return {
      authorized: false,
      statusCode: 401,
      error: 'Empty Authorization Bearer token.',
    };
  }

  const decoded = await verifier(rawToken);
  if (!decoded || !decoded.uid) {
    return {
      authorized: false,
      statusCode: 401,
      error: 'Invalid or expired Firebase ID token.',
    };
  }

  const email = String(decoded.email || '')
    .trim()
    .toLowerCase();
  const emailVerified = decoded.email_verified === true;

  if (!email || !emailVerified || !ALLOWED_ADMIN_EMAILS.has(email)) {
    return {
      authorized: false,
      statusCode: 403,
      error: 'Forbidden: Verified administrator account required.',
    };
  }

  return {
    authorized: true,
    admin: {
      uid: decoded.uid,
      email,
      emailVerified: true,
      projectId: String(decoded.aud || 'aibharix'),
    },
  };
}
