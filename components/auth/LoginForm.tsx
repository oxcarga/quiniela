"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { getUserByEmail } from "@/lib/firestore";
import { useSearchParams } from 'next/navigation'

type Status = "idle" | "loading" | "confirm_new" | "success" | "error";

export default function LoginForm() {
  const { sendMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const debug = useSearchParams().get('debug');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    console.log(email);

    try {
      debugger
      const exists = await getUserByEmail(email);
      if (exists) {
        await sendMagicLink(email);
        setStatus("success");
      } else {
        setStatus("confirm_new");
      }
    } catch (err) {
      console.log(err);
      setStatus("error");
      setError("No se pudo verificar el correo. Intenta de nuevo.");
    }
  }

  async function handleConfirmNew() {
    setStatus("loading");
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

  if (status === "confirm_new") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            No encontramos una cuenta con este correo
          </p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            ¿Es la primera vez que usas la app?
          </p>
        </div>
        <Button className="w-full" size="lg" onClick={handleConfirmNew}>
          Soy nuevo, continuar
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => setStatus("idle")}
        >
          Probar con otro correo
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      
      {debug && <div>
        <p>debug: {debug}</p>
        <p>1: {process.env.NEXT_PUBLIC_APP_URL}</p>
        <p>2: {process.env.NEXT_PUBLIC_FIREBASE_API_KEY}</p>
        <p>3: {process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}</p>
        <p>4: {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}</p>
        <p>5: {process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}</p>
        <p>6: {process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}</p>
        <p>7: {process.env.NEXT_PUBLIC_FIREBASE_APP_ID}</p>
        <p>8: {process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID}</p>
        <p>status: {status.toString()}</p>
      </div>}
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
        {status === "loading" ? "Verificando…" : "Enviar enlace de acceso"}
      </Button>
    </form>
  );
}
