"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface Props {
  children: React.ReactNode;
  requireName?: boolean;
}

export default function ProtectedRoute({ children, requireName = true }: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (requireName && !user.displayName) {
      router.replace("/onboarding");
    }
  }, [user, loading, requireName, router]);

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <span className="text-sm text-muted-foreground">Cargando…</span>
      </main>
    );
  }

  if (!user || (requireName && !user.displayName)) return null;

  return <>{children}</>;
}
