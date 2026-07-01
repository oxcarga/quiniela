import { create } from "zustand";
import type { Match } from "@/lib/firestore";

interface AppState {
  // Match list phase filter; null means "all phases"
  matchPhaseFilter: Match["phase"] | null;
  setMatchPhaseFilter: (phase: Match["phase"] | null) => void;

  // The matchId currently open in the detail / prediction view
  selectedMatchId: string | null;
  setSelectedMatchId: (matchId: string | null) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  matchPhaseFilter: "round_of_32",
  setMatchPhaseFilter: (phase) => set({ matchPhaseFilter: phase }),

  selectedMatchId: null,
  setSelectedMatchId: (matchId) => set({ selectedMatchId: matchId }),
}));
