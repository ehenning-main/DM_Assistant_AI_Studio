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

// Google Login Pop-up Trigger
export async function logInWithGoogle() {
  if (!isRealFirebase || !auth) {
    throw new Error("Cloud auth triggers are inactive in Local mode.");
  }
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

// Sign Out Trigger
export async function logOutUser() {
  if (isRealFirebase && auth) {
    return signOut(auth);
  }
}
