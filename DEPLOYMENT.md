# Deployment Guide — Quiniela Mundial 2026

The app has two independent deployment targets that must both be live for the app to function:

| Target | What it is | Where |
|---|---|---|
| **Next.js frontend** | The React web app | Vercel |
| **Firebase backend** | Firestore rules, indexes, and Cloud Functions | Firebase (project `quiniela-ee895`) |

---

## Prerequisites

### Tooling

```bash
node --version   # must be ≥ 20 (matches functions/package.json engines.node)
npm install -g firebase-tools
firebase login   # authenticate with the account that owns quiniela-ee895
```

### Firebase project

The project is `quiniela-ee895`. Confirm the CLI is pointing at it:

```bash
firebase projects:list   # quiniela-ee895 should appear
```

The `.firebaserc` file at the root does **not** have a clean `default` alias yet (it contains a stray key). Fix it before deploying:

```json
{
  "projects": {
    "default": "quiniela-ee895"
  }
}
```

---

## Step 1 — Deploy Firestore Rules and Indexes

Firestore rules and the `matchId` field index are defined locally and must be pushed before users can interact with the database.

```bash
firebase deploy --only firestore
```

This reads two files:
- `firestore.rules` — security rules (public read for matches/leaderboard, auth-gated predictions, admin-only result writes)
- `firestore.indexes.json` — the `matchId` field override used by the `scoreMatch` collection-group query

Run this first, before any other step. Rules must be live before the app or Cloud Functions touch Firestore.

---

## Step 2 — Deploy Cloud Functions

There are three Cloud Functions, all in `functions/src/`:

| Function | Trigger | What it does |
|---|---|---|
| `updateMatchStatus` | Scheduled every 5 minutes | Transitions `upcoming → locked` at kickoff; fetches results from football-data.org 115 min after kickoff and sets `status: "finished"` |
| `scoreMatch` | Firestore `onDocumentUpdated` on `/matches/{matchId}` | When a match transitions to `finished`, scores all user predictions and increments `totalScore` on each user document |
| `updateLeaderboard` | Firestore `onDocumentUpdated` on `/users/{userId}` | Rebuilds `/leaderboard/current` sorted by `totalScore` after any user's score changes |

### 2.1 Set the football-data.org API key

`updateMatchStatus` reads match results from the football-data.org v4 API. The key must be set as a Firebase Functions environment secret — **do not commit it in code**.

```bash
firebase functions:secrets:set FOOTBALL_DATA_API_KEY
# paste your key when prompted
```

The key in `functions/.env` is for local emulator use only and is not read in production.

### 2.2 Build and deploy

```bash
npm run func:build          # compiles functions/src → functions/lib
firebase deploy --only functions
```

Or in one step from the `functions/` directory:

```bash
cd functions
npm run deploy              # runs build then firebase deploy --only functions
```

Deployment takes 2–4 minutes. The Firebase console will show all three functions under the project's Functions tab after it completes.

---

## Step 3 — Seed Firestore (one-time)

These scripts must be run once against the **production** Firestore before the tournament starts. They are idempotent — re-running overwrites existing documents safely.

### 3.1 Get a service account key

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click **Generate new private key**
3. Save the file as `service-account.json` in the project root (it is in `.gitignore`)

### 3.2 Seed match fixtures (104 matches)

```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npx tsx scripts/seed-matches.ts
```

Reads `data/fifa_world_cup_2026_group_fixtures.json` and writes all 104 fixtures to `/matches/{matchId}`. Match IDs follow the pattern `WC2026_001` … `WC2026_104`.

### 3.3 Seed FIFA world rankings

```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npx tsx scripts/seed-rankings.ts
```

Reads `data/fifa_world_ranking_men.json` and writes 211 teams to `/rankings/current`.

### 3.4 Delete the service account key

```bash
rm service-account.json
```

Never leave it on disk after you're done.

---

## Step 4 — Deploy the Next.js Frontend to Vercel

### 4.1 Connect the repository

1. Go to [vercel.com](https://vercel.com) and click **Add New Project**
2. Import the GitHub repository
3. Vercel auto-detects Next.js — no build settings need to change
4. **Do not deploy yet.** Set environment variables first.

### 4.2 Set environment variables in Vercel

In the Vercel project dashboard → Settings → Environment Variables, add all of the following for the **Production** environment:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Project Settings → Your apps → SDK setup |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Same — format: `quiniela-ee895.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `quiniela-ee895` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Same — format: `quiniela-ee895.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Same |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Same |
| `NEXT_PUBLIC_APP_URL` | Your Vercel production URL, e.g. `https://quiniela.vercel.app` |

The `NEXT_PUBLIC_*` prefix means these are embedded in the client bundle at build time — they are safe to expose (they are Firebase public config, not secrets).

### 4.3 Deploy

Click **Deploy** in the Vercel dashboard, or push to the `main` branch — Vercel deploys automatically on every push.

### 4.4 Add the Vercel domain to Firebase Authorized Domains

Magic link emails will fail if the redirect domain is not whitelisted in Firebase.

1. Firebase Console → Authentication → Settings → Authorized Domains
2. Add your Vercel production URL (e.g. `quiniela.vercel.app`)
3. Also add any preview URLs you want to test against (e.g. `quiniela-git-main-yourteam.vercel.app`)

---

## Step 5 — Enable Firebase Authentication

If not already done in the Firebase Console:

1. Authentication → Sign-in method → Email/Password → **Enable**
2. Under Email/Password, toggle **"Email link (passwordless sign-in)"** → **On**
3. Optionally customize the magic link email template (logo, subject, body) under Authentication → Templates

---

## Step 6 — Grant Admin Access

The admin panel (`/admin`) is protected by a custom Firebase Auth claim `admin: true`. At least one user must be granted this claim before official results can be entered.

The user must have signed in at least once (so their Firebase Auth record exists) before you run this.

```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npx tsx scripts/set-admin.ts your@email.com
```

The user must sign out and back in after this runs for the new claim to appear in their ID token.

---

## Deployment Checklist

Run through this before the tournament starts:

- [ ] `.firebaserc` has a clean `default` alias pointing to `quiniela-ee895`
- [ ] Firestore rules and indexes deployed (`firebase deploy --only firestore`)
- [ ] `FOOTBALL_DATA_API_KEY` secret set in Firebase Functions
- [ ] Cloud Functions deployed (`firebase deploy --only functions`)
- [ ] 104 match fixtures seeded to production Firestore
- [ ] FIFA rankings seeded to production Firestore
- [ ] Service account key deleted from disk
- [ ] All `NEXT_PUBLIC_*` env vars set in Vercel
- [ ] `NEXT_PUBLIC_APP_URL` set to the production Vercel URL
- [ ] Vercel production URL added to Firebase Authorized Domains
- [ ] Firebase Email Link sign-in enabled
- [ ] Admin claim granted to at least one user
- [ ] Admin user has signed out and back in to refresh their token
- [ ] Test the full flow end-to-end: sign up → predict a match → admin enters result → leaderboard updates

---

## Re-deploying Individual Pieces

| What changed | Command |
|---|---|
| Firestore security rules | `firebase deploy --only firestore:rules` |
| Firestore indexes | `firebase deploy --only firestore:indexes` |
| Cloud Functions | `npm run func:build && firebase deploy --only functions` |
| Single function | `firebase deploy --only functions:scoreMatch` |
| Next.js app | Push to `main` — Vercel deploys automatically |

---

## Local Development vs Production

The Next.js app auto-connects to the Firebase Emulator Suite in `NODE_ENV=development` (see [lib/firebase.ts](lib/firebase.ts)). In production (`NODE_ENV=production`) it connects directly to the real Firebase project. No code changes are needed between environments — the switch is purely env-based.

```bash
# Local dev — emulators must be running first
npm run emulators   # starts Auth (9099), Firestore (8080), Functions (5001)
npm run dev         # Next.js on :3000, auto-connects to emulators
```

---

## Architecture Overview

```
User's browser
     │
     ▼
  Vercel (Next.js)
     │  reads/writes
     ▼
  Firestore ─────────────────────────────────┐
     │                                       │
     │ onDocumentUpdated /matches/{id}        │
     ▼                                       │
  scoreMatch (CF)                            │
     │ increments users/{userId}.totalScore  │
     ▼                                       │
  updateLeaderboard (CF)                     │
     │ rebuilds /leaderboard/current         ▼
     └──────────────────────────────→  Firestore
                                            ▲
  updateMatchStatus (CF, every 5 min)       │
     │ football-data.org API                │
     └──────────────── writes results ──────┘
```
