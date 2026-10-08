# Next year's trip — framework and handoff

Written Oct 8 2026, right after the 2026 trip, so the 2027 build can start cold.
`CLAUDE.md` is the full decision record for 2026; this file is the short version of what to keep,
what to change and what to watch out for.

---

## 1. How 2026 finished

Quota game, first 4 Sand Valley rounds counted, worst dropped, other 3 averaged.

| | Player | Counting | Dropped | Avg |
|---|---|---|---|---|
| 1 | Paul | +6, +6, −4 | −7 | +2.7 |
| 2 | Ryan | +2, +4, 0 | −1 | +2 |
| 3 | Mike | +4, −1, +3 | −3 | +2 |
| 4 | Matt | −1, +4, +3 | −1 | +2 |
| 5 | Brook | +2, +4, −4 | −7 | +0.7 |
| 6 | Eric | +7, −3, −5 | −6 | −0.3 |
| 7 | Drew | −6, +2, −2 | −7 | −2 |
| 8 | Daniel | −6, −7, −9 | −9 | −7.3 |
| 9 | Tony | −9, −7, −9 | −11 | −8.3 |

Seeds 2–4 were a three-way tie on +2, and so was the first tiebreak (best round +4 each). The
second tiebreak, Sunday at Lawsonia (Ryan 0, Mike −5, Matt −6), decided it. **Lesson: a tiebreak
nobody expects to use will get used.** Enter the backup/tiebreak round's scores anyway.
La Final: Paul v Ryan, Mike v Matt. *(Thursday results not recorded here — add them.)*

The final `data.json` is the archive of every score. To keep the 2026 site viewable, tag it before
changing anything: `git tag 2026-final && git push origin 2026-final`.

---

## 2. What worked: keep it

- **One self-contained `index.html` on GitHub Pages**, state in the URL hash, `data.json` through
  the contents API, explicit **Publish**, a fine-grained token scoped to this one repo. No backend
  and no failures during the trip. See `CLAUDE.md` §6.
- **Self-updating open tabs** (`checkForUpdate`) and **`SITE_UPDATED`**. Fixes went out mid-trip
  and showed up on phones without anyone retyping the URL.
- **Central-time landing round** (`liveRound`): the site opens on the round you're about to play.
- **Split rounds** (`split:[…]` legs): different courses/tees per group in one round, with quotas
  resolved per player.
- **Per-player tee overrides on Enter.** Several players moved tees at Sedge and it just worked.
- **Plays off column** for the side games inside a group.
- **Pairing optimizer** (Appendix A of `CLAUDE.md`): every pair met at least once, pins honoured.
  Exhaustive search beat guessing every time a request came in.
- **"Everyone plays the same number of counting rounds."** Getting all nine to exactly 4 removed
  every fairness argument. Design the schedule for that first.
- **Mid-week standings**: `n/4` with the counting scores in brackets, plus a "based on current
  standings" label on the final-day card until every round was in.
- **Tie explainer** under the standings: say in plain English how each tie was broken.
- **`verify.js`** (Playwright, API mocked). It caught regressions on almost every change.

## 3. What bit us: do differently

1. **Par was wrong for Mammoth Dunes** (entered 72, actually 73), so every Mammoth course handicap
   was one too high. Drew caught it against GHIN on the morning of the round. **Before the trip,
   check one player's course handicap on every course/tee against the GHIN calculator.**
   `CR − par` matters.
2. **Indexes changed mid-trip** (Matt 14.1 → 14.5 before Monday). Results are recomputed from the
   *current* index, so a change after a counting round rewrites history. **Lock indexes before
   the first counting round**, or store the index used with each round's scores.
3. **Date-dependent tests.** Once the trip started, the site opened on a later round, and tests
   that typed into "the current round" broke. Pin tests to a round with `#roundSel`, or freeze the
   clock in Playwright.
4. **Hand-edited pairings in `data.json` silently overrode code changes** early on. The baseline is
   now stripped before publish. Keep that rule.
5. **The schedule changed constantly** (Lido times, the rebooked Wednesday). The flag-driven design
   (`counts`, `backup`, `out`, `split`) absorbed it. Keep rounds as data, never hardcode a round id
   in scoring logic.

---

## 4. 2027 format (Drew's plan, Oct 8 2026)

**Variety of individual / pattern games instead of quota every round. Each round is ranked, and
your rank earns points. Top 4 on points go to a match-play final day.**

### 4a. Round games

Each round names one game. The game must produce **one number per player, handicap-adjusted**, so
the whole field can be ranked, including across courses on split days. Possible games:

| Game | Per-player number | Better | Net how |
|---|---|---|---|
| Quota (2026's) | points − quota | high | built in |
| Net Stableford | points | high | strokes off the stroke index |
| Net stroke play | net total | low | course handicap |
| Par 3s / par 5s only | net score to par on those holes | low | strokes on those holes only |
| Peoria / Callaway | adjusted net from hidden holes | low | self-handicapping |
| Best 9 holes | net score to par on your best 9 holes | low | strokes on the stroke index |

Keep them **individual, own ball**, so group side games still don't interfere (2026 rule).
**Anything that needs stroke indexes needs every course's handicap row entered and checked**,
which quota avoided. Budget for it, or favour games that only need a course handicap (quota,
net total, Callaway).

### 4b. Rank points

- Rank the whole field each round. **Points from a fixed table**, so a round is worth the same
  whoever sits. Suggested table for 9:
  **1st 10 · 2nd 8 · 3rd 6 · 4th 5 · 5th 4 · 6th 3 · 7th 2 · 8th 1 · 9th 0**.
  This is steeper at the top so winning a round matters; 9-down-to-1 is the flat alternative.
- **Ties split the points** of the positions they occupy (two tied for 2nd each get (8+6)/2 = 7).
- A rank caps the margin: one blowout round can't run away with the week. That's the main gain
  over averaging.
- **Uneven round counts.** Either give everyone the same number of counting rounds (best, as in
  2026), or count each player's best N rounds. A sit-out scoring 0 is not fair.
- Tiebreak on total points: most round wins, then best single finish, then head-to-head. Pick the
  order before the trip and print it on the Info tab.

### 4c. Final day: match play bracket

- **Semifinals on the front nine:** Seed 1 v Seed 4 and Seed 2 v Seed 3. **Seeds 1 and 2 start up
  half a stroke.**
- **Back nine:** the **Final** (semifinal winners) and the **3rd-place match** (semifinal losers).
  **Higher seed starts up half a stroke.**
- The half stroke exists to make a halved match impossible. Settle the wording before the trip:
  *"all square after 9 → higher seed wins"* (match play), or half a stroke off the total in a
  9-hole net stroke match. They play out the same; the first is easier to explain on the tee.
- **Handicap strokes over nine holes:** half the 18-hole course-handicap difference, given on the
  nine holes of that side ranked by the scorecard's stroke index (front-nine SIs for the semis,
  back-nine for the finals). If the venue isn't 18 holes (the Commons was 12, 65% rule), split it
  6 + 6 or pick a different venue for the final day.
- Prizes: four places now (1st, 2nd, 3rd, 4th, or 4th gets nothing). Keep `PRIZES` / `ENTRY_FEE` as
  the single source and make the total equal the pot.

---

## 5. What changes in the code

**Reuse unchanged:** save layer, hash state, Publish, token handling, `checkForUpdate`,
`SITE_UPDATED`, `liveRound`, split-round legs, `TEES` and `chcp()`, Plays off, Courses by player,
pairing optimizer, `verify.js` harness.

**Replace or extend:**
- `rd.game` → a structured spec, e.g. `{id:'stableford', name:'Net Stableford', better:'high',
  needs:'si'}`. Keep `gamerules` for the text.
- Enter tab: one number per player per round, labelled by the game ("net total", "points"…), with
  the direction shown so nobody enters a gross score into a net game.
- `results()/standing()/board()` → `roundRanks(rid)` (field-wide rank with split ties) →
  `rankPoints` table → totals. The drop-worst / first-N logic and `pendingRounds` still apply.
- Standings: points per round in brackets the way the counting scores were, the rank shown per
  round, and the tie explainer rewritten for the new tiebreak order.
- The La Final card becomes a **bracket**: semis (front 9) → final + 3rd-place (back 9), with
  "up ½" on the higher seed, nine-hole stroke allocation, and the "based on current standings"
  label until all rounds are in.
- If games need stroke indexes: a `SI` row per course in `TEES`, with permutation-of-1..18 checks
  in `verify.js` (as was done for the Commons).

---

## 6. Pre-trip checklist

- [ ] Every course/tee: rating, slope **and par** checked against the scorecard, and one GHIN
      course-handicap spot check per course.
- [ ] Stroke-index rows entered and verified if any game needs them.
- [ ] Indexes confirmed and **locked before the first counting round**.
- [ ] Schedule gives everyone the same number of counting rounds.
- [ ] Optimizer run with this year's pins; check 36/36 pairs and max repeats.
- [ ] Token generated (one repo, Contents read/write, expiry past the trip) and pasted on each
      scoring device.
- [ ] Rank-points table, tiebreak order, half-stroke wording and prizes all on the Info tab.
- [ ] `node verify.js` green with the clock set to mid-trip as well as before it.
