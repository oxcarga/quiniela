"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, User2, Gamepad } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import UsersTable from "@/components/admin/UsersTable";
import { useMatches } from "@/hooks/useMatches";
import { setMatchResult } from "@/lib/firestore";
import { Flag } from "@/components/Flag";
import { useQueryClient } from "@tanstack/react-query";

const schema = z.object({
  homeGoals: z.number().int().min(0),
  awayGoals: z.number().int().min(0),
});

function AdminContent() {
  const { data: matches, isLoading } = useMatches();

  const [showPast, setShowPast]         = useState(false);
  const [selectedId, setSelectedId]     = useState("");
  const [homeGoals, setHomeGoals]       = useState(0);
  const [awayGoals, setAwayGoals]       = useState(0);
  const [homePens, setHomePens]         = useState(0);
  const [awayPens, setAwayPens]         = useState(0);
  const [matchEnded, setMatchEnded]     = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [successId, setSuccessId]       = useState<string | null>(null);
  const [loadUsers, setLoadUsers]       = useState(false);
  const [updateMatch, setUpdateMatch]   = useState(false);
  const queryClient                     = useQueryClient();

  // update the status of the checkbox based on what's coming from the database
  useEffect(() => {
    if (!matches || !selectedId) return;
    const selected = matches?.find((m) => m.matchId === selectedId) ?? null;
    setMatchEnded(selected?.status === "finished");
  }, [successId, selectedId]);

  const allMatches = matches ?? [];
  const selected   = allMatches.find((m) => m.matchId === selectedId) ?? null;
  // Knockout matches can be settled on penalties when level after regulation.
  const isKnockout = selected != null && selected.phase !== "group";
  const showPenalties = isKnockout && Number(homeGoals) === Number(awayGoals);

  function handleMatchChange(id: string) {
    const match = allMatches.find((m) => m.matchId === id) ?? null;
    setSelectedId(id);
    setHomeGoals(match?.result?.homeGoals ?? 0);
    setAwayGoals(match?.result?.awayGoals ?? 0);
    setHomePens(match?.result?.homePenalties ?? 0);
    setAwayPens(match?.result?.awayPenalties ?? 0);
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

    const shootout =
      isKnockout && matchEnded && parsed.data.homeGoals === parsed.data.awayGoals;
    let penalties: { home: number; away: number } | undefined;
    if (shootout) {
      penalties = { home: Number(homePens), away: Number(awayPens) };
      if (penalties.home === penalties.away) {
        setError("Los penales no pueden quedar empatados: debe haber un ganador.");
        return;
      }
    }

    setSubmitting(true);
    try {
      await setMatchResult(selectedId, parsed.data.homeGoals, parsed.data.awayGoals, matchEnded, penalties);
      // force sync the matches data
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      setSuccessId(selectedId);
      setSelectedId("");
      setHomeGoals(0);
      setAwayGoals(0);
      setHomePens(0);
      setAwayPens(0);
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

      <hr className="border-zinc-200 dark:border-zinc-800" />
      {!updateMatch && <button className="cursor-pointer inline-flex w-fit items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500" onClick={() => setUpdateMatch(true)}>
        <Gamepad className="h-4 w-4" />
        Actualizar Partidos
      </button>}

      {updateMatch && 
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Match selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-lg font-semibold">Partido</label>
          <p>
            <label htmlFor="show-past-games" className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium justify-end">
              <input 
                id="show-past-games"
                className="w-4 h-4 accent-primary cursor-pointer"
                type="checkbox" 
                checked={showPast}
                onChange={(e) => setShowPast(e.target.checked)} />
              Mostrar partidos pasados?
            </label>
          </p>
          {isLoading ? (
            <p className="text-sm text-zinc-500">Cargando partidos…</p>
          ) : (
            <select
              value={selectedId}
              onChange={(e) => handleMatchChange(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">— Selecciona un partido —</option>
              {allMatches.map((m) => {
                const isFinished = m.status === "finished";
                if (isFinished && !showPast) {return}
                return <option key={m.matchId} value={m.matchId}>
                  {isFinished ? "✅ " : ""}{m.homeFlag} {m.homeTeam} vs {m.awayTeam} {m.awayFlag}
                  {" · "}
                  {new Intl.DateTimeFormat(undefined, {
                    month: "short", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  }).format(m.kickoffAt.toDate())}
                </option>
              })}
            </select>
          )}
        </div>

        {/* Score entry card — only shown after a match is selected */}
        {selected && (
          <div className="flex items-center justify-center gap-6 rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900">
            {/* Home */}
            <div className="flex flex-col items-center gap-2">
              <Flag emoji={selected.homeFlag} size={[56, 42]} />
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
              <Flag emoji={selected.awayFlag} size={[56, 42]} />
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

        {/* Penalty shootout — knockout matches level after regulation */}
        {showPenalties && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-6 py-4 dark:border-amber-900 dark:bg-amber-950/40">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Penales
            </span>
            <div className="flex items-center justify-center gap-6">
              <Input
                type="number" min={0}
                value={homePens}
                onChange={(e) => setHomePens(parseInt(e.target.value))}
                disabled={submitting}
                className="w-16 text-center text-2xl font-bold"
                placeholder="0"
              />
              <span className="text-2xl font-semibold text-zinc-400">–</span>
              <Input
                type="number" min={0}
                value={awayPens}
                onChange={(e) => setAwayPens(parseInt(e.target.value))}
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
      </form>}

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <Link
        href="/admin/ad"
        className="cursor-pointer inline-flex w-fit items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
      >
        <Megaphone className="h-4 w-4" />
        Editar anuncio (banner)
      </Link>

      <hr className="border-zinc-200 dark:border-zinc-800" />

        
      {!loadUsers && <button className="cursor-pointer inline-flex w-fit items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500" onClick={() => setLoadUsers(true)}>
        <User2 className="h-4 w-4" />
        Cargar Users
      </button>}
      {loadUsers && <UsersTable enabled={loadUsers} />}
    </div>
  );
}


export default function AdminPage() {
  return <AdminContent />;
}
