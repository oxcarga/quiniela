import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

if (!getApps().length) {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
  } else {
    initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)),
    });
  }
}

export const adminAuth = getAuth();
