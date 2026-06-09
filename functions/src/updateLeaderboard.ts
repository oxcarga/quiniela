import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { rebuildLeaderboard } from "./leaderboard";

export const updateLeaderboard = onDocumentUpdated(
  { document: "users/{userId}", region: "us-central1" },
  async () => {
    await rebuildLeaderboard();
  }
);
