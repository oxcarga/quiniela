# Ronda de 32 — Readiness Assessment

**Date:** 2026-06-26 (tournament in Fase de Grupos)
**Scope:** Is the app ready to run the knockout stage, starting with the Round of 32 (first KO matches kick off **2026-06-28**)?

**Short answer:** Partially. The *data model and UI* already understand all seven phases, and the 16 Round-of-32 matches are seeded and visible. But there is **no operational path** to (1) turn the placeholder slots ("2nd Group A", "Best 3rd (A/B/C/D/F)") into real teams, or (2) bring in knockout results automatically. Both are manual, and the admin panel **cannot currently edit team names/flags** — only scores. There are also two correctness questions (penalty shootouts and blind early predictions) that need a policy decision.

---

## 1. How the system is built (relevant facts)

### Match data
- Fixtures live in [data/fifa_world_cup_2026_group_fixtures.json](data/fifa_world_cup_2026_group_fixtures.json) — **all 104 matches**, including the full knockout bracket, are present.
- [scripts/seed-matches.ts](scripts/seed-matches.ts) writes every match to Firestore (`matches/WC2026_NNN`) with a `phase` field. The phase enum already covers `group | round_of_32 | round_of_16 | quarter | semi | third_place | final` ([lib/firestore.ts:20](lib/firestore.ts#L20)).
- Knockout matches were seeded with **placeholder names**, not teams:

  | Match | home_team | away_team |
  |-------|-----------|-----------|
  | 73 | `2nd Group A` | `2nd Group B` |
  | 74 | `1st Group E` | `Best 3rd (A/B/C/D/F)` |
  | 89 | `Winner Match 73` | `Winner Match 75` |
  | … | … | … |

  These strings are stored verbatim in `homeTeam` / `awayTeam`.

### UI
- [components/matches/MatchList.tsx](components/matches/MatchList.tsx) already has phase filters and Spanish labels for every phase ("Ronda de 32", "Octavos de Final", etc.). Round-of-32 matches will render and group correctly with **zero changes**.
- [components/matches/MatchCard.tsx](components/matches/MatchCard.tsx) renders `homeTeam`/`awayTeam` directly and looks up flags + FIFA ranking + recent form by team name.

### Scoring & lifecycle
- Scoring is goal-difference based ([lib/scoring.ts](lib/scoring.ts), [functions/src/scoreMatch.ts](functions/src/scoreMatch.ts)): 3 exact / 2 correct draw / 1 correct outcome / 0. It is **phase-agnostic** and works for KO matches as-is.
- [functions/src/updateMatchStatus.ts](functions/src/updateMatchStatus.ts) runs every 5 min: locks matches at kickoff and fetches finished results from football-data.org, matching by **team name**.
- Admin can set results in [app/admin/page.tsx](app/admin/page.tsx) — it edits **score + "finished" flag only**.
- Booster is one-per-kickoff-day ([functions/src/toggleBooster.ts](functions/src/toggleBooster.ts)); works the same in KO rounds.
- Firestore rules allow a user to create/update their own prediction for any match **before kickoff** ([firestore.rules:48-57](firestore.rules#L48-L57)) — including placeholder KO matches.

---

## 2. Current behaviour vs. expected behaviour

| # | Area | Expected for Ronda de 32 | Current behaviour | Gap |
|---|------|--------------------------|-------------------|-----|
| 1 | **Team resolution** | After groups end, each KO slot shows the real qualified team (e.g. "2nd Group A" → "Croacia") with flag, ranking, form. | Matches display the literal placeholder string ("2nd Group A vs 2nd Group B"). Flag falls back to 🏳️ (white flag), no ranking, no form dots. | **Round of 32 now has tooling** — `scripts/resolve-round-of-32.ts` (see §6). Later rounds (`Winner Match NN`) and an in-UI admin editor are still missing. Was the main blocker. |
| 2 | **Result ingestion** | Knockout scores get filled in (manually or automatically). | Auto-fetch matches by team name; placeholder names never match → no auto-results for KO. (Note: even group results likely don't auto-match — DB stores Spanish names like "México" while football-data returns "Mexico", so this path appears unused already.) | KO results must be entered **manually** via admin. Not blocking *if* admin does it, but worth confirming. |
| 3 | **Penalty shootouts** | A KO match that is level after 90'/extra time is decided on penalties; someone advances. | `result` stores only `{homeGoals, awayGoals, winner}`; scoring uses goals only. A 1-1 that goes to pens scores as a draw (2 pts for a 1-1 prediction). There is **no field for who advanced** and no rule on whether extra-time goals count. | **Policy decision needed**: do quiniela scores use 90-min/regulation only, or full result incl. extra time? Today it's whatever number the admin types. Probably acceptable, but undefined. |
| 4 | **Blind early predictions** | Users typically predict a KO match *after* the teams are known. | Rules + UI let users predict "2nd Group A vs 2nd Group B" **right now**, before any team is known. | Decide whether to allow this. Predictions are keyed by `matchId`, so they survive a later name edit — but users will have bet on unknown teams. |
| 5 | **Auto-lock writes fake 0-0** | A locked-but-unfinished match shows no score. | [updateMatchStatus.ts:61](functions/src/updateMatchStatus.ts#L61) writes `result:{0,0,draw}` on lock. MatchCard then shows "0 – 0" for in-play matches. | Pre-existing (affects group stage too). Cosmetic, but more visible in KO where every match matters. |
| 6 | **Best-third assignment** | The "Best 3rd (X/Y/Z…)" slots resolve to a specific group via FIFA's combination table once the 8 best third-placed teams are known. | Not modeled at all. | Manual determination + manual entry. Compounds gap #1. |

---

## 3. The critical gap, in detail

**There is no way, today, to put real teams into the knockout matches.**

- No standings/qualification/bracket-advancement code exists anywhere in `app/`, `functions/src/`, `lib/`, or `scripts/` (verified by search — zero hits for standings/qualify/advance/bracket/resolve logic).
- The admin panel ([app/admin/page.tsx](app/admin/page.tsx)) only exposes goal inputs + a "finished" checkbox. `homeTeam`, `awayTeam`, `homeFlag`, `awayFlag` are **not editable from any UI**.
- Firestore rules permit admin writes to `matches`, so the *capability* exists at the data layer — it's just not surfaced.

So on 2026-06-28, without intervention, users would see cards like **"🏳️ 2nd Group A vs 2nd Group B 🏳️"** and be able to (blindly) predict them.

---

## 4. Recommended work to be ready

In rough priority order:

1. **Team-resolution path (Round of 32 — DONE).** `scripts/resolve-round-of-32.ts` (the "minimal / script" approach) resolves all 16 R32 matches from group standings + a best-third group map, with validation and a dry-run preview. See §6 for how it works. **Still open:** later rounds (`Winner Match NN` / `Loser Match NN`) have no resolver yet, and there's no in-UI admin team editor — the script is the only path today.
2. **Flag coverage.** `FLAG_MAP` already covers all 48 teams (the resolver reuses the same table as the seeder), so resolved Spanish names light up flags/rankings/form automatically.
3. **Penalty/extra-time policy (#3).** Decide and document whether scores are regulation-only or include extra time, and whether you need to record who advanced. If shootouts matter for any bonus, add an `advanced: "home" | "away"` field.
4. **Blind predictions (#4) — ACCEPTED, no action.** Owner decision (2026-06): we don't restrict predicting KO matches before teams are known.
5. **Confirm result-entry route (#2).** Since auto-fetch by name doesn't match the Spanish DB names, confirm the operator will enter KO results manually, or fix the name-mapping in `updateMatchStatus`.
6. **Optional polish:** suppress the fake "0 – 0" for locked-not-finished matches (#5).

---

## 5. Quick verification you can do now

- Open the app, switch the phase filter to **"Ronda 32"** → you should see 16 cards with placeholder names and white flags. That confirms the data/UI are wired; the missing piece is purely team resolution + results.
- In the admin panel, try to select a Round-of-32 match → you can set a score but there is no field to set the teams. That confirms gap #1.

---

### Bottom line
The **scaffolding is ready** (phases, fixtures, UI, scoring all phase-agnostic). The Round-of-32 team-resolution gap is now **closed via tooling** (`scripts/resolve-round-of-32.ts`). What remains: a resolver for the later rounds, a confirmed KO result-entry route, and a penalty/extra-time scoring policy.

---

## 6. Round-of-32 resolver — `scripts/resolve-round-of-32.ts`

Reads the placeholder strings from the fixtures JSON and writes resolved `homeTeam` / `awayTeam` / `homeFlag` / `awayFlag` to each `WC2026_0NN` doc. Dry-run by default; `--commit` writes. Two config blocks at the top of the file:

- **`STANDINGS`** — each group's `[1st, 2nd, 3rd, 4th]` (Spanish names matching `FLAG_MAP`).
- **`BEST_THIRDS`** — the group letter feeding each of the 8 `Best 3rd (...)` matches.

Resolution rules:
- `1st Group X` / `2nd Group X` → `STANDINGS[X][0|1]` (24 slots, fully automatic).
- `Best 3rd (…)` → `STANDINGS[ BEST_THIRDS[matchId] ][2]` (8 slots, from the map).

Validates and aborts before writing if: a best-third letter is outside that slot's allowed `(…)` list; a group is used for two best-third slots; a name is missing from `FLAG_MAP`; or standings aren't 12×4 distinct.

### Why the 8 best-thirds can't be computed — they must be read off FIFA's bracket

In the 48-team / 12-group format, the **8 best third-placed teams** advance (4 of the 12 are eliminated). FIFA resolves them in three steps:

1. **Rank all 12 third-placed teams** (Pts → GD → GF → … → fair play → lots). The top 8 qualify. *This ranking is used only to pick the 8 — the rank number does not map to a slot.*
2. **Take the *set* of 8 groups** those teams come from (order discarded).
3. **Look up that set in FIFA's pre-published combination table** — one row for each of the C(12,8) = **495** possible group-sets. The row dictates exactly which group's third goes to which of the 8 designated slots.

It's a fixed lookup, not a formula, because the bracket/venues/dates were locked before qualifiers were known; FIFA hand-designed the 495 rows to (a) avoid a group-stage rematch in the R32 and (b) keep the bracket balanced.

The `(A/B/C/D/F)`-style lists in the fixtures are the **envelope** of possibilities for each slot across all 495 rows — they bound, but **do not uniquely determine**, the assignment. Worked example: for the qualifying set `{A,B,D,E,F,G,I,L}`, multiple perfect matchings satisfy every slot's allowed list (e.g. `74=F,77=D,79=I,80=E,81=B,82=A,85=G,87=L` **and** `74=B,79=F,81=I,…`). Only FIFA's table picks the official one. Hence `BEST_THIRDS` is a manual transcription from the published bracket, not something the script derives.
