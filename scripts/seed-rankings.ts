/**
 * Seed script: writes FIFA men's world rankings to /rankings/current in Firestore.
 *
 * Usage (against emulator):
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/seed-rankings.ts
 *
 * Usage (against production — requires service account):
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npx tsx scripts/seed-rankings.ts
 *
 * Idempotent: re-running overwrites the existing document.
 * Note: team names in the source JSON are in Spanish (as published by FIFA).
 */

import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

interface RawRankingEntry {
  ranking: number;
  team: string;
  last_results: string[];
}

async function main() {
  const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

  initializeApp(
    process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? { credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS) }
      : isEmulator
        ? { projectId: "quiniela-ee895" }
        : { credential: applicationDefault() }
  );

  const db = getFirestore();
  const jsonPath = resolve(process.cwd(), "data/fifa_world_ranking_men.json");
  const raw = JSON.parse(readFileSync(jsonPath, "utf-8")) as RawRankingEntry[];

  const teams = raw.map((entry) => ({
    ranking: entry.ranking,
    team: entry.team,
    lastResults: entry.last_results,
  }));

  await db.collection("rankings").doc("current").set({
    updatedAt: Timestamp.now(),
    teams,
  });

  console.log(
    `✓ Seeded ${teams.length} team rankings into /rankings/current${isEmulator ? " (emulator)" : ""}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
