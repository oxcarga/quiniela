import { MAX_CODE_ATTEMPTS, hashCode, normalizeEmail } from "@/lib/otp";

type Outcome = "ok" | "invalid" | "expired" | "locked";

export async function POST(request: Request) {
  const body = await request.json();
  const email =
    typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!email || !/^\d{4}$/.test(code)) {
    return Response.json({ error: "Código inválido." }, { status: 400 });
  }

  const { adminAuth, adminDb } = await import("@/lib/firebase-admin");
  const codeRef = adminDb.collection("loginCodes").doc(email);

  // Validate + atomically bump the attempt counter so concurrent guesses can't
  // race past the cap.
  let outcome: Outcome;
  try {
    outcome = await adminDb.runTransaction<Outcome>(async (tx) => {
      const snap = await tx.get(codeRef);
      if (!snap.exists) return "invalid";
      const data = snap.data()!;
      if (Date.now() > data.expiresAt) {
        tx.delete(codeRef);
        return "expired";
      }
      if ((data.attempts ?? 0) >= MAX_CODE_ATTEMPTS) return "locked";
      if (data.codeHash !== hashCode(email, code)) {
        tx.update(codeRef, { attempts: (data.attempts ?? 0) + 1 });
        return "invalid";
      }
      tx.delete(codeRef);
      return "ok";
    });
  } catch (err) {
    console.error("[verify-code] transaction error:", err);
    return Response.json(
      { error: "Error al verificar el código" },
      { status: 500 }
    );
  }

  if (outcome === "locked") {
    return Response.json(
      { error: "Demasiados intentos. Solicita un código nuevo." },
      { status: 429 }
    );
  }
  if (outcome !== "ok") {
    // Generic message for both wrong and expired — don't leak which.
    return Response.json(
      { error: "Código inválido o expirado." },
      { status: 400 }
    );
  }

  // Resolve the Firebase Auth user (creating it for first-time logins, just as
  // the magic-link flow does implicitly), then mint a custom token the client
  // exchanges via signInWithCustomToken — keeping the whole login inside the PWA.
  try {
    let uid: string;
    try {
      const existing = await adminAuth.getUserByEmail(email);
      uid = existing.uid;
    } catch (err) {
      if ((err as { code?: string }).code === "auth/user-not-found") {
        // The code proves ownership of the inbox, so mark the email verified.
        const created = await adminAuth.createUser({
          email,
          emailVerified: true,
        });
        uid = created.uid;
      } else {
        throw err;
      }
    }

    const token = await adminAuth.createCustomToken(uid);
    return Response.json({ token });
  } catch (err) {
    console.error("[verify-code] token error:", err);
    return Response.json({ error: "Error al iniciar sesión" }, { status: 500 });
  }
}
