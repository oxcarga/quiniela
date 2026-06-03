import { onSchedule } from "firebase-functions/v2/scheduler";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./admin";

// Maps football-data.org team names to the names used in our Firestore
const FD_TEAM_MAP: Record<string, string> = {
  "Korea Republic": "South Korea",
  "Bosnia and Herzegovina": "Bosnia",
  "Ivory Coast": "Côte d'Ivoire",
  "Congo DR": "DR Congo",
  "Cape Verde Islands": "Cabo Verde",
  "Turkey": "Türkiye",
};

function normalizeTeam(name: string): string {
  return FD_TEAM_MAP[name] ?? name;
}

interface FdScore {
  home: number | null;
  away: number | null;
}

interface FdMatch {
  status: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  score: {
    fullTime: FdScore;
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
  };
}

async function fetchFinishedMatches(date: string): Promise<FdMatch[]> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) return [];

  const url =
    `https://api.football-data.org/v4/competitions/WC/matches` +
    `?dateFrom=${date}&dateTo=${date}&status=FINISHED`;

  const res = await fetch(url, { headers: { "X-Auth-Token": apiKey } });
  if (!res.ok) return [];

  const data = (await res.json()) as { matches: FdMatch[] };
  return data.matches ?? [];
}

export const updateMatchStatus = onSchedule("every 5 minutes", async () => {
  const now = Timestamp.now();

  // Lock matches that have kicked off
  const upcomingSnap = await db
    .collection("matches")
    .where("status", "==", "upcoming")
    .where("kickoffAt", "<=", now)
    .get();

  if (!upcomingSnap.empty) {
    const batch = db.batch();
    upcomingSnap.docs.forEach((d) => batch.update(d.ref, { status: "locked" }));
    await batch.commit();
  }

  // Fetch results for locked matches that are 115+ minutes past kickoff
  // (90 min match + 25 min buffer for stoppage time)
  const cutoff = Timestamp.fromMillis(now.toMillis() - 115 * 60 * 1000);

  const lockedSnap = await db
    .collection("matches")
    .where("status", "==", "locked")
    .where("kickoffAt", "<=", cutoff)
    .get();

  if (lockedSnap.empty) return;

  // Group locked matches by date to minimise API calls (1 call per day)
  const byDate: Record<string, typeof lockedSnap.docs[0][]> = {};
  for (const doc of lockedSnap.docs) {
    const kickoffAt = doc.data().kickoffAt as Timestamp;
    const date = kickoffAt.toDate().toISOString().slice(0, 10);
    (byDate[date] ??= []).push(doc);
  }

  for (const [date, docs] of Object.entries(byDate)) {
    const fdMatches = await fetchFinishedMatches(date);
    if (fdMatches.length === 0) continue;

    const batch = db.batch();

    for (const doc of docs) {
      const { homeTeam, awayTeam } = doc.data() as {
        homeTeam: string;
        awayTeam: string;
      };

      const fdMatch = fdMatches.find(
        (m) =>
          normalizeTeam(m.homeTeam.name) === homeTeam &&
          normalizeTeam(m.awayTeam.name) === awayTeam
      );

      if (!fdMatch || fdMatch.score.fullTime.home === null) continue;

      const homeGoals = fdMatch.score.fullTime.home;
      const awayGoals = fdMatch.score.fullTime.away!;
      const winner =
        fdMatch.score.winner === "HOME_TEAM"
          ? "home"
          : fdMatch.score.winner === "AWAY_TEAM"
            ? "away"
            : "draw";

      batch.update(doc.ref, {
        status: "finished",
        result: { homeGoals, awayGoals, winner },
      });
    }

    await batch.commit();
  }
});
