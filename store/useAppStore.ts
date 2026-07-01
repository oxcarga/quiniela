import { create } from "zustand";
import type { Match } from "@/lib/firestore";

interface AppState {
  // Match list phase filter; null means "all phases"
  matchPhaseFilter: Match["phase"] | null;
  // While true, the list follows the tournament's current stage instead of
  // matchPhaseFilter. Any explicit choice (incl. "Todos") turns this off.
  phaseFilterAuto: boolean;
  setMatchPhaseFilter: (phase: Match["phase"] | null) => void;

  // The matchId currently open in the detail / prediction view
  selectedMatchId: string | null;
  setSelectedMatchId: (matchId: string | null) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  matchPhaseFilter: null,
  phaseFilterAuto: true,
  setMatchPhaseFilter: (phase) => set({ matchPhaseFilter: phase, phaseFilterAuto: false }),

  selectedMatchId: null,
  setSelectedMatchId: (matchId) => set({ selectedMatchId: matchId }),
}));
