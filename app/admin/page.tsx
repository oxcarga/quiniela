"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { getIdTokenResult } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useMatches } from "@/hooks/useMatches";
import { setMatchResult } from "@/lib/firestore";
import { useQueryClient } from "@tanstack/react-query";

const schema = z.object({
  homeGoals: z.number().int().min(0),
  awayGoals: z.number().int().min(0),
});

function AdminContent() {
  const { user } = useAuth();
  const { data: matches, isLoading } = useMatches();

  const [isAdmin, setIsAdmin]           = useState<boolean | null>(null);
  const [selectedId, setSelectedId]     = useState("");
  const [homeGoals, setHomeGoals]       = useState(0);
  const [awayGoals, setAwayGoals]       = useState(0);
  const [matchEnded, setMatchEnded]     = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [successId, setSuccessId]       = useState<string | null>(null);
  const queryClient                     = useQueryClient();

  // Check admin custom claim
  useEffect(() => {
    if (!user) return;
    getIdTokenResult(user).then((result) => {
      setIsAdmin(result.claims.admin === true);
    });
  }, [user]);

  // update the status of the checkbox based on what's coming from the database
  useEffect(() => {
    if (!matches || !selectedId) return;
    const selected = matches?.find((m) => m.matchId === selectedId) ?? null;
    setMatchEnded(selected?.status === "finished");
  }, [successId, selectedId]);

  if (isAdmin === null) return <p className="text-center text-sm text-zinc-500">Verificando permisos…</p>;
  if (!isAdmin) return (
    <div className="text-center">
      <p className="text-lg font-semibold text-red-600">Acceso denegado</p>
      <p className="mt-1 text-sm text-zinc-500">Necesitas permisos de administrador.</p>
    </div>
  );

  const allMatches = matches ?? [];
  const selected   = allMatches.find((m) => m.matchId === selectedId) ?? null;

  function handleMatchChange(id: string) {
    const match = allMatches.find((m) => m.matchId === id) ?? null;
    setSelectedId(id);
    setHomeGoals(match?.result?.homeGoals ?? 0);
    setAwayGoals(match?.result?.awayGoals ?? 0);
    setError(null);
    setSuccessId(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const parsed = schema.safeParse({
      homeGoals: Number(homeGoals),
      awayGoals: Number(awayGoals),
    });
    if (!parsed.success) {
      setError("Ingresa un resultado válido (números enteros ≥ 0).");
      return;
    }
    if (!selectedId) {
      setError("Selecciona un partido.");
      return;
    }

    setSubmitting(true);
    try {
      await setMatchResult(selectedId, parsed.data.homeGoals, parsed.data.awayGoals, matchEnded);
      // force sync the matches data
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      setSuccessId(selectedId);
      setSelectedId("");
      setHomeGoals(0);
      setAwayGoals(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el resultado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Panel de administrador</h1>

      {successId && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          Resultado guardado correctamente.
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Match selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Partido</label>
          {isLoading ? (
            <p className="text-sm text-zinc-500">Cargando partidos…</p>
          ) : (
            <select
              value={selectedId}
              onChange={(e) => handleMatchChange(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">— Selecciona un partido —</option>
              {allMatches.map((m) => (
                <option key={m.matchId} value={m.matchId}>
                  {m.status === "finished" ? "✅ " : ""}{m.homeFlag} {m.homeTeam} vs {m.awayTeam} {m.awayFlag}
                  {" · "}
                  {new Intl.DateTimeFormat(undefined, {
                    month: "short", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  }).format(m.kickoffAt.toDate())}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Score entry card — only shown after a match is selected */}
        {selected && (
          <div className="flex items-center justify-center gap-6 rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900">
            {/* Home */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-5xl">{selected.homeFlag}</span>
              <span className="text-sm font-medium">{selected.homeTeam}</span>
              <Input
                type="number" min={0}
                value={homeGoals}
                onChange={(e) => setHomeGoals(parseInt(e.target.value))}
                disabled={submitting}
                className="w-16 text-center text-2xl font-bold"
                placeholder="0"
              />
            </div>

            <span className="mt-6 text-2xl font-semibold text-zinc-400">–</span>

            {/* Away */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-5xl">{selected.awayFlag}</span>
              <span className="text-sm font-medium">{selected.awayTeam}</span>
              <Input
                type="number" min={0}
                value={awayGoals}
                onChange={(e) => setAwayGoals(parseInt(e.target.value))}
                disabled={submitting}
                className="w-16 text-center text-2xl font-bold"
                placeholder="0"
              />
            </div>
          </div>
        )}
        <label htmlFor="game-finished" className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium">
          <input 
            id="game-finished"
            className="w-4 h-4 accent-primary cursor-pointer"
            type="checkbox" 
            checked={matchEnded}
            onChange={(e) => setMatchEnded(e.target.checked)} />
          Partido finalizado?
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" disabled={!selectedId || submitting} className="w-full">
          {submitting ? "Guardando…" : "Confirmar resultado"}
        </Button>
      </form>
    </div>
  );
}


export default function AdminPage() {
  return (
    <ProtectedRoute>
      <main className="mx-auto w-full max-w-xl px-4 py-8">
        <AdminContent />
      </main>
    </ProtectedRoute>
  );
}
