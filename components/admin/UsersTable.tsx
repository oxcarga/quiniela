"use client";

import { useAdminUsers } from "@/hooks/useAdminUsers";

const dateFmt = new Intl.DateTimeFormat("es", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export default function UsersTable({ enabled }: { enabled: boolean }) {
  const { data: users, isLoading, error } = useAdminUsers(enabled);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Usuarios</h2>
        {users && (
          <span className="text-sm text-zinc-500">{users.length} en total</span>
        )}
      </div>

      {isLoading && <p className="text-sm text-zinc-500">Cargando usuarios…</p>}
      {error && (
        <p className="text-sm text-red-500">
          {error instanceof Error ? error.message : "Error cargando usuarios."}
        </p>
      )}

      {users && users.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 font-medium">Usuario</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Creado</th>
                <th className="px-3 py-2 text-right font-medium">Predicciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {users.map((u) => (
                <tr key={u.userId} className="align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">
                      {u.displayName ?? <span className="text-zinc-400">— sin nombre —</span>}
                    </div>
                    <div className="font-mono text-xs text-zinc-400">{u.userId}</div>
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                    {u.email ?? "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                    {dateFmt.format(new Date(u.createdAt))}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {u.predictionsCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {users && users.length === 0 && (
        <p className="text-sm text-zinc-500">No hay usuarios registrados.</p>
      )}
    </section>
  );
}
