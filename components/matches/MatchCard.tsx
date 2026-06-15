"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { getEffectiveStatus, type Match, type Prediction } from "@/lib/firestore";
import { useSetPrediction, useToggleBooster } from "@/hooks/usePredictions";
import rankingsByName from "@/data/fifa_world_ranking_men_by_name.json";
import FormDots from "./FormDots";
import { Flag } from "@/components/Flag";

const STATUS_BADGE: Record<Match["status"], { label: string; className: string }> = {
  upcoming: { label: "PRONTO",       className: "bg-blue-100 text-blue-700" },
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
  const [boostError, setBoostError] = useState<string | null>(null);

  const { mutate, isPending } = useSetPrediction(userId, match.matchId);
  const { mutate: toggleBoost, isPending: isBoosting } = useToggleBooster(
    userId,
    match.matchId
  );

  function handleToggleBoost() {
    setBoostError(null);
    toggleBoost(!prediction?.boosted, {
      onError: (err) =>
        setBoostError(
          err instanceof Error ? err.message : "No se pudo aplicar el refuerzo."
        ),
    });
  }

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
      className={`relative overflow-hidden rounded-xl border transition-colors duration-1000 ${
        showHighlight
          ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/40"
          : effectiveStatus === "finished"
            ? "border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/30"
            : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      {/* Top accent line for finished matches */}
      {effectiveStatus === "finished" && (
        <div className="h-1 bg-gradient-to-r from-green-200 via-green-600 to-green-200 dark:from-green-400 dark:via-green-400 dark:to-green-500" />
      )}
      {effectiveStatus === "locked" && (
        <div className="h-1 bg-gradient-to-r from-yellow-200 via-yellow-600 to-yellow-200 dark:from-yellow-400 dark:via-yellow-400 dark:to-yellow-500" />
      )}

      {/* Checkmark badge for finished matches */}
      {effectiveStatus === "finished" && (
        <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 ring-2 ring-green-500">
          <Check className="h-4 w-4 text-zinc-50 dark:text-green-400" strokeWidth={4} />
        </div>
      )}

      {/* Navigable area */}
      <Link
        href={`/matches/${match.matchId}`}
        onClick={() => sessionStorage.setItem("scroll:matches", String(window.scrollY))}
        className="flex flex-col items-center justify-between px-3 py-5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
      >

        {/* Group + venue */}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {match.group ? ` Grupo ${match.group}` : ""}
          </p>
          <p className="mt-1 text-sm text-zinc-500">{kickoffFormatted}</p>
          <p className="text-xs text-zinc-400">{match.venue}, {match.city}</p>
        </div>

        <div className="flex items-center justify-between px-0 py-3 gap-2">
          <div className="relative flex w-28 flex-col items-center gap-1">
            <Flag emoji={match.homeFlag} size={40} />
            <span className="text-center text-sm font-medium leading-tight">{match.homeTeam}</span>
            {rankingsByName[match.homeTeam as keyof typeof rankingsByName] && (
              <span className="text-xs text-zinc-400">
                #{rankingsByName[match.homeTeam as keyof typeof rankingsByName].ranking}
              </span>
            )}
            <FormDots results={rankingsByName[match.homeTeam as keyof typeof rankingsByName]?.last_results} />
          </div>

          <div className="flex flex-col items-center gap-1">
            {/* match is "finished" OR "locked" */}
            {match.status !== "upcoming" ? (
              <span className="text-xl font-bold tabular-nums">
                {match?.result?.homeGoals ?? 0} – {match?.result?.awayGoals ?? 0}
              </span>
            ) : (
              <span className="text-lg font-semibold text-zinc-400">vs</span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${badge.className}`}>
              {badge.label}
            </span>
          </div>

          <div className="relative flex w-28 flex-col items-center gap-1">
            <Flag emoji={match.awayFlag} size={40} />
            <span className="text-center text-sm font-medium leading-tight">{match.awayTeam}</span>
            {rankingsByName[match.awayTeam as keyof typeof rankingsByName] && (
              <span className="text-xs text-zinc-400">
                #{rankingsByName[match.awayTeam as keyof typeof rankingsByName].ranking}
              </span>
            )}
            <FormDots results={rankingsByName[match.awayTeam as keyof typeof rankingsByName]?.last_results} />
          </div>
        </div>
      </Link>

      {/* Prediction area — sibling to Link */}
      <div className={`border-t border-zinc-200 dark:border-zinc-800 ${
        effectiveStatus === "finished" ? "px-4 py-2" : "px-4 py-4"
      }`}>
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
          <div className={`flex ${effectiveStatus === "finished" ? "items-center justify-center gap-2" : "flex-col items-center justify-center gap-2"}`}>
            {effectiveStatus !== "finished" && (
              <span className="px-3 py-0.5 text-sm font-semibold tabular-nums text-green-700 dark:bg-green-950 dark:text-green-300">
                Tu predicción:
              </span>
            )}
            <span className={`flex items-center gap-2 rounded-full ${effectiveStatus === "finished" ? "bg-green-50/50 px-2 py-0.5 text-sm" : "bg-green-50 px-3 py-0.5 text-lg"} font-semibold tabular-nums text-green-700 dark:bg-green-950 dark:text-green-300`}>
              {prediction.predictedHomeGoals} – {prediction.predictedAwayGoals}
              {prediction.boosted && (
                <span className="rounded-full bg-amber-100 px-1.5 text-xs font-bold text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                  ⚡×2
                </span>
              )}
            </span>
            {effectiveStatus === "finished" && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                prediction.pointsEarned
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
              }`}>
                {prediction.pointsEarned != null ? `+${prediction.pointsEarned} pts` : "0 pts"}
                {prediction.boosted && prediction.pointsEarned ? " (×2)" : ""}
              </span>
            )}
            {effectiveStatus === "upcoming" && (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-3">
                  <button
                    onClick={openForm}
                    className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    Editar
                  </button>
                  <button
                    onClick={handleToggleBoost}
                    disabled={isBoosting}
                    className={`cursor-pointer rounded-full px-2 py-0.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      prediction.boosted
                        ? "bg-amber-500 text-white hover:bg-amber-600"
                        : "border border-amber-400 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                    }`}
                  >
                    {isBoosting ? "…" : prediction.boosted ? "⚡ Refuerzo activo" : "⚡ Reforzar ×2"}
                  </button>
                </div>
                {boostError && (
                  <p className="text-center text-xs text-red-500">{boostError}</p>
                )}
              </div>
            )}
          </div>
        ) : effectiveStatus === "upcoming" ? (
          <div className="flex justify-center">
            <button
              onClick={openForm}
              className="cursor-pointer rounded-full bg-blue-600 px-4 py-1 text-sm font-semibold text-white hover:bg-blue-700"
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
