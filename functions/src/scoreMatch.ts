import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin";
import { rebuildLeaderboard } from "./leaderboard";

type Outcome = "home" | "away" | "draw";
type Match = {
  matchId: string;
  result: { homeGoals: number; awayGoals: number };
};
function outcome(home: number, away: number): Outcome {
  return home > away ? "home" : away > home ? "away" : "draw";
}

function calculatePoints(
  predicted: { home: number; away: number },
  actual: { home: number; away: number }
): number {
  if (predicted.home === actual.home && predicted.away === actual.away) return 3;
  if (predicted.home === predicted.away && actual.home === actual.away) return 2;
  return outcome(predicted.home, predicted.away) === outcome(actual.home, actual.away)
    ? 1
    : 0;
}

export const scoreMatch = onDocumentUpdated(
  { document: "matches/{matchId}", region: "us-central1" },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!after || after.status !== "finished") return;

    // Skip if already finished and the result hasn't changed (idempotency guard)
    const resultChanged =
      JSON.stringify(before?.result) !== JSON.stringify(after.result);
    if (before?.status === "finished" && !resultChanged) return;

    const { matchId, result } = after as Match;

    // collectionGroup("matches") searches /predictions/{userId}/matches as well as
    // the top-level /matches collection — skip docs that aren't predictions
    const predictionsSnap = await db
      .collectionGroup("matches")
      .where("matchId", "==", matchId)
      .get();

    if (predictionsSnap.empty) return;

    const batch = db.batch();

    for (const predDoc of predictionsSnap.docs) {
      const pred = predDoc.data();
      if (typeof pred.predictedHomeGoals !== "number") continue;

      const basePoints = calculatePoints(
        { home: pred.predictedHomeGoals, away: pred.predictedAwayGoals },
        { home: result.homeGoals, away: result.awayGoals }
      );
      // Match booster (I-6): a boosted prediction earns double points
      const newPoints = pred.boosted === true ? basePoints * 2 : basePoints;

      // An exact-score hit (base 3 pts, ignoring the booster multiplier) — used as
      // the leaderboard tiebreaker between users level on totalScore.
      const exactHit = basePoints === 3;

      // When re-scoring a finished match, adjust by the delta to avoid double-counting
      const previousPoints = typeof pred.pointsEarned === "number" ? pred.pointsEarned : 0;
      const delta = newPoints - previousPoints;

      const previousExact = pred.exactHit === true ? 1 : 0;
      const exactDelta = (exactHit ? 1 : 0) - previousExact;

      batch.update(predDoc.ref, { pointsEarned: newPoints, exactHit });
      if (delta !== 0 || exactDelta !== 0) {
        const userUpdate: Record<string, FirebaseFirestore.FieldValue> = {};
        if (delta !== 0) userUpdate.totalScore = FieldValue.increment(delta);
        if (exactDelta !== 0) userUpdate.exactCount = FieldValue.increment(exactDelta);
        batch.update(db.collection("users").doc(pred.userId as string), userUpdate);
      }
    }

    await batch.commit();
    await rebuildLeaderboard();
  }
);
