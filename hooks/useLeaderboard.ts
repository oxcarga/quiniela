"use client";

import { useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "@/lib/firestore";

export function useLeaderboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: getLeaderboard,
    refetchInterval: 60_000,
    staleTime: 60_000,
  });

  return { data: data ?? null, loading: isLoading, error: error as Error | null };
}
