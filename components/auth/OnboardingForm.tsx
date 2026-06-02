"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";

const MAX_LENGTH = 24;

export default function OnboardingForm() {
  const { setDisplayName } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");

    try {
      await setDisplayName(trimmed);
      router.replace("/");
    } catch {
      setError("No se pudo guardar el nombre. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Input
          placeholder="Tu apodo (máx. 24 caracteres)"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, MAX_LENGTH))}
          required
          disabled={loading}
          autoFocus
        />
        <p className="text-xs text-muted-foreground text-right">
          {name.length}/{MAX_LENGTH}
        </p>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={loading || name.trim().length === 0}
      >
        {loading ? "Guardando…" : "Entrar a la quiniela"}
      </Button>
    </form>
  );
}
