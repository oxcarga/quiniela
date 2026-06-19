"use client";

import { useEffect, useState } from "react";
import { getIdTokenResult } from "firebase/auth";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    getIdTokenResult(user).then((result) => {
      setIsAdmin(result.claims.admin === true);
    });
  }, [user]);

  if (isAdmin === null)
    return <p className="text-center text-sm text-zinc-500">Verificando permisos…</p>;
  if (!isAdmin)
    return (
      <div className="text-center">
        <p className="text-lg font-semibold text-red-600">Acceso denegado</p>
        <p className="mt-1 text-sm text-zinc-500">Necesitas permisos de administrador.</p>
      </div>
    );

  return <>{children}</>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <AdminGuard>{children}</AdminGuard>
      </main>
    </ProtectedRoute>
  );
}
