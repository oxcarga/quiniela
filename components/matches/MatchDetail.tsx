"use client";

import Link from "next/link";
import { useMatch } from "@/hooks/useMatches";
import { useAuth } from "@/context/AuthContext";
import { usePrediction } from "@/hooks/usePredictions";
import PredictionForm from "./PredictionForm";
import type { Match } from "@/lib/firestore";

const PHASE_LABEL: Record<Match["phase"], string> = {
  group:        "Fase de Grupos",
  round_of_32:  "Ronda de 32",
  round_of_16:  "Octavos de Final",
  quarter:      "Cuartos de Final",
  semi:         "Semifinales",
  third_place:  "Tercer Lugar",
  final:        "Final",
};

const STATUS_BADGE: Record<Match["status"], { label: string; className: string }> = {
  upcoming: { label: "PRÓXIMAMENTE",  className: "bg-blue-100 text-blue-700" },
  locked:   { label: "EN JUEGO", className: "bg-amber-100 text-amber-700" },
  finished: { label: "FT",       className: "bg-zinc-100 text-zinc-600" },
};

export default function MatchDetail({ matchId }: { matchId: string }) {
  const { data: match, isLoading, error } = useMatch(matchId);
  const { user } = useAuth();
  const { data: prediction } = usePrediction(user?.uid ?? null, matchId);

  if (isLoading) return <p className="text-center text-sm text-zinc-500">Cargando…</p>;
  if (error || !match) return <p className="text-center text-sm text-red-500">Partido no encontrado.</p>;

  const badge = STATUS_BADGE[match.status];
  const kickoffFormatted = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month:   "long",
    day:     "numeric",
    hour:    "2-digit",
    minute:  "2-digit",
  }).format(match.kickoffAt.toDate());

  return (
    <div className="flex flex-col gap-6">
      <Link href="/matches" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        ← Todos los partidos
      </Link>

      {/* Phase + venue */}
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {PHASE_LABEL[match.phase]}{match.group ? ` · Grupo ${match.group}` : ""}
        </p>
        <p className="mt-1 text-sm text-zinc-500">{kickoffFormatted}</p>
        <p className="text-xs text-zinc-400">{match.venue}, {match.city}</p>
      </div>

      {/* Teams + score */}
      <div className="flex items-center justify-center gap-6">
        <div className="flex w-28 flex-col items-center gap-1">
          <span className="text-5xl">{match.homeFlag}</span>
          <span className="text-center font-semibold">{match.homeTeam}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          {match.status !== "upcoming" ? (
            <span className="text-4xl font-bold tabular-nums">
              {match?.result?.homeGoals ?? 0} – {match?.result?.awayGoals || 0}
            </span>
          ) : (
            <span className="text-2xl font-semibold text-zinc-400">vs</span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        <div className="flex w-28 flex-col items-center gap-1">
          <span className="text-5xl">{match.awayFlag}</span>
          <span className="text-center font-semibold">{match.awayTeam}</span>
        </div>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      {/* Prediction section */}
      <div>
        <h2 className="mb-4 text-center text-lg font-semibold">Tu predicción</h2>
        {user && <PredictionForm match={match} userId={user.uid} />}

        {/* Points summary after match finishes */}
        {match.status === "finished" && prediction && (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">Predijiste</p>
            <p className="text-2xl font-bold tabular-nums">
              {prediction.predictedHomeGoals} – {prediction.predictedAwayGoals}
            </p>
            <p className="mt-2 text-lg font-semibold">
              {prediction.pointsEarned !== null ? (
                <span className={prediction.pointsEarned > 0 ? "text-green-600" : "text-zinc-400"}>
                  {prediction.pointsEarned} {prediction.pointsEarned === 1 ? "punto" : "puntos"}
                </span>
              ) : (
                <span className="text-zinc-400 text-sm">Calculando puntos…</span>
              )}
            </p>
          </div>
        )}

        {match.status === "finished" && !prediction && (
          <p className="mt-4 text-center text-sm text-zinc-400">No hiciste una predicción para este partido.</p>
        )}
      </div>
    </div>
  );
}
