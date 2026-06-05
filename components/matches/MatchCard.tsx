"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Match, Prediction } from "@/lib/firestore";

const STATUS_BADGE: Record<Match["status"], { label: string; className: string }> = {
  upcoming: { label: "PRÓXIMAMENTE", className: "bg-blue-100 text-blue-700" },
  locked:   { label: "EN JUEGO", className: "bg-amber-100 text-amber-700" },
  finished: { label: "FT", className: "bg-zinc-100 text-zinc-600" },
};

interface Props {
  match: Match;
  prediction?: Prediction;
  highlighted?: boolean;
}

export default function MatchCard({ match, prediction, highlighted = false }: Props) {
  const badge = STATUS_BADGE[match.status];
  const kickoffFormatted = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(match.kickoffAt.toDate());

  const [showHighlight, setShowHighlight] = useState(false);

  useEffect(() => {
    if (!highlighted) return;
    setShowHighlight(true);
    const timer = setTimeout(() => setShowHighlight(false), 4000);
    return () => clearTimeout(timer);
  }, [highlighted]);

  return (
    <Link
      href={`/matches/${match.matchId}`}
      onClick={() => sessionStorage.setItem("scroll:matches", String(window.scrollY))}
      className={`flex items-center justify-between rounded-xl border px-4 py-3 shadow-sm transition-colors duration-1000 hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
        showHighlight
          ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/40"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
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
        {prediction ? (
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-lg font-semibold tabular-nums text-green-700 dark:bg-green-950 dark:text-green-300">
            {prediction.predictedHomeGoals} – {prediction.predictedAwayGoals}
          </span>
        ) : (
          <span className="text-sm font-medium text-red-400">Sin predicción</span>
        )}
      </div>

      <div className="flex w-28 flex-col items-center gap-1">
        <span className="text-3xl">{match.awayFlag}</span>
        <span className="text-center text-sm font-medium leading-tight">{match.awayTeam}</span>
      </div>
    </Link>
  );
}
