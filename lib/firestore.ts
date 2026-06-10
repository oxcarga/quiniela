import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
  type QueryConstraint,
  type Timestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";

export interface Match {
  matchId: string;
  phase: "group" | "round_of_32" | "round_of_16" | "quarter" | "semi" | "third_place" | "final";
  group?: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  kickoffAt: Timestamp;
  status: "upcoming" | "locked" | "finished";
  venue?: string;
  city?: string;
  result?: {
    homeGoals: number;
    awayGoals: number;
    winner?: "home" | "away" | "draw";
  };
}

export interface Prediction {
  userId: string;
  matchId: string;
  predictedHomeGoals: number;
  predictedAwayGoals: number;
  submittedAt: Timestamp;
  pointsEarned: number | null;
  boosted?: boolean;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  photoURL: string | null;
  totalScore: number;
  position: number;
}

export interface Leaderboard {
  updatedAt: Timestamp;
  rankings: LeaderboardEntry[];
}

export function getEffectiveStatus(match: Match): Match["status"] {
  if (match.status === "finished") return "finished";
  if (Date.now() >= match.kickoffAt.toMillis()) return "locked";
  return match.status;
}

export async function getMatch(matchId: string): Promise<Match | null> {
  const snap = await getDoc(doc(db, "matches", matchId));
  if (!snap.exists()) return null;
  return { matchId: snap.id, ...snap.data() } as Match;
}

export async function getMatches(phase?: Match["phase"]): Promise<Match[]> {
  const constraints: QueryConstraint[] = phase
    ? [where("phase", "==", phase), orderBy("kickoffAt")]
    : [orderBy("kickoffAt")];
  const snap = await getDocs(query(collection(db, "matches"), ...constraints));
  return snap.docs.map((d) => ({ matchId: d.id, ...d.data() }) as Match);
}

export async function getPrediction(
  userId: string,
  matchId: string
): Promise<Prediction | null> {
  const snap = await getDoc(doc(db, "predictions", userId, "matches", matchId));
  if (!snap.exists()) return null;
  return snap.data() as Prediction;
}

export async function getUserPredictions(userId: string): Promise<Prediction[]> {
  const snap = await getDocs(collection(db, "predictions", userId, "matches"));
  return snap.docs.map((d) => d.data() as Prediction);
}

export async function setPrediction(
  userId: string,
  matchId: string,
  predictedHomeGoals: number,
  predictedAwayGoals: number
): Promise<void> {
  // merge: true preserves the `boosted` flag (managed by the toggleBooster
  // Cloud Function) across prediction edits
  await setDoc(
    doc(db, "predictions", userId, "matches", matchId),
    {
      userId,
      matchId,
      predictedHomeGoals,
      predictedAwayGoals,
      submittedAt: serverTimestamp(),
      pointsEarned: null,
    },
    { merge: true }
  );
}

export async function setMatchResult(
  matchId: string,
  homeGoals: number,
  awayGoals: number,
  matchEnded: boolean
): Promise<void> {
  const winner =
    homeGoals > awayGoals ? "home" : awayGoals > homeGoals ? "away" : "draw";
  await updateDoc(doc(db, "matches", matchId), {
    status: matchEnded ? "finished" : "locked",
    result: { homeGoals, awayGoals, winner },
  });
}

export async function getLeaderboard(): Promise<Leaderboard | null> {
  const snap = await getDoc(doc(db, "leaderboard", "current"));
  if (!snap.exists()) return null;
  return snap.data() as Leaderboard;
}

export async function toggleBooster(
  matchId: string,
  boosted: boolean
): Promise<void> {
  const callable = httpsCallable<
    { matchId: string; boosted: boolean },
    { boosted: boolean }
  >(functions, "toggleBooster");
  await callable({ matchId, boosted });
}

export async function getUserByEmail(email: string): Promise<boolean> {
  const res = await fetch("/api/auth/check-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error("Error verificando el correo");
  const { exists } = await res.json();
  return exists as boolean;
}
