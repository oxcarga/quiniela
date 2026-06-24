"use client";

import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/context/AuthContext";
import LeaderboardRow from "./LeaderboardRow";

// Each tie group (users sharing a score) gets a distinct badge color, cycled in order.
const TIE_COLORS = [
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
];

export default function Leaderboard() {
  const { data, loading, error } = useLeaderboard();
  const { users, loading: usersLoading, error: usersError } = useUsers();
  const { user } = useAuth();

  // Until any scores exist, fall back to the registered users (by display name).
  const entries = data?.rankings.length ? data.rankings : users;

  if (loading || usersLoading) return <p className="text-center text-sm text-zinc-500">Cargando tabla…</p>;
  if (error || usersError)     return <p className="text-center text-sm text-red-500">Error cargando la tabla.</p>;
  if (!entries.length)         return <p className="text-center text-sm text-zinc-500">Aún no hay participantes.</p>;

  // A score is "tied" when more than one user shares it — only then is the exact-score
  // tiebreaker meaningful, so we surface the exact count just for those rows.
  const scoreCounts = entries.reduce<Record<number, number>>((acc, e) => {
    acc[e.totalScore] = (acc[e.totalScore] ?? 0) + 1;
    return acc;
  }, {});

  // Give every distinct tie group its own color (highest score → first color).
  const tiedScores = [...new Set(entries.map((e) => e.totalScore))]
    .filter((score) => scoreCounts[score] > 1)
    .sort((a, b) => b - a);
  const colorByScore = new Map<number, string>(
    tiedScores.map((score, i) => [score, TIE_COLORS[i % TIE_COLORS.length]])
  );

  return (
    <div className="flex flex-col gap-1">
      {entries.map((entry) => (
        <LeaderboardRow
          key={entry.userId}
          entry={entry}
          isCurrentUser={entry.userId === user?.uid}
          exactColorClass={colorByScore.get(entry.totalScore)}
        />
      ))}
    </div>
  );
}
