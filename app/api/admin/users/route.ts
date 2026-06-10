import type { UserRecord } from "firebase-admin/auth";

export interface AdminUserRow {
  userId: string;
  displayName: string | null;
  email: string | null;
  createdAt: string; // ISO string
  predictionsCount: number;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { adminAuth, adminDb } = await import("@/lib/firebase-admin");

  // Verify the caller is an authenticated admin.
  let callerUid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.admin !== true) {
      return Response.json({ error: "Acceso denegado" }, { status: 403 });
    }
    callerUid = decoded.uid;
  } catch {
    return Response.json({ error: "Token inválido" }, { status: 401 });
  }

  try {
    // Collect every Auth user (paginated, 1000 per page).
    const authUsers: UserRecord[] = [];
    let pageToken: string | undefined;
    do {
      const page = await adminAuth.listUsers(1000, pageToken);
      authUsers.push(...page.users);
      pageToken = page.pageToken;
    } while (pageToken);

    // Count predictions per user via aggregate count() — one cheap read each.
    const rows: AdminUserRow[] = await Promise.all(
      authUsers.map(async (u) => {
        const snap = await adminDb
          .collection("predictions")
          .doc(u.uid)
          .collection("matches")
          .count()
          .get();
        return {
          userId: u.uid,
          displayName: u.displayName ?? null,
          email: u.email ?? null,
          createdAt: u.metadata.creationTime,
          predictionsCount: snap.data().count,
        };
      })
    );

    // Most recent sign-ups first.
    rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    return Response.json({ users: rows });
  } catch (err) {
    console.error(`[admin/users] error (caller ${callerUid}):`, err);
    return Response.json({ error: "Error cargando usuarios" }, { status: 500 });
  }
}
