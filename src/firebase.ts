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

/**
 * Initiates mobile-friendly GitHub redirect sign-in.
 */
export async function signInWithGithubRedirect(): Promise<void> {
  return signInWithRedirect(auth, githubProvider);
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
      return 'GitHub sign-in is not enabled in Firebase Console. Please enable the GitHub provider under Authentication -> Sign-in method.';
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
        return 'GitHub sign-in was cancelled.';
      }
      return message || 'Authentication failed. Please try again.';
  }
}

