import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { rebuildLeaderboard } from "./leaderboard";

export const updateLeaderboard = onDocumentUpdated(
  { document: "users/{userId}", region: "us-central1" },
  async () => {
    await rebuildLeaderboard();
  }
);

// onDocumentUpdated does not fire when a brand-new user doc is written, so new
// users never made it into leaderboard/current. Rebuild on create too.
export const updateLeaderboardOnUserCreate = onDocumentCreated(
  { document: "users/{userId}", region: "us-central1" },
  async () => {
    await rebuildLeaderboard();
  }
);
