"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getEffectiveStatus, type Match, type Prediction } from "@/lib/firestore";
import { useSetPrediction } from "@/hooks/usePredictions";

const STATUS_BADGE: Record<Match["status"], { label: string; className: string }> = {
  upcoming: { label: "PRÓXIMAMENTE", className: "bg-blue-100 text-blue-700" },
  locked:   { label: "EN JUEGO",     className: "bg-amber-100 text-amber-700" },
  finished: { label: "FT",           className: "bg-zinc-100 text-zinc-600" },
};

interface Props {
  match: Match;
  prediction?: Prediction;
  highlighted?: boolean;
  userId: string;
}

export default function MatchCard({ match, prediction, highlighted = false, userId }: Props) {
  const effectiveStatus = getEffectiveStatus(match);
  const badge = STATUS_BADGE[effectiveStatus];
  const kickoffFormatted = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(match.kickoffAt.toDate());

  const [showHighlight, setShowHighlight] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [home, setHome] = useState("0");
  const [away, setAway] = useState("0");
  const [formError, setFormError] = useState<string | null>(null);

  const { mutate, isPending } = useSetPrediction(userId, match.matchId);

  useEffect(() => {
    if (!highlighted) return;
    setShowHighlight(true);
    const timer = setTimeout(() => setShowHighlight(false), 4000);
    return () => clearTimeout(timer);
  }, [highlighted]);

  function openForm() {
    setHome(prediction ? String(prediction.predictedHomeGoals) : "0");
    setAway(prediction ? String(prediction.predictedAwayGoals) : "0");
    setFormError(null);
    setFormOpen(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const h = parseInt(home, 10);
    const a = parseInt(away, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      setFormError("Ingresa números válidos ≥ 0.");
      return;
    }
    mutate(
      { homeGoals: h, awayGoals: a },
      {
        onSuccess: () => {
          setFormOpen(false);
          sessionStorage.setItem("highlight:match", match.matchId);
        },
        onError: () => setFormError("Error guardando. Intenta de nuevo."),
      }
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border shadow-sm transition-colors duration-1000 ${
        showHighlight
          ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/40"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      {/* Navigable area */}
      <Link
        href={`/matches/${match.matchId}`}
        onClick={() => sessionStorage.setItem("scroll:matches", String(window.scrollY))}
        className="flex flex-col items-center justify-between px-4 py-5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
      >

        {/* Group + venue */}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {match.group ? ` Grupo ${match.group}` : ""}
          </p>
          <p className="mt-1 text-sm text-zinc-500">{kickoffFormatted}</p>
          <p className="text-xs text-zinc-400">{match.venue}, {match.city}</p>
        </div>

        <div className="flex items-center justify-between px-4 py-3 gap-15">
        <div className="flex w-28 flex-col items-center gap-1">
          <span className="text-3xl">{match.homeFlag}</span>
          <span className="text-center text-sm font-medium leading-tight">{match.homeTeam}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
            {/* match is "finished" OR "locked" */}
            {match.status !== "upcoming" ? (
            <span className="text-2xl font-bold tabular-nums">
              {match?.result?.homeGoals ?? 0} – {match?.result?.awayGoals ?? 0}
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
        </div>
      </Link>

      {/* Prediction area — sibling to Link */}
      <div className="border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
        {formOpen ? (
          <form onSubmit={handleSave} className="flex flex-col items-center gap-2 py-1">
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                value={home}
                onChange={(e) => setHome(e.target.value)}
                disabled={isPending}
                className="w-14 rounded-md border border-zinc-300 bg-white px-2 py-1 text-center text-xl font-bold dark:border-zinc-700 dark:bg-zinc-800"
              />
              <span className="text-xl text-zinc-400">–</span>
              <input
                type="number"
                min={0}
                value={away}
                onChange={(e) => setAway(e.target.value)}
                disabled={isPending}
                className="w-14 rounded-md border border-zinc-300 bg-white px-2 py-1 text-center text-xl font-bold dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            {formError && <p className="text-xs text-red-500">{formError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                disabled={isPending}
                className="rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-full bg-zinc-900 px-3 py-1 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isPending ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        ) : prediction ? (
          <div className="flex flex-col items-center justify-center gap-2">
            <span className="px-3 py-0.5 text-sm font-semibold tabular-nums text-green-700 dark:bg-green-950 dark:text-green-300">
              Tu predicción: 
            </span>
            <span className="rounded-full bg-green-50 px-3 py-0.5 text-lg font-semibold tabular-nums text-green-700 dark:bg-green-950 dark:text-green-300">
              {prediction.predictedHomeGoals} – {prediction.predictedAwayGoals}
            </span>
            {effectiveStatus === "upcoming" && (
              <button
                onClick={openForm}
                className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                Editar
              </button>
            )}
          </div>
        ) : effectiveStatus === "upcoming" ? (
          <div className="flex justify-center">
            <button
              onClick={openForm}
              className="rounded-full bg-blue-600 px-4 py-1 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Predecir
            </button>
          </div>
        ) : (
          <p className="text-center text-sm text-zinc-400">Sin predicción</p>
        )}
      </div>
    </div>
  );
}
