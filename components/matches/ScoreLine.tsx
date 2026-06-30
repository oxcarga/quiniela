import { getMatchWinner, type Match } from "@/lib/firestore";

interface Props {
  match: Match;
  /** Classes for the goal figures (size/weight per call site). */
  className?: string;
  /** Classes for the smaller parenthesised penalty figures. */
  penaltyClassName?: string;
}

/**
 * Renders a finished/in-play score, e.g. `1 (4) – 1 (5)` when the knockout
 * match was decided on penalties. The advancing side's score is emphasised and
 * the eliminated side is dimmed; group-stage scores render flat.
 */
export default function ScoreLine({
  match,
  className = "",
  penaltyClassName = "text-[0.6em] font-semibold align-super text-zinc-500",
}: Props) {
  const r = match.result;
  const homeGoals = r?.homeGoals ?? 0;
  const awayGoals = r?.awayGoals ?? 0;
  const hasPens = r?.homePenalties != null && r?.awayPenalties != null;
  const winner = hasPens ? getMatchWinner(match) : null;

  return (
    <span className={`tabular-nums ${className}`}>
      <span className={winner === "away" ? "text-zinc-400 dark:text-zinc-600" : undefined}>
        {homeGoals}
        {hasPens && <span className={penaltyClassName}> ({r!.homePenalties})</span>}
      </span>
      <span className="px-1 font-normal text-zinc-400">–</span>
      <span className={winner === "home" ? "text-zinc-400 dark:text-zinc-600" : undefined}>
        {hasPens && <span className={penaltyClassName}>({r!.awayPenalties}) </span>}
        {awayGoals}
      </span>
    </span>
  );
}
