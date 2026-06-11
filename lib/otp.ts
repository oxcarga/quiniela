import { createHash, randomInt } from "node:crypto";

// Shared helpers for the emailed one-time-code login flow. Server-only — this
// imports node:crypto and must never be pulled into a client bundle.

// A server-side pepper makes the stored hashes resistant to offline brute force
// if the Firestore data ever leaks (a 4-digit space is only 10k values).
// Optional: set OTP_PEPPER in the environment for production hardening.
const PEPPER = process.env.OTP_PEPPER ?? "";

export const CODE_TTL_MS = 10 * 60 * 1000; // codes expire after 10 minutes
export const RESEND_COOLDOWN_MS = 60 * 1000; // min gap between sends per email
export const MAX_CODE_ATTEMPTS = 5; // lock the code after this many wrong tries

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateCode(): string {
  // 4-digit, zero-padded. Safe with the attempt cap + short TTL above.
  return randomInt(0, 10000).toString().padStart(4, "0");
}

export function hashCode(email: string, code: string): string {
  // Salt with the (normalized) email so identical codes for different users
  // never share a hash, then pepper with the server secret.
  return createHash("sha256")
    .update(`${PEPPER}:${normalizeEmail(email)}:${code}`)
    .digest("hex");
}
