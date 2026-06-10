"use client";

import { useState } from "react";
import type { LeaderboardEntry } from "@/lib/firestore";
import { useUserPredictions } from "@/hooks/usePredictions";

interface Props {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function LeaderboardRow({ entry, isCurrentUser }: Props) {
  const [clickedTimes, setClickedTimes] = useState(0);
  const { data: predictions, isLoading: loadingPreds } = useUserPredictions(
      entry.userId,
      { refetchOnMount: true, staleTime: 60000 }
    );

  const initials = entry.displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  
  const predictionsCount = (predictions ?? []).length;

  function handleClickRow () {
    setClickedTimes(clickedTimes+1);
  } 

  return (
    <div
      className={`flex items-center gap-4 rounded-xl px-4 py-3 transition ${
        isCurrentUser
          ? "bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-950 dark:ring-blue-800"
          : "bg-white dark:bg-zinc-900"
      }`}
      onClick={handleClickRow}
    >
      {/* Position */}
      <span className="w-8 text-center text-lg font-bold tabular-nums text-zinc-500">
        {MEDAL[entry.position] ?? entry.position}
      </span>

      {/* Avatar */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
        {entry.photoURL ? (
          <img src={entry.photoURL} alt={entry.displayName} className="h-9 w-9 rounded-full object-cover" />
        ) : (
          initials
        )}
      </div>

      {/* Name */}
      <span className={`flex-1 font-medium ${isCurrentUser ? "text-blue-700 dark:text-blue-300" : ""}`}>
        {entry.displayName}
        {isCurrentUser && <span className="ml-2 text-xs font-normal text-blue-500">(tú)</span>}
      </span>

      {/* Score */}
      <span className="text-lg font-bold tabular-nums">{entry.totalScore}</span>
      <span className="text-xs text-zinc-400">pts</span>

      <div className={`text-xs ${clickedTimes < 5 && 'invisible'}`}> {predictionsCount} predicciones hechas</div>
    </div>
  );
}
