import type { Match } from "@/lib/firestore";

// Chronological order of tournament phases.
export const PHASE_ORDER: Match["phase"][] = [
  "group", "round_of_32", "round_of_16", "quarter", "semi", "third_place", "final",
];

/**
 * The tournament's current stage: the earliest phase that still has an
 * unfinished (not yet played) match. Once everything scheduled has been played,
 * falls back to the furthest phase that has any matches. Returns null when no
 * matches exist yet.
 */
export function getCurrentPhase(matches: Match[]): Match["phase"] | null {
  if (matches.length === 0) return null;

  for (const phase of PHASE_ORDER) {
    const inPhase = matches.filter((m) => m.phase === phase);
    if (inPhase.length > 0 && inPhase.some((m) => m.status !== "finished")) {
      return phase;
    }
  }

  // Everything seeded has finished — show the furthest phase that has matches.
  for (let i = PHASE_ORDER.length - 1; i >= 0; i--) {
    if (matches.some((m) => m.phase === PHASE_ORDER[i])) return PHASE_ORDER[i];
  }
  return null;
}
