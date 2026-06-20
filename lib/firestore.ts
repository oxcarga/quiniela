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
  predictionsCount: number;
}

export interface Leaderboard {
  updatedAt: Timestamp;
  rankings: LeaderboardEntry[];
}

export interface AdBanner {
  active: boolean;
  previewMode: boolean; // when true, only admins see the banner
  imageUrl: string;
  alt: string;
  modalHtml: string;
  version: string;
  updatedAt: Timestamp;
}

// Per-version interaction counters, written only by the logAdEvent Cloud
// Function. All fields are optional — a counter only exists once its event has
// fired at least once.
export interface AdBannerStats {
  impression?: number;
  impressionUnique?: number;
  bannerClose?: number;
  bannerCloseAfterModal?: number;
  modalOpen?: number;
  modalOpenUnique?: number;
  modalCloseNoClick?: number;
  clickWhatsapp?: number;
  clickWhatsappUnique?: number;
  clickInstagram?: number;
  clickInstagramUnique?: number;
  clickPhone?: number;
  clickPhoneUnique?: number;
  clickOther?: number;
  updatedAt?: Timestamp;
}

// One doc per calendar day (America/Mexico_City) under a version's `days`
// subcollection. Holds event totals only (no uniques).
export interface AdBannerStatsDay {
  date: string;
  [event: string]: number | string;
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

// Reads another user's predictions one match at a time. Security rules only
// permit reading another user's prediction for a match that has already kicked
// off, so this is the read path for the head-to-head comparison. Reads that the
// rules reject (e.g. a match that hasn't started, or clock skew near kickoff)
// are silently skipped rather than failing the whole batch.
export async function getUserPredictionsForMatches(
  userId: string,
  matchIds: string[]
): Promise<Prediction[]> {
  const results = await Promise.allSettled(
    matchIds.map((matchId) =>
      getDoc(doc(db, "predictions", userId, "matches", matchId))
    )
  );
  const predictions: Prediction[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.exists()) {
      predictions.push(r.value.data() as Prediction);
    }
  }
  return predictions;
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

export async function getAdBanner(): Promise<AdBanner | null> {
  const snap = await getDoc(doc(db, "config", "adBanner"));
  if (!snap.exists()) return null;
  return snap.data() as AdBanner;
}

export async function setAdBanner(
  data: Omit<AdBanner, "version" | "updatedAt">
): Promise<void> {
  await setDoc(doc(db, "config", "adBanner"), {
    ...data,
    version: Date.now().toString(),
    updatedAt: serverTimestamp(),
  });
}

export async function getAdBannerStats(
  version: string
): Promise<AdBannerStats | null> {
  const snap = await getDoc(doc(db, "config", "adBanner", "stats", version));
  if (!snap.exists()) return null;
  return snap.data() as AdBannerStats;
}

export async function getAdBannerStatsDays(
  version: string
): Promise<AdBannerStatsDay[]> {
  const snap = await getDocs(
    query(
      collection(db, "config", "adBanner", "stats", version, "days"),
      orderBy("date")
    )
  );
  return snap.docs.map((d) => d.data() as AdBannerStatsDay);
}

export async function getUsers(): Promise<LeaderboardEntry[]> {
  const snap = await getDocs(query(collection(db, "users"), orderBy("displayName", "desc")));
  return snap.docs.map((d, i) => {
    const u = d.data();
    return {
      userId: u.uid as string,
      displayName: u.displayName as string,
      photoURL: (u.photoURL as string | null) ?? null,
      totalScore: (u.totalScore as number) ?? 0,
      predictionsCount: (u.predictionsCount as number) ?? 0,
      position: i + 1,
    };
  });
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
