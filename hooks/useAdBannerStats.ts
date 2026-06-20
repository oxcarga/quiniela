"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdBannerStats, getAdBannerStatsDays } from "@/lib/firestore";

// Loads the counters + per-day breakdown for a given banner version. Admin-only
// read per Firestore rules, so this is only used from the admin editor.
export function useAdBannerStats(version: string | undefined) {
  return useQuery({
    queryKey: ["adBannerStats", version],
    queryFn: () =>
      Promise.all([
        getAdBannerStats(version!),
        getAdBannerStatsDays(version!),
      ]).then(([stats, days]) => ({ stats, days })),
    enabled: !!version,
    staleTime: 60_000,
  });
}
