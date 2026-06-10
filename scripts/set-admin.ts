/**
 * Sets the `admin: true` custom claim on a Firebase Auth user.
 *
 * Usage (against emulator):
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 npx tsx scripts/set-admin.ts user@example.com
 *
 * Usage (against production — requires service account):
 *   GOOGLE_APPLICATION_CREDENTIALS=./functions/service-account.json npx tsx scripts/set-admin.ts user@example.com
 *
 * To remove the admin claim, the user must sign out and back in for the token to refresh.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const projectId = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", ".firebaserc"), "utf8")
).projects.default as string;

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx scripts/set-admin.ts <email>");
  process.exit(1);
}

const isEmulator = !!process.env.FIREBASE_AUTH_EMULATOR_HOST;

initializeApp(
  process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? { credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS) }
    : isEmulator
      ? { projectId }
      : { credential: applicationDefault() }
);

async function main() {
  const auth = getAuth();
  const user = await auth.getUserByEmail(email);
  await auth.setCustomUserClaims(user.uid, { admin: true });
  console.log(`✓ Admin claim set on ${email} (uid: ${user.uid})${isEmulator ? " (emulator)" : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
