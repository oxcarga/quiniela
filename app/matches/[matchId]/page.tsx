import ProtectedRoute from "@/components/layout/ProtectedRoute";
import MatchDetail from "@/components/matches/MatchDetail";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;

  return (
    <ProtectedRoute>
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <MatchDetail matchId={matchId} />
      </main>
    </ProtectedRoute>
  );
}
