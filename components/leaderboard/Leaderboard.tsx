"use client";

import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useAuth } from "@/context/AuthContext";
import LeaderboardRow from "./LeaderboardRow";

export default function Leaderboard() {
  const { data, loading, error } = useLeaderboard();
  const { user } = useAuth();

  if (loading) return <p className="text-center text-sm text-zinc-500">Cargando tabla…</p>;
  if (error)   return <p className="text-center text-sm text-red-500">Error cargando la tabla.</p>;
  if (!data?.rankings.length) return <p className="text-center text-sm text-zinc-500">Aún no hay participantes.</p>;

  return (
    <div className="flex flex-col gap-1">
      {data.rankings.map((entry) => (
        <LeaderboardRow
          key={entry.userId}
          entry={entry}
          isCurrentUser={entry.userId === user?.uid}
        />
      ))}
    </div>
  );
}
