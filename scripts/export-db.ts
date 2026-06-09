/**
 * Export all Firestore collections to a JSON file.
 *
 * Usage (against emulator):
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/export-db.ts
 *
 * Usage (against production — requires service account):
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npx tsx scripts/export-db.ts
 *
 * Output: firestore-export-<timestamp>.json in the project root.
 */

import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { writeFileSync } from "fs";
import { resolve } from "path";

if (!getApps().length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
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

async function main() {
  console.log("Listing top-level collections...");
  const topLevel = await db.listCollections();

  const output: Record<string, unknown> = {};

  for (const colRef of topLevel) {
    console.log(`Exporting collection: ${colRef.id}`);
    output[colRef.id] = await exportCollection(colRef.path);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = resolve(process.cwd(), `firestore-export-${timestamp}.json`);

  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Done. Exported to: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
