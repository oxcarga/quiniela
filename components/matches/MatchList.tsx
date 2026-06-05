"use client";

import { useEffect, useState } from "react";
import { useMatches } from "@/hooks/useMatches";
import { useUserPredictions } from "@/hooks/usePredictions";
import { useAuth } from "@/context/AuthContext";
import { useAppStore } from "@/store/useAppStore";
import MatchCard from "./MatchCard";
import type { Match } from "@/lib/firestore";

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

export default function MatchList() {
  const { user } = useAuth();
  const { matchPhaseFilter, setMatchPhaseFilter } = useAppStore();
  const { data: matches, isLoading, error } = useMatches(matchPhaseFilter ?? undefined);
  const { data: predictions } = useUserPredictions(user?.uid ?? null);
  const [highlightedMatchId, setHighlightedMatchId] = useState<string | null>(null);

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

  const grouped = (matches ?? []).reduce<Partial<Record<Match["phase"], Match[]>>>((acc, m) => {
    (acc[m.phase] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      {/* Phase filter */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={String(f.value)}
            onClick={() => setMatchPhaseFilter(f.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              matchPhaseFilter === f.value
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-center text-sm text-zinc-500">Cargando partidos…</p>}
      {error    && <p className="text-center text-sm text-red-500">Error cargando partidos.</p>}

      {PHASE_ORDER.filter((p) => grouped[p]?.length).map((phase) => (
        <section key={phase}>
          {!matchPhaseFilter && (
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {PHASE_LABEL[phase]}
            </h2>
          )}
          <div className="flex flex-col gap-2">
            {grouped[phase]!.map((m) => (
              <MatchCard key={m.matchId} match={m} prediction={predictionByMatchId.get(m.matchId)} highlighted={highlightedMatchId === m.matchId} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
