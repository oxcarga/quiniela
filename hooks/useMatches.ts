import { useQuery } from "@tanstack/react-query";
import { getMatch, getMatches, type Match } from "@/lib/firestore";

export function useMatches(
  phase?: Match["phase"],
  options?: { refetchOnMount?: boolean | "always"; staleTime?: number }
) {
  return useQuery({
    queryKey: ["matches", phase ?? "all"],
    queryFn: () => getMatches(phase),
    ...options,
  });
}

export function useMatch(matchId: string) {
  return useQuery({
    queryKey: ["matches", matchId],
    queryFn: () => getMatch(matchId),
    enabled: !!matchId,
  });
}
