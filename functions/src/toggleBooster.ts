import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./admin";

// One booster per user per match-day, where the day is the match kickoff
// date in Mexico City time. Enforced via a per-day registry doc whose key
// is the date string, so the document key itself guarantees "one per day".
function kickoffDay(kickoffAt: Timestamp): string {
  // en-CA renders as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(kickoffAt.toDate());
}

export const toggleBooster = onCall(
  { region: "us-central1" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    }

    const matchId = request.data?.matchId;
    const boosted = request.data?.boosted;
    if (typeof matchId !== "string" || typeof boosted !== "boolean") {
      throw new HttpsError("invalid-argument", "Parámetros inválidos.");
    }

    const matchSnap = await db.collection("matches").doc(matchId).get();
    const match = matchSnap.data();
    if (!matchSnap.exists || !match) {
      throw new HttpsError("not-found", "Partido no encontrado.");
    }
    if (match.status !== "upcoming") {
      throw new HttpsError("failed-precondition", "El partido ya está cerrado.");
    }
    const kickoffAt = match.kickoffAt as Timestamp;
    if (kickoffAt.toMillis() <= Date.now()) {
      throw new HttpsError("failed-precondition", "El partido ya comenzó.");
    }

    const day = kickoffDay(kickoffAt);
    const predRef = db
      .collection("predictions")
      .doc(uid)
      .collection("matches")
      .doc(matchId);
    const dayRef = db
      .collection("users")
      .doc(uid)
      .collection("boosterDays")
      .doc(day);

    await db.runTransaction(async (tx) => {
      const predSnap = await tx.get(predRef);
      if (!predSnap.exists) {
        throw new HttpsError(
          "failed-precondition",
          "Primero haz una predicción para este partido."
        );
      }
      const daySnap = await tx.get(dayRef);

      if (boosted) {
        if (daySnap.exists && daySnap.data()?.matchId !== matchId) {
          throw new HttpsError(
            "failed-precondition",
            "Ya usaste tu refuerzo para este día."
          );
        }
        tx.set(dayRef, { matchId, day });
        tx.update(predRef, { boosted: true });
      } else {
        if (daySnap.exists && daySnap.data()?.matchId === matchId) {
          tx.delete(dayRef);
        }
        tx.update(predRef, { boosted: false });
      }
    });

    return { boosted };
  }
);
