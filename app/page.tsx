import ProtectedRoute from "@/components/layout/ProtectedRoute";
import Leaderboard from "@/components/leaderboard/Leaderboard";
import RulesModal from "@/components/leaderboard/RulesModal";

export default function HomePage() {
  return (
    <ProtectedRoute>
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-baseline gap-2">
          <h1 className="text-2xl font-bold">Tabla de posiciones</h1>
          <RulesModal />
        </div>
        <Leaderboard />
      </main>
    </ProtectedRoute>
  );
}
