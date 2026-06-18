/**
 * Export all Firestore collections plus all Firebase Auth users to a JSON file.
 *
 * Usage (against emulator):
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 npx tsx scripts/export-db.ts
 *
 * Usage (against production — requires service account):
 *   GOOGLE_APPLICATION_CREDENTIALS=./functions/service-account.json npx tsx ./scripts/export-db.ts
 *
 * Auth users are exported without password fields: this app is passwordless
 * (magic-link / OTP, see app/api/auth/verify-code/route.ts), and properly
 * re-importing a password hash requires the project's scrypt signer key,
 * which the Admin SDK doesn't expose. One side effect: a stray `password`
 * provider entry left over from an old email-link sign-in (Firebase tags any
 * email-identified user that way, hash or not) gets silently dropped by the
 * emulator's importUsers on the way back in. Harmless — nothing here looks
 * users up by providerData.
 *
 * Output: firestore-export-<timestamp>.json in the project root.
 */

import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth, type UserImportRecord } from "firebase-admin/auth";
import { writeFileSync, readFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const projectId = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", ".firebaserc"), "utf-8")
).projects.default as string;

if (!getApps().length) {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    initializeApp({ projectId });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)) });
  } else {
    initializeApp({ credential: applicationDefault() });
  }
}

const db = getFirestore();

async function exportCollection(collectionPath: string): Promise<Record<string, unknown>> {
  // listDocuments() includes hollow docs (no fields, only subcollections)
  // collection().get() skips them, which is why predictions appeared empty
  const docRefs = await db.collection(collectionPath).listDocuments();
  const result: Record<string, unknown> = {};

  for (const docRef of docRefs) {
    const docSnap = await docRef.get();
    const data = docSnap.exists ? (docSnap.data() ?? {}) : {};

    const subcollections = await docRef.listCollections();
    const subs: Record<string, unknown> = {};
    for (const sub of subcollections) {
      subs[sub.id] = await exportCollection(sub.path);
    }

    result[docRef.id] = {
      ...data,
      ...(Object.keys(subs).length > 0 ? { _subcollections: subs } : {}),
    };
  }

  return result;
}

async function exportAuthUsers(): Promise<UserImportRecord[]> {
  const auth = getAuth();
  const users: UserImportRecord[] = [];
  let pageToken: string | undefined;

  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      users.push({
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        phoneNumber: user.phoneNumber,
        photoURL: user.photoURL,
        disabled: user.disabled,
        customClaims: user.customClaims,
        providerData: user.providerData.map((p) => ({
          uid: p.uid,
          providerId: p.providerId,
          email: p.email,
          displayName: p.displayName,
          photoURL: p.photoURL,
          phoneNumber: p.phoneNumber,
        })),
        metadata: {
          creationTime: user.metadata.creationTime,
          lastSignInTime: user.metadata.lastSignInTime,
        },
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);

  return users;
}

async function main() {
  console.log("Listing top-level collections...");
  const topLevel = await db.listCollections();

  const output: Record<string, unknown> = {};

  for (const colRef of topLevel) {
    console.log(`Exporting collection: ${colRef.id}`);
    output[colRef.id] = await exportCollection(colRef.path);
  }

  console.log("Exporting Auth users...");
  const authUsers = await exportAuthUsers();
  output._authUsers = authUsers;
  console.log(`  exported ${authUsers.length} user(s)`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = resolve(process.cwd(), `firestore-export-${timestamp}.json`);

  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Done. Exported to: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
