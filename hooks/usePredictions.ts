import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getPrediction,
  getUserPredictions,
  getUserPredictionsForMatches,
  setPrediction,
  toggleBooster,
  type Prediction,
} from "@/lib/firestore";

export function usePrediction(userId: string | null, matchId: string) {
  return useQuery({
    queryKey: ["predictions", userId, matchId],
    queryFn: () => getPrediction(userId!, matchId),
    enabled: !!userId && !!matchId,
    staleTime: 60_000,
  });
}

export function useUserPredictions(
  userId: string | null,
  options?: { refetchOnMount?: boolean | "always"; staleTime?: number }
) {
  return useQuery({
    queryKey: ["predictions", userId],
    queryFn: () => getUserPredictions(userId!),
    enabled: !!userId,
    ...options,
  });
}

// Reads another user's predictions for a specific set of matches (one getDoc
// each). Used for the head-to-head comparison, where security rules only allow
// reading another user's pick for a match that has already kicked off.
export function useUserPredictionsForMatches(
  userId: string | null,
  matchIds: string[]
) {
  const sortedIds = [...matchIds].sort();
  return useQuery({
    queryKey: ["predictions", "for-matches", userId, sortedIds],
    queryFn: () => getUserPredictionsForMatches(userId!, sortedIds),
    enabled: !!userId && sortedIds.length > 0,
    staleTime: 60000,
  });
}

// Same as above but for several users at once. Returns a map of
// userId -> their predictions for the requested matches, so the profile page
// can show head-to-head comparisons against multiple players simultaneously.
export function useMultiUserPredictionsForMatches(
  userIds: string[],
  matchIds: string[]
) {
  const sortedIds = [...matchIds].sort();
  const results = useQueries({
    queries: userIds.map((userId) => ({
      queryKey: ["predictions", "for-matches", userId, sortedIds],
      queryFn: () => getUserPredictionsForMatches(userId, sortedIds),
      enabled: !!userId && sortedIds.length > 0,
      staleTime: 60000,
    })),
  });
  return userIds.reduce<Record<string, Prediction[]>>((acc, userId, i) => {
    acc[userId] = results[i]?.data ?? [];
    return acc;
  }, {});
}

export function useSetPrediction(userId: string | null, matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      homeGoals,
      awayGoals,
    }: {
      homeGoals: number;
      awayGoals: number;
    }) => setPrediction(userId!, matchId, homeGoals, awayGoals),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["predictions", userId],
      });
    },
  });
}

export function useToggleBooster(userId: string | null, matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (boosted: boolean) => toggleBooster(matchId, boosted),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["predictions", userId],
      });
    },
  });
}
