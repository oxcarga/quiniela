"use client";

import { useEffect, useState } from "react";
import { useMatches } from "@/hooks/useMatches";
import { useUserPredictions } from "@/hooks/usePredictions";
import { useAuth } from "@/context/AuthContext";
import { useAppStore } from "@/store/useAppStore";
import MatchCard from "./MatchCard";
import { getEffectiveStatus, type Match } from "@/lib/firestore";
import { ListFilter } from "lucide-react";

const PHASE_ORDER: Match["phase"][] = [
  "group", "round_of_32", "round_of_16", "quarter", "semi", "third_place", "final",
];

const PHASE_LABEL: Record<Match["phase"], string> = {
  group:        "Fase de Grupos",
  round_of_32:  "Ronda de 32",
  round_of_16:  "Octavos de Final",
  quarter:      "Cuartos de Final",
  semi:         "Semifinales",
  third_place:  "Tercer Lugar",
  final:        "Final",
};

const FILTERS: Array<{ value: Match["phase"] | null; label: string }> = [
  { value: null,          label: "Todos" },
  { value: "group",       label: "Grupos" },
  { value: "round_of_32", label: "Ronda 32" },
  { value: "round_of_16", label: "Octavos" },
  { value: "quarter",     label: "Cuartos" },
  { value: "semi",        label: "Semis" },
  { value: "third_place", label: "3er Lugar" },
  { value: "final",       label: "Final" },
];

type StatusFilter = "all" | Match["status"];

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all",      label: "Todos" },
  { value: "upcoming", label: "Próximos" },
  { value: "locked",   label: "En juego" },
  { value: "finished", label: "Finalizados" },
];

type PredictionFilter = "all" | "predicted" | "unpredicted";

const PREDICTION_FILTERS: Array<{ value: PredictionFilter; label: string }> = [
  { value: "all",         label: "Todos" },
  { value: "predicted",   label: "Predichos" },
  { value: "unpredicted", label: "Sin predecir" },
];

export default function MatchList() {
  const { user } = useAuth();
  const { matchPhaseFilter, setMatchPhaseFilter } = useAppStore();
  const { data: matches, isLoading, error } = useMatches(matchPhaseFilter ?? undefined);
  const { data: predictions } = useUserPredictions(user?.uid ?? null);
  const [highlightedMatchId, setHighlightedMatchId] = useState<string | null>(null);
  const [predictionFilter, setPredictionFilter] = useState<PredictionFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [filtersVisible, setFiltersVisible] = useState<boolean>(false);

  useEffect(() => {
    const scroll = sessionStorage.getItem("scroll:matches");
    const highlight = sessionStorage.getItem("highlight:match");

    if (scroll) {
      sessionStorage.removeItem("scroll:matches");
      requestAnimationFrame(() =>
        requestAnimationFrame(() => window.scrollTo(0, parseInt(scroll)))
      );
    }

    if (highlight) {
      sessionStorage.removeItem("highlight:match");
      setHighlightedMatchId(highlight);
    }
  }, []);

  const predictionByMatchId = new Map(
    (predictions ?? []).map((p) => [p.matchId, p])
  );

  const filteredMatches = (matches ?? []).filter((m) => {
    if (statusFilter !== "all" && getEffectiveStatus(m) !== statusFilter) return false;
    if (predictionFilter === "predicted") return predictionByMatchId.has(m.matchId);
    if (predictionFilter === "unpredicted") return !predictionByMatchId.has(m.matchId);
    return true;
  });

  const grouped = filteredMatches.reduce<Partial<Record<Match["phase"], Match[]>>>((acc, m) => {
    (acc[m.phase] ??= []).push(m);
    return acc;
  }, {});

  function toggleFilters () {
    setFiltersVisible(!filtersVisible)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filter controls */}
      <div className="flex flex-col items-start justify-between gap-4">
        {/* Phase filter */}
        <div className="flex flex-wrap gap-2 cursor-pointer">
          {FILTERS.map((f) => (
            <button
              key={String(f.value)}
              onClick={() => setMatchPhaseFilter(f.value)}
              className={`cursor-pointer rounded-full px-3 py-1 text-sm font-medium transition ${
                matchPhaseFilter === f.value
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>


        <div className="w-full flex flex-wrap justify-end items-center gap-2">
          <button
            onClick={toggleFilters}
            aria-pressed={filtersVisible}
            title="Mostrar filtros"
            className={`cursor-pointer rounded-full p-2 transition-colors ${
              filtersVisible
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-900 hover:bg-zinc-100 dark:text-white dark:hover:bg-zinc-800"
            }`}
          >
            <ListFilter className="h-4 w-4" />
          </button>
        </div>

        {/* Status + prediction filter pills */}
        <div className={`w-full flex flex-wrap justify-end items-center gap-2 ${!filtersVisible ? "hidden" : ""}`}>
          {/* Status filter pill */}
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

        {/* Prediction filter pill */}
        <div className={`w-full flex flex-wrap justify-end items-center gap-2 ${!filtersVisible ? "hidden" : ""}`}>
          <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-800">
            {PREDICTION_FILTERS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPredictionFilter(p.value)}
                className={`cursor-pointer rounded-full px-3 py-1 text-sm font-medium transition ${
                  predictionFilter === p.value
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && <p className="text-center text-sm text-zinc-500">Cargando partidos…</p>}
      {error    && <p className="text-center text-sm text-red-500">Error cargando partidos.</p>}

      <div
        key={`${statusFilter}-${predictionFilter}`}
        className="flex flex-col gap-6 animate-in fade-in duration-300"
      >
        {PHASE_ORDER.filter((p) => grouped[p]?.length).map((phase) => (
          <section key={phase}>
            {!matchPhaseFilter && (
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {PHASE_LABEL[phase]}
              </h2>
            )}
            <div className="flex flex-col gap-2">
              {grouped[phase]!.map((m) => (
                <MatchCard key={m.matchId} match={m} prediction={predictionByMatchId.get(m.matchId)} highlighted={highlightedMatchId === m.matchId} userId={user!.uid} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
