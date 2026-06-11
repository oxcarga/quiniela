import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Quiniela Mundial 2026
          </h1>
          <p className="text-sm text-muted-foreground">
            Ingresa tu email para recibir tu código y enlace de acceso
          </p>
        </div>
        <LoginForm />
        <p className="text-center text-md text-muted-foreground">
          Hecho con ❤︎ y 🤖 en PZ, CR
        </p>
      </div>
    </main>
  );
}
