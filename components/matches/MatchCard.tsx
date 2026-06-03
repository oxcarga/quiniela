"use client";

import Link from "next/link";
import type { Match } from "@/lib/firestore";

const STATUS_BADGE: Record<Match["status"], { label: string; className: string }> = {
  upcoming: { label: "PRÓXIMO", className: "bg-blue-100 text-blue-700" },
  locked:   { label: "EN JUEGO", className: "bg-amber-100 text-amber-700" },
  finished: { label: "FT", className: "bg-zinc-100 text-zinc-600" },
};

interface Props {
  match: Match;
}

export default function MatchCard({ match }: Props) {
  const badge = STATUS_BADGE[match.status];
  const kickoffFormatted = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(match.kickoffAt.toDate());

  return (
    <Link
      href={`/matches/${match.matchId}`}
      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
    >
      <div className="flex w-28 flex-col items-center gap-1">
        <span className="text-3xl">{match.homeFlag}</span>
        <span className="text-center text-sm font-medium leading-tight">{match.homeTeam}</span>
      </div>

      <div className="flex flex-col items-center gap-1">
        {match.status === "finished" && match.result ? (
          <span className="text-2xl font-bold tabular-nums">
            {match.result.homeGoals} – {match.result.awayGoals}
          </span>
        ) : (
          <span className="text-lg font-semibold text-zinc-400">vs</span>
        )}
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
          {badge.label}
        </span>
        <span className="text-xs text-zinc-500">{kickoffFormatted}</span>
      </div>

      <div className="flex w-28 flex-col items-center gap-1">
        <span className="text-3xl">{match.awayFlag}</span>
        <span className="text-center text-sm font-medium leading-tight">{match.awayTeam}</span>
      </div>
    </Link>
  );
}
