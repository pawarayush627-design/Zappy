import { initializeApp, getApps, App as AdminApp } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import type express from 'express';
import { isEmailRegisteredOnServer } from '../server/registeredUsers.js';

const ALLOWED_ADMIN_EMAILS = new Set([
  'pawarayushai1@gmail.com',
  'admin@zappy.app',
]);

const SUPPORTED_FIREBASE_PROJECT_IDS = ['zappyfun'] as const;

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
 * the configured Firebase project ('zappyfun').
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
      // Continue verification
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
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      statusCode: 401,
      error: 'Unauthorized: Missing or malformed Authorization header.',
    };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return {
      authorized: false,
      statusCode: 401,
      error: 'Unauthorized: Empty bearer token.',
    };
  }

  let decoded: DecodedIdToken | null = null;
  try {
    decoded = await verifier(token);
  } catch (err) {
    console.warn(
      'Admin token verification threw error:',
      err instanceof Error ? err.message : String(err)
    );
    decoded = null;
  }

  if (!decoded || !decoded.uid) {
    return {
      authorized: false,
      statusCode: 401,
      error: 'Unauthorized: Invalid, expired, or untrusted Firebase ID token.',
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
      projectId: String(decoded.aud || 'zappyfun'),
    },
  };
}

export interface ServerEmailCheckResult {
  registered: boolean | null;
  hasPassword?: boolean;
  providers?: string[];
  isGithubOnly?: boolean;
  error?: string;
}

/**
 * Checks whether an email address is already registered in Firebase Authentication.
 * Returns { registered: true, hasPassword, isGithubOnly } if user found,
 * { registered: false } if not found,
 * or { registered: null } if server lacks service account credentials (delegating to client SDK).
 */
export async function checkEmailRegisteredOnServer(
  email: string
): Promise<ServerEmailCheckResult> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { registered: false };
  }

  // Fast check: Known registered user emails (including admin, test users, and signed-up accounts)
  if (isEmailRegisteredOnServer(cleanEmail)) {
    return { registered: true, hasPassword: true, providers: ['password'] };
  }

  try {
    const adminApps = getOrInitAdminApps();
    for (const adminApp of adminApps) {
      try {
        const user = await getAuth(adminApp).getUserByEmail(cleanEmail);
        if (user && user.uid) {
          const providers = (user.providerData || []).map((p) => p.providerId);
          const hasPassword =
            providers.includes('password') || user.passwordHash !== undefined;
          const isGithubOnly =
            providers.includes('github.com') && !hasPassword;

          return {
            registered: true,
            hasPassword,
            providers,
            isGithubOnly,
          };
        }
      } catch (err: unknown) {
        const errObj = err as { code?: string; message?: string };
        if (errObj.code === 'auth/user-not-found') {
          return { registered: false };
        }
      }
    }
    return { registered: null };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { registered: null, error: errMsg };
  }
}


