"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePrediction, useSetPrediction, useToggleBooster } from "@/hooks/usePredictions";
import type { Match } from "@/lib/firestore";

const schema = z.object({
  homeGoals: z.number().int().min(0),
  awayGoals: z.number().int().min(0),
});

interface Props {
  match: Match;
  userId: string;
}

export default function PredictionForm({ match, userId }: Props) {
  const { data: existing, isLoading } = usePrediction(userId, match.matchId);
  const { mutate, isPending } = useSetPrediction(userId, match.matchId);
  const { mutate: toggleBoost, isPending: isBoosting } = useToggleBooster(
    userId,
    match.matchId
  );

  const [home, setHome] = useState("0");
  const [away, setAway] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [boostError, setBoostError] = useState<string | null>(null);

  function handleToggleBoost() {
    setBoostError(null);
    toggleBoost(!existing?.boosted, {
      onError: (err) =>
        setBoostError(
          err instanceof Error ? err.message : "No se pudo aplicar el refuerzo."
        ),
    });
  }

  useEffect(() => {
    if (existing) {
      setHome(String(existing.predictedHomeGoals));
      setAway(String(existing.predictedAwayGoals));
    }
  }, [existing]);

  const isLocked = match.status !== "upcoming";

  if (isLocked && !isLoading && !existing) {
    return <p className="text-center text-sm text-zinc-400">Sin predicción</p>;
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const result = schema.safeParse({
      homeGoals: Number(home),
      awayGoals: Number(away),
    });
    if (!result.success) {
      setError("Ingresa un resultado válido (números enteros ≥ 0).");
      return;
    }
    mutate(
      { homeGoals: result.data.homeGoals, awayGoals: result.data.awayGoals },
      {
        onSuccess: () => {
          sessionStorage.setItem("highlight:match", match.matchId);
          setSaved(true);
        },
        onError: () => setError("Error guardando la predicción. Intenta de nuevo."),
      }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-medium">{match.homeTeam}</span>
          <Input
            type="number"
            min={0}
            value={home}
            onChange={(e) => { setHome(e.target.value); setSaved(false); }}
            disabled={isLocked || isPending}
            className="w-16 text-center text-xl font-bold"
          />
        </div>
        <span className="text-xl font-semibold text-zinc-400">–</span>
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-medium">{match.awayTeam}</span>
          <Input
            type="number"
            min={0}
            value={away}
            onChange={(e) => { setAway(e.target.value); setSaved(false); }}
            disabled={isLocked || isPending}
            className="w-16 text-center text-xl font-bold"
          />
        </div>
      </div>

      {error && <p className="text-center text-sm text-red-500">{error}</p>}
      {saved && <p className="text-center text-sm text-green-600">¡Predicción guardada!</p>}

      {isLocked ? (
        <p className="text-center text-sm text-zinc-500">
          {match.status === "locked" ? "Predicciones cerradas." : "Partido terminado."}
        </p>
      ) : (
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Guardando…" : existing ? "Actualizar predicción" : "Guardar predicción"}
        </Button>
      )}

      {/* Match booster — only once a prediction exists and the match is open */}
      {!isLocked && existing && (
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={handleToggleBoost}
            disabled={isBoosting}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
              existing.boosted
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "border border-amber-400 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
            }`}
          >
            {isBoosting
              ? "…"
              : existing.boosted
                ? "⚡ Refuerzo activo (×2) — toca para quitar"
                : "⚡ Reforzar este partido (×2)"}
          </button>
          <p className="text-center text-xs text-zinc-400">
            Un refuerzo por día. Duplica los puntos de este partido.
          </p>
          {boostError && (
            <p className="text-center text-xs text-red-500">{boostError}</p>
          )}
        </div>
      )}
    </form>
  );
}
