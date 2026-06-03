import { useQuery } from "@tanstack/react-query";
import { getMatch, getMatches, type Match } from "@/lib/firestore";

export function useMatches(phase?: Match["phase"]) {
  return useQuery({
    queryKey: ["matches", phase ?? "all"],
    queryFn: () => getMatches(phase),
  });
}

export function useMatch(matchId: string) {
  return useQuery({
    queryKey: ["matches", matchId],
    queryFn: () => getMatch(matchId),
    enabled: !!matchId,
  });
}
