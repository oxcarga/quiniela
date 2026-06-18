/**
 * Import a Firestore + Auth export JSON (produced by scripts/export-db.ts)
 * into the local emulators.
 *
 * Usage:
 *   1. Export prod:
 *        GOOGLE_APPLICATION_CREDENTIALS=./functions/service-account.json npx tsx ./scripts/export-db.ts
 *   2. Import into the emulators (make sure they're running: npm run emulators):
 *        FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 npx tsx scripts/import-db.ts firestore-export-<timestamp>.json
 *
 * Pass --clear to delete every existing doc/user in the collections and Auth
 * being imported first, so the emulators end up an exact mirror of the
 * export instead of a merge with whatever stale local data was already there:
 *   ... npx tsx scripts/import-db.ts firestore-export-<timestamp>.json --clear
 *
 * Refuses to run unless FIRESTORE_EMULATOR_HOST is set, since this script is
 * only meant for refreshing local dev data, not for writing to production.
 * FIREBASE_AUTH_EMULATOR_HOST is only required if the export contains
 * _authUsers.
 */

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { getAuth, type UserImportRecord } from "firebase-admin/auth";
import { readFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const projectId = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", ".firebaserc"), "utf-8")
).projects.default as string;

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error(
    "FIRESTORE_EMULATOR_HOST is not set. This script only writes to the Firestore emulator " +
      "— set it (e.g. FIRESTORE_EMULATOR_HOST=localhost:8080) to confirm that's where you want to write."
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const clear = args.includes("--clear");
const filePath = args.find((a) => !a.startsWith("--"));

if (!filePath) {
  console.error("Usage: npx tsx scripts/import-db.ts <export.json> [--clear]");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ projectId });
}

const db = getFirestore();

// Admin SDK Timestamps have no toJSON(), so JSON.stringify falls back to
// their own enumerable fields: { _seconds, _nanoseconds }. Detect that exact
// shape on the way back in and turn it into a real Timestamp.
function isTimestampLike(value: unknown): value is { _seconds: number; _nanoseconds: number } {
  if (typeof value !== "object" || value === null) return false;
  const keys = Object.keys(value);
  return (
    keys.length === 2 &&
    typeof (value as Record<string, unknown>)._seconds === "number" &&
    typeof (value as Record<string, unknown>)._nanoseconds === "number"
  );
}

function reviveTimestamps(value: unknown): unknown {
  if (isTimestampLike(value)) return new Timestamp(value._seconds, value._nanoseconds);
  if (Array.isArray(value)) return value.map(reviveTimestamps);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, reviveTimestamps(v)])
    );
  }
  return value;
}

interface PendingWrite {
  path: string;
  data: Record<string, unknown>;
}

// Mirrors the shape written by export-db.ts: each doc's own fields live
// alongside an optional `_subcollections` map of nested collections.
function flatten(collectionPath: string, docs: Record<string, unknown>, out: PendingWrite[]): void {
  for (const [docId, raw] of Object.entries(docs)) {
    const { _subcollections, ...fields } = raw as Record<string, unknown> & {
      _subcollections?: Record<string, Record<string, unknown>>;
    };

    out.push({ path: `${collectionPath}/${docId}`, data: reviveTimestamps(fields) as Record<string, unknown> });

    if (_subcollections) {
      for (const [subName, subDocs] of Object.entries(_subcollections)) {
        flatten(`${collectionPath}/${docId}/${subName}`, subDocs, out);
      }
    }
  }
}

async function collectDocRefs(collectionPath: string, out: DocumentReference[]): Promise<void> {
  const docRefs = await db.collection(collectionPath).listDocuments();
  for (const docRef of docRefs) {
    out.push(docRef);
    const subcollections = await docRef.listCollections();
    for (const sub of subcollections) {
      await collectDocRefs(sub.path, out);
    }
  }
}

async function commitWritesInBatches(writes: PendingWrite[]): Promise<void> {
  const CHUNK = 500;
  for (let i = 0; i < writes.length; i += CHUNK) {
    const chunk = writes.slice(i, i + CHUNK);
    const batch = db.batch();
    for (const w of chunk) batch.set(db.doc(w.path), w.data);
    await batch.commit();
    console.log(`  wrote ${Math.min(i + CHUNK, writes.length)}/${writes.length}`);
  }
}

async function deleteRefsInBatches(refs: DocumentReference[]): Promise<void> {
  const CHUNK = 500;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const chunk = refs.slice(i, i + CHUNK);
    const batch = db.batch();
    for (const ref of chunk) batch.delete(ref);
    await batch.commit();
  }
}

async function importAuthUsers(users: UserImportRecord[], clear: boolean): Promise<void> {
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    console.error(
      "FIREBASE_AUTH_EMULATOR_HOST is not set, but the export contains _authUsers. " +
        "Set it (e.g. FIREBASE_AUTH_EMULATOR_HOST=localhost:9099) to import them."
    );
    process.exit(1);
  }

  const auth = getAuth();

  if (clear) {
    console.log("Clearing existing emulator Auth users...");
    const uids: string[] = [];
    let pageToken: string | undefined;
    do {
      const page = await auth.listUsers(1000, pageToken);
      uids.push(...page.users.map((u) => u.uid));
      pageToken = page.pageToken;
    } while (pageToken);

    for (let i = 0; i < uids.length; i += 1000) {
      await auth.deleteUsers(uids.slice(i, i + 1000));
    }
    console.log(`  deleted ${uids.length} user(s)`);
  }

  console.log(`Importing ${users.length} Auth user(s)...`);
  const result = await auth.importUsers(users);
  if (result.failureCount > 0) {
    console.error(`  ${result.failureCount} user(s) failed to import:`);
    for (const err of result.errors) {
      console.error(`    [${err.index}] ${err.error.message}`);
    }
  }
  console.log(`  imported ${result.successCount}/${users.length} user(s)`);
}

async function main() {
  const { _authUsers, ...collections } = JSON.parse(
    readFileSync(resolve(process.cwd(), filePath!), "utf-8")
  ) as { _authUsers?: UserImportRecord[] } & Record<string, Record<string, unknown>>;

  if (clear) {
    console.log("Clearing existing emulator data for the collections being imported...");
    const refs: DocumentReference[] = [];
    for (const collectionPath of Object.keys(collections)) {
      await collectDocRefs(collectionPath, refs);
    }
    await deleteRefsInBatches(refs);
    console.log(`  deleted ${refs.length} doc(s)`);
  }

  const writes: PendingWrite[] = [];
  for (const [collectionPath, docs] of Object.entries(collections)) {
    flatten(collectionPath, docs, writes);
  }

  console.log(`Writing ${writes.length} document(s) to the emulator...`);
  await commitWritesInBatches(writes);

  if (_authUsers && _authUsers.length > 0) {
    await importAuthUsers(_authUsers, clear);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
