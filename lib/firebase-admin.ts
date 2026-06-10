import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    // In emulator mode the app is created without credentials, so the Firestore
    // admin client must be pointed at the local emulator too — otherwise it
    // tries to reach production Firestore and fails. Mirror the client port
    // (firebase.json → firestore: 8080) unless an override is already set.
    process.env.FIRESTORE_EMULATOR_HOST ??= "localhost:8080";
    initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
  } else {
    initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)),
    });
  }
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
