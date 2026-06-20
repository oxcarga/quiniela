# Mundial 2026 — Quiniela App: Project Plan

> Last updated: June 9, 2026  
> Status: In Progress — core features complete, tournament underway

---

## 1. Project Overview

A web application that allows a group of users to predict the results of FIFA World Cup 2026 matches, compete on a shared leaderboard, and track scores in real time. The app uses passwordless email authentication via magic links.

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 16** (App Router) | SSR, API routes, file-based routing, Vercel-native |
| Auth | **Firebase Authentication** | Email Link (magic link) passwordless auth |
| Database | **Firestore** | Real-time listeners, great for leaderboard and live prediction updates |
| Hosting | **Vercel** | Zero-config Next.js deployment, free tier sufficient for MVP |
| UI Components | **shadcn/ui** | Accessible, unstyled base components; code is owned by the project |
| Styling | **Tailwind CSS** | Required by shadcn; utility-first, co-located styles, fast iteration |
| State (client) | **Zustand** | Lightweight global state (current user, selected match, etc.) |
| Data fetching | **TanStack Query (React Query)** | Caching, background refetch, loading/error states for Firestore reads |
| Validation | **Zod** | Schema validation for prediction form submissions |
| Backend logic | **Firebase Cloud Functions** | Auto-scoring predictions after official results are entered; avoids client-side trust issues |
| Dev tooling | **Firebase Emulator Suite** | Local Firestore + Auth dev without hitting production |

---

## 3. Authentication

### 3.1 Supported Methods

- Email magic link (passwordless — no password ever set or required)

### 3.2 Magic Link Flow

1. User enters their email on `/login`
2. Firebase sends a sign-in link to that email
3. Email is stored in `localStorage` as `emailForSignIn`
4. User clicks the link → lands on `/auth/confirm`
5. App reads `localStorage`, calls `signInWithEmailLink()`
6. If the link was opened on a different device → prompt user to re-enter email
7. On first login → check if `displayName` is null → redirect to `/onboarding`
8. On `/onboarding` → user picks a nickname (max 24 chars) → saved to Firebase Auth profile + Firestore

### 3.3 Onboarding Rule

After login, the following check applies:

```
if (!user.displayName) → redirect to /onboarding before entering the app
```

### 3.4 Firebase Console Setup Checklist

- [ ] Enable **Email/Password** provider
- [ ] Toggle **"Email link (passwordless sign-in)"** ON under Email/Password
- [ ] Add all domains to **Authorized Domains** (localhost + Vercel URL)
- [ ] Customize the magic link email template (logo, subject line, copy)

---

## 4. Firestore Data Model

### 4.1 Collections

#### `/matches/{matchId}`
Stores all World Cup fixtures. Populated before the tournament; updated with official results by the admin.

```ts
{
  matchId: string,          // e.g. "WC2026_GS_01"
  phase: "group" | "round_of_16" | "quarter" | "semi" | "final",
  group?: string,           // e.g. "A" — only for group stage
  homeTeam: string,         // e.g. "Mexico"
  awayTeam: string,
  homeFlag: string,         // emoji or URL
  awayFlag: string,
  kickoffAt: Timestamp,     // UTC
  status: "upcoming" | "locked" | "finished",
  result?: {
    homeGoals: number,
    awayGoals: number,
    winner?: "home" | "away" | "draw",  // draw only valid in group stage
  }
}
```

#### `/users/{userId}`
Created on first login, updated on each subsequent login.

```ts
{
  uid: string,
  email: string,
  displayName: string,
  photoURL: string | null,
  totalScore: number,       // denormalized for leaderboard performance
  createdAt: Timestamp,
}
```

#### `/predictions/{userId}/matches/{matchId}`
Each user has their own subcollection of predictions.

```ts
{
  userId: string,
  matchId: string,
  predictedHomeGoals: number,
  predictedAwayGoals: number,
  submittedAt: Timestamp,
  pointsEarned: number | null,  // null until match is finished and scored
}
```

#### `/leaderboard` (single document, denormalized)
Updated by a Cloud Function after every match is scored. Avoids expensive collection queries on every page load.

```ts
{
  updatedAt: Timestamp,
  rankings: [
    {
      userId: string,
      displayName: string,
      photoURL: string | null,
      totalScore: number,
      position: number,
    }
  ]
}
```

#### `/rankings/current` (single document)
FIFA men's world rankings. Seeded from `data/fifa_world_ranking_men.json` via `scripts/seed-rankings.ts`. Team names are in Spanish as published by FIFA.

```ts
{
  updatedAt: Timestamp,
  teams: [
    {
      ranking: number,   // e.g. 1
      team: string,      // e.g. "Francia" (Spanish, as per FIFA)
      lastResults: string[],  // e.g. ["W","W","D","W","D"]
    }
  ]
}
```

### 4.2 Security Rules (key rules)

```
// Users can only read/write their own predictions
match /predictions/{userId}/matches/{matchId} {
  allow read: if request.auth != null;
  allow write: if request.auth.uid == userId
               && request.time < get(/databases/$(database)/documents/matches/$(matchId)).data.kickoffAt;
}

// Matches are public read, admin-only write
match /matches/{matchId} {
  allow read: if true;
  allow write: if request.auth.token.admin == true;
}

// Leaderboard is public read, written only by Cloud Functions
match /leaderboard/{doc} {
  allow read: if true;
  allow write: if false; // Cloud Function uses admin SDK
}
```

---

## 5. Scoring System

Define this before launch so Cloud Functions implement it correctly.

| Prediction | Points |
|---|---|
| Exact score (e.g. 2-1 predicted, 2-1 result) | **3 points** |
| Predicted draw AND result is a draw (wrong score) | **2 points** |
| Correct winner / draw, wrong score | **1 point** |
| Wrong outcome | **0 points** |

**Knockout stage note:** In knockout matches there are no draws in 90 minutes from the prediction perspective. A match ending 1-1 AET (going to penalties) should be defined clearly — recommend treating the 90-min result as the scoreline for prediction purposes.

---

## 6. App Routes

| Route | Access | Description |
|---|---|---|
| `/login` | Public | Login screen (magic link) |
| `/auth/confirm` | Public | Magic link redirect handler |
| `/onboarding` | Auth required | First-time user nickname setup |
| `/` | Auth required | Home / leaderboard |
| `/matches` | Auth required | All matches list, filterable by phase |
| `/matches/[matchId]` | Auth required | Match detail + prediction form |
| `/profile` | Auth required | User's own predictions history + score breakdown |
| `/admin` | Admin only | Enter official match results |

---

## 7. Key Features

### 7.1 Leaderboard
- Real-time Firestore listener on the `/leaderboard` document
- Shows position, avatar, name, total score
- Highlight the current user's row
- Animated rank changes after scoring

### 7.2 Match List
- Grouped by phase (Group Stage → Round of 16 → etc.)
- Each match card shows: teams, flags, kickoff time (in user's local timezone), status badge (`UPCOMING` / `LOCKED` / `FT`)
- Clicking a match opens the prediction form if still open, or the result + user's prediction if locked

### 7.3 Prediction Form
- Two number inputs (home goals, away goals)
- Disabled and locked automatically when `kickoffAt` is reached (enforced also by Firestore security rules)
- Submission optimistically updates the UI, confirmed by Firestore write

### 7.4 Prediction Lock
- Match `status` field changes from `upcoming` → `locked` at `kickoffAt`
- A scheduled Cloud Function runs every minute to update match statuses
- Firestore security rules double-enforce the lock (belt-and-suspenders)

### 7.5 Auto-scoring (Cloud Function)
- Triggered when an admin writes the official result to `/matches/{matchId}`
- Reads all predictions for that match from `/predictions/*/matches/{matchId}`
- Calculates points per user, writes `pointsEarned` back to each prediction document
- Recalculates `totalScore` on each user document
- Regenerates the `/leaderboard` document

### 7.6 Admin Panel (`/admin`)
- Protected by a custom Firebase Auth claim: `admin: true`
- Simple form: select match → enter home goals, away goals → submit
- Sets `status: "finished"` and `result` on the match document
- Triggers the scoring Cloud Function

### 7.7 Push Notifications (Phase 2)
- Firebase Cloud Messaging
- Remind users 30 minutes before a match locks
- Notify when their score is updated after a match

---

## 8. File & Folder Structure

```
/
├── app/
│   ├── layout.tsx                  # Root layout — Providers + bottom Navbar
│   ├── providers.tsx               # TanStack Query + Zustand providers wrapper
│   ├── page.tsx                    # Home / leaderboard
│   ├── login/
│   │   └── page.tsx                # Login screen
│   ├── api/
│   │   └── auth/
│   │       ├── send-magic-link/
│   │       │   └── route.ts        # Generates Firebase magic link + sends custom email via Resend
│   │       └── check-email/
│   │           └── route.ts        # Checks if email is registered (Admin SDK, no auth required)
│   ├── auth/
│   │   └── confirm/
│   │       └── page.tsx            # Magic link confirmation
│   ├── onboarding/
│   │   └── page.tsx                # First-login nickname setup
│   ├── matches/
│   │   ├── page.tsx                # Match list
│   │   └── [matchId]/
│   │       └── page.tsx            # Match detail + prediction
│   ├── profile/
│   │   └── page.tsx                # User profile + history
│   └── admin/
│       └── page.tsx                # Admin result entry (all matches, pre-fills existing result)
│
├── components/
│   ├── ui/                         # shadcn generated components (Button, Input, …)
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── OnboardingForm.tsx
│   ├── matches/
│   │   ├── MatchCard.tsx           # Card with prediction pill or "Sin predicción"
│   │   ├── MatchDetail.tsx         # Full match detail view
│   │   ├── MatchList.tsx           # Filtered list; bulk-fetches user predictions
│   │   └── PredictionForm.tsx      # Score input form (defaults to 0–0)
│   ├── leaderboard/
│   │   ├── Leaderboard.tsx
│   │   └── LeaderboardRow.tsx
│   └── layout/
│       ├── Navbar.tsx              # Fixed bottom nav (Home, Partidos, Perfil, Admin)
│       └── ProtectedRoute.tsx
│
├── context/
│   └── AuthContext.tsx             # Auth state + all auth methods
│
├── lib/
│   ├── firebase.ts                 # Firebase client SDK init
│   ├── firebase-admin.ts           # Firebase Admin SDK init (used by API routes)
│   ├── firestore.ts                # Firestore types + helper functions
│   ├── scoring.ts                  # Scoring logic (3/2/1/0 points)
│   └── utils.ts                    # shadcn cn() utility
│
├── hooks/
│   ├── useLeaderboard.ts           # Firestore real-time listener
│   ├── useMatches.ts               # Matches with TanStack Query
│   └── usePredictions.ts           # User predictions (single + bulk)
│
├── store/
│   └── useAppStore.ts              # Zustand store (matchPhaseFilter, selectedMatchId)
│
├── data/                           # Static JSON source data
│   ├── fifa_world_cup_2026_group_fixtures.json   # 104 fixtures (Spanish team names)
│   ├── fifa_world_ranking_men.json               # FIFA rankings array (211 teams)
│   └── fifa_world_ranking_men_by_name.json       # Rankings keyed by Spanish team name
│
├── scripts/                        # One-off admin / seeding scripts (run with tsx)
│   ├── seed.sh                     # Convenience wrapper — runs both seed scripts from project root
│   ├── seed-matches.ts             # Seed /matches from fixtures JSON
│   ├── seed-rankings.ts            # Seed /rankings/current from rankings JSON
│   ├── set-admin.ts                # Grant admin custom claim to a user by email
│   ├── export-db.ts                # Export all Firestore collections/subcollections to timestamped JSON
│   └── repair-scores.ts            # Recalculate each user's totalScore from prediction pointsEarned; updates users + triggers leaderboard rebuild
│
├── functions/                      # Firebase Cloud Functions (v2)
│   ├── src/
│   │   ├── index.ts                # Exports all functions
│   │   ├── admin.ts                # Admin SDK init
│   │   ├── leaderboard.ts          # Shared rebuildLeaderboard() — reads all users, writes /leaderboard/current
│   │   ├── scoreMatch.ts           # Triggered on result write — scores predictions + calls rebuildLeaderboard()
│   │   ├── updateMatchStatus.ts    # Scheduled: lock matches at kickoff time
│   │   └── updateLeaderboard.ts    # Fallback trigger on users/{userId} — delegates to rebuildLeaderboard()
│   ├── tsconfig.json
│   └── package.json
│
├── .env.local.example
└── firebase.json                   # Firebase project config (emulator ports, etc.)
```

---

## 9. Environment Variables

```bash
# Firebase (public — safe to expose in browser)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# App URL (for magic link redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Firebase Admin SDK — service account JSON (used by API routes, not Cloud Functions)
# Paste the full JSON content of your service-account.json as a single line
FIREBASE_SERVICE_ACCOUNT_KEY=

# Resend API key — for sending custom magic link emails
RESEND_API_KEY=

# Firebase Auth emulator host (local dev only — omit in production)
# When set, firebase-admin.ts initializes without credentials (emulator ignores them)
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099

# football-data.org API key (used by Cloud Function CF-2 to fetch match results)
# Get a free key at https://www.football-data.org/client/register
FOOTBALL_DATA_API_KEY=
```

---

## 10. Development Setup

```bash
# 1. Clone and install
git clone <repo>
cd quiniela
npm install

# 2. Copy env vars
cp .env.local.example .env.local
# → fill in Firebase values

# 3. Install Firebase CLI
npm install -g firebase-tools
firebase login

# 4. Start Firebase emulators (Auth + Firestore + Functions)
firebase emulators:start

# 5. Seed Firestore (once, while emulators are running)
bash scripts/seed.sh

# 6. Run Next.js dev server
npm run dev
```

---

## 11. Deployment

### Vercel (Next.js)
1. Push to GitHub
2. Import repo in Vercel
3. Add all `NEXT_PUBLIC_*` env vars in Vercel dashboard
4. Deploy — Vercel auto-detects Next.js

### Firebase Cloud Functions
```bash
cd functions
npm run build
firebase deploy --only functions
```

### Firestore Rules + Indexes
```bash
firebase deploy --only firestore
```

---

## 12. Implementation Tracker

Progress legend: `[x]` done · `[~]` scaffolded / stub only · `[ ]` not started

---

### 12.1 Foundation

| # | Task | Status | Notes |
|---|---|---|---|
| F-1 | Firebase project setup (console: Auth + Firestore enabled) | [x] | Enable Email Link provider, add authorized domains |
| F-2 | Next.js + Tailwind + shadcn scaffolding | [x] | All dirs and stub files created |
| F-3 | `lib/firebase.ts` — Firebase init | [x] | Auth + Firestore exported; emulator wiring on `NODE_ENV=development` |
| F-4 | `.env.local` filled in with real Firebase values | [x] | Copy from `.env.local.example` |
| F-5 | Firestore security rules deployed | [x] | See §4.2 |
| F-6 | Firebase emulators running locally | [x] | `firebase emulators:start` |

---

### 12.2 Auth Flow

| # | Task | Status | Notes |
|---|---|---|---|
| A-1 | `context/AuthContext.tsx` — full implementation | [x] | `onAuthStateChanged`, send/confirm link, user state, setDisplayName (uses `auth.currentUser` — spreading would strip Firebase prototype methods), signOut |
| A-2 | `app/login/page.tsx` + `components/auth/LoginForm.tsx` | [x] | Email input with 4-state flow: `idle` → submit → lookup → if found: `sendSignInLinkToEmail` → `success`; if not found: `confirm_new` (amber warning "No encontramos una cuenta" + "Soy nuevo, continuar" / "Probar con otro correo") → on confirm: send link → `success` |
| A-3 | `app/auth/confirm/page.tsx` — magic link handler | [x] | `signInWithEmailLink`; device-mismatch prompt; redirects to /onboarding or / |
| A-4 | `app/onboarding/page.tsx` + `OnboardingForm.tsx` | [x] | Nickname input (max 24), `setDisplayName` → redirects to / |
| A-5 | `proxy.ts` — route protection (replaces deprecated `middleware.ts`) | [x] | Optimistic cookie check; redirects unauthenticated to `/login` |
| A-6 | `components/layout/ProtectedRoute.tsx` | [x] | Redirects unauthed → /login, no displayName → /onboarding; shows loader while Firebase resolves |
| A-7 | User document created in Firestore on first login | [x] | Written in `setDisplayName` (called from `OnboardingForm`). Writes `uid`, `email`, `photoURL`, `displayName` with `merge: true` — `totalScore` is omitted and managed by Cloud Functions via `FieldValue.increment` |
| A-9 | `signInLinkDEV` on `AuthContext` — dev-only magic link passthrough | [x] | `sendMagicLink` reads the `link` field from the `send-magic-link` API response (only returned by the emulator); stores it in `signInLinkDEV` state. Consumed by dev UI to skip email and click the link directly in the browser |
| A-8 | Duplicate-account guard on login | [x] | `LoginForm` calls `getUserByEmail` before sending magic link; if email not found → `confirm_new` state shows amber warning + "Soy nuevo, continuar" / "Probar con otro correo"; returning users with correct email see zero friction. `getUserByEmail` calls `/api/auth/check-email` (Admin SDK) — direct Firestore queries are blocked for unauthenticated users, and the deprecated `fetchSignInMethodsForEmail` client API silently returns empty for passwordless users |

---

### 12.3 Core Data Layer

| # | Task | Status | Notes |
|---|---|---|---|
| D-1 | `lib/firestore.ts` — helper functions | [x] | getMatch, getMatches, getPrediction, setPrediction, getUserPredictions, setMatchResult, getLeaderboard, getUserByEmail; Match type includes optional `venue` and `city` fields; `getUserByEmail` fetches `/api/auth/check-email` (server-side Admin SDK) — direct Firestore reads are blocked for unauthenticated users and the deprecated `fetchSignInMethodsForEmail` always returned empty for email-link users; `setMatchResult` accepts `matchEnded: boolean` and sets status to `"finished"` or `"locked"` accordingly |
| D-2 | `lib/scoring.ts` — scoring logic | [x] | `calculatePoints(prediction, result): number` |
| D-3 | `hooks/useMatches.ts` — TanStack Query | [x] | `useMatches(phase?)` + `useMatch(matchId)` |
| D-4 | `hooks/usePredictions.ts` — user predictions | [x] | `usePrediction(userId, matchId)` + `useSetPrediction(userId, matchId)`; on save invalidates `["predictions", userId]` (parent key) so both the per-match and bulk queries refetch |
| D-5 | `hooks/useLeaderboard.ts` — real-time listener | [x] | `useLeaderboard()` — `onSnapshot` on `/leaderboard/current`; returns `{ data, loading, error }` |
| D-6 | `store/useAppStore.ts` — Zustand store | [x] | `matchPhaseFilter` + `selectedMatchId` slices |
| D-7 | Seed Firestore with all 104 fixtures | [x] | `scripts/seed-matches.ts` reads `data/fifa_world_cup_2026_group_fixtures.json`; FLAG_MAP uses Spanish team names; knockout teams are "TBD" until determined |
| D-8 | Seed Firestore with FIFA world rankings | [x] | `scripts/seed-rankings.ts` reads `data/fifa_world_ranking_men.json`; writes 211 teams to `/rankings/current`; team names in Spanish |
| D-9 | `scripts/seed.sh` — combined seed runner | [x] | Bash wrapper; `cd`s to project root so relative `data/` paths resolve correctly, then runs seed-matches and seed-rankings in sequence; `set -e` stops on first failure |

---

### 12.4 Match Pages

| # | Task | Status | Notes |
|---|---|---|---|
| M-1 | `components/matches/MatchCard.tsx` | [x] | Outer `<div>` wraps a `<Link>` (teams, score, badge, time — navigates to detail) and a sibling prediction `<div>` (not inside the link). Prediction area: upcoming + no prediction → blue "Predecir" button opens inline form (two inputs + Guardar/Cancelar); upcoming + prediction exists → green score pill + "Editar"; locked/finished + prediction → green pill only; locked/finished + no prediction → "Sin predicción". Saves scroll position to `sessionStorage["scroll:matches"]` on link click; `highlighted` prop animates green bg for 4 s via `transition-colors duration-1000`. Accepts `userId` prop (required for mutation). |
| M-2 | `components/matches/MatchList.tsx` | [x] | Grouped by phase, phase filter pills; fetches all user predictions once (`useUserPredictions`) and passes each to its card; on mount reads `sessionStorage["scroll:matches"]` (restores position via double-rAF) and `sessionStorage["highlight:match"]` (passes `highlighted` to the matching card) |
| M-3 | `app/matches/page.tsx` | [x] | ProtectedRoute + MatchList |
| M-4 | `components/matches/PredictionForm.tsx` | [x] | 2 number inputs (default 0, not empty), Zod validation, auto-disable when locked/finished, pre-fills existing prediction; on save success writes `matchId` to `sessionStorage["highlight:match"]` so MatchList highlights the card on return. For locked/finished matches with no prediction (query resolved, `existing` is null) renders "Sin predicción" early — avoids showing a misleading 0–0 disabled form |
| M-5 | `app/matches/[matchId]/page.tsx` | [x] | Async params; MatchDetail client component: form if upcoming, result + points if finished |

---

### 12.5 Leaderboard & Home

| # | Task | Status | Notes |
|---|---|---|---|
| L-1 | `components/leaderboard/LeaderboardRow.tsx` | [x] | Position (medal for top 3), avatar initials, name, score, highlights own row |
| L-2 | `components/leaderboard/Leaderboard.tsx` | [x] | Real-time via `useLeaderboard`; loading/error/empty states |
| L-3 | `app/page.tsx` — home / leaderboard | [x] | ProtectedRoute + Leaderboard |

---

### 12.6 Profile Page

| # | Task | Status | Notes |
|---|---|---|---|
| P-1 | `app/profile/page.tsx` — prediction history + score breakdown | [x] | User header, stats bar (total pts / predictions / scored), full prediction list sorted by kickoff with result + points badge |

---

### 12.7 Admin Panel

| # | Task | Status | Notes |
|---|---|---|---|
| AD-1 | `app/admin/page.tsx` — result entry form | [x] | Admin claim guard via `getIdTokenResult`; match selector (all matches, ✅ prefix on finished ones, pre-fills existing score for corrections), score inputs inline with flags, writes `status: "finished"` + `result` to Firestore |
| AD-2 | `scripts/set-admin.ts` — set `admin: true` custom claim | [x] | Works with emulator (`FIREBASE_AUTH_EMULATOR_HOST=localhost:9099`) and prod (`GOOGLE_APPLICATION_CREDENTIALS`); usage: `npx tsx scripts/set-admin.ts user@example.com` |

---

### 12.8 Cloud Functions

| # | Task | Status | Notes |
|---|---|---|---|
| CF-1 | `functions/src/scoreMatch.ts` — triggered on result write | [x] | `onDocumentUpdated` on `/matches/{matchId}`; scores all predictions when status → "finished"; increments user `totalScore` via `FieldValue.increment`; directly calls `rebuildLeaderboard()` after `batch.commit()` to guarantee leaderboard sync without relying on the trigger chain. Re-scoring supported: if an admin corrects a result after finalization (status stays "finished" but `result` changes), the function re-fires, computes a delta (`newPoints − previousPoints`), and adjusts `totalScore` accordingly — avoiding double-counting |
| CF-2 | `functions/src/updateMatchStatus.ts` — scheduled every 5 min | [x] | Locks upcoming→locked at kickoff; fetches results from football-data.org (115 min cutoff); sets status→finished + result |
| CF-3 | `functions/src/updateLeaderboard.ts` — rebuild leaderboard doc | [x] | `onDocumentUpdated` on `/users/{userId}`; fallback for non-scoring user updates (e.g. display name change); delegates to shared `rebuildLeaderboard()` in `leaderboard.ts` |
| CF-4 | Deploy Cloud Functions to Firebase | [ ] | `firebase deploy --only functions` |

---

### 12.9 Layout & Navigation

| # | Task | Status | Notes |
|---|---|---|---|
| N-1 | `components/layout/Navbar.tsx` | [x] | Fixed bottom nav; tabs: Inicio, Partidos, Perfil, Admin (admin-only); active tab highlighted; hidden on /login and /onboarding |
| N-2 | `app/layout.tsx` — root layout with AuthProvider | [x] | Providers (QueryClient + Auth) wired; Navbar rendered globally; `pb-16` on body to clear fixed nav |

---

### Phase 2 — During tournament
- [ ] Animated rank changes after scoring
- [ ] Profile page — full prediction history + per-match score breakdown
- [ ] Knockout stage match seeding (auto-populate as teams advance)
- [ ] Push notifications — 30 min before lock, score update after match
- [ ] Mobile-responsive polish

### Phase 3 — Nice to have
- [ ] Share leaderboard as image (OG card)
- [ ] Multiple quiniela groups (invite-only rooms)
- [ ] Chat / reactions per match
- [ ] Statistics page (most predicted results, upset tracker)

---

## 13. Improvements

| # | Improvement | Notes | Done |
|---|---|---|---|
| I-1 | Inline predictions on `/matches` | Allow users to submit/edit their prediction directly from the match list card, without navigating to `/matches/:matchId`. The detail page can remain for the full result + points view. | ✅ 
| I-2 | Show prediction + result inline on `/matches` | Alongside each match card, display the user's predicted score. If the match is finished, show the official result and points earned side by side with the prediction. | ✅
| I-3 | Show FIFA team rankings on `/matches` | We currently have ranking information in `data/fifa_world_cup_2026_group_fixtures.json`. Display each team's current standing next to their name in the match card. | ✅
| I-4 | Show rules in Spanish | Display the scoring rules somewhere accessible. Options: (a) a "?" or "Reglas" button in the Navbar/Inicio tab that opens a modal; (b) a collapsible section at the bottom of the Inicio page; (c) a dedicated `/rules` page linked from the footer. Modal approach keeps it lightweight and doesn't require a new route. | ✅
| I-5 | Extra time & penalty handling | Clarify scoring policy: does a 1–1 result at 90 min that ends 1–2 after extra time score as 1–1 or 1–2? Scores as 1-2. The final result after 90+30 is the final result the predictions will be checked against.  What about a penalty shootout — does the scoreline freeze at the 90+ET score or include a "winner" bonus? No winner bonnus. regukar time + ET, and that's it. | ✅
| I-6 | Match booster | Allow each user to apply 1 booster per day to a single match, doubling the points earned for that prediction. **Implemented:** `boosted` flag on the prediction doc (read by `scoreMatch` → `basePoints × 2`). Daily limit = one boost per **match kickoff-day** (America/Mexico_City), enforced by the `toggleBooster` callable Cloud Function in a transaction against a per-day registry doc `/users/{uid}/boosterDays/{YYYY-MM-DD}`. Firestore rules prevent clients from setting/flipping `boosted` (callable uses admin SDK); `setPrediction` switched to `{ merge: true }` so edits preserve the flag. UI: ⚡ toggle in `MatchCard` + `PredictionForm`, only before kickoff once a prediction exists, with `×2` indicators on boosted predictions/points. Needs `firebase deploy --only functions,firestore:rules`. | ✅ |
| I-7 | Live result partial-update safety | `setMatchResult` now accepts `matchEnded: boolean` and sets `status: "finished"` or `status: "locked"` accordingly — so an in-progress score can be saved without triggering the scoring Cloud Function (which only fires on `"finished"`). Admin UI needs to expose this distinction with a "Partido terminado" checkbox. | ✅
| I-8 | Admin result list stale after update | After submitting a result in the admin area, the match dropdown list does not reactively update — the green checkmark icon does not appear on the just-updated match until the page is refreshed. Fix by invalidating or optimistically updating the relevant React Query cache entry after a successful `setMatchResult` call. | ✅
| I-9 | Edit display name from `/profile` | Allow users to update their display name directly from the profile page, without having to go through the initial setup flow. | ✅
| I-10 | Re-score predictions when admin corrects a finished match result | `scoreMatch` used to guard `before.status === "finished"` → early return, so any result correction after finalization was silently ignored. Fixed: the guard now compares `before.result` vs `after.result`; if they differ the function re-scores using a delta (`newPoints − previousPoints`) to avoid double-counting `totalScore`. | ✅
| I-11 | Groups view inside matches list (table view per group) | Add a "Grupos" view to `/matches` (e.g. a toggle alongside the existing phase filter) that renders the group stage as standings tables — one table per group (A–L). Each table lists the four teams with the classic columns: PJ (played), G (won), E (drawn), P (lost), GF (goals for), GC (goals against), DG (goal difference), Pts (points), sorted by the official FIFA tiebreakers (points → goal difference → goals for). Standings are derived client-side from finished `matches` results (`status === "finished"`), so the table fills in live as the group stage progresses; upcoming matches simply don't contribute yet. Show each team's flag + name (Spanish) and optionally highlight the top two (qualifying) rows. Scope: group phase only — knockout phases keep the existing match-card list. | ⬜ |
| I-12 | Leaderboard fallback to user list before scoring | When `/leaderboard/current` has no rankings yet (e.g. before any match is scored), the home leaderboard used to show "Aún no hay participantes". **Implemented:** new `hooks/useUsers.ts` subscribes to the `users` collection via `onSnapshot` with `orderBy("displayName", "desc")` and maps each doc into a `LeaderboardEntry` (carrying `totalScore`, default 0; `position` by index). `Leaderboard.tsx` uses `data.rankings` when non-empty, otherwise falls back to this user list; the empty-state message only shows when there are no users at all. **Note:** requires Firestore rules to allow authenticated clients to read the `users` collection. | ✅ |
| I-13 | Read project ID from `.firebaserc` in scripts | The Firebase project ID (`quiniela-ee895`) was hardcoded in the emulator branch of every admin/seed script. **Implemented:** each script now derives `projectId` once at module load by parsing `.firebaserc` (`projects.default`), resolved relative to the script's own location via `fileURLToPath(import.meta.url)` so it works regardless of cwd. Applied to `scripts/set-admin.ts`, `scripts/seed-rankings.ts`, `scripts/seed-matches.ts`, and `scripts/repair-scores.ts`. Single source of truth — changing the Firebase project only requires editing `.firebaserc`. | ✅ |

---

## 14. Data — Recent Changes

### 14.1 FIFA Rankings data

Three files added/updated:

| File | Description |
|---|---|
| `data/fifa_world_ranking_men.json` | Original FIFA rankings array (211 teams, names in Spanish) |
| `data/fifa_world_ranking_men_by_name.json` | Same data re-keyed by Spanish team name for O(1) lookups |
| `data/fifa_world_cup_2026_group_fixtures.json` | All fixture `home_team`/`away_team` values translated from English → Spanish to match the ranking keys |

Seed script: `scripts/seed-rankings.ts` — writes `/rankings/current` to Firestore (single document, `teams` array).

After updating `fifa_world_cup_2026_group_fixtures.json`, re-seed matches:
```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/seed-matches.ts
```

### 14.2 English → Spanish team name mapping

Used to translate `home_team`/`away_team` in the fixtures JSON. Placeholder values (`1st Group A`, `Winner Match X`, etc.) are left unchanged.

| English (fixtures) | Spanish (rankings) |
|---|---|
| Algeria | Argelia |
| Argentina | Argentina |
| Australia | Australia |
| Austria | Austria |
| Belgium | Bélgica |
| Bosnia and Herzegovina | Bosnia y Herzegovina |
| Brazil | Brasil |
| Cabo Verde | Cabo Verde |
| Canada | Canadá |
| Colombia | Colombia |
| Congo DR | RD del Congo |
| Croatia | Croacia |
| Curaçao | Curazao |
| Czechia | República Checa |
| Côte d'Ivoire | Costa de Marfil |
| Ecuador | Ecuador |
| Egypt | Egipto |
| England | Inglaterra |
| France | Francia |
| Germany | Alemania |
| Ghana | Ghana |
| Haiti | Haití |
| IR Iran | RI de Irán |
| Iraq | Irak |
| Japan | Japón |
| Jordan | Jordania |
| Korea Republic | República de Corea |
| Mexico | México |
| Morocco | Marruecos |
| Netherlands | Países Bajos |
| New Zealand | Nueva Zelanda |
| Norway | Noruega |
| Panama | Panamá |
| Paraguay | Paraguay |
| Portugal | Portugal |
| Qatar | Qatar |
| Saudi Arabia | Arabia Saudí |
| Scotland | Escocia |
| Senegal | Senegal |
| South Africa | Sudáfrica |
| Spain | España |
| Sweden | Suecia |
| Switzerland | Suiza |
| Tunisia | Túnez |
| Türkiye | Turquía |
| USA | EEUU |
| Uruguay | Uruguay |
| Uzbekistan | Uzbekistán |

---

## 15. Key Decisions & Notes

- **Scoring is server-side only.** Cloud Functions use the Firebase Admin SDK. Clients never write `pointsEarned` — Firestore rules block it.
- **Leaderboard is denormalized.** A single document is cheaper to read than aggregating across all users. Rebuilt after every match is scored.
- **Magic link email device mismatch** is handled on `/auth/confirm` — user is prompted to re-enter email if `localStorage` is empty.
- **Knockout draws:** Predictions are scored based on the 90-minute result only. Extra time and penalties are ignored for scoring purposes. This must be communicated clearly in the UI.
- **Timezones:** All `kickoffAt` timestamps stored in UTC. Displayed in the user's local timezone using `Intl.DateTimeFormat`.
- **Only magic link auth is supported.** No OAuth providers (Google, Facebook) — keeps the auth surface minimal and avoids third-party app setup.
- **Pre-auth Firestore reads must go through an API route.** The `users` collection requires `request.auth != null`. Any check that runs before the user is authenticated (e.g. the login page email lookup) must call a Next.js API route that uses the Firebase Admin SDK, which bypasses security rules.
- **`fetchSignInMethodsForEmail` is broken for passwordless users.** The Firebase client SDK's `fetchSignInMethodsForEmail` always returns an empty array for email-link users — it cannot be used to check whether an account exists. Use `adminAuth.getUserByEmail()` server-side instead.

---

## 16. Form-guide dots widget (MatchCard)

### Context

Each team in `data/fifa_world_ranking_men_by_name.json` carries a `last_results`
array of its last 5 matches (`"W"` win, `"D"` draw, `"L"` loss). The match list
already surfaces FIFA ranking per team but nothing about recent form. We add a
compact "form guide" — 5 colored dots under each team's flag/name/ranking —
giving users a quick read on how each side is playing before they predict.

Scope: **MatchCard only**. Missing/short data: **pad to 5 slots**, rendering
absent results as hollow placeholder dots so both teams' rows stay vertically
aligned.

### Implementation

**New component — `components/matches/FormDots.tsx`:**
- Props: `{ results?: string[] }` (the team's `last_results`, possibly undefined).
- Builds a fixed array of 5 slots; fills from `results` (first 5), pads the rest
  with an empty marker.
- Renders a `flex items-center gap-1` row of `h-2 w-2 rounded-full` dots.
- Color map (data-driven `Record`, mirroring `STATUS_BADGE`):
  - `W` → `bg-green-500` (Victoria)
  - `D` → `bg-zinc-400` (Empate)
  - `L` → `bg-red-500` (Derrota)
  - empty/unknown → `bg-transparent border border-zinc-300 dark:border-zinc-700` (Sin dato)
- Each dot carries a Spanish `title`/`aria-label` so meaning isn't color-only.

**Wiring — `components/matches/MatchCard.tsx`:**
- Import `FormDots`.
- After the ranking `#` span in each team column, add
  `<FormDots results={rankingsByName[match.homeTeam as keyof typeof rankingsByName]?.last_results} />`
  and the equivalent for `awayTeam`. Optional chaining handles teams absent from
  the JSON (renders 5 empty slots). Reuses the existing `rankingsByName[... as
  keyof typeof rankingsByName]` lookup idiom already in the file.

### Notes

- Dots render in the JSON's array order, left→right. If the source order is
  newest→oldest and we prefer oldest→newest (typical form-guide convention),
  reverse the slice — a one-line tweak in `FormDots`.
- Client-only change; no Next.js API surface touched.

---

## 17. Ad Banner Stats Tracking

### Context

The ad banner (`components/ads/AdBanner.tsx`, shown on the home page to logged-in
users) currently has **zero analytics**. We can't tell whether anyone sees it,
opens the modal, clicks through to WhatsApp/Instagram/Phone, or just dismisses it.
This adds a lightweight, per-campaign stats system so the admin can judge each
banner's performance from `/admin/ad`.

**Events tracked:**

| Event | When it fires |
|---|---|
| `impression` | Banner is actually displayed (once per mount) |
| `bannerClose` | × pressed **without** ever opening the modal |
| `bannerCloseAfterModal` | × pressed **after** the modal was opened |
| `modalOpen` | User clicks the banner image to open the modal |
| `modalCloseNoClick` | Modal closed (×/backdrop/Esc) with no channel click |
| `clickWhatsapp` / `clickInstagram` / `clickPhone` / `clickOther` | A link inside the modal is clicked, classified by `href` |

Extras: **impressions**, **unique-user dedupe**, **per-day buckets**,
**modal-closed-without-click**. Segmentation is **per banner version**.

**Key constraints discovered:**
- Viewers are authenticated (`AdBanner` is inside `ProtectedRoute`), so
  `request.auth` is reliable.
- `setAdBanner()` (`lib/firestore.ts`) does a full `setDoc` overwrite of
  `config/adBanner` → **stats must live in a separate doc**, not on that doc.
- Clients can't write under `config/` (rule `match /config/{doc}` is admin-only
  write and doesn't even cover subcollections) → **writes go through a callable
  Cloud Function** using the Admin SDK, exactly like `toggleBooster`.
- Modal channel links are admin-authored HTML injected via
  `dangerouslySetInnerHTML` → click tracking must use **event delegation**
  (`e.target.closest('a')` + `href` inspection), not React handlers.

### Data model

Per-version stats doc (created/merged by the function):

```
config/adBanner/stats/{version}
  impression, impressionUnique: number
  bannerClose, bannerCloseAfterModal: number
  modalOpen, modalOpenUnique: number
  modalCloseNoClick: number
  clickWhatsapp(+Unique), clickInstagram(+Unique), clickPhone(+Unique), clickOther: number
  updatedAt: serverTimestamp
```

Per-day buckets (total counts only, no uniques, to stay lean):

```
config/adBanner/stats/{version}/days/{YYYY-MM-DD}   // day in America/Mexico_City
  <event>: number ...
  date: "YYYY-MM-DD"
```

**Unique counting** is client-deduped via `localStorage` (per device, per
version, per event) — approximate but cheap and consistent with how dismissal
already uses `localStorage`. The client sends `unique: true` only on the first
occurrence of an event for that version; the function then also bumps
`{event}Unique`.

### Implementation

**1. Cloud Function — `functions/src/logAdEvent.ts` (new)**
- `onCall({ region: "us-central1" }, …)` mirroring `toggleBooster.ts`.
- Require `request.auth?.uid` (throw `unauthenticated` otherwise).
- Validate `event` against an allowlist (the table above); validate `version` is
  a string; coerce `unique` to boolean.
- Compute `day` in `America/Mexico_City` (reuse the `Intl.DateTimeFormat` `en-CA`
  approach from `toggleBooster.ts`'s `kickoffDay`).
- One `db.batch()` with two `set(ref, {…}, { merge: true })` calls using
  `FieldValue.increment(1)`:
  - `config/adBanner/stats/{version}`: `[event]` always; `[event+"Unique"]` only
    when `unique`; `updatedAt`.
  - `config/adBanner/stats/{version}/days/{day}`: `[event]` + `date`.
- Export from `functions/src/index.ts` alongside the others.

**2. Client helper — `lib/adStats.ts` (new)**
- `const callLogAdEvent = httpsCallable(functions, "logAdEvent")` (same import
  style as `lib/firestore.ts`).
- `export function logAdEvent(event: AdEvent, version: string)`:
  - Reads/writes `localStorage` key `adBanner.fired.{version}.{event}` to decide
    `unique`.
  - Fire-and-forget: `callLogAdEvent({ event, version, unique }).catch(() => {})`
    — never block UI or throw.
- Export an `AdEvent` union type for the allowlisted events.

**3. `components/ads/AdBanner.tsx`**
- Add refs: `impressionFired`, `openedModal`, `clickedInModal`.
- Hoist visibility into a `visible` boolean so hooks stay above the early returns.
  Add a local `track(event)` that **skips when previewing or admin**
  (`banner.previewMode || isAdmin === true`) to avoid self-inflating stats, then
  calls `logAdEvent`.
- `useEffect` on `visible`: fire `impression` once via `impressionFired`.
- Banner image `onClick`: set `openedModal.current = true`,
  `clickedInModal.current = false`, `track("modalOpen")`, then `setOpen(true)`.
- `dismiss()`: `track(openedModal.current ? "bannerCloseAfterModal" : "bannerClose")`.
- Replace the three `setOpen(false)` sites (backdrop, × button, Esc) with a single
  `closeModal()` that fires `modalCloseNoClick` when `!clickedInModal.current`.
- Add `onClick` on the `.ad-modal-content` container: `closest('a')`, read `href`,
  classify (`wa.me|whatsapp` → whatsapp, `instagram.com` → instagram, `^tel:` →
  phone, else other), set `clickedInModal.current = true`, track it.

**4. Read path for the admin UI**
- `firestore.rules`: add
  ```
  match /config/adBanner/stats/{version} {
    allow read: if request.auth != null && request.auth.token.admin == true;
    allow write: if false;
    match /days/{day} {
      allow read: if request.auth != null && request.auth.token.admin == true;
      allow write: if false;
    }
  }
  ```
  (stats not needed by end users → admin-only read; function-only write, like
  `leaderboard`).
- `lib/firestore.ts`: add `AdBannerStats` interface + `getAdBannerStats(version)`
  and `getAdBannerStatsDays(version)` readers.
- `hooks/useAdBannerStats.ts`: React Query hook keyed on the version.

**5. Admin display — `app/admin/ad/page.tsx`**
- Add an "Estadísticas" panel for the **current banner version**: raw counts +
  derived rates (open rate = `modalOpen/impression`, CTR =
  `(clickWA+IG+Phone)/impression`, modal abandon = `modalCloseNoClick/modalOpen`),
  totals vs uniques, plus a compact per-day table from the `days` subcollection.

### Verification
1. `cd functions && npm run build` — type-check the new function.
2. Run the app against the Firebase emulators (dev mode auto-connects, per
   `lib/firebase.ts`). As a non-admin user on `/`:
   - Confirm `impression` appears in `config/adBanner/stats/{version}` (emulator UI).
   - Open modal → `modalOpen`; click WhatsApp/IG/Phone → matching `click*`; close
     modal without clicking → `modalCloseNoClick`; dismiss before vs after opening
     → `bannerClose` vs `bannerCloseAfterModal`.
   - Verify `{event}Unique` increments only on first occurrence per device, and a
     `days/{today}` doc accrues counts.
3. As admin, confirm preview-mode views and admin views do **not** create events,
   and that `/admin/ad` renders the stats panel with correct rates.
4. Deploy: `firebase deploy --only functions:logAdEvent,firestore:rules`.

