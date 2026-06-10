"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { LeaderboardEntry } from "@/lib/firestore";

// Fallback list (used before any scores exist): every registered user, by name.
export function useUsers() {
  const [users, setUsers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "users"), orderBy("displayName", "desc")),
      (snap) => {
        setUsers(
          snap.docs.map((d, i) => {
            const u = d.data();
            return {
              userId: u.uid as string,
              displayName: u.displayName as string,
              photoURL: (u.photoURL as string | null) ?? null,
              totalScore: (u.totalScore as number) ?? 0,
              predictionsCount: (u.predictionsCount as number) ?? 0,
              position: i + 1,
            };
          })
        );
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { users, loading, error };
}
