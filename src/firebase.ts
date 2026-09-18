import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

// Check if Firebase is configured with real keys
export const isRealFirebase = !!(firebaseConfig.apiKey && firebaseConfig.apiKey !== "");

let app;
let db: any = null;
let auth: any = null;

if (isRealFirebase) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");
    auth = getAuth(app);
  } catch (error) {
    console.error("Firebase startup anomaly:", error);
  }
}

export { db, auth };

// Firestore Error Helper conforming strictly to standard specifications
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentAuth = auth;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentAuth?.currentUser?.uid || null,
      email: currentAuth?.currentUser?.email || null,
      emailVerified: currentAuth?.currentUser?.emailVerified || null,
      isAnonymous: currentAuth?.currentUser?.isAnonymous || null,
      tenantId: currentAuth?.currentUser?.tenantId || null,
      providerInfo: currentAuth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Exception Scrutiny:", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// In-memory token cache (never stored in localStorage or sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Create configured GoogleAuthProvider with Drive Readonly scope
export function getGoogleDriveAuthProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope("https://www.googleapis.com/auth/drive.readonly");
  return provider;
}

// Google Login Pop-up Trigger with Drive Scopes & Token Acquisition
export async function logInWithGoogle(): Promise<{ user: any; accessToken: string | null }> {
  if (!isRealFirebase || !auth) {
    throw new Error("Cloud auth triggers are inactive in Local mode.");
  }
  isSigningIn = true;
  try {
    const provider = getGoogleDriveAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
}

// Get the current cached Google OAuth access token
export async function getGoogleAccessToken(): Promise<string | null> {
  return cachedAccessToken;
}

// Explicit function to request/refresh Drive access token
export async function requestDriveAccessToken(): Promise<string | null> {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }
  const result = await logInWithGoogle();
  return result.accessToken;
}

// Initialize auth state listener conforming to workspace integration standard
export const initAuth = (
  onAuthSuccess?: (user: any, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  if (!isRealFirebase || !auth) {
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }
  return auth.onAuthStateChanged(async (firebaseUser: any) => {
    if (firebaseUser) {
      if (onAuthSuccess) onAuthSuccess(firebaseUser, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign Out Trigger
export async function logOutUser() {
  cachedAccessToken = null;
  if (isRealFirebase && auth) {
    return signOut(auth);
  }
}

