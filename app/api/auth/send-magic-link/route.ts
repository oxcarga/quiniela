import { adminAuth } from "@/lib/firebase-admin";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email || typeof email !== "string") {
    return Response.json({ error: "Email requerido" }, { status: 400 });
  }

  const actionCodeSettings = {
    url: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
    handleCodeInApp: true,
  };

  let link: string;
  try {
    link = await adminAuth.generateSignInWithEmailLink(email, actionCodeSettings);
  } catch {
    return Response.json({ error: "Error al generar el enlace" }, { status: 500 });
  }

  const { error } = await resend.emails.send({
    from: "Quiniela Mundial 2026 <noreply@predicciones.app>",
    to: email,
    subject: "Tu enlace de acceso",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px;font-size:20px;font-weight:600">Quiniela Mundial 2026</h2>
        <p style="margin:0 0 24px;color:#555;font-size:15px">
          Haz clic en el botón de abajo para iniciar sesión con
          <strong>${email}</strong>.
        </p>
        <a
          href="${link}"
          style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:15px;font-weight:500"
        >
          Iniciar sesión
        </a>
        <p style="margin:24px 0 0;color:#999;font-size:13px">
          Si no solicitaste este enlace puedes ignorar este mensaje.
          El enlace expira en 1 hora.
        </p>
      </div>
    `,
  });

  if (error) {
    return Response.json({ error: "Error al enviar el email" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
