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
│   ├── layout.tsx                  # Root layout with AuthProvider
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
│       └── page.tsx                # Admin result entry
│
├── components/
│   ├── ui/                         # shadcn generated components
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── OnboardingForm.tsx
│   ├── matches/
│   │   ├── MatchCard.tsx
│   │   ├── MatchList.tsx
│   │   └── PredictionForm.tsx
│   ├── leaderboard/
│   │   ├── Leaderboard.tsx
│   │   └── LeaderboardRow.tsx
│   └── layout/
│       ├── Navbar.tsx
│       └── ProtectedRoute.tsx
│
├── context/
│   └── AuthContext.tsx             # Auth state + all auth methods
│
├── lib/
│   ├── firebase.ts                 # Firebase init
│   ├── firestore.ts                # Firestore helper functions
│   └── scoring.ts                  # Scoring logic (shared with Cloud Functions)
│
├── hooks/
│   ├── useLeaderboard.ts           # Firestore real-time listener
│   ├── useMatches.ts               # Matches with TanStack Query
│   └── usePredictions.ts           # User predictions
│
├── store/
│   └── useAppStore.ts              # Zustand store
│
├── functions/                      # Firebase Cloud Functions
│   ├── src/
│   │   ├── scoreMatch.ts           # Triggered on result write
│   │   ├── updateMatchStatus.ts    # Scheduled: lock matches at kickoff
│   │   └── updateLeaderboard.ts    # Rebuild leaderboard document
│   └── package.json
│
├── middleware.ts                   # Next.js route protection
├── .env.local.example
└── firebase.json                   # Firebase project config
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

# 4. Start Firebase emulators (Auth + Firestore)
firebase emulators:start

# 5. Run Next.js dev server
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
| A-1 | `context/AuthContext.tsx` — full implementation | [x] | `onAuthStateChanged`, send/confirm link, user state, setDisplayName, signOut |
| A-2 | `app/login/page.tsx` + `components/auth/LoginForm.tsx` | [x] | Email input → `sendSignInLinkToEmail`; loading/success/error states |
| A-3 | `app/auth/confirm/page.tsx` — magic link handler | [x] | `signInWithEmailLink`; device-mismatch prompt; redirects to /onboarding or / |
| A-4 | `app/onboarding/page.tsx` + `OnboardingForm.tsx` | [x] | Nickname input (max 24), `setDisplayName` → redirects to / |
| A-5 | `proxy.ts` — route protection (replaces deprecated `middleware.ts`) | [x] | Optimistic cookie check; redirects unauthenticated to `/login` |
| A-6 | `components/layout/ProtectedRoute.tsx` | [x] | Redirects unauthed → /login, no displayName → /onboarding; shows loader while Firebase resolves |
| A-7 | User document created in Firestore on first login | [x] | Handled inside `confirmMagicLink` in `AuthContext.tsx` |

---

### 12.3 Core Data Layer

| # | Task | Status | Notes |
|---|---|---|---|
| D-1 | `lib/firestore.ts` — helper functions | [~] | Empty; getMatch, getMatches, getPrediction, setPrediction, getLeaderboard |
| D-2 | `lib/scoring.ts` — scoring logic | [~] | Empty; `calculatePoints(prediction, result): number` |
| D-3 | `hooks/useMatches.ts` — TanStack Query | [~] | Scaffold exists; implement |
| D-4 | `hooks/usePredictions.ts` — user predictions | [~] | Scaffold exists; implement |
| D-5 | `hooks/useLeaderboard.ts` — real-time listener | [~] | Scaffold exists; implement |
| D-6 | `store/useAppStore.ts` — Zustand store | [~] | Scaffold exists; define slices |
| D-7 | Seed Firestore with group stage fixtures | [ ] | All 48 group stage matches, `status: "upcoming"` |

---

### 12.4 Match Pages

| # | Task | Status | Notes |
|---|---|---|---|
| M-1 | `components/matches/MatchCard.tsx` | [~] | Scaffold; teams, flags, kickoff (local TZ), status badge |
| M-2 | `components/matches/MatchList.tsx` | [~] | Scaffold; grouped by phase, filterable |
| M-3 | `app/matches/page.tsx` | [~] | Stub; wire up MatchList + useMatches |
| M-4 | `components/matches/PredictionForm.tsx` | [~] | Scaffold; 2 number inputs, auto-disable at kickoff, Zod validation |
| M-5 | `app/matches/[matchId]/page.tsx` | [~] | Stub; prediction form if open, result + user prediction if locked |

---

### 12.5 Leaderboard & Home

| # | Task | Status | Notes |
|---|---|---|---|
| L-1 | `components/leaderboard/LeaderboardRow.tsx` | [~] | Scaffold; position, avatar, name, score, highlight own row |
| L-2 | `components/leaderboard/Leaderboard.tsx` | [~] | Scaffold; real-time listener via `useLeaderboard` |
| L-3 | `app/page.tsx` — home / leaderboard | [~] | Still default Next.js template; replace with Leaderboard |

---

### 12.6 Profile Page

| # | Task | Status | Notes |
|---|---|---|---|
| P-1 | `app/profile/page.tsx` — prediction history + score breakdown | [~] | Stub |

---

### 12.7 Admin Panel

| # | Task | Status | Notes |
|---|---|---|---|
| AD-1 | `app/admin/page.tsx` — result entry form | [~] | Stub; select match, enter goals, submit → write to Firestore |
| AD-2 | Set `admin: true` custom claim on admin user(s) | [ ] | Via Firebase Admin SDK / console |

---

### 12.8 Cloud Functions

| # | Task | Status | Notes |
|---|---|---|---|
| CF-1 | `functions/src/scoreMatch.ts` — triggered on result write | [~] | File exists, empty |
| CF-2 | `functions/src/updateMatchStatus.ts` — scheduled lock at kickoff | [~] | File exists, empty |
| CF-3 | `functions/src/updateLeaderboard.ts` — rebuild leaderboard doc | [~] | File exists, empty |
| CF-4 | Deploy Cloud Functions to Firebase | [ ] | `firebase deploy --only functions` |

---

### 12.9 Layout & Navigation

| # | Task | Status | Notes |
|---|---|---|---|
| N-1 | `components/layout/Navbar.tsx` | [~] | Scaffold exists; links, user avatar, sign-out |
| N-2 | `app/layout.tsx` — root layout with AuthProvider | [x] | AuthProvider wired; metadata updated |

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

## 13. Key Decisions & Notes

- **Scoring is server-side only.** Cloud Functions use the Firebase Admin SDK. Clients never write `pointsEarned` — Firestore rules block it.
- **Leaderboard is denormalized.** A single document is cheaper to read than aggregating across all users. Rebuilt after every match is scored.
- **Magic link email device mismatch** is handled on `/auth/confirm` — user is prompted to re-enter email if `localStorage` is empty.
- **Knockout draws:** Predictions are scored based on the 90-minute result only. Extra time and penalties are ignored for scoring purposes. This must be communicated clearly in the UI.
- **Timezones:** All `kickoffAt` timestamps stored in UTC. Displayed in the user's local timezone using `Intl.DateTimeFormat`.
- **Only magic link auth is supported.** No OAuth providers (Google, Facebook) — keeps the auth surface minimal and avoids third-party app setup.
