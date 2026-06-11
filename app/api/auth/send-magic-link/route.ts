import { Resend } from "resend";
import {
  CODE_TTL_MS,
  RESEND_COOLDOWN_MS,
  generateCode,
  hashCode,
  normalizeEmail,
} from "@/lib/otp";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const body = await request.json();
  const email =
    typeof body.email === "string" ? normalizeEmail(body.email) : "";

  if (!email) {
    return Response.json({ error: "Email requerido" }, { status: 400 });
  }

  const actionCodeSettings = {
    url: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
    handleCodeInApp: true,
  };

  const isLocal = process.env.NEXT_PUBLIC_APP_URL?.startsWith(
    "http://localhost"
  );

  let link: string;
  let code: string;
  try {
    const { adminAuth, adminDb } = await import("@/lib/firebase-admin");
    link = await adminAuth.generateSignInWithEmailLink(
      email,
      actionCodeSettings
    );

    const codeRef = adminDb.collection("loginCodes").doc(email);

    // Per-email resend cooldown — blocks scripted code spamming. Skipped
    // locally so dev testing isn't throttled.
    if (!isLocal) {
      const existing = await codeRef.get();
      if (existing.exists) {
        const elapsed = Date.now() - (existing.data()?.createdAt ?? 0);
        if (elapsed < RESEND_COOLDOWN_MS) {
          return Response.json(
            { error: "Espera un momento antes de pedir otro código." },
            { status: 429 }
          );
        }
      }
    }

    code = generateCode();
    await codeRef.set({
      codeHash: hashCode(email, code),
      attempts: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + CODE_TTL_MS,
    });
  } catch (err) {
    console.error("[send-magic-link] setup error:", err);
    return Response.json(
      { error: "Error al generar el enlace" },
      { status: 500 }
    );
  }

  // ONLY in dev — skip email sending and return the link + code directly
  if (isLocal) return Response.json({ ok: true, link, code });

  const { error } = await resend.emails.send({
    from: "Quiniela Mundial 2026 <noreply@predicciones.app>",
    to: email,
    subject: "Tu código de acceso",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px;font-size:20px;font-weight:600">Quiniela Mundial 2026</h2>
        <p style="margin:0 0 16px;color:#555;font-size:15px">
          Tu código de acceso para <strong>${email}</strong> es:
        </p>
        <div style="font-size:34px;font-weight:700;letter-spacing:10px;text-align:center;background:#f4f4f5;border-radius:8px;padding:16px 0;margin:0 0 24px">
          ${code}
        </div>
        <p style="margin:0 0 24px;color:#555;font-size:14px">
          Escríbelo en la app para entrar. Esto funciona aunque tengas la app
          instalada en tu pantalla de inicio.
        </p>
        <p style="margin:0 0 8px;color:#999;font-size:13px">
          O, si abriste este correo en el mismo navegador, puedes usar el botón:
        </p>
        <a
          href="${link}"
          style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:15px;font-weight:500"
        >
          Iniciar sesión
        </a>
        <p style="margin:24px 0 0;color:#999;font-size:13px">
          Si no solicitaste este acceso puedes ignorar este mensaje.
          El código y el enlace expiran en 10 minutos.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("[send-magic-link] Resend error:", error);
    return Response.json({ error: "Error al enviar el email" }, { status: 500 });
  }

  console.log("[send-magic-link] Email sent to:", email);
  return Response.json({ ok: true });
}
