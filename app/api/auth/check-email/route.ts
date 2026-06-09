export async function POST(request: Request) {
  const { email } = await request.json();
  if (!email || typeof email !== "string") {
    return Response.json({ error: "Email requerido" }, { status: 400 });
  }

  try {
    const { adminAuth } = await import("@/lib/firebase-admin");
    await adminAuth.getUserByEmail(email);
    return Response.json({ exists: true });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "auth/user-not-found") {
      return Response.json({ exists: false });
    }
    console.error("[check-email] error:", err);
    return Response.json({ error: "Error verificando el correo" }, { status: 500 });
  }
}
