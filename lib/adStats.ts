import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

// Ad-banner interaction events. Kept in sync with the EVENTS allowlist in
// functions/src/logAdEvent.ts.
export type AdEvent =
  | "impression"
  | "bannerClose"
  | "bannerCloseAfterModal"
  | "modalOpen"
  | "modalCloseNoClick"
  | "clickWhatsapp"
  | "clickInstagram"
  | "clickPhone"
  | "clickOther";

// Events we also count as "unique per device", deduped via localStorage so a
// single active user doesn't inflate the unique totals.
const UNIQUE_EVENTS = new Set<AdEvent>([
  "impression",
  "modalOpen",
  "clickWhatsapp",
  "clickInstagram",
  "clickPhone",
]);

const callLogAdEvent = httpsCallable<
  { event: AdEvent; version: string; unique: boolean },
  { ok: true }
>(functions, "logAdEvent");

// Fire-and-forget analytics for the ad banner. Never throws or blocks the UI —
// a failed event must not affect the user's interaction with the banner.
export function logAdEvent(event: AdEvent, version: string): void {
  let unique = false;
  if (UNIQUE_EVENTS.has(event)) {
    const key = `adBanner.fired.${version}.${event}`;
    try {
      if (!localStorage.getItem(key)) {
        unique = true;
        localStorage.setItem(key, "1");
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — skip dedupe.
    }
  }
  callLogAdEvent({ event, version, unique }).catch(() => {});
}
