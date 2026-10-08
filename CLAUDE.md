# La Copa De Vatoz — Sand Valley 2026

Project notes and decision record for the golf trip dashboard. Written as a handoff
so a future session can pick this up cold.

- **Live site:** https://dvarano.github.io/sandvalleyvatoz/
- **The app:** `index.html` — one self-contained file, no build step, no dependencies.
- **Group name:** the Sand Valley Vatoz (vatos with a z). Competition is **La Copa De Vatoz**.
  Rename via `TRIP_NAME` at the top of the script.
- **Trip complete (Oct 8 2026).** Planning 2027? **Read `NEXT_YEAR.md` first**: final results,
  what to keep, lessons, and Drew's 2027 format (partner + individual games, rank-points per round, match-play bracket).
- **Branch:** commit and push directly to `main`. No feature branches, no PRs — Pages serves
  `main`, so anything not on it isn't live.

---

## 1. The trip

Nine golfers, Oct 4–8 2026. Lawsonia (Green Lake, WI) for two rounds, then Sand Valley.
Matt Anderson organizes the trip logistics; Drew handles pairings, games and this app.

| # | Day | Course | Tee times | Default tee | Counts? | Format idea | Out |
|---|---|---|---|---|---|---|---|
| r1 | Sun 10/4 PM | Lawsonia Links | 1:40 / 1:50 | White 72.0 / 133, par 72 | Backup only | Six-Six-Six | Daniel |
| r2 | Mon 10/5 AM | **Sand Valley / Lido / Mammoth (split)** | 10:10 / 10:30 / 10:30 | SV Orange 72.8/138 · Lido White 72.5/144 · Mammoth Orange 72.1/136 | **Yes** | Nassau (front/back/total) | Daniel |
| r3 | Mon 10/5 PM | The Sandbox | 4:54 / 5:18 | 17 par 3s | No — Side Pot | Gross skins + CTP | — |
| r4 | Tue 10/6 AM | Sedge Valley | 8:30 / 8:40 | Back/Middle 67.0 / 126, par 68 | **Yes** | Net skins | Paul |
| r5 | Tue 10/6 PM | Mammoth Dunes | 12:50 / 1:00 | Orange 72.1 / 136, **par 73** | **Yes** | Wolf | Matt |
| r6 | Wed 10/7 AM | **Sedge Valley / Lido (split)** | 7:40 / 10:00 | Sedge **Back** 68.7/130 · Lido White 72.5/144 | **Yes** | Six-Six-Six | Drew |
| r7 | Wed 10/7 PM | Sand Valley | 1:00 (one foursome) | Orange 72.8 / 138, par 72 | **Yes** | Vegas | Mike, Tony, Brook, Eric, Ryan |
| r8 | Thu 10/8 AM | The Commons | 8:00 / 8:10 | 12 holes, par 45 | No — La Final | Match play | — |

**Mammoth Dunes is par 73 (fixed Oct 5 2026).** It was entered as par 72, which put every Mammoth course
handicap one stroke too high (and every quota one too low). Drew caught it against GHIN: 7.3 × 136/113 +
(72.1 − 73) = 7.89 → **8**, matching GHIN; par 72 gave 9. Fixed before any Mammoth score was entered.
The `CR − par` term matters — always take par from the scorecard, not the default 72.

Alternate tees available in the app: Woodlands White 70.2/128; Sedge Back 68.7/130 and Middle 63.9/112;
Mammoth Orange/Sand 71.1/134 and Sand 69.8/131; Sand Valley Orange/Sand 71.4/133 and Sand 70.2/129.

**Sedge default is the Back/Middle combo, 67.0/126 (Drew, Oct 2 2026)** — confirmed from the Sedge
scorecard (Back 5,808 yds / Back-Middle 5,477 / Middle 4,790, par 68). It used to be the Back tees
on a golf-quality argument; Drew changed it. Back and Middle remain selectable per player on Enter,
and quota self-corrects for whichever tee is played. **Exception: Wednesday AM Sedge (r6) defaults to
the Back tees 68.7/130** (Drew, Oct 2 2026) via `def:'Back'` on that split leg; `legTees()` reorders
the tee list so the named default comes first. Tuesday AM stays Back/Middle.

### Roster (fallback indexes; confirmed values live in `data.json`, see §5)

| Mike | Drew | Paul | Daniel | Eric | Brook | Matt | Tony | Ryan |
|---|---|---|---|---|---|---|---|---|
| 6 | 7 | 8 | 9 | 10 | 12 | 13 | 13 | 14 |

These are the `BASE_IDX` fallback baked into the page. Confirmed values are edited in the app
(Pairings tab) and published with the board — no code change needed. See §5.

Array index order in the code is **0 Matt, 1 Drew, 2 Mike, 3 Tony, 4 Brook, 5 Eric, 6 Ryan,
7 Paul, 8 Daniel**. The `BASE_GRID` constant uses these integers.

---

## 2. The competition

### Quota game (not Stableford)

- **Quota** = 36 − course handicap, where
  `courseHandicap = round(index × slope / 113 + (courseRating − par))`
- **Points, gross:** eagle 6, birdie 4, par 2, bogey 1, **double bogey or worse 0**
- **Round result** = points − quota

**Why quota over net Stableford.** Three practical reasons, in order of weight:
1. No stroke allocation. Net Stableford needs hole-by-hole stroke indexes for five different
   courses, and one wrong index silently corrupts the standings for the whole week.
2. It normalizes. A "+4" means the same thing for a 6 and a 14, so the standings are one
   column of signed integers and the drop-and-average rule is trivial to state.
3. Mixed tees are free. Each player's quota comes from his own tee, so anyone can move up on
   Wednesday afternoon at no competitive cost and nobody negotiates a group tee.

**On the 1/2/4/6 scale.** Drew chose it knowingly. Valuing a birdie at two pars tilts toward
low handicaps beyond what quota corrects for — roughly 1.5 points a round to the single digits
in this field, call it 4–6 points over the competition. It's acceptable *because the field is
tight* (6 to 14). If the spread ever widens past ~18, revisit: birdie = 3 removes the tilt
entirely. Eagle at 6 rather than 8 is deliberate, so a lucky eagle can't hijack the leaderboard.

### Standings — drop your worst (El Mulligan), average the rest

**Rule (Oct 1 2026, Drew): your FIRST 4 Sand Valley rounds count** (schedule order). Drop the worst
of those 4, average the other 3. An extra solo round never counts. Fewer than 4 (missed/skipped a
round) → Lawsonia tops the pool up. Enforced in `results()` by `.slice(0, MIN_POOL)` before the
backup step, so a fifth scored round can never sneak in. The Info tab's "uneven round counts"
sentence was removed — everyone is on exactly 4 now. Covered by verify.js §13b.

*(Historical: it used to be "play five, average your best four; play four, average your best three".)*

**Mid-week display (Oct 2 2026).** Lawsonia only backfills a round a player has actually *missed*:
`results()` targets `MIN_POOL − (scored + pendingRounds(pi))`, where `pendingRounds` counts counting
rounds not yet scored (`roundPlayed()` = any score entered) that the player is scheduled to play. So
before the week is done nobody shows `*` or `!`; a known skip (Sitting) that leaves someone unable to
reach 4 still pulls Lawsonia in immediately. The Rds column shows **`n/4`** while rounds are pending,
with the **counting scores in brackets** underneath, e.g. `(+2, 0, -1)` (the dropped one excluded).
**The drop starts at 3 rounds** (`DROP_FROM`); with 1–2 rounds the average is over all of them.
Covered by verify.js §19.

**Lawsonia is a conditional backup (added Sep 2026).** Only **Sand Valley resort 18-hole rounds**
count. If a player ends up with fewer than `MIN_POOL` (4) of them — sat one out, arrived late —
their **Lawsonia round is pulled in to top the pool back up to 4**, best Lawsonia round first.
A player with a full Sand Valley pool never touches Lawsonia, however well they played it.

Implemented as flags, not hardcoded rounds: `counts:true` = Sand Valley counting round,
`backup:true` = Lawsonia. `results()` fills from `COUNTING`, then tops up from `BACKUP`.
**This survives schedule changes** — move a round between the two flags and the maths follows.

Under the current schedule (`COUNTING` = r2/r4/r5/r6/r7, `BACKUP` = r1) **nobody needs the
backup: all nine play exactly 4 Sand Valley rounds** (since Drew took Matt's Tuesday PM spot,
Oct 1 2026). It is insurance again.

**Why the backup exists in practice:** the likely trigger is someone deciding not to play 36 in a
day and skipping an afternoon or a morning — Tuesday PM Mammoth or Wednesday AM Sedge. Those
scheduled for 36 on **both** days are Matt, Mike, Eric, Ryan and Daniel (Tuesday also Tony and
Paul; Wednesday also Drew and Brook). Drew marks the skip on the Pairings tab (player → Sitting)
and the pool recomputes on the spot; nothing else is needed.

**Daniel is the one player with no Lawsonia round** (he sits Sunday), so the backup cannot cover
him. **Settled: Drew expects Daniel to play both 36-hole days**, giving him 4 Sand Valley rounds
and no need for a backup. Nothing to do — but if that changes and he skips one, he drops to a pool
of 3 averaged over 2, and the board marks it with `!` rather than hiding it.

**Sunday is flagged "Backup only" on Today and Enter (Oct 4 2026, Drew).** A `Backup round for Copa` pill on the
Groups heading, `Backup only` on the Quotas heading, an amber note on the Quotas card, and the Notes bullet saying when it counts.
All keyed off `rd.backup`. **Drew's call (Oct 5 2026): Sunday's points are NOT entered unless needed** —
i.e. someone ends up short of 4 SV rounds, or a seeding tie survives the best-single-round tiebreak.
Nothing breaks while it's blank: `sundayDelta()` returns null and the backup has nothing to pull, so a
short player shows `3!` until Sunday is entered, then recomputes. The Enter-tab note says so. Covered by verify.js §21.

**The standings say why.** A pool topped up from Lawsonia shows `4*`; a pool under `MIN_POOL` with
nothing to backfill shows `3!`, each with a footnote. Without these, a Lawsonia round quietly
counting looks identical to four Sand Valley rounds, and a thin pool looks like a normal one.

**Why this exact rule.** The round counts cannot be made even. Five counting rounds × eight
tee-time slots = 40 player-rounds for nine players, so four people play five rounds and five
people play four. Counting a fixed number instead (best-4-of-5 for everyone) hands the
five-round players a free discard the four-round players never get. Measured against round-to-round
variation σ:

| Rule | Edge to the 5-round player |
|---|---|
| Best 4 counted for everyone | 0.29σ (~1.3 pts/round) |
| Top 3 average for everyone | 0.21σ (~0.95) |
| **Everyone drops one, average the rest** | **0.05σ (~0.23), and it flips slightly the other way** |

**Corollary that must be preserved:** whoever sits Mammoth or Sand Valley has to be someone
playing all the other rounds. Daniel, Brook and Tony are already down a round; taxing them
twice breaks the symmetry the rule depends on.

### Seeding and La Final

- Sunday at Lawsonia is a **warmup only** (see the backup rule above). **Tiebreaks (Oct 2 2026, Drew
  flipped the order): 1st best single round** (highest +/- in the player's counting pool), **2nd
  Sunday finish at Lawsonia**. The committee (Drew and Matt) may still adjust
  indexes before Monday — that is an index decision, deliberately **not** described on the
  Info tab as part of the Lawsonia round. **The site says only that indexes may be adjusted; it
  deliberately gives no number** (it used to say ±3; Drew asked to keep it vague, Sep 2026).
- **Tie explainer (Oct 7 2026, Drew).** `tieNotes(board())` renders a "How ties were broken" box under
  the standings whenever averages tie, spelling out each tie: the best single rounds, then (only if
  still level) the Sunday scores, then the resulting places. It mirrors `board()`'s sort, so it can't
  disagree with the table. First used for the final board: Ryan, Mike and Matt all +2 with a best
  round of +4 each; Sunday (Ryan 0, Mike −5, Matt −6) set 2nd/3rd/4th. verify.js §20.
- **La Final card is labelled provisional mid-week (Oct 6 2026, Drew).** Until every counting round has a
  score (`COUNTING.every(roundPlayed)`), the Standings card leads with an amber "Based on current
  standings. Not final…" note; after that it shows a `Final seeds` pill. verify.js §20c.
- **La Final:** the top 4 after Wednesday play the final Thursday at the Commons, teeing off **last, at 8:10**. **El Toilet Bowl goes off
  first at 8:00.** (Swapped Sep 2026 — the final group should finish last.)
- Match A: Seed 1 v Seed 2 for **$700 / $350**. Match B: Seed 3 v Seed 4 for **$300**.
- **Seeds 1 and 3 start 1 up.**
- All square after 12 → split the prizes, or agree on a playoff / chip-off / putt-off.
  `ALL_SQUARE` in the code is the single source for this line — La Final's card, the Today
  tab and the Info tab all quote it. They drifted once, with Thursday saying "higher seed
  wins" against "split the prizes" everywhere else.

### The Commons is a special case

Not USGA rated — you cannot post a score there, so there is no slope or course rating and no
quota. The scorecard itself prescribes **65% of your handicap** for match allocation over the
12 holes. Commons handicaps: Mike 4, Drew 5, Paul 5, Daniel 6, Eric 7, Brook 8, Matt 8, Tony 8,
Ryan 9. Match strokes are the difference, given to the higher handicap.

**VERIFIED against the physical scorecard.** The HANDICAP row, per hole 1..12, is
`COMMONS_SI = [11, 7, 5, 3, 9, 1, 8, 12, 10, 2, 4, 6]`, stored verbatim in the code with the
hardest-first order **derived** from it rather than transcribed:
`[6, 10, 4, 11, 3, 12, 2, 7, 5, 9, 1, 8]`.

The earlier hand-transcription `[12, 9, 4, 10, 3, 11, 2, 6, 5, 8, 1, 7]` was **wrong in ten of
twelve positions** and is now corrected. The suspicion recorded here was right. The par row,
however, is fine: the card reads 5-3-4-4-3-4 / 4-3-4-4-3-4 and sums to exactly 45 — the "47"
came from the bad PDF extraction, not the card.

Checks that confirm the transcription (re-run these if anyone re-enters it): par sums to **45**;
back/middle/forward yardages sum to **3,417 / 3,027 / 2,584**, each matching its printed total;
and the indexes are a clean permutation of 1..12. Card also confirms the 65% rule directly —
its HANDICAP CONVERSION box runs PLAYER → HI → 65% → MATCH HDCP → STROKE ALLOC — and states the
holes are not USGA rated, so no score can be posted. Architect Jimmy Craig, est. 2026.

### Money

- **La Copa:** $150 each × 9 = $1,350, paying $700 / $350 / $300. Funds exactly at nine.
  `PRIZES` and `ENTRY_FEE` in the code are the **single source** for every figure shown — the
  pool table, the La Final cards, the Info tab and Thursday's match rules all read from them.
  They are declared above `R` so the round definitions can quote them. Change the constant,
  never a displayed number: the two drifted apart once and the app quoted $500/$300/$200 on
  Thursday against $700/$350/$300 everywhere else.
  At eight buy-ins you'd be $150 short — scale the prizes or have the eight cover it.
- **Each round can have its own money game inside the foursome.** These do not interfere with
  the Copa **as long as everyone plays their own ball**. All the suggested formats respect
  that; a scramble or alternate shot would break it.
- **The Sandbox** is its own pot: **$450 prize pool split between skins and CTP** (Oct 2026). Gross skins
  with carryovers plus CTP on all 17. No handicaps. `SANDBOX_POT` is the single source for the figure
  (Today notes, Info money card, Enter tab). **Split: $15 a hole CTP × 17 = $255; the remaining $195
  goes to skins** (`SANDBOX_CTP`, `SANDBOX_HOLES`; `SANDBOX_SKINS` is derived, never typed).

**Format ideas (Sep 2026).** Bingo Bango Bongo is dropped entirely. Sunday is Six-Six-Six, Monday
is Nassau (front / back / total), Tuesday morning stays Wolf, Tuesday afternoon is **gross skins**
— it was a second Nassau, identical to Monday's, until this was spotted. Skins now appears on one
18-hole round; the Sandbox (r3) is a separate pot on 17 par 3s, not a duplicate.

**Tuesday swapped (Oct 1 2026, Drew): Tuesday AM Sedge is now NET skins, Tuesday PM Mammoth is
Wolf.** Net skins works without the app carrying stroke indexes: each player uses the **Plays off**
number from the Today quota table and takes strokes off the handicap row on the Sedge scorecard.
(Earlier the Mammoth skins were deliberately gross on the no-stroke-index argument; the Plays off
column, added later, removed that objection.) The Sandbox stays gross.

`rd.game` is rendered through `esc()`, so it must be **plain text — no HTML entities**;
`rd.gamerules` is not escaped and may use them. Six-Six-Six still appears twice: Sunday, and
inside r6's conditional "Nine Point / Six-Six-Six". Left as-is — these are suggestions.

---

## 3. Pairings

### Baseline grid (current)

| Round | Group 1 | Group 2 |
|---|---|---|
| r1 Links (pinned) | Mike, Drew, Paul, Tony | Eric, Brook, Matt, Ryan |
| r2 SV / Lido / Mammoth | **Sand Valley 10:10** — Mike, Tony, Brook · **Lido 10:30** — Drew, Matt | **Mammoth 10:30** — Ryan, Eric, Paul |
| r4 Sedge (Tue) | **8:30** — Mike, Drew, Eric, Brook | **8:40** — Daniel, Matt, Tony, Ryan |
| r5 Mammoth | Brook, Eric, Daniel, Paul | Drew, Mike, Tony, Ryan |
| r6 Sedge / Lido (Wed) | **Sedge 7:40** — Mike, Paul, Matt, Daniel | **Lido 10:00** — Brook, Tony, Eric, Ryan |
| r7 Sand Valley (Wed) | **1:00** — Drew, Daniel, Matt, Paul | *(one foursome only)* |

**Wednesday rebooked (Sep 30 2026) — set by tee times, not by the optimiser.** The 7:50 Sedge and
12:50 Sand Valley times were given up for a **10:00 Lido foursome**. Drew specified the groups:
Lido — Brook, Tony, Eric, Ryan; Sedge 7:40 — Mike, Paul, Matt, Daniel; Sand Valley 1:00 — Drew,
Daniel, Matt, Paul. r6 is now a two-leg split (Sedge / Lido, like Monday) with **Drew sitting**;
r7 is a single foursome (`ng:1`); Mike and the Lido four all show as **Sitting** (Drew's call:
Mike also plays that day, just earlier, so all five are treated the same).

Consequences, all checked:
- **Drew now has only 3 Sand Valley rounds** (sits Tue PM and Wed AM), so **the Lawsonia backup
  fires for him** — his pool shows `4*`. Matt plays 5; everyone else 4.
- **Full coverage is impossible now.** With Sunday, Monday and this Wednesday fixed, an exhaustive
  search of every Tuesday AM × PM arrangement finds **no week with every pair meeting**; the best
  possible is 1 unmet pair, and that one puts Brook/Ryan together 5 times.
- With Tuesday unchanged it was: never meet — Drew/Ryan, Mike/Ryan, Brook/Daniel, Eric/Daniel;
  4 times — Matt/Daniel, Brook/Eric, Brook/Ryan. **Fixed partly by swapping Daniel and Ryan on
  Tuesday PM (accepted Sep 30 2026)**, Tuesday AM untouched. Then: never meet — Drew/Ryan,
  Ryan/Paul; 4 times — Tony/Ryan, Brook/Eric.
- **Monday Brook/Paul swap (Sep 30 2026, Drew's request):** fixes Ryan/Paul, but **Brook/Eric goes
  to 5** (Sun, Mon SV, Tue AM, Tue PM, Wed Lido). Then Brook/Eric 5, Tony/Ryan 4.
- **Tuesday PM: Drew plays, Matt sits (Oct 1 2026, Drew's request)** — Drew takes Matt's place in
  Mike/Tony/Ryan's group. **Back to 36/36: every pair meets; only Brook/Eric at 4.** Drew now has 4
  SV rounds (no backup needed) and plays Mammoth with the group, so the planned solo is moot.
  **Cost: Matt now has no Mammoth** (his only Mammoth was Tuesday PM). Drew+Mike 3, Drew+Paul 2,
  Matt+Daniel 3. Everyone on 4 counting rounds. verify.js §7 is back to asserting 36/36.
  **Considered and declined (Oct 1 2026): Brook sitting Tuesday PM instead of Matt.** Course coverage
  comes out the same (one priority player on a Mammoth solo either way), but it costs Brook/Paul and
  Brook/Daniel never meeting, Matt/Daniel 4, Brook down to 3 SV rounds (Lawsonia backup) and Matt up
  to 5. Drew: leave Matt sitting.
- **Monday Eric/Tony swap (Sep 30 2026):** strictly better — **now never meet: Drew/Ryan only;
  4 times: Brook/Eric only; max 4.** verify.js §7 pins exactly this, so any new gap still fails. Offered, not taken:
  swapping Eric and Ryan on Tuesday AM (8:30 becomes Drew/Mike/Brook/Ryan) brings Brook/Eric to 4
  and Tony/Ryan to 3 but leaves Drew/Eric and Ryan/Daniel never meeting.
- **Wednesday PM lists Mike, Tony, Brook, Eric and Ryan all as Sitting.** A separate "Played the
  Lido this morning" line was tried and removed at Drew's request — Mike plays Sedge that morning
  too, so singling out the Lido four was inconsistent.
- The old "Tony + Eric + Matt Wednesday PM" request and the Sedge sit-out plan are superseded.

**Group order matters on the non-split rounds.** Group 1 tees first — the Today tab reads the
two times straight off `rd.tees`. Tuesday morning: **Drew's foursome goes first at 8:30, Matt's at 8:40**
(flipped Oct 1 2026 to Matt first, then flipped back at Drew's request Oct 2 2026). Swapping the two groups in `BASE_GRID` changes only who tees when; membership, pair
counts and the pins are all order-independent.

**Wednesday swap (Sep 2026), from the group's feedback:** on Wednesday PM they asked to keep
Tony with Eric and move Brook and/or Matt into that group. Checked exhaustively:
**Brook and Matt both is infeasible** (no week keeps 36/36 with max 3); Wed PM alone can't do it
either (always a 0 or a 4). The smallest fix is **Matt in, with Wed AM swapping Matt and Eric**
and Wed PM swapping Matt and Daniel. Brook-only needed Tuesday PM reshuffled too and took Drew
out of Tony's group, so it was not taken. (Superseded in part by the
Lido re-pair below: Tony/Eric/Matt still together Wednesday PM, but Drew is no longer in that group.)
- ~~**r7 Wednesday PM** must have **Tony with Eric and Matt**~~ — superseded by the rebooked Wednesday.

**Pinned by request — do not lose these when regenerating:**
- **r1 Sunday** must have **Drew with Mike** and **Drew with Paul** and **Eric with Brook**.
- **r4 Tuesday AM** must have **Matt with Daniel** (Daniel's first 18).
- **Matt with Daniel at least twice** across the week.
- **Drew with Paul at least twice** across the week.
- **Drew with Mike at least twice** across the week.

**Sedge sit-outs (Sep 2026).** Paul, Brook and Tony each skip one of the two Sedge rounds:
**Paul sits Tuesday**, **Tony and Brook sit Wednesday**. Wednesday Sedge therefore runs with
**seven players — one four and one three** (`ng:2`, `sizesFor(7,2)` → `[4,3]`). Nobody drops below
four Sand Valley rounds, so the Lawsonia backup stays dormant. Loads are now **three players on
five** (Matt, Eric, Ryan) and **six on four**.

**Drew's partner preferences (Sep 2026):** more rounds with Mike, Brook and Tony; fewer with Ryan.
After the Lido re-pair: Mike **3**, Brook 2, Paul 2, Tony **1**, Ryan **1** (the floor), Matt 1,
Eric 1, Daniel 1. Tony at 1 is forced — no full-coverage week reaches 3, and the only ones at 2
reshuffle Tuesday morning too (option B, not taken).

**What unlocked it: dropping the index-balance constraint.** While balance was enforced, Drew with
Mike could only happen once, and Sunday with Drew+Mike+Paul forced Ryan in as the only workable
fourth — the exact opposite of the request. Balance was never a real constraint (see below), and
removing it made all of it reachable at once. **Do not reintroduce it.**

**Sunday with Drew+Mike is infeasible if Monday is also held fixed** — some pair is always forced
over 3. Verified by exhaustive search, not a failed optimiser run. That is why Monday's course
split moved.

**Properties this grid satisfies:** all **36 possible pairs** play together at least once and
**nobody is paired more than 3 times** (nor zero times).

**All hand overrides are now cleared.** An earlier round of in-app edits left `r4` and `r6`
pairing/sit-out overrides in `data.json` — at one point putting Matt with Daniel four times,
breaking the Matt-with-Daniel pin, and dropping Drew/Paul to 1. The Sedge sit-out change above
redefined both rounds in code, so `data.json` carries **no `p` or `o` overrides at all** and the
whole week comes from `BASE_GRID`. That also resolved the Matt/Daniel 4 — **nobody is over 3 now**.

To undo an override in future, **delete it from `data.json`** so the round falls back to the grid
— do not write `BASE_GRID` into the file. The Sandbox is excluded from partner
tracking because everyone plays it together; Thursday follows the standings.

**Index balance is NOT a property and must not be reintroduced (Sep 2026).** The group-average
index gap is now 3.75 and that is fine. It appears in exactly one place in the code — a display
label on the Pairings preview — and in none of `chcp`, `quotaFor`, `results`, `standing` or
`board`. **Quota is `quotaFor(that player's index, that player's tee)`; the group is not an
argument**, so the draw cannot move anyone's score. Enforcing balance bought nothing and blocked
the pairings people actually asked for.

**First four rounds — checked Sep 2026, no tweak available.** Drew asked whether the spread over
Sunday, Monday and the two Tuesday rounds could be improved, given Wednesday may be reshuffled.
It cannot, without cost. Current: **32/36 pairs met in the first four**, 4 pairs at 3+. The
absolute ceiling is **34/36** — Daniel plays only 2 of those 4 rounds (he sits Sunday and Monday),
so at most 6 of his 8 pairs are reachable and 2 are structurally impossible. Exhaustive search
over every legal r2/r4/r5 arrangement: the best that still completes to a valid full week is
**exactly the current 32/36**, and all 6 arrangements that reach 34/36 **cannot** be completed to
a 36/36 week with max 3. So the 2-pair gain costs the week-long guarantee. **Left as-is.**
Three of the four first-four gaps are Daniel's and unavoidable; the fourth is Matt/Drew.

**How it was produced.** Not greedily round-by-round — that plateaus around 35/36 pairs. All six
grouped rounds were optimized **jointly**: random restart plus hill-climbing on cross-group swaps,
with the pinned rounds held fixed and Drew's partner preferences as a soft objective. Optimizer is
in Appendix A.

### Monday is a split round

**Lido landed (Sep 2026).** Two Lido tee times at 10:30 replaced one spot each from the Sand Valley
and Mammoth groups: **Drew and Matt play the Lido as a twosome**, leaving threesomes on Sand Valley
(Mike, Tony, Brook) and Mammoth (Ryan, Eric, Paul) — Brook↔Paul and then Eric↔Tony swapped at
Drew's request, Sep 30 2026. Daniel still sits.

**Drew's course priority (Sep 30 2026): Drew, Mike, Matt, Tony and Brook should each play all four
resort courses (Sand Valley, Lido, Sedge, Mammoth).** The Eric↔Tony swap gave Tony Sand Valley.
After Drew took Matt's Tuesday PM spot: Drew, Tony and Brook have all four; **Matt has no Mammoth**.
**Mike has no Lido** (Drew: leave it).
**Solos (Oct 1 2026): Matt plays Mammoth solo on Tuesday PM at 1:30pm; Mike plays the Lido solo on
Wednesday PM at 12:30pm.** They do not count for the Copa. **Shown on the site at Drew's request (reversing an earlier
"keep it off")**: the Today sitting line reads "Matt (playing Mammoth solo)" / "Mike (playing the Lido
solo)" via a display-only `rd.soloNote` map, and a note under Courses by player names both. The
table counts themselves still exclude solos (red dashes stay). Covered by verify.js §17. — fixing it means swapping him into the Wednesday Lido foursome, which costs
Mike/Daniel never meeting; offered, not taken. Non-priority gaps: Eric/Ryan no SV; Paul/Daniel no Lido. The round is now a
three-leg split (`ng:3`, `split` = SV / Lido / Mammoth in `BASE_GRID.r2` order). Lido counts
like every other Sand Valley resort 18.

**Lido ratings — CONFIRMED** against Sand Valley's own tee table (men's): White 72.5/144
(default), Navy/White 74.1/146, Navy 75.2/149, White/Green 70.7/141, Green 69.6/134, all par 72.
Drew and Matt can pick a different tee per player on the Enter tab.

**Drew's Tuesday PM Mammoth solo is moot** — as of Oct 1 2026 Drew plays Tuesday PM with the group
and Matt sits (see §3). The "everyone plays both courses" reasoning below predates Lido.

**Coverage broke:** with Drew and Matt out of the two foursomes, **Matt/Paul and Drew/Ryan dropped
to zero**. Exhaustive search (Sunday, Monday, Matt+Daniel Tuesday AM, Drew+Paul ≥2, Drew+Mike ≥2,
Matt+Daniel ≥2, Tony+Eric+Matt Wednesday PM all held) finds 23 full-coverage weeks; **none keeps
Drew/Ryan at zero**, and **none gives Drew more than 2 rounds with Tony**.

**Chosen: option A (Sep 2026), the smallest fix — 6 players move, Tuesday morning untouched.**
Tue PM becomes Brook/Eric/Ryan/Paul | Matt/Mike/Tony/Daniel; Wed AM 7:40 Drew/Mike/Ryan (Mike's
group still first) | 7:50 Matt/Eric/Paul/Daniel; Wed PM Drew/Brook/Paul/Daniel | Matt/Tony/Eric/Ryan.
Back to 36/36, max 3; Drew+Paul 2, Drew+Mike 3, Matt+Daniel 3. Option B (11 moves, Drew with Tony
2 but Mike out of Drew's Tuesday 8:30) was offered and not taken.

r2 is the only round where the two groups play **different courses**: Sand Valley at 10:10 and
Mammoth Dunes at 10:30, replacing the cancelled Lawsonia Woodlands tee time. Daniel sits.

The round carries a `split:[{key,course,tee},…]` array indexed by group. `legOf()/keyFor()/
courseOf()/teeListFor()` resolve **per player via their group**, so course handicap, quota, the
tee presets on Enter and the labels on Today all follow whichever course that player actually
played. A round without `split` behaves exactly as before. Slopes differ (SV 138 vs Mammoth 136),
so this is not cosmetic — getting it wrong would mis-quota half the field.

Monday's groups **changed in Sep 2026** when Drew asked to play with Mike on Sunday: holding both
Sunday and Monday fixed made the week infeasible (see §3). The course split is
**Sand Valley 10:10** — Mike, Paul, Eric, Matt; **Mammoth 10:30** — Drew, Brook, Tony, Ryan.

**Why this way round (Sep 2026): it is the only split where Drew and Mike both play both courses.**
Drew sits Tuesday PM Mammoth and Mike sits Wednesday PM Sand Valley, so Monday is the only chance
for Drew to play Mammoth and for Mike to play Sand Valley. Everyone else plays both courses either
way. Do not flip it back unless those sit-outs change.

To swap which group plays which course, swap the two groups in `BASE_GRID.r2` (done here, so the
Today tab still lists Monday in tee-time order) or reorder the `split` array. Either is safe while
`data.json` carries no `r2` pairing override. Keep the round-level `tees` string chronological (`10:10 / 10:30`); it
feeds the Today header and the round selector, and listing it in group order reads like a typo.
Per-group times come from the legs and are correct either way.
The `woodlands` entry in `TEES` is kept, unused, in case the tee time is un-cancelled.

### In the app

The Info tab's **"How pairings work" card is organiser-only** — it describes controls nobody else
can see, and the group does not need the mechanics. Its grouped-round count is derived from
`BASE_GRID` rather than written out; it read "eight" while there were six.

**There is NO user-facing auto-generate (removed Sep 2026).** The Auto-generate / Try another
arrangement / Unlock buttons, the per-round lock and `isLocked()` are all gone, along with the
`Locked` pill. The grid was chosen deliberately after a lot of iteration; a button that could
redraw a round out from under it was pure downside, and it had already caused trouble via the
sit-out path. **Do not add it back.** Pairings change only through the per-player dropdowns.

`generate()` and `scorePartition()` are **kept as an internal fallback**: `defaultPairings()`
calls them when a sit-out change means the baseline no longer covers the players who are in, so
that one round re-draws and the rest are untouched. `S.u` (unlock flags) is now vestigial —
still in `BLANK` so old links decode, never read or written.

**`defaultPairings()` uses the baseline whenever it still covers exactly the players who are in**,
compared as a set. It used to test `!S.o[rd.id]`, which threw the chosen grid away the moment ANY
sit-out override existed for that round — **including one identical to the default**, which the
Pairings dropdowns create just by being touched and set back. That silently regenerated Tuesday
morning on the live board in Sep 2026 and pushed Eric/Paul to 4. A genuine sit-out change still
falls through to `generate()`, as it should. Covered by verify.js §13c.

Manual per-player dropdowns (Sitting / Group 1 / 2 / 3) are the only way to change a pairing, and
every change re-renders the group preview, the sit-outs, the Today tab and the partner matrix.

---

## 4. The app

Single self-contained `index.html`. No frameworks, no build, no bundled assets.
The only network calls are to the GitHub contents API (§6), and they are optional —
the app is fully usable offline with the URL-hash path alone.

**localStorage is used for exactly one thing: the organiser's API token.** Every access
is wrapped in try/catch, so in a sandbox that blocks storage the app degrades to the
read-only board rather than breaking. Do not put app state there — the hash is the
state, deliberately.

### State model

State lives in the URL hash as base64 of a compact JSON object. The link *is* the save file.

```
S = {
  v: 1,
  s: { roundId: [9 point totals, null if blank] },   // scores
  t: { roundId: [9 entries: 0 = default tee, or [courseRating, slope]] },
  p: { roundId: [[playerIdx,...], [playerIdx,...]] },// pairings
  o: { roundId: [playerIdx,...] },                   // sit-outs
  u: { roundId: 1 },                                 // rounds unlocked for auto-generate
  i: { playerIdx: 11 },                              // confirmed indexes; absent = BASE_IDX
  m: 0,                                              // epoch ms of last user edit
  l: []                                              // legacy ledger, unused
}
```

**The hash is written stripped, like a publish** (Sep 2026): rounds still matching `BASE_GRID`
are left out of `p`, and a `g` stamp (hash of `BASE_GRID`) is added. On load, a hash whose `g`
differs from the running grid drops its `p` entirely. Before this, reload kept the hash, the hash
carried the whole old grid, and `defaultPairings()` saw `S.p` already filled — so a reload showed
last week's pairings until the tab was closed and the URL retyped. Published hand edits come back
with the pull; only an *unpublished* local pairing edit is lost across a code update.

`m` is what decides hash-versus-remote on load, so **it must only be stamped on genuine
user edits**. That is why edits go through `edit()` and boot-time seeding calls `save()`
directly — if simply opening the page stamped `m`, every viewer's untouched local copy
would look newer than the published board and refuse to update.

`decode()` fills missing keys with defaults, so **older shared links keep working** as the
shape evolves. Preserve that when changing state.

### Key functions

| Function | Does |
|---|---|
| `chcp(idx, tee)` / `quotaFor(idx, tee)` | course handicap and quota; `tee = [name, CR, slope, par]` |
| `fmtIdx(v)` | **index display, always 1dp** (7 → `7.0`). Never wrap a course handicap or quota in it — those are integers by definition |
| `applyIdx()` | copies `S.i` onto `P[n].idx`. Run after every load/pull, **before `defaultPairings()`** |
| `rosterCard()` / `wireRoster()` | the index editor on the Pairings tab |
| `teeFor(rd, pi)` | that player's tee for that round, honoring per-player CR/slope overrides |
| `results(pi)` / `standing(pi)` / `board()` | round results, drop-worst-average, sorted leaderboard with tiebreaks |
| `commonsHcp(idx)` / `matchStrokes(a, b)` | the 65% rule and La Final stroke allocation |
| `historyUpTo(i)` | pair-frequency map across locked groups; **skips r3 (Sandbox)** |
| `generate(ids, sizes, hist, seed)` | seeded random-restart pairing search |
| `defaultPairings()` | seeds `BASE_GRID`, falls back to `generate()` |
| `isLocked(rd)` | true when the round has a baseline grid and isn't unlocked |
| `save()` / `edit()` | `save()` writes the hash; `edit()` stamps `m`, flags dirty, then saves. **User edits call `edit()`** |
| `remoteGet()` / `remotePut()` | contents API read / write; `remotePut` retries once on a stale-SHA 409 |
| `pull(manual)` / `publish()` | fetch the published board (never clobbers unpublished edits) / push it |
| `renderSync()` / `ago(ms)` | the last-updated header line and its relative-time formatting |
| `applyMode()` | hides Enter when there's no token; Pairings then renders read-only |
| `matrixCard()` / `rosterCardReadOnly()` | the two cards viewers see on Pairings |
| `renderInfo / renderToday / renderEnter / renderStand / renderPair` | the five tabs |

### Tabs

**Which round the site opens on (Oct 2026, Drew).** `liveRound(now)` picks the last round whose
`roundOpens(i)` has passed, **always in Wisconsin Central time** (`TZ_OFFSET_H = 5`, CDT, independent
of the phone's zone; tee times are parsed from `rd.tees`). Morning rounds open at **7pm Central the
night before**; afternoon rounds (and the first round, Sunday) open **4h before their first tee, but
not until 2h after the previous round's last tee** so a 36-hole day doesn't flip mid-round. Result:
Sun 9:40am Lawsonia · Sun 7pm Mon AM · Mon 12:54pm Sandbox · Mon 7pm Tue AM · Tue 10:40am Mammoth ·
Tue 7pm Wed AM · Wed 12:00pm Sand Valley · Wed 7pm Commons. Before Sun 9:40am the site opens on Info.
Covered by verify.js §18. If tee times change, the switch times follow automatically.

**Info** (landing until Sun 9:40am Central, then Today on the live round) · **Today** (groups — **each
group box names its course (split days) and default tees in bold with rating/slope, right under
the tee time**; the old "X tees by default" in the header was dropped since it was wrong on split
days — format,
quotas, and **Plays off** — strokes against the lowest course handicap *in that player's own
group*, for the side games; rows grouped, low man first at 0; split rounds put the course on the
group header instead of a column so it fits a phone. Uses course handicaps, so tee overrides and
split courses are already in it. It is display only — the Copa never reads it) · **Enter** (nine number inputs plus editable CR/slope per player) · **Standings**
(leaderboard, bar chart, La Final card, pool) · **Pairings** (assignment dropdowns, partner
matrix, indexes, and at the bottom **Courses by player** — `coursesCard()` counts each player's
Lawsonia / SV / Lido / Sedge / Mammoth rounds from `S.p` across counting and backup rounds (Lawsonia
column added Oct 2026; Total counts it, so most players show 5), red dash for a course they
never play; shown to viewers too. Off-site rounds like Drew's Tuesday solo are not in it).

### Testing

Verified with jsdom (logic) and Playwright/Chromium (render + interaction). Checks worth
re-running after changes: quota math against a known table, partition validity, partner
coverage, drop-average against a hand calculation, URL round-trip, and every tab rendering
without a page error.

---

## 5. Open items

- [x] **Who sits Mammoth (Tue PM) and Sand Valley (Wed PM).** **Drew sits Mammoth**; **Mike sits
      Sand Valley** (he may try to get on Lido as a solo that afternoon). Both play every other
      round, so both drop from five counting rounds to four and the corollary above holds.
      Neither sit-out is attributed on the Info or Today tabs — the rounds just name who sits.
      Revisit only if the third tee time lands (see below), which would make them moot.
- [ ] **Ask Sand Valley for a third tee time** on those two rounds. Turns them into 3/3/3 so
      everyone plays, and threesomes walk faster.
- [ ] **Tuesday's turn is tight.** Sedge at 8:30/8:40 finishing at the resort's 4:15 pace lands
      12:45–12:55 against a 12:50 Mammoth tee. Moving Tuesday's Sedge earlier is worth more than
      the extra tee times. (Wednesday is fine: 7:40 is a pre-8am speed slot, under 4 hours.)
- [x] **Confirm real handicap indexes.** All nine confirmed (Oct 4 2026): Matt 14.1, Drew 7.3, Mike 7.7,
      Tony 13.1, Brook 12.7, Eric 6.4, Paul 8.8, Ryan 15.1 (all in `data.json`), and **Daniel 9.0** —
      confirmed equal to his `BASE_IDX` fallback, so he has no `data.json` entry and needs none. If an
      index changes, edit it on the **Pairings tab → Handicap indexes** and Publish (no code change).
      **Lock them before Monday** — round results are recomputed from the current index, so editing one
      after a counting round rewrites that round's result. Committee adjustments belong Sunday night.
- [x] **Verify the Commons stroke-index row** against the physical scorecard. Done — the old row
      was wrong in ten of twelve positions and is corrected. See §2.
- [x] **Lido** — landed for Monday: Drew and Matt, 10:30. See §3 Monday.
- [x] **Confirm Lido rating/slope** — matches Sand Valley's tee table; White 72.5/144 in use.
- [x] **Restore 36/36 coverage** after the Lido change — done with option A (§3 Monday).
- [x] Round plans — superseded by the rebooked Wednesday (§3).
- [x] **Tuesday PM Daniel/Ryan swap** — done; never-meet 4 → 2, four-timers 3 → 2.

---

## 6. The save layer — BUILT

One URL for everyone. The page reads `data.json` from the **repo contents API**; whoever holds
a token can publish to it. No more texting a link after every round.

### Setup — Drew, once, before the trip

1. GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate.
2. Repository access: **only `dvarano/sandvalleyvatoz`**. Permissions: **Contents → Read and write**.
   Nothing else.
3. Expiry: set it past the trip (e.g. 30 Nov 2026). Fine-grained tokens must have one.
4. Open the site → **Info tab → "Organiser access"** → paste → Save.

The token lives in `localStorage` on that device only. **It is per-device-per-browser** — paste
it again on the laptop if you'll score from both. It is never committed and never in the URL.
It publishes to one repo, so the worst case if it leaks is a defaced golf site.

### How the two modes work

| | Token present | No token |
|---|---|---|
| Tabs | all five | Info, Today, Standings, **Pairings (read-only)** |
| Pairings tab | assignment dropdowns, generator, editable indexes | "Who plays with whom" + indexes as a table, nothing editable |
| Header | last-updated + Refresh + **Publish** | last-updated + Refresh |
| Writes | local hash *and* `data.json` | local hash only, never shared |

Hiding Enter and the Pairings edit controls is **cosmetic, not a security boundary** — anyone can unhide them in dev
tools. The real guard is that publishing needs the token, so an unhidden tab only ever edits
that person's own copy, which vanishes on refresh. Don't "harden" the hiding; it isn't the point.

### Decisions worth not re-litigating

- **Explicit Publish, not autosave.** `save()` fires on every keystroke. Auto-pushing would mean
  a commit per keystroke — unreadable history, and it would burn the rate limit. Publish also
  means a half-entered round never shows up as the live leaderboard.
- **The hash stays the local write path, always.** Sand Valley is rural Wisconsin and scores get
  entered on one bar of signal. `edit()` writes the hash synchronously first, so a failed publish
  can never lose a round. Verified by test: score survives a publish against a dead network.
- **Reads go through the contents API**, not Pages or `raw.githubusercontent.com` — those are
  CDN-cached for minutes and would feel broken when nine people refresh after a round.
- **Refresh is manual, never polled.** Unauthenticated reads are 60/hour *per IP*, and on resort
  wifi the whole group is behind one NAT — so that 60 is shared. Polling would blow it.
- **Rate limiting is detected from the response body, not the `x-ratelimit-remaining` header**,
  which is CORS-filtered and not reliably readable from the page.
- **On conflict, newer `m` wins**, and unpublished local edits are never clobbered by a pull.
- **Baseline pairings are deliberately NOT published.** `defaultPairings()` seeds `S.p` from
  `BASE_GRID` at boot, so publishing it verbatim freezes the grid at the publisher's code
  version and no later `BASE_GRID` change can reach anyone. This bit us on the very first
  publish (a board went out carrying the pre-Paul grid, which then contradicted `rd.out` and
  showed Paul both playing and sitting Sand Valley). `publishPayload()` now strips rounds that
  still match `BASE_GRID`; hand-edited rounds are published as-is. **If you change `BASE_GRID`,
  that is enough — do not also hand-write `data.json`.**

- **"Updated X ago" covers code changes too** (Sep 2026). The header used to show only `S.m`,
  the last publish of `data.json`, so a pairing change pushed as code never moved it.
  `renderSync()` now shows the newer of `S.m` and **`SITE_UPDATED`**, a timestamp constant at the
  top of the script. **Bump `SITE_UPDATED` in every commit that changes something the group sees**
  (pairings, schedule, rules or Info text) — set it to the current UTC time. Do not bump it for
  tests, docs or refactors. Display only: publish and pull still compare `S.m` alone, so this
  cannot affect the hash-versus-remote decision. Covered by verify.js §16.
- **Open tabs pick up code updates themselves** (Sep 2026). Pages serves `index.html` with a
  10-minute cache and Safari holds it longer, so a code change (new pairings) would not show on
  reload. `checkForUpdate()` fetches `location.pathname?cb=<now>` with `no-store` — the Pages URL,
  **not** the API, so it costs nothing against the 60/hour limit — hashes the fetched inline script
  and compares it with `BUILD`, the hash of the script actually running. On a mismatch it
  `location.replace`s onto `?v=<build>`, a URL neither Safari nor the CDN has cached, keeping the
  hash. Runs at boot, on Refresh, when the tab becomes visible, and on a bfcache restore; throttled
  to once per 30s. **Loop guard:** if `?v=` already names the fresh build, it never redirects again.
  **Unpublished edits hold the reload back** (toast instead). There is no manual build number to
  bump — the version is derived from the script text, so any code change counts. Only runs on
  http(s), so the file:// test path is unaffected. Covered by verify.js §15.

Alternatives considered: Cloudflare Workers + KV (better on every axis — no browser token, no
rate limit, no SHA dance — but a second service to stand up for nine guys and five rounds), and
Supabase/Firebase (proper, and overkill).

### Testing

`verify.js` in the repo root (Playwright, GitHub API mocked via route interception) covers both
modes, publish, the stale-SHA 409 retry, rate limiting, offline edit survival, index editing and
propagation, backward compatibility with pre-`i` links, the baseline-grid freeze guard, the
read-only viewer tab, index/course-handicap number formatting, the Lawsonia backup rule, the
Monday split round, the standings markers, the organiser-only Info card, the no-op sit-out
guard, the pairing invariants, and code updates reaching an open tab (§15, over a local HTTP
server), the header's last-updated time (§16) the courses-by-player table and solo notes (§17), the Central-time landing round (§18), mid-week standings (§19), the tiebreak order (§20) and the Sunday backup-only flag (§21), Mammoth par 73 (§20b), the provisional La Final label (§20c) — 156 assertions. Worth re-running after any change to the sync path.

```
npm i playwright && node verify.js      # no token and no network needed; the API is mocked
```

It drives the real `index.html` from disk, so it catches render regressions too. If Chromium
isn't on the default path, set `executablePath` at the top of the file.

---

## 7. Sources

- Sand Valley course pages (ratings/slopes for Sedge, Mammoth, Sand Valley) — sandvalley.com
- The Commons scorecard PDF (12 holes, par 45, 3,417 back, not USGA rated, 65% rule)
- Sand Valley FAQ — pace of play: under 4 hours pre-8am, 4:15 after
- Lawsonia ratings supplied by Drew: Links White 72.0/133; Woodlands Blue 71.6/131, White 70.2/128
- Original trip email chain and `Sand Valley 2026.xlsx` in this folder

---

## Appendix A — pairing optimizer

Standalone Node script. Regenerates `BASE_GRID` if constraints change (someone drops out, Lido
lands, a new pairing gets pinned). Edit `OUT`, `FIXED_R1` and the `together()` constraints, run
`node optimizer.js`, paste the `EMBED` line into `BASE_GRID` in `index.html`.

```js
const P=[13,7,6,13,12,10,14,8,9];                     // indexes, array order below
const NAMES=['Matt','Drew','Mike','Tony','Brook','Eric','Ryan','Paul','Daniel'];
const FIXED_R1=[[1,2,3,7],[0,4,5,6]];                 // Sunday: Drew+Mike+Tony+Paul | Matt+Brook+Eric+Ryan
const OUT={r2:[8],r4:[4],r5:[1],r6:[3],r7:[2]};       // who sits each round (r7: Mike)
const FREE=['r2','r4','r5','r6','r7'], ALL=['r1'].concat(FREE);
const IDS={}; FREE.forEach(r=>{IDS[r]=[];for(let i=0;i<9;i++)if(OUT[r].indexOf(i)<0)IDS[r].push(i);});
function mul(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const key=(a,b)=>Math.min(a,b)+'|'+Math.max(a,b);
function stats(plan){
  const h={};
  ALL.forEach(r=>plan[r].forEach(g=>{for(let a=0;a<g.length;a++)for(let b=a+1;b<g.length;b++)
    h[key(g[a],g[b])]=(h[key(g[a],g[b])]||0)+1;}));
  let unmet=0; for(let i=0;i<9;i++)for(let j=i+1;j<9;j++) if(!h[key(i,j)]) unmet++;
  const v=Object.values(h);
  let bal=0; ALL.forEach(r=>{const m=plan[r].map(g=>g.reduce((s,x)=>s+P[x],0)/g.length);
    bal=Math.max(bal,Math.max(...m)-Math.min(...m));});
  let excess=0; v.forEach(c=>{ if(c>2) excess+=(c-2)*(c-2); });
  return {h,unmet,max:Math.max(...v),bal,excess,met:Object.keys(h).length};
}
function together(plan,r,a,b){return plan[r].some(g=>g.indexOf(a)>=0&&g.indexOf(b)>=0);}
const MD=key(0,8), DP=key(1,7);                   // Matt+Daniel, Drew+Paul
/* No s.bal term: index balance is deliberately not optimised — see §3. */
const cost=(s,plan)=>s.unmet*10000 + s.excess*60 + Math.max(0,s.max-3)*5000
  + (together(plan,'r4',0,8)?0:1000000)           // Matt + Daniel, Tuesday AM
  + Math.max(0,2-(s.h[MD]||0))*1000000            // Matt + Daniel at least twice
  + Math.max(0,2-(s.h[DP]||0))*1000000;           // Drew + Paul at least twice
function climb(plan){
  let cur=cost(stats(plan),plan),imp=true;
  while(imp){ imp=false;
    for(const r of FREE){ const g=plan[r];
      for(let x=0;x<g[0].length;x++)for(let y=0;y<g[1].length;y++){
        const t=g[0][x];g[0][x]=g[1][y];g[1][y]=t;
        if(cost(stats(plan),plan)<cur-1e-9){cur=cost(stats(plan),plan);imp=true;}
        else {const t2=g[0][x];g[0][x]=g[1][y];g[1][y]=t2;}
      }}}
  return cur;
}
let best=null,bestC=Infinity;
for(let seed=1;seed<=600;seed++){
  const rnd=mul(seed), plan={r1:JSON.parse(JSON.stringify(FIXED_R1))};
  FREE.forEach(r=>{const p=IDS[r].slice();
    for(let i=p.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=p[i];p[i]=p[j];p[j]=t;}
    plan[r]=[p.slice(0,4),p.slice(4)];});
  const c=climb(plan);
  if(c<bestC){bestC=c;best=JSON.parse(JSON.stringify(plan));}
}
const st=stats(best);
console.log(`pairs met ${st.met}/36 | max repeat ${st.max} | index gap ${st.bal.toFixed(2)} (informational only)`);
ALL.forEach(r=>console.log('  '+r+'  '+best[r].map(g=>g.map(i=>NAMES[i]).join('/')).join('   |   ')));
console.log('\nEMBED = '+JSON.stringify(best));
```
