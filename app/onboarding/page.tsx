"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import OnboardingForm from "@/components/auth/OnboardingForm";
import { useAuth } from "@/context/AuthContext";

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.displayName) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading || user?.displayName) return null;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            ¿Cómo te llamas?
          </h1>
          <p className="text-sm text-muted-foreground">
            Elige un apodo para aparecer en la tabla de posiciones.
          </p>
        </div>
        <OnboardingForm />
      </div>
    </main>
  );
}
