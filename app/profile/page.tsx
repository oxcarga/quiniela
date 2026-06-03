"use client";

import ProtectedRoute from "@/components/layout/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useUserPredictions } from "@/hooks/usePredictions";
import { useMatches } from "@/hooks/useMatches";
import type { Match, Prediction } from "@/lib/firestore";

const POINTS_BADGE: Record<number, { label: string; className: string }> = {
  3: { label: "3 pts", className: "bg-green-100 text-green-700" },
  2: { label: "2 pts", className: "bg-emerald-100 text-emerald-700" },
  1: { label: "1 pt",  className: "bg-yellow-100 text-yellow-700" },
  0: { label: "0 pts", className: "bg-zinc-100 text-zinc-500" },
};

function PredictionRow({ prediction, match }: { prediction: Prediction; match: Match }) {
  const kickoffFormatted = new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(match.kickoffAt.toDate());

  const badge = prediction.pointsEarned !== null ? POINTS_BADGE[prediction.pointsEarned] : null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Teams */}
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span>{match.homeFlag}</span>
          <span>{match.homeTeam}</span>
          <span className="text-zinc-400">vs</span>
          <span>{match.awayTeam}</span>
          <span>{match.awayFlag}</span>
        </div>
        <span className="text-xs text-zinc-400">{kickoffFormatted}</span>
      </div>

      {/* Prediction */}
      <div className="flex flex-col items-center">
        <span className="text-xs text-zinc-400">Predicción</span>
        <span className="tabular-nums font-semibold">
          {prediction.predictedHomeGoals} – {prediction.predictedAwayGoals}
        </span>
      </div>

      {/* Result */}
      {match.status === "finished" && match.result && (
        <div className="flex flex-col items-center">
          <span className="text-xs text-zinc-400">Resultado</span>
          <span className="tabular-nums font-semibold">
            {match.result.homeGoals} – {match.result.awayGoals}
          </span>
        </div>
      )}

      {/* Points */}
      <div className="w-14 text-right">
        {match.status === "finished" ? (
          badge ? (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
              {badge.label}
            </span>
          ) : (
            <span className="text-xs text-zinc-400">…</span>
          )
        ) : (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            match.status === "locked"
              ? "bg-amber-100 text-amber-700"
              : "bg-blue-100 text-blue-700"
          }`}>
            {match.status === "locked" ? "EN JUEGO" : "PRÓXIMO"}
          </span>
        )}
      </div>
    </div>
  );
}

function ProfileContent() {
  const { user, signOut } = useAuth();
  const { data: predictions, isLoading: loadingPreds } = useUserPredictions(user?.uid ?? null);
  const { data: matches, isLoading: loadingMatches } = useMatches();

  const isLoading = loadingPreds || loadingMatches;

  const matchMap = new Map<string, Match>(matches?.map((m) => [m.matchId, m]) ?? []);

  const rows = (predictions ?? [])
    .map((p) => ({ prediction: p, match: matchMap.get(p.matchId) }))
    .filter((r): r is { prediction: Prediction; match: Match } => !!r.match)
    .sort((a, b) => a.match.kickoffAt.toMillis() - b.match.kickoffAt.toMillis());

  const totalEarned = (predictions ?? [])
    .reduce((sum, p) => sum + (p.pointsEarned ?? 0), 0);

  const predicted = (predictions ?? []).length;
  const scored = (predictions ?? []).filter((p) => p.pointsEarned !== null).length;

  const initials = (user?.displayName ?? "?")
    .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      {/* User header */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xl font-bold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
          {user?.photoURL
            ? <img src={user.photoURL} alt="" className="h-14 w-14 rounded-full object-cover" />
            : initials}
        </div>
        <div className="flex-1">
          <p className="text-lg font-bold">{user?.displayName}</p>
          <p className="text-sm text-zinc-500">{user?.email}</p>
        </div>
        <button
          onClick={signOut}
          className="rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Cerrar sesión
        </button>
      </div>

      {/* Stats bar */}
      <div className="mb-6 flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-1 flex-col items-center">
          <span className="text-2xl font-bold">{totalEarned}</span>
          <span className="text-xs text-zinc-500">puntos totales</span>
        </div>
        <div className="w-px bg-zinc-200 dark:bg-zinc-700" />
        <div className="flex flex-1 flex-col items-center">
          <span className="text-2xl font-bold">{predicted}</span>
          <span className="text-xs text-zinc-500">predicciones</span>
        </div>
        <div className="w-px bg-zinc-200 dark:bg-zinc-700" />
        <div className="flex flex-1 flex-col items-center">
          <span className="text-2xl font-bold">{scored}</span>
          <span className="text-xs text-zinc-500">partidos jugados</span>
        </div>
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
        Mis predicciones
      </h2>

      {isLoading && <p className="text-center text-sm text-zinc-500">Cargando…</p>}
      {!isLoading && rows.length === 0 && (
        <p className="text-center text-sm text-zinc-500">Aún no tienes predicciones.</p>
      )}

      <div className="flex flex-col gap-2">
        {rows.map(({ prediction, match }) => (
          <PredictionRow key={prediction.matchId} prediction={prediction} match={match} />
        ))}
      </div>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
