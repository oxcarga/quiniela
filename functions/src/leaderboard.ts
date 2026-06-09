import { db } from "./admin";

export async function rebuildLeaderboard(): Promise<void> {
  const usersSnap = await db.collection("users").get();

  const rankings = usersSnap.docs
    .map((doc) => {
      const u = doc.data();
      return {
        userId: u.uid as string,
        displayName: u.displayName as string,
        photoURL: (u.photoURL as string | null) ?? null,
        totalScore: (u.totalScore as number) ?? 0,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((entry, i) => ({ ...entry, position: i + 1 }));

  await db.collection("leaderboard").doc("current").set({
    updatedAt: new Date(),
    rankings,
  });
}
