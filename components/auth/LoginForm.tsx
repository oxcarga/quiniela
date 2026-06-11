"use client";

import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { getUserByEmail } from "@/lib/firestore";
import { useRouter, useSearchParams } from 'next/navigation'

type Status = "idle" | "loading" | "confirm_new" | "code_sent" | "error";

const SPAM_PRONE_DOMAINS = ["hotmail.com", "outlook.com"];

function isSpamProneEmail(email: string) {
  const domain = email.trim().toLowerCase().split("@")[1];
  return SPAM_PRONE_DOMAINS.includes(domain);
}

type DebugProps = {
  status: Status
}
function Debug(props: DebugProps) {
  const debug = useSearchParams().get('debug');
  return <>
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
      <p>status: {props.status.toString()}</p>
    </div>}
  </>
}

export default function LoginForm() {
  const { sendMagicLink, signInLinkDEV, signInCodeDEV, confirmCode } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [codeError, setCodeError] = useState("");

  // In dev the API returns the code directly — prefill it to speed up testing.
  useEffect(() => {
    if (signInCodeDEV) setCode(signInCodeDEV);
  }, [signInCodeDEV]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    try {
      const exists = await getUserByEmail(email);
      if (exists) {
        await sendMagicLink(email);
        setStatus("code_sent");
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
      setStatus("code_sent");
    } catch {
      setStatus("error");
      setError("No se pudo enviar el enlace. Intenta de nuevo.");
    }
  }

  async function handleVerifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setVerifying(true);
    setCodeError("");
    try {
      const user = await confirmCode(email, code);
      router.replace(user.displayName ? "/" : "/onboarding");
    } catch (err) {
      setCodeError(
        err instanceof Error ? err.message : "Código inválido. Intenta de nuevo."
      );
      setVerifying(false);
    }
  }

  if (status === "code_sent") {
    return (
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-foreground">
            Revisa tu correo
          </p>
          <p className="text-sm text-muted-foreground">
            Enviamos un código de 4 dígitos a{" "}
            <span className="font-bold">{email}</span>. Escríbelo aquí para
            entrar.
          </p>
        </div>

        <form onSubmit={handleVerifyCode} className="space-y-3">
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{4}"
            maxLength={4}
            placeholder="••••"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            disabled={verifying}
            autoFocus
            className="text-center text-lg tracking-[0.5em]"
          />
          {codeError && (
            <p className="text-xs text-destructive">{codeError}</p>
          )}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={code.length !== 4 || verifying}
          >
            {verifying ? "Verificando…" : "Entrar"}
          </Button>
        </form>

        {signInLinkDEV && (
          <a
            className="block text-center text-sm font-semibold text-blue-600 hover:text-blue-500"
            href={signInLinkDEV}
          >
            Skip login ➔
          </a>
        )}

        <p className="text-center text-xs text-muted-foreground">
          También puedes abrir el enlace del correo, pero debe ser en este mismo
          navegador.
        </p>

        <Button
          variant="ghost"
          className="w-full"
          onClick={() => {
            setCode("");
            setCodeError("");
            setStatus("idle");
          }}
        >
          Usar otro correo
        </Button>
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
      
      <Suspense>
        <Debug status={status} />
      </Suspense>
      <Input
        type="email"
        placeholder="tu@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={status === "loading"}
        autoFocus
      />
      <p className="text-xs text-muted-foreground">
        Te enviaremos un correo. 
        {isSpamProneEmail(email) && (
        <span className="text-xs text-muted-foreground">
          &nbsp;Si no lo ves en la bandeja de entrada, revisa tu carpeta de spam.
        </span>
      )}
      </p>
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
