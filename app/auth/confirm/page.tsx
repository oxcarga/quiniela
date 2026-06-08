"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";

type Status = "loading" | "email_required" | "error";

export default function AuthConfirmPage() {
  const { confirmMagicLink, isEmailLinkUrl } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const url = window.location.href;
    const storedEmail = localStorage.getItem("emailForSignIn");
    console.log("[auth/confirm] url:", url);
    console.log("[auth/confirm] isEmailLinkUrl:", isEmailLinkUrl(url));
    console.log("[auth/confirm] storedEmail:", storedEmail);

    if (!isEmailLinkUrl(url)) {
      router.replace("/login");
      return;
    }

    confirmMagicLink(url).then((user) => {
      router.replace(user.displayName ? "/" : "/onboarding");
    }).catch((err: Error) => {
      console.error("[auth/confirm] confirmMagicLink error:", err);
      if (err.message === "EMAIL_REQUIRED") {
        setStatus("email_required");
      } else {
        setError("El enlace es inválido o ya expiró.");
        setStatus("error");
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const user = await confirmMagicLink(window.location.href, email);
      router.replace(user.displayName ? "/" : "/onboarding");
    } catch {
      setError("No se pudo verificar el enlace. Intenta solicitar uno nuevo.");
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Verificando enlace…</p>
      </main>
    );
  }

  if (status === "email_required") {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-semibold">Confirma tu email</h1>
            <p className="text-sm text-muted-foreground">
              Abriste el enlace en un dispositivo diferente. Ingresa tu email
              para continuar.
            </p>
          </div>
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <Input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              disabled={submitting}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Verificando…" : "Confirmar"}
            </Button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => router.replace("/login")}>
          Volver al inicio
        </Button>
      </div>
    </main>
  );
}
