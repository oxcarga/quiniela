"use client";

import { Fragment, useState } from "react";
import { Info, X } from "lucide-react";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useUserPredictions, useMultiUserPredictionsForMatches } from "@/hooks/usePredictions";
import { useMatches } from "@/hooks/useMatches";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { getEffectiveStatus, type Match, type Prediction } from "@/lib/firestore";
import { Flag } from "@/components/Flag";

type StatusFilter = "all" | Match["status"];

type CompareUser = { id: string; name: string };

type CompareColor = { border: string; bg: string; text: string; dot: string };

// One distinct color per compared user, assigned by selection order. Classes are
// written out in full so Tailwind keeps them in the build.
const COMPARE_COLORS: CompareColor[] = [
  { border: "border-green-200 dark:border-green-900",  bg: "bg-green-50 dark:bg-green-950/30",   text: "text-green-800 dark:text-green-300",  dot: "bg-green-500" },
  { border: "border-blue-200 dark:border-blue-900",    bg: "bg-blue-50 dark:bg-blue-950/30",     text: "text-blue-800 dark:text-blue-300",    dot: "bg-blue-500" },
  { border: "border-purple-200 dark:border-purple-900",bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-800 dark:text-purple-300",dot: "bg-purple-500" },
  { border: "border-orange-200 dark:border-orange-900",bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-800 dark:text-orange-300",dot: "bg-orange-500" },
  { border: "border-pink-200 dark:border-pink-900",    bg: "bg-pink-50 dark:bg-pink-950/30",     text: "text-pink-800 dark:text-pink-300",    dot: "bg-pink-500" },
];

function compareColor(index: number): CompareColor {
  return COMPARE_COLORS[index % COMPARE_COLORS.length];
}

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all",      label: "Todos" },
  { value: "upcoming", label: "Próximos" },
  { value: "locked",   label: "En juego" },
  { value: "finished", label: "Finalizados" },
];

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
  comparisonColor,
}: {
  prediction: Prediction;
  match: Match;
  comparisonName?: string;
  comparisonColor?: CompareColor;
}) {
  const isComparison = comparisonName !== undefined;
  const color = comparisonColor ?? COMPARE_COLORS[0];
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
          ? `${color.border} ${color.bg}`
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
          <span className={`text-sm font-semibold text-right px-10 ${color.text}`}>{comparisonName}</span>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row items-left gap-2 text-sm font-medium">
              <div className="flex gap-2">
                <Flag emoji={match.homeFlag} size={[20, 15]} />
                <span>{match.homeTeam}</span>
              </div>
              <span className="px-8 text-zinc-400">vs</span>
              <div className="flex gap-2">
                <Flag emoji={match.awayFlag} size={[20, 15]} />
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
  selectedIds,
  onToggle,
  onClear,
  onSelectAll,
}: {
  currentUserId?: string;
  selectedIds: string[];
  onToggle: (user: CompareUser) => void;
  onClear: () => void;
  onSelectAll: (users: CompareUser[]) => void;
}) {
  const { data: leaderboard } = useLeaderboard();
  const [open, setOpen] = useState(false);
  const rankings = (leaderboard?.rankings ?? []).filter((e) => e.userId !== currentUserId);

  const label =
    selectedIds.length === 0
      ? "Comparar con:"
      : selectedIds.length === 1
        ? `Comparando: ${rankings.find((e) => e.userId === selectedIds[0])?.displayName ?? ""}`
        : `Comparando: ${selectedIds.length}`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        {label}
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
          {/* Click-away overlay — closes only when clicking outside the list */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 max-h-80 w-64 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            {selectedIds.length > 0 && (
              <div
                onClick={onClear}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" /> Quitar comparación
              </div>
            )}
            {rankings.length > 0 && (() => {
              const allSelected = rankings.every((e) => selectedIds.includes(e.userId));
              return (
                <div
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (allSelected) {
                      onClear();
                    } else {
                      onSelectAll(rankings.map((e) => ({ id: e.userId, name: e.displayName })));
                    }
                  }}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      allSelected
                        ? "bg-zinc-500 border-transparent text-white"
                        : "border-zinc-300 dark:border-zinc-600"
                    }`}
                  >
                    {allSelected && (
                      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                        <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-6.5 6.5a.75.75 0 0 1-1.06 0l-3.25-3.25a.75.75 0 1 1 1.06-1.06l2.72 2.72 5.97-5.97a.75.75 0 0 1 1.06 0Z" />
                      </svg>
                    )}
                  </span>
                  Seleccionar todos
                </div>
              );
            })()}
            {rankings.length === 0 ? (
              <p className="px-3 py-2 text-xs text-zinc-500">Sin datos aún.</p>
            ) : (
              rankings.map((entry) => {
                const selectedIndex = selectedIds.indexOf(entry.userId);
                const isSelected = selectedIndex !== -1;
                return (
                  <div
                    key={entry.userId}
                    onClick={() =>
                      onToggle({ id: entry.userId, name: entry.displayName })
                    }
                    className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                      isSelected
                        ? "bg-zinc-50 dark:bg-zinc-800/60"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        isSelected
                          ? `${compareColor(selectedIndex).dot} border-transparent text-white`
                          : "border-zinc-300 dark:border-zinc-600"
                      }`}
                    >
                      {isSelected && (
                        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-6.5 6.5a.75.75 0 0 1-1.06 0l-3.25-3.25a.75.75 0 1 1 1.06-1.06l2.72 2.72 5.97-5.97a.75.75 0 0 1 1.06 0Z" />
                        </svg>
                      )}
                    </span>
                    <span className="w-5 shrink-0 text-right tabular-nums text-zinc-400">
                      {entry.position}
                    </span>
                    <span className="flex-1 truncate">{entry.displayName}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{entry.totalScore}</span>
                    <span className="shrink-0 text-xs text-zinc-400">pts</span>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  info,
  align = "center",
  corner = "",
}: {
  label: string;
  value: string;
  info?: string;
  align?: "left" | "center" | "right";
  corner?: string;
}) {
  const [open, setOpen] = useState(false);

  // Anchor the tooltip inward on edge columns so it doesn't overflow the screen.
  const tooltipPosition =
    align === "left"
      ? "left-0"
      : align === "right"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

  return (
    <div className={`relative flex flex-col items-center bg-white px-2 py-4 dark:bg-zinc-900 ${corner}`}>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      <span className="flex items-center gap-1 text-center text-xs text-zinc-500">
        {label}
        {info && (
          <button
            type="button"
            aria-label={`¿Qué es "${label}"?`}
            onClick={() => setOpen((o) => !o)}
            className="cursor-pointer text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        )}
      </span>

      {info && open && (
        <>
          {/* Click-away overlay closes the tooltip */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className={`absolute top-full z-30 mb-1 w-52 rounded-lg border border-zinc-200 bg-white p-2.5 text-left text-xs font-normal leading-snug text-zinc-600 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 ${tooltipPosition}`}
          >
            {info}
          </div>
        </>
      )}
    </div>
  );
}

function ProfileContent() {
  const { user, signOut, setDisplayName } = useAuth();
  const { data: predictions, isLoading: loadingPreds } = useUserPredictions(
    user?.uid ?? null,
    { staleTime: 60_000 }
  );
  const { data: matches, isLoading: loadingMatches } = useMatches(undefined, {
    staleTime: 60_000,
  });

  const matchMap = new Map<string, Match>(matches?.map((m) => [m.matchId, m]) ?? []);

  const [compareUsers, setCompareUsers] = useState<CompareUser[]>([]);

  function toggleCompareUser(u: CompareUser) {
    setCompareUsers((prev) =>
      prev.some((p) => p.id === u.id)
        ? prev.filter((p) => p.id !== u.id)
        : [...prev, u]
    );
  }

  // Only the matches I predicted that have already kicked off are comparable —
  // security rules forbid reading another user's pick for an upcoming match.
  const comparableMatchIds = (predictions ?? [])
    .filter((p) => {
      const m = matchMap.get(p.matchId);
      return m && getEffectiveStatus(m) !== "upcoming";
    })
    .map((p) => p.matchId);

  // userId -> Map(matchId -> their prediction), one entry per compared user.
  const comparePredsByUser = useMultiUserPredictionsForMatches(
    compareUsers.map((u) => u.id),
    comparableMatchIds
  );
  const comparePredMapByUser = new Map<string, Map<string, Prediction>>(
    compareUsers.map((u) => [
      u.id,
      new Map((comparePredsByUser[u.id] ?? []).map((p) => [p.matchId, p])),
    ])
  );

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
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
    .filter((r) => statusFilter === "all" || getEffectiveStatus(r.match) === statusFilter)
    .sort((a, b) => a.match.kickoffAt.toMillis() - b.match.kickoffAt.toMillis());

  const totalEarned = (predictions ?? [])
    .reduce((sum, p) => sum + (p.pointsEarned ?? 0), 0);

  const predicted = (predictions ?? []).length;
  const scored = (predictions ?? []).filter((p) => p.pointsEarned !== null).length;

  // Played predictions (match finished with a result), ordered by kickoff so we
  // can measure streaks. Everything below is derived, not read from Firestore.
  const playedRows = (predictions ?? [])
    .map((p) => ({ prediction: p, match: matchMap.get(p.matchId) }))
    .filter((r): r is { prediction: Prediction; match: Match } =>
      !!r.match &&
      getEffectiveStatus(r.match) === "finished" &&
      !!r.match.result &&
      r.prediction.pointsEarned !== null
    )
    .sort((a, b) => a.match.kickoffAt.toMillis() - b.match.kickoffAt.toMillis());

  const exactScores = playedRows.filter(
    ({ prediction, match }) =>
      prediction.predictedHomeGoals === match.result!.homeGoals &&
      prediction.predictedAwayGoals === match.result!.awayGoals
  ).length;

  const correctOutcomes = playedRows.filter(
    ({ prediction }) => (prediction.pointsEarned ?? 0) > 0
  ).length;

  const hitRate = scored > 0 ? Math.round((correctOutcomes / scored) * 100) : 0;
  const avgPoints = scored > 0 ? totalEarned / scored : 0;

  // Longest run of consecutive scoring predictions (by kickoff order).
  let bestStreak = 0;
  let currentRun = 0;
  for (const { prediction } of playedRows) {
    if ((prediction.pointsEarned ?? 0) > 0) {
      currentRun += 1;
      bestStreak = Math.max(bestStreak, currentRun);
    } else {
      currentRun = 0;
    }
  }

  const boostsUsed = playedRows.filter(({ prediction }) => prediction.boosted).length;
  const boostsHit = playedRows.filter(
    ({ prediction }) => prediction.boosted && (prediction.pointsEarned ?? 0) > 0
  ).length;

  const stats: Array<{ label: string; value: string; info?: string }> = [
    {
      label: "puntos totales",
      value: String(totalEarned),
      info: "Todos los puntos que has ganado. Cada partido da 3 puntos por resultado exacto, 2 por acertar un empate y 1 por acertar el ganador. Los refuerzos (⚡) duplican los puntos de ese partido.",
    },
    {
      label: "aciertos exactos",
      value: String(exactScores),
      info: "Partidos en los que acertaste el marcador exacto (goles de local y visitante). Es el criterio de desempate en la clasificación cuando dos usuarios tienen los mismos puntos.",
    },
    {
      label: "% de acierto",
      value: `${hitRate}%`,
      info: "Porcentaje de partidos jugados en los que ganaste al menos 1 punto (acertaste el ganador, el empate o el marcador exacto).",
    },
    {
      label: "media de puntos",
      value: avgPoints.toFixed(1),
      info: "Promedio de puntos que ganas por partido jugado (puntos totales ÷ partidos jugados). Sirve para comparar tu rendimiento con quien ha jugado más o menos partidos que tú.",
    },
    {
      label: "mejor racha",
      value: String(bestStreak),
      info: "La mayor cantidad de partidos seguidos (por orden de inicio) en los que ganaste al menos 1 punto.",
    },
    {
      label: "refuerzos acertados",
      value: boostsUsed > 0 ? `${boostsHit}/${boostsUsed}` : "—",
      info: "Refuerzos (⚡) que dieron puntos frente al total de refuerzos que usaste. Un refuerzo duplica los puntos de ese partido, así que conviene usarlo donde más aciertas.",
    },
  ];

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

      {/* Stats grid. No `overflow-hidden` here so tooltips can escape — the four
          corner cells round themselves to keep the outer rounded-xl shape. */}
      <div className="mb-2 grid grid-cols-3 gap-px rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
        {stats.map((s, i) => {
          const cols = 3;
          const lastRowStart = Math.floor((stats.length - 1) / cols) * cols;
          const corner = [
            i === 0 && "rounded-tl-xl",
            i === cols - 1 && "rounded-tr-xl",
            i === lastRowStart && "rounded-bl-xl",
            i === stats.length - 1 && "rounded-br-xl",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <StatTile
              key={s.label}
              label={s.label}
              value={s.value}
              info={s.info}
              // 3-column grid: anchor edge columns' tooltips inward.
              align={i % cols === 0 ? "left" : i % cols === 2 ? "right" : "center"}
              corner={corner}
            />
          );
        })}
      </div>
      <p className="mb-6 text-center text-xs text-zinc-400">
        {predicted} predicciones · {scored} partidos jugados
      </p>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Mis predicciones
        </h2>
        <RankingDropdown
          currentUserId={user?.uid}
          selectedIds={compareUsers.map((u) => u.id)}
          onToggle={toggleCompareUser}
          onClear={() => setCompareUsers([])}
          onSelectAll={(users) => setCompareUsers(users)}
        />
      </div>

      {/* Status filter pill */}
      <div className="mb-4 flex flex-wrap justify-start">
        <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-800">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={`cursor-pointer rounded-full px-3 py-1 text-sm font-medium transition ${
                statusFilter === s.value
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-white"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-center text-sm text-zinc-500">Cargando…</p>}
      {!isLoading && rows.length === 0 && (
        <p className="text-center text-sm text-zinc-500">
          {statusFilter === "all"
            ? "Aún no tienes predicciones."
            : "No hay predicciones en este filtro."}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {rows.map(({ prediction, match }) => {
          // Only reveal other users' predictions once the match has kicked off,
          // so upcoming predictions aren't leaked.
          const revealed = getEffectiveStatus(match) !== "upcoming";

          return (
            <Fragment key={prediction.matchId}>
              <PredictionRow prediction={prediction} match={match} />
              {revealed &&
                compareUsers.map((cu, i) => {
                  const comparePred = comparePredMapByUser
                    .get(cu.id)
                    ?.get(match.matchId);
                  if (!comparePred) return null;
                  return (
                    <PredictionRow
                      key={cu.id}
                      prediction={comparePred}
                      match={match}
                      comparisonName={cu.name}
                      comparisonColor={compareColor(i)}
                    />
                  );
                })}
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
