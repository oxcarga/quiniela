/**
 * Resolve the Round-of-32 placeholder slots ("1st Group A", "2nd Group B",
 * "Best 3rd (A/B/C/D/F)") into real teams, then write the resolved
 * homeTeam/awayTeam/homeFlag/awayFlag back to each match doc.
 *
 * Edit the two config blocks below (STANDINGS and BEST_THIRDS), then run.
 *
 * Dry run (default — prints the resolved bracket, writes nothing):
 *   npx tsx scripts/resolve-round-of-32.ts
 *
 * Commit to the emulator:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/resolve-round-of-32.ts --commit
 *
 * Commit to production (requires service account):
 *   GOOGLE_APPLICATION_CREDENTIALS=./functions/service-account.json npx tsx scripts/resolve-round-of-32.ts --commit
 *
 * Idempotent: re-running overwrites the same fields.
 */

import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG 1 — Final group standings.
// For each group, list the FOUR teams in finishing order: [1st, 2nd, 3rd, 4th].
// Names must match the Spanish names used in the fixtures (and FLAG_MAP below).
// ⚠️ The values below are a SIMULATION — replace with the real standings.
// ─────────────────────────────────────────────────────────────────────────────

type Group = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L";

const STANDINGS: Record<Group, [string, string, string, string]> = {
  // group: [1st,                 2nd,                  3rd,                  4th]
  A: ["México",        "Sudáfrica",          "República de Corea",    "República Checa"],
  B: ["Suiza",         "Canadá",             "Bosnia y Herzegovina",  "Qatar"],
  C: ["Brasil",        "Marruecos",          "Escocia",               "Haití"],
  D: ["EEUU",          "Australia",          "Paraguay",              "Turquía"],
  E: ["Alemania",      "Costa de Marfil",    "Ecuador",               "Curazao"],
  F: ["Países Bajos",  "Japón",              "Suecia",                "Túnez"],
  G: ["Bélgica",       "Egipto",             "RI de Irán",            "Nueva Zelanda"],
  H: ["España",        "Cabo Verde",         "Uruguay",               "Arabia Saudí"],
  I: ["Francia",       "Noruega",            "Senegal",               "Irak"],
  J: ["Argentina",     "Austria",            "Argelia",               "Jordania"],
  K: ["Colombia",      "Portugal",           "RD del Congo",          "Uzbekistán"],
  L: ["Inglaterra",    "Croacia",            "Ghana",                 "Panamá"],
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG 2 — Best-third assignment.
// The 8 "Best 3rd (...)" slots, one per match, each mapped to the GROUP whose
// 3rd-place team fills it (read from the official FIFA bracket). The script
// then uses STANDINGS[group][2] for the team.
// ⚠️ The values below are a SIMULATION — replace with the real assignment.
// Each letter must be one of the allowed groups printed in the slot's "(.../...)".
// ─────────────────────────────────────────────────────────────────────────────

const BEST_THIRDS: Record<string, Group> = {
  WC2026_074: "D", // 1st E vs Best 3rd (A/B/C/D/F)
  WC2026_077: "F", // 1st I vs Best 3rd (C/D/F/G/H)
  WC2026_079: "E", // 1st A vs Best 3rd (C/E/F/H/I)
  WC2026_080: "K", // 1st L vs Best 3rd (E/H/I/J/K)
  WC2026_081: "B", // 1st D vs Best 3rd (B/E/F/I/J)
  WC2026_082: "I", // 1st G vs Best 3rd (A/E/H/I/J)
  WC2026_085: "J", // 1st B vs Best 3rd (E/F/G/I/J)
  WC2026_087: "L", // 1st K vs Best 3rd (D/E/I/J/L)
};

// ─────────────────────────────────────────────────────────────────────────────
// Flag lookup (same table used by seed-matches.ts)
// ─────────────────────────────────────────────────────────────────────────────

const FLAG_MAP: Record<string, string> = {
  "México": "🇲🇽", "República de Corea": "🇰🇷", "Sudáfrica": "🇿🇦", "República Checa": "🇨🇿",
  "Canadá": "🇨🇦", "Suiza": "🇨🇭", "Qatar": "🇶🇦", "Bosnia y Herzegovina": "🇧🇦",
  "Brasil": "🇧🇷", "Marruecos": "🇲🇦", "Haití": "🇭🇹", "Escocia": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "EEUU": "🇺🇸", "Paraguay": "🇵🇾", "Australia": "🇦🇺", "Turquía": "🇹🇷",
  "Alemania": "🇩🇪", "Ecuador": "🇪🇨", "Costa de Marfil": "🇨🇮", "Curazao": "🇨🇼",
  "Países Bajos": "🇳🇱", "Japón": "🇯🇵", "Túnez": "🇹🇳", "Suecia": "🇸🇪",
  "Bélgica": "🇧🇪", "Egipto": "🇪🇬", "RI de Irán": "🇮🇷", "Nueva Zelanda": "🇳🇿",
  "España": "🇪🇸", "Uruguay": "🇺🇾", "Arabia Saudí": "🇸🇦", "Cabo Verde": "🇨🇻",
  "Francia": "🇫🇷", "Senegal": "🇸🇳", "Noruega": "🇳🇴", "Irak": "🇮🇶",
  "Argentina": "🇦🇷", "Argelia": "🇩🇿", "Austria": "🇦🇹", "Jordania": "🇯🇴",
  "Portugal": "🇵🇹", "Colombia": "🇨🇴", "Uzbekistán": "🇺🇿", "RD del Congo": "🇨🇩",
  "Inglaterra": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Croacia": "🇭🇷", "Ghana": "🇬🇭", "Panamá": "🇵🇦",
};

function flag(team: string): string {
  return FLAG_MAP[team] ?? "🏳️";
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolution
// ─────────────────────────────────────────────────────────────────────────────

interface RawMatch {
  match_number: number;
  stage: string;
  home_team: string;
  away_team: string;
}

const POS_LABEL = ["1st", "2nd", "3rd", "4th"];

// Returns { team } or throws with a clear message. matchId is needed to look up
// the best-third assignment.
function resolveSlot(placeholder: string, matchId: string, errors: string[]): string {
  // "1st Group A" / "2nd Group B"
  const direct = placeholder.match(/^(1st|2nd|3rd|4th) Group ([A-L])$/);
  if (direct) {
    const pos = POS_LABEL.indexOf(direct[1]);
    const grp = direct[2] as Group;
    return STANDINGS[grp][pos];
  }

  // "Best 3rd (A/B/C/D/F)"
  const best = placeholder.match(/^Best 3rd \(([A-L/]+)\)$/);
  if (best) {
    const allowed = best[1].split("/") as Group[];
    const grp = BEST_THIRDS[matchId];
    if (!grp) {
      errors.push(`${matchId}: missing BEST_THIRDS entry for "${placeholder}" (allowed: ${allowed.join("/")})`);
      return placeholder;
    }
    if (!allowed.includes(grp)) {
      errors.push(`${matchId}: BEST_THIRDS = ${grp}, but slot "${placeholder}" only allows ${allowed.join("/")}`);
      return placeholder;
    }
    return STANDINGS[grp][2];
  }

  errors.push(`${matchId}: unrecognised placeholder "${placeholder}"`);
  return placeholder;
}

function validateStandings(errors: string[]) {
  const groups = Object.keys(STANDINGS) as Group[];
  if (groups.length !== 12) errors.push(`STANDINGS must have 12 groups, found ${groups.length}`);
  for (const g of groups) {
    const teams = STANDINGS[g];
    if (teams.length !== 4) errors.push(`Group ${g}: expected 4 teams, found ${teams.length}`);
    if (new Set(teams).size !== teams.length) errors.push(`Group ${g}: duplicate team in standings`);
    for (const t of teams) {
      if (!(t in FLAG_MAP)) errors.push(`Group ${g}: "${t}" not in FLAG_MAP — flag would fall back to 🏳️ (typo?)`);
    }
  }
  // Best-third groups must be distinct (a 3rd-place team can fill only one slot)
  const usedThirds = Object.values(BEST_THIRDS);
  const dupes = usedThirds.filter((g, i) => usedThirds.indexOf(g) !== i);
  if (dupes.length) errors.push(`BEST_THIRDS assigns the same group twice: ${[...new Set(dupes)].join(", ")}`);
}

async function main() {
  const commit = process.argv.includes("--commit");
  const errors: string[] = [];

  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const projectId = JSON.parse(readFileSync(join(repoRoot, ".firebaserc"), "utf-8")).projects.default as string;
  const jsonPath = resolve(repoRoot, "data/fifa_world_cup_2026_group_fixtures.json");
  const { matches } = JSON.parse(readFileSync(jsonPath, "utf-8")) as { matches: RawMatch[] };

  validateStandings(errors);

  const r32 = matches.filter((m) => m.stage === "Round of 32");

  const resolved = r32.map((m) => {
    const matchId = `WC2026_${m.match_number.toString().padStart(3, "0")}`;
    const homeTeam = resolveSlot(m.home_team, matchId, errors);
    const awayTeam = resolveSlot(m.away_team, matchId, errors);
    return {
      matchId,
      homePlaceholder: m.home_team,
      awayPlaceholder: m.away_team,
      homeTeam,
      awayTeam,
      homeFlag: flag(homeTeam),
      awayFlag: flag(awayTeam),
    };
  });

  // ── Print the resolved bracket ─────────────────────────────────────────────
  console.log(`\nRound of 32 — resolved bracket (${commit ? "COMMIT" : "DRY RUN"}):\n`);
  for (const r of resolved) {
    console.log(
      `  ${r.matchId}  ${r.homeFlag} ${r.homeTeam.padEnd(22)} vs ${r.awayFlag} ${r.awayTeam}`
    );
    console.log(
      `            ↑ ${r.homePlaceholder.padEnd(20)}        ↑ ${r.awayPlaceholder}`
    );
  }

  if (errors.length) {
    console.error(`\n✗ ${errors.length} problem(s) — nothing written:\n`);
    for (const e of errors) console.error(`   • ${e}`);
    process.exit(1);
  }

  if (!commit) {
    console.log(`\n✓ Dry run OK. Re-run with --commit to write ${resolved.length} matches to Firestore.\n`);
    return;
  }

  // ── Write ──────────────────────────────────────────────────────────────────
  const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
  initializeApp(
    process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? { credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS) }
      : isEmulator
        ? { projectId }
        : { credential: applicationDefault() }
  );
  const db = getFirestore();
  const batch = db.batch();
  for (const r of resolved) {
    batch.update(db.collection("matches").doc(r.matchId), {
      homeTeam: r.homeTeam,
      awayTeam: r.awayTeam,
      homeFlag: r.homeFlag,
      awayFlag: r.awayFlag,
    });
  }
  await batch.commit();
  console.log(`\n✓ Updated ${resolved.length} Round-of-32 matches${isEmulator ? " (emulator)" : ""}.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
