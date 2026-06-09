import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin";
import { rebuildLeaderboard } from "./leaderboard";

type Outcome = "home" | "away" | "draw";
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

    const { matchId, result } = after as {
      matchId: string;
      result: { homeGoals: number; awayGoals: number };
    };

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

      const newPoints = calculatePoints(
        { home: pred.predictedHomeGoals, away: pred.predictedAwayGoals },
        { home: result.homeGoals, away: result.awayGoals }
      );

      // When re-scoring a finished match, adjust by the delta to avoid double-counting
      const previousPoints = typeof pred.pointsEarned === "number" ? pred.pointsEarned : 0;
      const delta = newPoints - previousPoints;

      batch.update(predDoc.ref, { pointsEarned: newPoints });
      if (delta !== 0) {
        batch.update(db.collection("users").doc(pred.userId as string), {
          totalScore: FieldValue.increment(delta),
        });
      }
    }

    await batch.commit();
    await rebuildLeaderboard();
  }
);
