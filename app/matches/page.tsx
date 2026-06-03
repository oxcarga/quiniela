import ProtectedRoute from "@/components/layout/ProtectedRoute";
import MatchList from "@/components/matches/MatchList";

export default function MatchesPage() {
  return (
    <ProtectedRoute>
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Partidos</h1>
        <MatchList />
      </main>
    </ProtectedRoute>
  );
}
