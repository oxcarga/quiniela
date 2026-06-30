# Quiniela Mundial 2026

A web app for predicting FIFA World Cup 2026 match results and competing on a shared leaderboard.

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
# Fill in your Firebase project values
```

### 3. Start Firebase emulators

```bash
npm run emulators
# Requires Java — install with: brew install --cask temurin
```

Emulator UI: http://localhost:4000

### 4. Compile Cloud Functions (separate terminal)

```bash
cd functions && npx tsc --watch
```

The emulator picks up compiled output from `functions/lib/`. Keep this running alongside the emulator so edits to `functions/src/` are reflected immediately.

### 5. Start the Next.js dev server (separate terminal)

```bash
npm run dev
```

App: http://localhost:3000

---

## Seeding Firestore

Run these once after the emulators are up (swap env var for `GOOGLE_APPLICATION_CREDENTIALS` to target production):

```bash
# All 104 World Cup fixtures
FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/seed-matches.ts

# FIFA men's world rankings (211 teams → /rankings/current)
FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/seed-rankings.ts
```

## Resolving the knockout bracket

Knockout matches are seeded with placeholder names (`2nd Group A`, `Best 3rd (A/B/C/D/F)`,
`Winner Match 73`). They must be resolved to real teams once each round's participants are known.

For the **Round of 32**, use `scripts/resolve-round-of-32.ts`. Edit the two config blocks at the
top of the file:

1. **`STANDINGS`** — the final 1st/2nd/3rd/4th team for each group (Spanish names matching `FLAG_MAP`).
2. **`BEST_THIRDS`** — for each of the 8 `Best 3rd (...)` matches, the group letter whose 3rd-place
   team fills that slot, **read off FIFA's published bracket** (see note below).

```bash
# Preview only — prints the resolved bracket, writes nothing (default):
npx tsx scripts/resolve-round-of-32.ts

# Commit (emulator):
FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/resolve-round-of-32.ts --commit

# Commit (production):
GOOGLE_APPLICATION_CREDENTIALS=./functions/service-account.json \
  npx tsx scripts/resolve-round-of-32.ts --commit
```

The script validates before writing (every best-3rd letter must be within that slot's allowed
list, no group used twice, all names in `FLAG_MAP`) and aborts on any problem.

> **Why `BEST_THIRDS` is manual:** the 8 best third-placed teams advance, but *which* group's
> third lands in *which* slot is decided by FIFA's pre-published 495-row combination table, not by
> a formula — the fixtures' `(A/B/C/D/F)` lists only bound the possibilities and don't uniquely
> determine the assignment. See [`RONDA_32_READINESS.md`](./RONDA_32_READINESS.md) for the full
> explanation. Later rounds (`Winner Match NN`) are not yet automated.

## Granting admin access

```bash
# Local emulator
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 npx tsx scripts/set-admin.ts user@example.com

# Production
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npx tsx scripts/set-admin.ts user@example.com
```

---

## Testing match states locally

- **Finished** (with result score): use the `/admin` page — select a match, enter a score, submit.
- **Locked** (kicked off, no result yet): open http://localhost:4000 → Firestore → `matches` → edit the `status` field to `"locked"`.

---

## Cloud Functions local testing

Firestore-triggered functions (`scoreMatch`, `updateLeaderboard`) fire automatically in the emulator when documents change — no extra steps needed.

The scheduled function (`updateMatchStatus`) is not auto-triggered by the emulator timer. To run it manually: http://localhost:4000 → Functions tab → click the function name.

---

## Testing magic link sign-in locally

The Firebase Auth emulator does **not** send real emails. Instead it stores the sign-in link internally. After submitting the login form, retrieve the link from:

```
http://localhost:9099/emulator/v1/projects/quiniela-ee895/oobCodes
```

The response contains an `oobLink` field — open that URL in your browser to complete sign-in. The user will then appear in the Auth emulator UI at http://localhost:4000/auth.

Example response:

```json
{
  "oobCodes": [
    {
      "email": "test@example.com",
      "requestType": "EMAIL_SIGNIN",
      "oobLink": "http://127.0.0.1:9099/emulator/action?mode=signIn&oobCode=...&continueUrl=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fconfirm"
    }
  ]
}
```

---

## Project structure

See [`plan.md`](./plan.md) for the full architecture, data model, and implementation tracker.
