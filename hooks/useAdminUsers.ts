"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import type { AdminUserRow } from "@/app/api/admin/users/route";

export type { AdminUserRow };

// Fetches every registered user (Auth profile + prediction counts) for the
// admin panel. Requires the caller to hold the `admin` custom claim — the
// API route enforces this server-side using the bearer ID token.
export function useAdminUsers(enabled: boolean) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["admin", "users"],
    enabled: enabled && !!user,
    queryFn: async (): Promise<AdminUserRow[]> => {
      const token = await user!.getIdToken();
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Error cargando usuarios");
      }
      const data = (await res.json()) as { users: AdminUserRow[] };
      return data.users;
    },
  });
}
