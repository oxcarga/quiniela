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

### 4. Start the Next.js dev server (separate terminal)

```bash
npm run dev
```

App: http://localhost:3000

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
