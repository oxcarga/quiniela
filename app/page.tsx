import ProtectedRoute from "@/components/layout/ProtectedRoute";
import Leaderboard from "@/components/leaderboard/Leaderboard";

export default function HomePage() {
  return (
    <ProtectedRoute>
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Tabla de posiciones</h1>
        <Leaderboard />
      </main>
    </ProtectedRoute>
  );
}
