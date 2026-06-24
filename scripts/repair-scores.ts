/**
 * Repair script: recalculates every user's totalScore by summing pointsEarned
 * across all their predictions, then writes the correct value back to users/{uid}.
 * It also recomputes exactCount (the leaderboard tiebreaker — number of exact-score
 * hits) and backfills the per-prediction `exactHit` flag that scoreMatch now writes.
 *
 * An exact hit is base 3 points, so pointsEarned is 3 (unboosted) or 6 (boosted) —
 * no other outcome produces those values.
 *
 * Safe to run multiple times — it always derives the values from the source of truth
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
import { readFileSync } from "fs";
import { dirname, join } from "path";
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
    const data = userDoc.data();
    const currentScore = (data.totalScore as number) ?? 0;
    const currentExact = (data.exactCount as number) ?? 0;

    const predsSnap = await db.collection("predictions").doc(uid).collection("matches").get();

    let recalculated = 0;
    let exactCount = 0;
    for (const pred of predsSnap.docs) {
      const earned = pred.data().pointsEarned;
      if (typeof earned === "number") {
        recalculated += earned;
        const exactHit = earned === 3 || earned === 6;
        if (exactHit) exactCount++;
        // Backfill the per-prediction flag so scoreMatch's delta logic stays correct.
        if (pred.data().exactHit !== exactHit) {
          batch.update(pred.ref, { exactHit });
        }
      }
    }

    const scoreOk = currentScore === recalculated;
    const exactOk = currentExact === exactCount;
    const scoreStatus = scoreOk ? "OK" : `${currentScore} → ${recalculated} ✓ FIXED`;
    const exactStatus = exactOk ? "OK" : `${currentExact} → ${exactCount} ✓ FIXED`;
    console.log(`  ${uid}  totalScore: ${scoreStatus}  exactCount: ${exactStatus}`);

    if (!scoreOk || !exactOk) {
      batch.update(userDoc.ref, { totalScore: recalculated, exactCount });
      changed++;
    }
  }

  if (changed === 0) {
    console.log("\nAll scores are already correct.");
  } else {
    console.log(`\nCommitting ${changed} update(s)...`);
    await batch.commit();
  }

  // Rebuild the cached leaderboard so the new totals + tiebreaker order take effect.
  await rebuildLeaderboard();
  console.log("Leaderboard rebuilt. Done.");
}

// Mirror of functions/src/leaderboard.ts so the repair script leaves the cached
// leaderboard consistent with what scoreMatch would produce.
async function rebuildLeaderboard() {
  const usersSnap = await db.collection("users").get();

  const rankings = usersSnap.docs
    .map((doc) => {
      const u = doc.data();
      return {
        userId: u.uid as string,
        displayName: u.displayName as string,
        photoURL: (u.photoURL as string | null) ?? null,
        totalScore: (u.totalScore as number) ?? 0,
        exactCount: (u.exactCount as number) ?? 0,
      };
    })
    .sort(
      (a, b) =>
        b.totalScore - a.totalScore ||
        b.exactCount - a.exactCount ||
        a.displayName.localeCompare(b.displayName)
    )
    .map((entry, i) => ({ ...entry, position: i + 1 }));

  await db.collection("leaderboard").doc("current").set({
    updatedAt: new Date(),
    rankings,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
