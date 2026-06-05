import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin";

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

export const scoreMatch = onDocumentUpdated("matches/{matchId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  // Only run when status transitions to "finished"
  if (!after || after.status !== "finished" || before?.status === "finished") return;

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
    if (typeof pred.predictedHomeGoals !== "number") continue; // not a prediction doc

    const points = calculatePoints(
      { home: pred.predictedHomeGoals, away: pred.predictedAwayGoals },
      { home: result.homeGoals, away: result.awayGoals }
    );

    batch.update(predDoc.ref, { pointsEarned: points });
    batch.update(db.collection("users").doc(pred.userId as string), {
      totalScore: FieldValue.increment(points),
    });
  }

  await batch.commit();
});
