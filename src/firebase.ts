import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const FIREBASE_TARGET_STORAGE_KEY = 'zappy_active_firebase_project_v1';

// User's Custom Firebase Project (zappyfun)
export const ZAPPYFUN_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDsfOcpVowpI9meVwLdKBAIKh3JODntkbM',
  authDomain: 'zappyfun.firebaseapp.com',
  projectId: 'zappyfun',
  storageBucket: 'zappyfun.firebasestorage.app',
  messagingSenderId: '22593530794',
  appId: '1:22593530794:web:fb90d32107a50f7b4f19d3',
  measurementId: 'G-8TWLVE24VB',
  firestoreDatabaseId: '(default)',
};

// Previous / Provisioned Firebase Project Reference (for automatic data recovery & migration)
export const LEGACY_FIREBASE_CONFIG = {
  projectId: firebaseConfig.projectId || 'aibharix',
  appId:
    firebaseConfig.appId || '1:596747289658:web:cc98232d160f06f350a103',
  apiKey:
    firebaseConfig.apiKey || 'AIzaSyBGqfYv6OrYNcD319mPHXj9LgRmieobTJE',
  authDomain: firebaseConfig.authDomain || 'aibharix.firebaseapp.com',
  firestoreDatabaseId:
    (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId ||
    'ai-studio-cinewave-4d6d3728-a0e8-4425-a1bd-5687d7a5b612',
  storageBucket:
    firebaseConfig.storageBucket || 'aibharix.firebasestorage.app',
  messagingSenderId: firebaseConfig.messagingSenderId || '596747289658',
};

export function getActiveFirebaseTarget(): 'zappyfun' | 'default' {
  try {
    const saved = localStorage.getItem(FIREBASE_TARGET_STORAGE_KEY);
    return saved === 'zappyfun' ? 'zappyfun' : 'default';
  } catch {
    return 'default';
  }
}

export function setActiveFirebaseTarget(target: 'zappyfun' | 'default') {
  try {
    localStorage.setItem(FIREBASE_TARGET_STORAGE_KEY, target);
  } catch {
    // Ignore storage error
  }
}

const useZappyFun = getActiveFirebaseTarget() === 'zappyfun';
const selectedConfig = useZappyFun ? ZAPPYFUN_FIREBASE_CONFIG : firebaseConfig;

// Primary Active Firebase Project
const app = initializeApp(selectedConfig);
export const db = getFirestore(
  app,
  (selectedConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId ||
    '(default)'
);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const ACTIVE_FIREBASE_PROJECT_ID = selectedConfig.projectId;
export const ACTIVE_FIRESTORE_DATABASE_ID =
  (selectedConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId ||
  '(default)';

// Secondary Legacy Firebase Project Instance (always connected to original database so all data can be recovered)
const legacyApp =
  getApps().find((a) => a.name === 'zappy-legacy-source') ||
  initializeApp(LEGACY_FIREBASE_CONFIG, 'zappy-legacy-source');

export const legacyDb = getFirestore(
  legacyApp,
  LEGACY_FIREBASE_CONFIG.firestoreDatabaseId
);

// Secondary ZappyFun Target Instance (for pre-flight check & migration)
const zappyFunTargetApp =
  getApps().find((a) => a.name === 'zappy-zappyfun-target') ||
  initializeApp(ZAPPYFUN_FIREBASE_CONFIG, 'zappy-zappyfun-target');

export const zappyFunDb = getFirestore(zappyFunTargetApp, '(default)');

export const ADMIN_EMAIL = 'pawarayushai1@gmail.com';

export function isUserAdmin(
  email?: string | null,
  emailVerified?: boolean
): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL && emailVerified !== false;
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
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot per skill requirements
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'catalog', 'connection-check'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
  return signOut(auth);
}
