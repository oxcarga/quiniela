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
            Ingresa tu email para recibir tu enlace de acceso
          </p>
        </div>
        <br />
        <p>1: {process.env.NEXT_PUBLIC_APP_URL}</p>
        <p>2: {process.env.NEXT_PUBLIC_FIREBASE_API_KEY}</p>
        <p>3: {process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}</p>
        <p>4: {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}</p>
        <p>5: {process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}</p>
        <p>6: {process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}</p>
        <p>7: {process.env.NEXT_PUBLIC_FIREBASE_APP_ID}</p>
        <p>8: {process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID}</p>
        <br />
        <LoginForm />
      </div>
    </main>
  );
}
