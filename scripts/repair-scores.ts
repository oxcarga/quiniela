/**
 * Repair script: recalculates every user's totalScore by summing pointsEarned
 * across all their predictions, then writes the correct value back to users/{uid}.
 *
 * Safe to run multiple times — it always derives the score from the source of truth
 * (prediction documents) rather than accumulating.
 *
 * Usage (production):
 *   GOOGLE_APPLICATION_CREDENTIALS=./functions/service-account.json npx tsx scripts/repair-scores.ts
 *
 * Usage (emulator):
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/repair-scores.ts
 */

import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    initializeApp({ projectId: "quiniela-ee895" });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)) });
  } else {
    initializeApp({ credential: applicationDefault() });
  }
}

const db = getFirestore();

async function main() {
  const usersSnap = await db.collection("users").get();

  if (usersSnap.empty) {
    console.log("No users found.");
    return;
  }

  console.log(`Found ${usersSnap.size} user(s). Recalculating scores...\n`);

  const batch = db.batch();
  let changed = 0;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const currentScore = (userDoc.data().totalScore as number) ?? 0;

    const predsSnap = await db.collection("predictions").doc(uid).collection("matches").get();

    let recalculated = 0;
    for (const pred of predsSnap.docs) {
      const earned = pred.data().pointsEarned;
      if (typeof earned === "number") {
        recalculated += earned;
      }
    }

    const status = currentScore === recalculated ? "OK" : `${currentScore} → ${recalculated} ✓ FIXED`;
    console.log(`  ${uid}  totalScore: ${status}`);

    if (currentScore !== recalculated) {
      batch.update(userDoc.ref, { totalScore: recalculated });
      changed++;
    }
  }

  if (changed === 0) {
    console.log("\nAll scores are already correct. Nothing to update.");
    return;
  }

  console.log(`\nCommitting ${changed} update(s)...`);
  await batch.commit();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
