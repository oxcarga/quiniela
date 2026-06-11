"use client";

import { useState } from "react";
import { Info } from "lucide-react";

const RULES = [
  { label: "Marcador exacto", example: "Predijiste 2-1 · Resultado 2-1", pts: 3, color: "text-green-600 dark:text-green-400" },
  { label: "Empate correcto (marcador diferente)", example: "Predijiste 1-1 · Resultado 0-0", pts: 2, color: "text-blue-600 dark:text-blue-400" },
  { label: "Ganador correcto (marcador diferente)", example: "Predijiste 2-0 · Resultado 1-0", pts: 1, color: "text-yellow-600 dark:text-yellow-400" },
  { label: "Resultado incorrecto", example: "Predijiste 2-1 · Resultado 0-1", pts: 0, color: "text-zinc-400" },
];

export default function RulesModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="cursor-pointer inline-flex items-center gap-1 rounded-full border border-zinc-300 dark:border-zinc-600 px-2 py-0.5 text-xs text-zinc-600 dark:text-zinc-300 hover:border-zinc-500 hover:text-zinc-900 dark:hover:border-zinc-400 dark:hover:text-zinc-100 transition-colors"
      >
        <Info className="h-3 w-3" />
        Reglas
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rules-title"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="rules-title" className="text-lg font-bold">
                Reglas de puntuación
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="cursor-pointer text-xl leading-none text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <table className="mb-4 w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="pb-2 font-medium">Predicción</th>
                  <th className="pb-2 text-right font-medium">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {RULES.map(({ label, example, pts, color }) => (
                  <tr key={label}>
                    <td className="py-2 pr-4">
                      <span className="block">{label}</span>
                      <span className="text-xs text-zinc-400">{example}</span>
                    </td>
                    <td className={`py-2 text-right font-bold tabular-nums ${color}`}>{pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mb-4 rounded-lg bg-amber-50 p-3 dark:bg-amber-950/30">
              <h3 className="mb-2 flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
                <span className="text-lg">⚡</span> Refuerzo (×2)
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
                Multiplica por 2 los puntos de tu predicción. Disponible solo una vez por día.
              </p>
              <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                <li>• Debes tener una predicción antes de aplicar el refuerzo</li>
                <li>• Solo puedes usarlo antes de que comience el partido</li>
                <li>• Un refuerzo por día (basado en la hora de inicio del partido)</li>
              </ul>
            </div>

            <p className="text-xs text-zinc-500">
              En fase de grupos, el resultado se evalúa al final de los 90 minutos reglamentarios. En partidos de eliminación directa, se evalúa al final del tiempo reglamentario más la prórroga (90+30 min), sin contar los penales.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
