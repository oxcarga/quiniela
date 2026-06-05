/**
 * One-time seed script: reads the fixtures JSON and writes all 104 matches to Firestore.
 *
 * Usage (against emulator):
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/seed-matches.ts
 *
 * Usage (against production — requires service account):
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npx tsx scripts/seed-matches.ts
 *
 * Idempotent: re-running overwrites existing docs.
 */

import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Flag emoji lookup ────────────────────────────────────────────────────────

const FLAG_MAP: Record<string, string> = {
  "México": "🇲🇽",
  "República de Corea": "🇰🇷",
  "Sudáfrica": "🇿🇦",
  "República Checa": "🇨🇿",
  "Canadá": "🇨🇦",
  "Suiza": "🇨🇭",
  "Qatar": "🇶🇦",
  "Bosnia y Herzegovina": "🇧🇦",
  "Brasil": "🇧🇷",
  "Marruecos": "🇲🇦",
  "Haití": "🇭🇹",
  "Escocia": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "EEUU": "🇺🇸",
  "Paraguay": "🇵🇾",
  "Australia": "🇦🇺",
  "Turquía": "🇹🇷",
  "Alemania": "🇩🇪",
  "Ecuador": "🇪🇨",
  "Costa de Marfil": "🇨🇮",
  "Curazao": "🇨🇼",
  "Países Bajos": "🇳🇱",
  "Japón": "🇯🇵",
  "Túnez": "🇹🇳",
  "Suecia": "🇸🇪",
  "Bélgica": "🇧🇪",
  "Egipto": "🇪🇬",
  "RI de Irán": "🇮🇷",
  "Nueva Zelanda": "🇳🇿",
  "España": "🇪🇸",
  "Uruguay": "🇺🇾",
  "Arabia Saudí": "🇸🇦",
  "Cabo Verde": "🇨🇻",
  "Francia": "🇫🇷",
  "Senegal": "🇸🇳",
  "Noruega": "🇳🇴",
  "Irak": "🇮🇶",
  "Argentina": "🇦🇷",
  "Argelia": "🇩🇿",
  "Austria": "🇦🇹",
  "Jordania": "🇯🇴",
  "Portugal": "🇵🇹",
  "Colombia": "🇨🇴",
  "Uzbekistán": "🇺🇿",
  "RD del Congo": "🇨🇩",
  "Inglaterra": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Croacia": "🇭🇷",
  "Ghana": "🇬🇭",
  "Panamá": "🇵🇦",
  "TBD": "🏳️",
};

function flag(team: string): string {
  return FLAG_MAP[team] ?? "🏳️";
}

// ── Phase mapping ────────────────────────────────────────────────────────────

type Phase = "group" | "round_of_32" | "round_of_16" | "quarter" | "semi" | "third_place" | "final";

function toPhase(stage: string): Phase {
  switch (stage) {
    case "Group Stage":  return "group";
    case "Round of 32": return "round_of_32";
    case "Round of 16": return "round_of_16";
    case "Quarterfinal": return "quarter";
    case "Semifinal":   return "semi";
    case "Third Place": return "third_place";
    case "Final":       return "final";
    default:            return "group";
  }
}

// ── Kickoff time parsing ─────────────────────────────────────────────────────
// time_local_cr is "HH:MM" in Costa Rica local time (UTC-6)

function toKickoffAt(date: string, timeLocalCr: string): Timestamp {
  const [hours, minutes] = timeLocalCr.split(":").map(Number);
  const d = new Date(`${date}T00:00:00Z`);
  // setUTCHours handles day overflow automatically (e.g. 22+6=28 → 04 next day)
  d.setUTCHours(hours + 6, minutes, 0, 0);
  return Timestamp.fromDate(d);
}

// ── Fixtures JSON type ───────────────────────────────────────────────────────

interface RawMatch {
  match_number: number;
  stage: string;
  group: string | null;
  date: string;
  time_local_cr: string;
  home_team: string;
  away_team: string;
  venue: string;
  city: string;
  country: string;
}

interface FixturesFile {
  matches: RawMatch[];
}

// ── Main ─────────────────────────────────────────────────────────────────────

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
  const jsonPath = resolve(process.cwd(), "data/fifa_world_cup_2026_group_fixtures.json");
  const { matches } = JSON.parse(readFileSync(jsonPath, "utf-8")) as FixturesFile;

  const batch = db.batch();

  for (const m of matches) {
    const matchId = `WC2026_${m.match_number.toString().padStart(3, "0")}`;
    const ref = db.collection("matches").doc(matchId);

    const doc: Record<string, unknown> = {
      matchId,
      phase: toPhase(m.stage),
      homeTeam: m.home_team,
      awayTeam: m.away_team,
      homeFlag: flag(m.home_team),
      awayFlag: flag(m.away_team),
      kickoffAt: toKickoffAt(m.date, m.time_local_cr),
      status: "upcoming",
      venue: m.venue,
      city: m.city,
      country: m.country,
    };

    if (m.group) doc.group = m.group;

    batch.set(ref, doc);
  }

  await batch.commit();
  console.log(`✓ Seeded ${matches.length} matches to Firestore${isEmulator ? " (emulator)" : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
