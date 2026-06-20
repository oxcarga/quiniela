import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin";

// Allowlisted ad-banner events. Kept in sync with the AdEvent union in
// lib/adStats.ts on the client.
const EVENTS = new Set([
  "impression",
  "bannerClose",
  "bannerCloseAfterModal",
  "modalOpen",
  "modalCloseNoClick",
  "clickWhatsapp",
  "clickInstagram",
  "clickPhone",
  "clickOther",
]);

// Day-bucket key in Mexico City time (en-CA renders YYYY-MM-DD), matching the
// convention used by toggleBooster's kickoffDay.
function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Records a single ad-banner interaction. Clients can't write under /config
// (admin-only per Firestore rules), so all stats flow through here on the Admin
// SDK. Counters are stored per banner version; a per-day subcollection keeps a
// lightweight time series. `unique` (deduped per device on the client) also
// bumps a parallel `{event}Unique` counter.
export const logAdEvent = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  const event = request.data?.event;
  const version = request.data?.version;
  const unique = request.data?.unique === true;

  if (typeof event !== "string" || !EVENTS.has(event)) {
    throw new HttpsError("invalid-argument", "Evento inválido.");
  }
  if (typeof version !== "string" || !version) {
    throw new HttpsError("invalid-argument", "Versión inválida.");
  }

  const day = today();
  const statsRef = db.doc(`config/adBanner/stats/${version}`);
  const dayRef = statsRef.collection("days").doc(day);

  const totals: Record<string, unknown> = {
    [event]: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (unique) totals[`${event}Unique`] = FieldValue.increment(1);

  const batch = db.batch();
  batch.set(statsRef, totals, { merge: true });
  batch.set(dayRef, { [event]: FieldValue.increment(1), date: day }, { merge: true });
  await batch.commit();

  return { ok: true } as const;
});
