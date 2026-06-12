"use client";

import { Fragment, useState } from "react";
import { X } from "lucide-react";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useUserPredictions, useUserPredictionsForMatches } from "@/hooks/usePredictions";
import { useMatches } from "@/hooks/useMatches";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { getEffectiveStatus, type Match, type Prediction } from "@/lib/firestore";

function pointsBadge(points: number, boosted?: boolean): { label: string; className: string } {
  const label = `${points} ${points === 1 ? "pt" : "pts"}${boosted ? " ⚡" : ""}`;
  if (points === 0) return { label, className: "bg-zinc-100 text-zinc-500" };
  if (boosted) return { label, className: "bg-amber-100 text-amber-700" };
  return { label, className: "bg-green-100 text-green-700" };
}

function PredictionRow({
  prediction,
  match,
  comparisonName,
}: {
  prediction: Prediction;
  match: Match;
  comparisonName?: string;
}) {
  const isComparison = comparisonName !== undefined;
  const effectiveStatus = getEffectiveStatus(match);
  const kickoffFormatted = new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(match.kickoffAt.toDate());

  const badge = prediction.pointsEarned !== null
    ? pointsBadge(prediction.pointsEarned, prediction.boosted)
    : null;

  return (
    <div
      className={`relative flex items-center gap-3 rounded-xl border px-4 py-3 ${
        isComparison
          ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      {prediction.boosted && (
        <span
          title="Refuerzo aplicado (×2)"
          className="absolute left-0 top-0 flex h-5 w-5 items-center justify-center rounded-br-lg rounded-tl-xl bg-amber-100 text-xs text-amber-700 dark:bg-amber-900 dark:text-amber-300"
        >
          ⚡
        </span>
      )}
      {/* Teams / comparison name */}
      <div className="flex flex-1 flex-col gap-0.5">
        {isComparison ? (
          <span className="text-sm font-medium text-green-800 font-semibold text-right px-10">{comparisonName}</span>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row items-left gap-2 text-sm font-medium">
              <div className="flex gap-2">
                <span>{match.homeFlag}</span>
                <span>{match.homeTeam}</span>
              </div>
              <span className="px-8 text-zinc-400">vs</span>
              <div className="flex gap-2">
                <span>{match.awayFlag}</span>
                <span>{match.awayTeam}</span>
              </div>
            </div>
            <span className="text-xs text-zinc-400">{kickoffFormatted}</span>
          </>
        )}
      </div>

      {/* Prediction */}
      <div className="flex flex-col items-center">
        <span className="text-xs text-zinc-400">Predicción</span>
        <span className="tabular-nums font-semibold">
          {prediction.predictedHomeGoals} – {prediction.predictedAwayGoals}
        </span>
      </div>

      {/* Result */}
      {effectiveStatus === "finished" && match.result && (
        <div className={`flex flex-col items-center ${isComparison ? "invisible" : ""}`}>
          <span className="text-xs text-zinc-400">Resultado</span>
          <span className="tabular-nums font-semibold">
            {match.result.homeGoals} – {match.result.awayGoals}
          </span>
        </div>
      )}

      {/* Points */}
      <div className="w-30 text-right">
        {effectiveStatus === "finished" ? (
          badge ? (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
              {badge.label}
            </span>
          ) : (
            <span className="text-xs text-zinc-400">…</span>
          )
        ) : (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            effectiveStatus === "locked"
              ? "bg-amber-100 text-amber-700"
              : "bg-blue-100 text-blue-700"
          }`}>
            {effectiveStatus === "locked" ? "EN JUEGO" : "PRONTO"}
          </span>
        )}
      </div>
    </div>
  );
}

function RankingDropdown({
  currentUserId,
  selectedId,
  onSelect,
}: {
  currentUserId?: string;
  selectedId: string | null;
  onSelect: (user: { id: string; name: string } | null) => void;
}) {
  const { data: leaderboard } = useLeaderboard();
  const [open, setOpen] = useState(false);
  const rankings = (leaderboard?.rankings ?? []).filter((e) => e.userId !== currentUserId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        {selectedId
          ? `Comparando: ${rankings.find((e) => e.userId === selectedId)?.displayName ?? ""}`
          : "Comparar con:"}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>

      {open && (
        <>
          {/* Click-away overlay */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 max-h-80 w-64 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            {selectedId && (
              <div
                onClick={() => {
                  onSelect(null);
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" /> Quitar comparación
              </div>
            )}
            {rankings.length === 0 ? (
              <p className="px-3 py-2 text-xs text-zinc-500">Sin datos aún.</p>
            ) : (
              rankings.map((entry) => (
                <div
                  key={entry.userId}
                  onClick={() => {
                    onSelect({ id: entry.userId, name: entry.displayName });
                    setOpen(false);
                  }}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                    selectedId === entry.userId
                      ? "bg-green-50 dark:bg-green-900/40"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span className="w-5 shrink-0 text-right tabular-nums text-zinc-400">
                    {entry.position}
                  </span>
                  <span className="flex-1 truncate">{entry.displayName}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{entry.totalScore}</span>
                  <span className="shrink-0 text-xs text-zinc-400">pts</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ProfileContent() {
  const { user, signOut, setDisplayName } = useAuth();
  // Always refetch on visit so freshly scored points/results show without a refresh
  const { data: predictions, isLoading: loadingPreds } = useUserPredictions(
    user?.uid ?? null,
    { refetchOnMount: "always", staleTime: 0 }
  );
  const { data: matches, isLoading: loadingMatches } = useMatches(undefined, {
    refetchOnMount: "always",
    staleTime: 0,
  });

  const matchMap = new Map<string, Match>(matches?.map((m) => [m.matchId, m]) ?? []);

  const [compareUser, setCompareUser] = useState<{ id: string; name: string } | null>(null);

  // Only the matches I predicted that have already kicked off are comparable —
  // security rules forbid reading another user's pick for an upcoming match.
  const comparableMatchIds = (predictions ?? [])
    .filter((p) => {
      const m = matchMap.get(p.matchId);
      return m && getEffectiveStatus(m) !== "upcoming";
    })
    .map((p) => p.matchId);

  const { data: comparePredictions } = useUserPredictionsForMatches(
    compareUser?.id ?? null,
    comparableMatchIds
  );
  const comparePredMap = new Map<string, Prediction>(
    (comparePredictions ?? []).map((p) => [p.matchId, p])
  );

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);

  function openNameEdit() {
    setNameInput(user?.displayName ?? "");
    setNameError(null);
    setEditingName(true);
  }

  async function saveDisplayName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) { setNameError("El nombre no puede estar vacío."); return; }
    setNameSaving(true);
    try {
      await setDisplayName(trimmed);
      setEditingName(false);
    } catch {
      setNameError("Error guardando. Intenta de nuevo.");
    } finally {
      setNameSaving(false);
    }
  }

  const isLoading = loadingPreds || loadingMatches;

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
        <div className="flex-1 min-w-0">
          {editingName ? (
            <form onSubmit={saveDisplayName} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  disabled={nameSaving}
                  className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm font-bold dark:border-zinc-700 dark:bg-zinc-800"
                />
                <button
                  type="submit"
                  disabled={nameSaving}
                  className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {nameSaving ? "…" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  disabled={nameSaving}
                  className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
              </div>
              {nameError && <p className="text-xs text-red-500">{nameError}</p>}
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold truncate">{user?.displayName}</p>
              <button
                onClick={openNameEdit}
                aria-label="Editar nombre"
                className="cursor-pointer text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L2.317 11.21a1.75 1.75 0 0 0-.5 1.018l-.325 2.6a.75.75 0 0 0 .83.83l2.6-.325a1.75 1.75 0 0 0 1.018-.5l8.697-8.696a1.75 1.75 0 0 0 0-2.474l-.149-.15Z" />
                </svg>
              </button>
            </div>
          )}
          <p className="text-sm text-zinc-500 truncate">{user?.email}</p>
        </div>
        <button
          onClick={signOut}
          className="rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 shrink-0"
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

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Mis predicciones
        </h2>
        <RankingDropdown
          currentUserId={user?.uid}
          selectedId={compareUser?.id ?? null}
          onSelect={setCompareUser}
        />
      </div>

      {isLoading && <p className="text-center text-sm text-zinc-500">Cargando…</p>}
      {!isLoading && rows.length === 0 && (
        <p className="text-center text-sm text-zinc-500">Aún no tienes predicciones.</p>
      )}

      <div className="flex flex-col gap-2">
        {rows.map(({ prediction, match }) => {
          // Only reveal the other user's prediction once the match has kicked off,
          // so upcoming predictions aren't leaked.
          const comparePred =
            compareUser && getEffectiveStatus(match) !== "upcoming"
              ? comparePredMap.get(match.matchId)
              : undefined;

          return (
            <Fragment key={prediction.matchId}>
              <PredictionRow prediction={prediction} match={match} />
              {compareUser && comparePred && (
                <PredictionRow
                  prediction={comparePred}
                  match={match}
                  comparisonName={compareUser.name}
                />
              )}
            </Fragment>
          );
        })}
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
