# Mundial 2026 — Quiniela App: Project Plan

> Last updated: June 2026  
> Status: In Progress — foundation + AuthContext done, login flow next

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
│   ├── firebase.ts                 # Firebase init
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
│   └── set-admin.ts                # Grant admin custom claim to a user by email
│
├── functions/                      # Firebase Cloud Functions (v2)
│   ├── src/
│   │   ├── index.ts                # Exports all functions
│   │   ├── admin.ts                # Admin SDK init
│   │   ├── scoreMatch.ts           # Triggered on result write — scores predictions
│   │   ├── updateMatchStatus.ts    # Scheduled: lock matches at kickoff time
│   │   └── updateLeaderboard.ts    # Rebuild /leaderboard document after scoring
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
| A-7 | User document created in Firestore on first login | [x] | Handled inside `confirmMagicLink` in `AuthContext.tsx` |
| A-8 | Duplicate-account guard on login | [x] | `LoginForm` calls `getUserByEmail` before sending magic link; if email not found → `confirm_new` state shows amber warning + "Soy nuevo, continuar" / "Probar con otro correo"; returning users with correct email see zero friction |

---

### 12.3 Core Data Layer

| # | Task | Status | Notes |
|---|---|---|---|
| D-1 | `lib/firestore.ts` — helper functions | [x] | getMatch, getMatches, getPrediction, setPrediction, getUserPredictions, setMatchResult, getLeaderboard, getUserByEmail; Match type includes optional `venue` and `city` fields; `getUserByEmail` uses `fetchSignInMethodsForEmail` (Firebase Auth) rather than a Firestore query — Firestore denies `list` ops for unauthenticated users and the login page runs before auth |
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
| M-1 | `components/matches/MatchCard.tsx` | [x] | Teams, flags, kickoff (local TZ), status badge, links to detail; shows user's predicted score in green pill or "Sin predicción" in red if none; saves scroll position to `sessionStorage["scroll:matches"]` on click; accepts `highlighted` prop — green bg for 4 s then fades over 1 s via `transition-colors duration-1000` |
| M-2 | `components/matches/MatchList.tsx` | [x] | Grouped by phase, phase filter pills; fetches all user predictions once (`useUserPredictions`) and passes each to its card; on mount reads `sessionStorage["scroll:matches"]` (restores position via double-rAF) and `sessionStorage["highlight:match"]` (passes `highlighted` to the matching card) |
| M-3 | `app/matches/page.tsx` | [x] | ProtectedRoute + MatchList |
| M-4 | `components/matches/PredictionForm.tsx` | [x] | 2 number inputs (default 0, not empty), Zod validation, auto-disable when locked/finished, pre-fills existing prediction; on save success writes `matchId` to `sessionStorage["highlight:match"]` so MatchList highlights the card on return |
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
| CF-1 | `functions/src/scoreMatch.ts` — triggered on result write | [x] | `onDocumentUpdated` on `/matches/{matchId}`; scores all predictions when status → "finished"; increments user totalScore |
| CF-2 | `functions/src/updateMatchStatus.ts` — scheduled every 5 min | [x] | Locks upcoming→locked at kickoff; fetches results from football-data.org (115 min cutoff); sets status→finished + result |
| CF-3 | `functions/src/updateLeaderboard.ts` — rebuild leaderboard doc | [x] | `onDocumentUpdated` on `/users/{userId}`; rebuilds `/leaderboard/current` sorted by totalScore |
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

| # | Improvement | Notes |
|---|---|---|
| I-1 | Inline predictions on `/matches` | Allow users to submit/edit their prediction directly from the match list card, without navigating to `/matches/:matchId`. The detail page can remain for the full result + points view. |
| I-2 | Show prediction + result inline on `/matches` | Alongside each match card, display the user's predicted score. If the match is finished, show the official result and points earned side by side with the prediction. |
| I-3 | Show FIFA team rankings on `/matches` | Scrape current group-stage rankings (position, played, won, drawn, lost, GF, GA, GD, points) from the FIFA website and store them in `data/fifa_world_cup_2026_group_fixtures.json`. Display each team's current standing next to their name in the match card and detail page. Needs a scraping script (e.g. `scripts/scrape-rankings.ts`) and a periodic refresh strategy. |

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
