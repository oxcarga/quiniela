"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";

type Status = "idle" | "loading" | "success" | "error";

export default function LoginForm() {
  const { sendMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    try {
      await sendMagicLink(email);
      setStatus("success");
    } catch {
      setStatus("error");
      setError("No se pudo enviar el enlace. Intenta de nuevo.");
    }
  }

  if (status === "success") {
    return (
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-foreground">
          Revisa tu correo
        </p>
        <p className="text-sm text-muted-foreground">
          Enviamos un enlace a <span className="font-medium">{email}</span>.
          Haz clic en él para entrar.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        type="email"
        placeholder="tu@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={status === "loading"}
        autoFocus
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={status === "loading"}
      >
        {status === "loading" ? "Enviando…" : "Enviar enlace de acceso"}
      </Button>
    </form>
  );
}
