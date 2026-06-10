import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPrediction,
  getUserPredictions,
  setPrediction,
  toggleBooster,
} from "@/lib/firestore";

export function usePrediction(userId: string | null, matchId: string) {
  return useQuery({
    queryKey: ["predictions", userId, matchId],
    queryFn: () => getPrediction(userId!, matchId),
    enabled: !!userId && !!matchId,
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
