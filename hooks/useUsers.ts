"use client";

import { useQuery } from "@tanstack/react-query";
import { getUsers } from "@/lib/firestore";

// Fallback list (used before any scores exist): every registered user, by name.
export function useUsers() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
    staleTime: 5 * 60_000,
  });

  return { users: data ?? [], loading: isLoading, error: error as Error | null };
}
