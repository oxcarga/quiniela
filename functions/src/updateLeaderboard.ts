import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { db } from "./admin";

// CF-3: Rebuild /leaderboard/current after any user totalScore changes
export const updateLeaderboard = onDocumentUpdated("users/{userId}", async () => {
  const usersSnap = await db.collection("users").orderBy("totalScore", "desc").get();

  const rankings = usersSnap.docs.map((doc, i) => {
    const u = doc.data();
    return {
      userId: u.uid as string,
      displayName: u.displayName as string,
      photoURL: (u.photoURL as string | null) ?? null,
      totalScore: u.totalScore as number,
      position: i + 1,
    };
  });

  await db
    .collection("leaderboard")
    .doc("current")
    .set({ updatedAt: new Date(), rankings });
});
