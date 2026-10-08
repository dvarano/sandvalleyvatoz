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
**La Final (Thu Oct 8, the Commons):** **Paul beat Ryan** to win La Copa ($700; Ryan $350), and
**Mike beat Matt** for 3rd ($300). Both higher seeds, who started 1 up, won. Worth remembering
when sizing 2027's half-stroke head start: a full hole was enough to hold up twice out of two.

**🏆 2026 champion: Paul.**

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

**Variety of partner and individual games instead of quota every round. Each round is ranked, and
you earn individual points from your rank (in a partner game, from your team's rank). Top 4 on
points go to a match-play final day.**

### 4a. Round games

Each round names one game, partner or individual. It must produce **one handicap-adjusted number
per team (or per player)** so the whole field can be ranked, including across groups and across
courses on split days. That means the game is scored field-wide, not just inside a foursome.

| Game | Type | Number ranked | Better | Handicap |
|---|---|---|---|---|
| Four-ball (best ball) | partner | team net total, lower ball per hole | low | 85% of course handicap |
| Two-man aggregate | partner | sum of both partners' net totals | low | 100% |
| Scramble | partner | team net total | low | 35% low / 15% high |
| Shamble | partner | team net, best ball after a shared drive | low | ~80% |
| Alternate shot / Chapman | partner | team net total | low | 50% / 60–40% combined |
| Quota (2026's) | individual | points − quota | high | built in |
| Net Stableford | individual | points | high | stroke index |
| Net stroke play | individual | net total | low | 100% |

The allowances are USGA recommendations; tweak them, but print whatever you use on the Info tab.
**Four-ball, shamble and Stableford need each course's stroke-index row** to give strokes on the
right holes, which quota avoided. Enter the rows and check them (a permutation of 1–18) before the
trip. Aggregate, scramble, alternate shot and quota only need a course handicap.

**This drops 2026's "own ball" rule on partner rounds.** That rule existed so foursome side games
couldn't interfere with the Copa; on a partner round the Copa *is* the team game, so side bets
should fit around it.

### 4b. Partner draws: balance now matters

In 2026 **index balance was deliberately ignored** because quota made the draw irrelevant to
anyone's score (`CLAUDE.md` §3). **With partner games that reverses**: your partner's handicap and
form directly move your points, so the draw is part of the competition.
- **Rotate partners**, so everyone partners as many different people as possible and nobody
  partners the same person twice. Extend the pairing optimizer with a partner-frequency term
  alongside the existing group-frequency term.
- **Balance team strength per round**, e.g. pair the low and high handicaps (1+9, 2+8, …). Net
  allowances do most of the levelling, and the rotation evens out the rest over the week.
- **An odd number of players means one is left out** of every partner round. With 8, 10 or 12
  (see 4e) this goes away. Keep a rule in reserve in case someone drops out late, best first:
  (1) a three-player team, scored best-2-of-3 or with an adjusted allowance;
  (2) the odd player plays with a "ghost" partner (their own second score, or a fixed net par);
  (3) the odd player sits that round, with the round counts kept even across the week.

### 4c. Rank points

- Rank the whole field each round. **Points from a fixed table**, so a round is worth the same
  whoever sits. The table depends on the field size (see 4e). The 2026 table for 9 would have been
  **1st 10 · 2nd 8 · 3rd 6 · 4th 5 · 5th 4 · 6th 3 · 7th 2 · 8th 1 · 9th 0**.
  It's steeper at the top so winning a round matters; n-down-to-1 is the flat alternative.
- **Partner rounds use the same table.** A two-player team finishing *k*-th occupies individual
  places 2k−1 and 2k, and **each partner gets the average of those two**. So the winning team
  gets (10+8)/2 = 9 each, 2nd gets (6+5)/2 = 5.5 each, and so on. A three-player team occupies
  three places. Partner and individual rounds then carry exactly the same total points.
- **Ties split the points** of the places they occupy (two players tied for 2nd each get
  (8+6)/2 = 7; tied teams share in the same way).
- A rank caps the margin: one blowout round can't run away with the week. That's the main gain
  over averaging.
- **Uneven round counts.** Either give everyone the same number of counting rounds (best, as in
  2026), or count each player's best N rounds. A sit-out scoring 0 is not fair.
- Tiebreak on total points: most round wins, then best single finish, then head-to-head. Pick the
  order before the trip and print it on the Info tab.

### 4d. Final day: match play bracket

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

### 4e. Field size: 8, 10 or 12 golfers (Drew, Oct 8 2026)

**Any even number fixes 2026's biggest headache.** Nine players into foursome tee times forced
sit-outs every round, and all the uneven-round-count rules and Lawsonia backup logic followed from
that. With 8 or 12, every foursome is full, **everybody plays every round**, and round counts are
equal automatically. Even numbers also give whole partner teams.

| | 8 | 10 | 12 |
|---|---|---|---|
| Groups per round | 2 foursomes | 3 groups: 4/3/3 (or 4/4/2) | 3 foursomes |
| Sit-outs | none | none, but needs a 3rd tee time | none |
| Partner teams | 4 | 5 | 6 |
| Pairs to cover | 28 | 45 | 66 |
| Rounds for every pair to meet* | **3** | **4** (4/3/3) · 5 (4/4/2) | **5** (no 4-round week found) |
| Pot at $150 | $1,200 | $1,500 | $1,800 |

\*Found by search, the same optimizer approach as 2026. More rounds than that leaves room for the
pins people ask for. 10 is the awkward one: three tee times, and the threesomes play faster, so
put them out first.

**Rank-points tables** (steep at the top, last place still scores except at 8):

| Place | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 8 players | 10 | 8 | 6 | 5 | 4 | 3 | 2 | 1 | | | | |
| 10 players | 12 | 10 | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 | | |
| 12 players | 15 | 12 | 10 | 9 | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 |

Partner rounds use the same table: a team finishing *k*-th shares places 2k−1 and 2k.

**Top 4 to the bracket works at every size**, but it's half the field at 8 and a third at 12.
At 12, consider paying 4th, or running a consolation bracket for 5th–8th alongside El Toilet Bowl.

**In the code:** `NP` is already `P.length`, so the roster size flows through the score arrays, the
pool and the Enter tab. Watch for: `BASE_GRID` and the optimizer (`FREE`, `OUT`, group sizes per
round via `sizesFor`), `ng` per round (3 at 10 and 12), `PRIZES` summing to the new pot, and
`verify.js`, whose pair counts (36/36) and partner-matrix checks assume nine.

## 5. What changes in the code

**Reuse unchanged:** save layer, hash state, Publish, token handling, `checkForUpdate`,
`SITE_UPDATED`, `liveRound`, split-round legs, `TEES` and `chcp()`, Plays off, Courses by player,
pairing optimizer, `verify.js` harness.

**Replace or extend:**
- `rd.game` → a structured spec, e.g. `{id:'fourball', name:'Four-ball', type:'partner',
  better:'low', allowance:0.85, needs:'si'}`. Keep `gamerules` for the text.
- **Teams per round**: a new `rd.teams` / `S.k[rid]` (partner pairs within each group), seeded from
  a baseline like `BASE_GRID` and editable on the Pairings tab, with the same strip-before-publish
  rule so code changes still reach everyone.
- Enter tab: one number per **team** on partner rounds and per player on individual rounds,
  labelled by the game ("team net", "points"…) with the direction shown, so nobody enters a gross
  score into a net game. Show each team's allowance-adjusted handicap next to it.
- Plays off: on partner rounds, show the allowance-adjusted strokes per player.
- `results()/standing()/board()` → `roundRanks(rid)` (field-wide rank of players or teams, with
  split ties; a team spreads across its places) → `rankPoints` table → per-player totals. The drop-worst / first-N logic and `pendingRounds` still apply.
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
- [ ] Field size settled (8 / 10 / 12) and enough tee times booked that nobody sits; points table and
      prizes match it.
- [ ] Schedule gives everyone the same number of counting rounds.
- [ ] Optimizer run with this year's pins; check 36/36 pairs, max repeats, **no repeat partners**
      and team balance on each partner round.
- [ ] Odd-player rule for partner rounds decided, and allowances for each partner game set.
- [ ] Token generated (one repo, Contents read/write, expiry past the trip) and pasted on each
      scoring device.
- [ ] Rank-points table, tiebreak order, half-stroke wording and prizes all on the Info tab.
- [ ] `node verify.js` green with the clock set to mid-trip as well as before it.
