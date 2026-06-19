"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdBanner } from "@/lib/firestore";

export function useAdBanner() {
  return useQuery({
    queryKey: ["adBanner"],
    queryFn: getAdBanner,
    staleTime: 5 * 60_000,
  });
}
