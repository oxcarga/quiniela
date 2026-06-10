import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { Timestamp } from "firebase-admin/firestore";
import { Resend } from "resend";
import { db } from "./admin";

// Costa Rica is UTC-6 year-round (no DST), matching the kickoff times the
// matches are seeded with. The schedule below runs at 23:59 in this zone.
const APP_TZ = "America/Costa_Rica";
const APP_URL = process.env.APP_URL ?? "https://predicciones.app";
const FROM = "Quiniela Mundial 2026 <noreply@predicciones.app>";

interface MatchDoc {
  homeTeam: string;
  awayTeam: string;
  homeFlag?: string;
  awayFlag?: string;
}

// Returns the [start, end) window covering "tomorrow" in Costa Rica local time,
// expressed as UTC Timestamps for querying `kickoffAt`.
function tomorrowWindow(now: Date): { start: Timestamp; end: Timestamp } {
  // Today's calendar date in CR (YYYY-MM-DD).
  const todayCr = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  // CR midnight == 06:00 UTC. Step forward one day for "tomorrow".
  const start = new Date(`${todayCr}T06:00:00Z`);
  start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };
}

function buildHtml(displayName: string, pending: MatchDoc[]): string {
  const greeting = displayName ? `Hola ${displayName},` : "Hola,";
  const list = pending
    .map(
      (m) =>
        `<li style="margin:0 0 6px">${m.homeFlag ?? ""} <strong>${m.homeTeam}</strong>` +
        ` vs <strong>${m.awayTeam}</strong> ${m.awayFlag ?? ""}</li>`
    )
    .join("");

  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:600">Quiniela Mundial 2026</h2>
      <p style="margin:0 0 16px;color:#555;font-size:15px">
        ${greeting} todavía no has registrado tus predicciones para los partidos de mañana:
      </p>
      <ul style="margin:0 0 24px;padding-left:20px;color:#333;font-size:15px">${list}</ul>
      <a
        href="${APP_URL}/matches"
        style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:15px;font-weight:500"
      >
        Hacer mis predicciones
      </a>
      <p style="margin:24px 0 0;color:#999;font-size:13px">
        Recuerda que cada partido se cierra al momento del saque inicial.
      </p>
    </div>
  `;
}

export const sendPredictionReminders = onSchedule(
  { schedule: "0 19 * * *", timeZone: APP_TZ, region: "us-central1" },
  async () => {
    if (!process.env.RESEND_API_KEY) {
      logger.warn("RESEND_API_KEY is not set — skipping reminder emails.");
      return;
    }

    // Constructed here (not at module scope) so loading the module to discover
    // functions doesn't throw when the key isn't injected yet.
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { start, end } = tomorrowWindow(new Date());

    // 1. Matches kicking off tomorrow (CR time).
    const matchesSnap = await db
      .collection("matches")
      .where("kickoffAt", ">=", start)
      .where("kickoffAt", "<", end)
      .get();

    if (matchesSnap.empty) {
      logger.info("No matches scheduled for tomorrow — nothing to remind.");
      return;
    }

    const matchById = new Map<string, MatchDoc>(
      matchesSnap.docs.map((d) => [d.id, d.data() as MatchDoc])
    );
    const tomorrowMatchIds = [...matchById.keys()];

    // 2. Every prediction for those matches, in a single collection-group query.
    //    `in` supports up to 30 values — a single match day never approaches that.
    const predsSnap = await db
      .collectionGroup("matches")
      .where("matchId", "in", tomorrowMatchIds)
      .get();

    // collectionGroup("matches") also matches the top-level /matches collection,
    // so keep only real prediction docs (they carry userId + a numeric score).
    const predictedByUser = new Map<string, Set<string>>();
    for (const doc of predsSnap.docs) {
      const p = doc.data();
      if (typeof p.userId !== "string" || typeof p.predictedHomeGoals !== "number") {
        continue;
      }
      const set = predictedByUser.get(p.userId) ?? new Set<string>();
      set.add(p.matchId as string);
      predictedByUser.set(p.userId, set);
    }

    // 3. Find users missing at least one of tomorrow's predictions.
    const usersSnap = await db.collection("users").get();

    const sends = usersSnap.docs.flatMap((userDoc) => {
      const u = userDoc.data();
      const email = u.email as string | undefined;
      if (!email) return [];

      // const allowed = ["oxcargasa@gmail.com", "oscargaritasalas@gmail.com"];
      // if (!allowed.includes(email)) {
      //   return [];
      // }

      const predicted = predictedByUser.get(u.uid as string) ?? new Set<string>();
      const pending = tomorrowMatchIds.filter((id) => !predicted.has(id));
      if (pending.length === 0) return [];

      const pendingMatches = pending.map((id) => matchById.get(id)!);
      return [
        resend.emails
          .send({
            from: FROM,
            to: email,
            subject: "⚽ No olvides tus predicciones de mañana",
            html: buildHtml((u.displayName as string) ?? "", pendingMatches),
          })
          .then(({ error }) => {
            if (error) throw error;
          }),
      ];
    });

    if (sends.length === 0) {
      logger.info("All users are up to date — no reminders to send.");
      return;
    }

    const results = await Promise.allSettled(sends);
    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - sent;
    logger.info(`Prediction reminders: ${sent} sent, ${failed} failed.`, {
      matchCount: tomorrowMatchIds.length,
    });
  }
);
