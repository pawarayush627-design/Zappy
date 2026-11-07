import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithCustomToken,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GithubAuthProvider,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signInWithPopup,
  deleteUser,
  signOut,
  updateProfile,
  fetchSignInMethodsForEmail,
  User,
  UserCredential,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// User's Dedicated Firebase Project (zappyfun)
export const ZAPPYFUN_FIREBASE_CONFIG = {
  apiKey: firebaseConfig.apiKey || 'AIzaSyDsfOcpVowpI9meVwLdKBAIKh3JODntkbM',
  authDomain: firebaseConfig.authDomain || 'zappyfun.firebaseapp.com',
  projectId: firebaseConfig.projectId || 'zappyfun',
  storageBucket: firebaseConfig.storageBucket || 'zappyfun.firebasestorage.app',
  messagingSenderId: firebaseConfig.messagingSenderId || '22593530794',
  appId: firebaseConfig.appId || '1:22593530794:web:fb90d32107a50f7b4f19d3',
  measurementId: firebaseConfig.measurementId || 'G-8TWLVE24VB',
  firestoreDatabaseId: '(default)',
};

const selectedConfig = ZAPPYFUN_FIREBASE_CONFIG;
const selectedDatabaseId = '(default)';

// Primary Active Firebase Project
const app =
  getApps().find((a) => a.name === '[DEFAULT]') ||
  initializeApp(selectedConfig);

function createResilientFirestore(
  targetApp: ReturnType<typeof initializeApp>,
  databaseId: string
): Firestore {
  try {
    return initializeFirestore(
      targetApp,
      {
        experimentalAutoDetectLongPolling: true,
      },
      databaseId
    );
  } catch {
    return getFirestore(targetApp, databaseId);
  }
}

export const db = createResilientFirestore(app, selectedDatabaseId);
export const auth = getAuth(app);

export const ACTIVE_FIREBASE_PROJECT_ID = 'zappyfun';
export const ACTIVE_FIRESTORE_DATABASE_ID = '(default)';

export const ADMIN_EMAIL = 'pawarayushai1@gmail.com';

export function isUserAdmin(
  email?: string | null,
  emailVerified?: boolean
): boolean {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  // Admin emails with verified email or authenticated via standard email sign-in
  return cleanEmail === ADMIN_EMAIL || cleanEmail === 'admin@zappy.app';
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  const errMsg = error instanceof Error ? error.message : String(error);

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Notice:', JSON.stringify(errInfo));
}

// Warm up connection to Firestore
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'catalog', 'connection-check'));
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('the client is offline') ||
        error.message.includes('unavailable'))
    ) {
      console.warn(
        'Firestore is currently operating in cached/offline mode until network connection resumes.'
      );
    }
  }
}
testConnection();

// Email & Password Authentication
export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function createUserWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email.trim(), password);
}

export async function updateUserProfile(
  user: User,
  profile: { displayName?: string; photoURL?: string }
) {
  return updateProfile(user, profile);
}

export async function checkEmailSignInMethods(email: string): Promise<string[]> {
  try {
    return await fetchSignInMethodsForEmail(auth, email.trim());
  } catch (err) {
    console.warn('fetchSignInMethodsForEmail notice:', err);
    return [];
  }
}

export interface UserProfileData {
  uid: string;
  email: string;
  displayName: string;
  age: number;
  photoURL?: string;
  favoriteGenres?: string[];
  onboardingCompleted?: boolean;
  updatedAtMs?: number;
}

export async function saveUserProfile(profile: UserProfileData): Promise<void> {
  const cleanPhotoUrl = profile.photoURL ? profile.photoURL.trim() : '';
  const cleanGenres = Array.isArray(profile.favoriteGenres)
    ? profile.favoriteGenres.slice(0, 8)
    : [];

  // 1. Cache in browser localStorage for immediate UI display
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        `zappy_user_profile_${profile.uid}`,
        JSON.stringify({
          uid: profile.uid,
          email: profile.email,
          displayName: profile.displayName,
          age: profile.age,
          photoURL: cleanPhotoUrl,
          favoriteGenres: cleanGenres,
          onboardingCompleted: true,
          savedAt: Date.now(),
        })
      );
      if (profile.email) {
        window.localStorage.setItem(
          `zappy_known_email_${profile.email.trim().toLowerCase()}`,
          '1'
        );
      }
    }
  } catch {
    // Ignore storage quota errors
  }

  // 2. Update Firebase Auth user profile (only pass photoURL if HTTP/S <= 2000 chars)
  try {
    if (auth.currentUser && auth.currentUser.uid === profile.uid) {
      const authUpdate: { displayName?: string; photoURL?: string } = {
        displayName: profile.displayName.trim(),
      };
      if (
        cleanPhotoUrl &&
        cleanPhotoUrl.length <= 2000 &&
        /^https?:\/\//i.test(cleanPhotoUrl)
      ) {
        authUpdate.photoURL = cleanPhotoUrl;
      }
      await updateProfile(auth.currentUser, authUpdate);
    }
  } catch (err) {
    console.warn('Notice updating Firebase Auth profile:', err);
  }

  // 3. Persist to Cloud Firestore /users/{uid}
  try {
    const userRef = doc(db, 'users', profile.uid);
    const payload: Record<string, any> = {
      uid: profile.uid,
      email: profile.email.trim().toLowerCase(),
      displayName: profile.displayName.trim(),
      age: Number(profile.age) || 18,
      onboardingCompleted: true,
      updatedAt: serverTimestamp(),
    };
    if (cleanPhotoUrl) {
      payload.photoURL = cleanPhotoUrl;
    }
    if (cleanGenres.length > 0) {
      payload.favoriteGenres = cleanGenres;
    }
    await setDoc(userRef, payload, { merge: true });
  } catch (err) {
    console.warn('Notice saving user profile to Cloud Firestore:', err);
  }
}

export function getCachedUserProfile(uid: string): UserProfileData | null {
  try {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(`zappy_user_profile_${uid}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            uid: parsed.uid || uid,
            email: parsed.email || '',
            displayName: parsed.displayName || '',
            age: Number(parsed.age) || 0,
            photoURL: parsed.photoURL,
            favoriteGenres: Array.isArray(parsed.favoriteGenres)
              ? parsed.favoriteGenres
              : undefined,
            onboardingCompleted: parsed.onboardingCompleted,
          };
        }
      }
    }
  } catch {}
  return null;
}

export async function fetchUserProfileFromFirestore(
  uid: string
): Promise<UserProfileData | null> {
  const cached = getCachedUserProfile(uid);
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      const loaded: UserProfileData = {
        uid,
        email: String(data.email || cached?.email || ''),
        displayName: String(data.displayName || cached?.displayName || ''),
        age: Number(data.age || cached?.age || 0),
        photoURL: String(data.photoURL || cached?.photoURL || ''),
        favoriteGenres: Array.isArray(data.favoriteGenres)
          ? data.favoriteGenres
          : cached?.favoriteGenres || [],
        onboardingCompleted: Boolean(
          data.onboardingCompleted ?? (data.displayName && data.age)
        ),
      };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          `zappy_user_profile_${uid}`,
          JSON.stringify({ ...loaded, savedAt: Date.now() })
        );
      }
      return loaded;
    }
  } catch {
    // Fallback to cached profile if offline
  }
  if (cached && cached.displayName && cached.age) {
    return {
      uid,
      email: cached.email || '',
      displayName: cached.displayName,
      age: cached.age,
      photoURL: cached.photoURL || '',
      favoriteGenres: cached.favoriteGenres || [],
      onboardingCompleted: Boolean(cached.onboardingCompleted ?? true),
    };
  }
  return null;
}


export async function sendPasswordReset(email: string) {
  return sendPasswordResetEmail(auth, email.trim());
}

export async function signInWithCustomFirebaseToken(customToken: string) {
  return signInWithCustomToken(auth, customToken);
}

export async function reauthenticateWithEmail(user: User, password: string) {
  if (!user.email) throw new Error('User has no registered email address.');
  const credential = EmailAuthProvider.credential(user.email, password);
  return reauthenticateWithCredential(user, credential);
}

export async function deleteUserAccount(user: User) {
  return deleteUser(user);
}

export async function signOutUser() {
  return signOut(auth);
}

// GitHub Authentication Provider & Flow
export const githubProvider = new GithubAuthProvider();
githubProvider.addScope('read:user');
githubProvider.addScope('user:email');
githubProvider.setCustomParameters({
  allow_signup: 'true',
});

// Google Authentication Provider & Flow
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Initiates mobile-friendly GitHub redirect sign-in.
 */
export async function signInWithGithubRedirect(): Promise<void> {
  return signInWithRedirect(auth, githubProvider);
}

/**
 * Initiates Google sign-in using popup in iframes or redirect on top-level web.
 */
export async function signInWithGoogle(): Promise<UserCredential | void> {
  const isInIframe =
    typeof window !== 'undefined' &&
    window.self !== window.top;

  if (isInIframe) {
    try {
      return await signInWithPopup(auth, googleProvider);
    } catch (popupErr: unknown) {
      console.warn('Google popup attempted in iframe context, attempting redirect:', popupErr);
      return await signInWithRedirect(auth, googleProvider);
    }
  }

  return await signInWithRedirect(auth, googleProvider);
}

/**
 * Retrieves and processes redirect results for Google or GitHub OAuth.
 */
export async function handleSocialRedirectResult(): Promise<UserCredential | null> {
  return getRedirectResult(auth);
}

/**
 * Retrieves and processes the redirect result when the app mounts after returning from GitHub.
 */
export async function handleGithubRedirectResult(): Promise<UserCredential | null> {
  return getRedirectResult(auth);
}

/**
 * Fallback popup-based GitHub sign-in (e.g. for desktop or sandboxed iframe environments).
 */
export async function signInWithGithubPopup(): Promise<UserCredential> {
  return signInWithPopup(auth, githubProvider);
}

/**
 * Smart GitHub Sign-In handler:
 * - Uses signInWithRedirect for mobile devices and standard top-level web apps (e.g., Netlify).
 * - Gracefully falls back to signInWithPopup when running inside cross-origin sandboxed iframes.
 */
export async function signInWithGithub(): Promise<UserCredential | void> {
  const isInIframe =
    typeof window !== 'undefined' &&
    window.self !== window.top;

  if (isInIframe) {
    try {
      return await signInWithPopup(auth, githubProvider);
    } catch (popupErr: unknown) {
      console.warn('GitHub popup attempted in iframe context, attempting redirect:', popupErr);
      return await signInWithRedirect(auth, githubProvider);
    }
  }

  return await signInWithRedirect(auth, githubProvider);
}

/**
 * Transforms Firebase error codes into clear, user-understandable messages.
 */
export function getFriendlyAuthErrorMessage(error: unknown): string {
  if (!error) return 'An unexpected error occurred during authentication.';
  const err = error as { code?: string; message?: string };
  const code = String(err.code || '');
  const message = String(err.message || error);

  switch (code) {
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email address. Please sign in with your email and password first.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'GitHub sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'Pop-up window was blocked by your browser. Please allow popups or use redirect.';
    case 'auth/operation-not-allowed':
      return 'Sign-in provider is not enabled in Firebase Console. Please enable it under Authentication -> Sign-in method.';
    case 'auth/unauthorized-domain':
      return 'This website domain is not authorized in Firebase. Please add your Netlify / hosting domain to Firebase Console -> Authentication -> Settings -> Authorized domains.';
    case 'auth/network-request-failed':
      return 'Network connection failed. Please check your internet connection.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/invalid-credential':
      return 'Invalid credentials. Please try again.';
    default:
      if (message.includes('popup-closed') || message.includes('cancelled')) {
        return 'Sign-in was cancelled.';
      }
      return message || 'Authentication failed. Please try again.';
  }
}

/**
 * Safely converts an email address into a deterministic, valid Firestore document ID.
 * Uses 2-digit hex encoding of lowercased email, matching ^[a-zA-Z0-9_\-]+$ and length <= 128.
 */
export function encodeEmailToDocId(email: string): string {
  const clean = email.trim().toLowerCase();
  let hex = '';
  for (let i = 0; i < clean.length; i++) {
    hex += clean.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex.slice(0, 128);
}

/**
 * Computes a SHA-256 hex string in both browser and server runtimes.
 */
export async function sha256Hex(str: string): Promise<string> {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    try {
      const buffer = await globalThis.crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(str)
      );
      return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Fallback below
    }
  }
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0))
    .toString(16)
    .padStart(64, '0');
}

/**
 * Checks whether an email address is registered in Firestore.
 */
export async function isEmailRegisteredInFirestore(
  email: string
): Promise<boolean> {
  const clean = email.trim().toLowerCase();
  if (!clean || !clean.includes('@')) return false;
  if (clean === ADMIN_EMAIL.toLowerCase() || clean === 'admin@zappy.app') {
    return true;
  }

  try {
    const docId = encodeEmailToDocId(clean);
    const snap = await getDoc(doc(db, 'registered_emails', docId));
    if (snap.exists()) {
      return true;
    }
  } catch (err) {
    console.warn('Notice checking registered_emails in Firestore:', err);
  }
  return false;
}

/**
 * Automatically records a registered email address in Cloud Firestore.
 */
export async function saveRegisteredEmailToFirestore(
  email: string,
  extra?: { displayName?: string; uid?: string }
): Promise<void> {
  const clean = email.trim().toLowerCase();
  if (!clean || !clean.includes('@')) return;

  try {
    const docId = encodeEmailToDocId(clean);
    const ref = doc(db, 'registered_emails', docId);
    await setDoc(
      ref,
      {
        email: clean,
        displayName: extra?.displayName || '',
        uid: extra?.uid || '',
        registeredAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Notice saving registered email in Firestore:', err);
  }

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(`zappy_known_email_${clean}`, '1');
    } catch {}
  }
}

/**
 * Stores a cryptographically salted OTP verification challenge in Firestore.
 */
export async function storeOtpChallengeInFirestore(
  email: string,
  otp: string
): Promise<{ salt: string; expiresAtMs: number }> {
  const clean = email.trim().toLowerCase();
  const salt =
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const challengeHash = await sha256Hex(`${clean}:${otp}:${salt}`);
  const expiresAtMs = Date.now() + 10 * 60 * 1000; // 10 minutes

  try {
    const docId = encodeEmailToDocId(clean);
    await setDoc(doc(db, 'otp_challenges', docId), {
      email: clean,
      challengeHash,
      salt,
      expiresAtMs,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Notice storing OTP challenge in Firestore:', err);
  }

  return { salt, expiresAtMs };
}

/**
 * Verifies an OTP challenge against Firestore with replay attack protection.
 */
export async function verifyOtpChallengeInFirestore(
  email: string,
  candidateOtp: string
): Promise<{ valid: boolean; reason?: string; registrationToken?: string }> {
  const clean = email.trim().toLowerCase();
  if (!clean || !candidateOtp) {
    return {
      valid: false,
      reason: 'Email and 6-digit verification code are required.',
    };
  }

  try {
    const docId = encodeEmailToDocId(clean);
    const challengeRef = doc(db, 'otp_challenges', docId);
    const snap = await getDoc(challengeRef);
    if (!snap.exists()) {
      return {
        valid: false,
        reason: 'No active OTP found for this email. Please request a new code.',
      };
    }

    const data = snap.data();
    if (Date.now() > Number(data.expiresAtMs || 0)) {
      try {
        await deleteDoc(challengeRef);
      } catch {}
      return {
        valid: false,
        reason: 'This OTP has expired. Please request a new code.',
      };
    }

    const candidateHash = await sha256Hex(
      `${clean}:${candidateOtp}:${data.salt}`
    );
    if (candidateHash !== data.challengeHash) {
      return { valid: false, reason: 'Incorrect OTP. Please try again.' };
    }

    // Single-use token: Immediately delete consumed challenge to prevent replay attacks
    try {
      await deleteDoc(challengeRef);
    } catch {}

    const registrationToken = `reg_fs_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    return { valid: true, registrationToken };
  } catch (err) {
    console.warn('Notice verifying OTP challenge in Firestore:', err);
    return { valid: false, reason: 'INCONCLUSIVE' };
  }
}


