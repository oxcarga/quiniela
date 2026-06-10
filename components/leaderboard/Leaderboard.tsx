"use client";

import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/context/AuthContext";
import LeaderboardRow from "./LeaderboardRow";

export default function Leaderboard() {
  const { data, loading, error } = useLeaderboard();
  const { users, loading: usersLoading, error: usersError } = useUsers();
  const { user } = useAuth();

  // Until any scores exist, fall back to the registered users (by display name).
  const entries = data?.rankings.length ? data.rankings : users;

  if (loading || usersLoading) return <p className="text-center text-sm text-zinc-500">Cargando tabla…</p>;
  if (error || usersError)     return <p className="text-center text-sm text-red-500">Error cargando la tabla.</p>;
  if (!entries.length)         return <p className="text-center text-sm text-zinc-500">Aún no hay participantes.</p>;

  return (
    <div className="flex flex-col gap-1">
      {entries.map((entry) => (
        <LeaderboardRow
          key={entry.userId}
          entry={entry}
          isCurrentUser={entry.userId === user?.uid}
        />
      ))}
    </div>
  );
}
