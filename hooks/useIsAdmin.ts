"use client";

import { useEffect, useState } from "react";
import { getIdTokenResult } from "firebase/auth";
import { useAuth } from "@/context/AuthContext";

// Resolves the `admin` custom claim for the current user.
// Returns `null` while the claim is still being resolved.
export function useIsAdmin(): boolean | null {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    getIdTokenResult(user).then((r) => {
      if (!cancelled) setIsAdmin(r.claims.admin === true);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return isAdmin;
}
