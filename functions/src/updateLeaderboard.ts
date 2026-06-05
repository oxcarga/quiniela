import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { db } from "./admin";

export const updateLeaderboard = onDocumentUpdated(
  { document: "users/{userId}", region: "us-central1" },
  async () => {
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
  }
);
