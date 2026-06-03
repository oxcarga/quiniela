import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPrediction, setPrediction } from "@/lib/firestore";

export function usePrediction(userId: string | null, matchId: string) {
  return useQuery({
    queryKey: ["predictions", userId, matchId],
    queryFn: () => getPrediction(userId!, matchId),
    enabled: !!userId && !!matchId,
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
        queryKey: ["predictions", userId, matchId],
      });
    },
  });
}
