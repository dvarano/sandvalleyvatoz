# La Copa De Vatoz — Sand Valley 2026

Project notes and decision record for the golf trip dashboard. Written as a handoff
so a future session can pick this up cold.

- **Live site:** https://dvarano.github.io/sandvalleyvatoz/
- **The app:** `index.html` — one self-contained file, no build step, no dependencies.
- **Group name:** the Sand Valley Vatoz (vatos with a z). Competition is **La Copa De Vatoz**.
  Rename via `TRIP_NAME` at the top of the script.
- **Branch:** commit and push directly to `main`. No feature branches, no PRs — Pages serves
  `main`, so anything not on it isn't live.

---

## 1. The trip

Nine golfers, Oct 4–8 2026. Lawsonia (Green Lake, WI) for two rounds, then Sand Valley.
Matt Anderson organizes the trip logistics; Drew handles pairings, games and this app.

| # | Day | Course | Tee times | Default tee | Counts? | Format idea | Out |
|---|---|---|---|---|---|---|---|
| r1 | Sun 10/4 PM | Lawsonia Links | 1:40 / 1:50 | White 72.0 / 133, par 72 | No — El Qualifier | Bingo Bango Bongo | Daniel |
| r2 | Mon 10/5 AM | Lawsonia Woodlands | 9:00 / 9:10 | Blue 71.6 / 131, par 72 | **Yes** | Six-Six-Six | Daniel |
| r3 | Mon 10/5 PM | The Sandbox | 4:54 / 5:18 | 17 par 3s | No — Side Pot | Gross skins + CTP | — |
| r4 | Tue 10/6 AM | Sedge Valley | 8:30 / 8:40 | Back 68.7 / 130, par 68 | **Yes** | Wolf | Brook |
| r5 | Tue 10/6 PM | Mammoth Dunes | 12:50 / 1:00 | Orange 72.1 / 136, par 72 | **Yes** | Four-ball Nassau | one sits |
| r6 | Wed 10/7 AM | Sedge Valley | 7:40 / 7:50 | Back 68.7 / 130, par 68 | **Yes** | Nine Point / 6-6-6 | Tony |
| r7 | Wed 10/7 PM | Sand Valley | 12:50 / 1:00 | Orange 72.8 / 138, par 72 | **Yes** | Vegas | one sits |
| r8 | Thu 10/8 AM | The Commons | 8:00 / 8:10 | 12 holes, par 45 | No — La Final | Match play | — |

Alternate tees available in the app: Woodlands White 70.2/128; Sedge Back/Middle 67.0/126;
Mammoth Orange/Sand 71.1/134 and Sand 69.8/131; Sand Valley Orange/Sand 71.4/133 and Sand 70.2/129.

**Sedge is played from the tips on purpose.** The back tees are only 5,829 yards at par 68,
already the shortest course on the trip. One up (~5,400) takes driver out of your hands on a
course built to be played at full length. This is a golf-quality call, not a fairness one —
quota self-corrects for tees automatically.

### Roster (handicap indexes are PLACEHOLDERS, confirm before the trip)

| Mike | Drew | Paul | Daniel | Eric | Brook | Matt | Tony | Ryan |
|---|---|---|---|---|---|---|---|---|
| 6 | 7 | 8 | 9 | 10 | 12 | 13 | 13 | 14 |

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

Play five counting rounds, average your best four. Play four, average your best three.

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

- Sunday at Lawsonia is a **warmup only**. No points. It sets adjusted indexes (committee —
  Drew and Matt — may move any index ±3 before Monday) and it is the **first tiebreak** for
  seeding. Second tiebreak is best single round.
- Top 4 after Wednesday tee at 8:00 Thursday at the Commons. Everyone else is **El Toilet Bowl**
  at 8:10.
- Match A: Seed 1 v Seed 2 for **$700 / $350**. Match B: Seed 3 v Seed 4 for **$300**.
- **Seeds 1 and 3 start 1 up.**
- All square after 12 → split the prizes, or agree on a playoff / chip-off / putt-off.

### The Commons is a special case

Not USGA rated — you cannot post a score there, so there is no slope or course rating and no
quota. The scorecard itself prescribes **65% of your handicap** for match allocation over the
12 holes. Commons handicaps: Mike 4, Drew 5, Paul 5, Daniel 6, Eric 7, Brook 8, Matt 8, Tony 8,
Ryan 9. Match strokes are the difference, given to the higher handicap.

Stroke holes hardest-first: `[12, 9, 4, 10, 3, 11, 2, 6, 5, 8, 1, 7]`. **Read off the published
scorecard PDF and worth verifying against the physical card** — the par row in the same
extraction was garbled (summed to 47 against a stated par of 45), so the index row may be off too.

### Money

- **La Copa:** $150 each × 9 = $1,350, paying $700 / $350 / $300. Funds exactly at nine.
  At eight buy-ins you'd be $150 short — scale the prizes or have the eight cover it.
- **Each round can have its own money game inside the foursome.** These do not interfere with
  the Copa **as long as everyone plays their own ball**. All the suggested formats respect
  that; a scramble or alternate shot would break it.
- **The Sandbox** is its own pot: gross skins with carryovers plus CTP on all 17. No handicaps.

---

## 3. Pairings

### Baseline grid (current)

| Round | Group 1 | Group 2 |
|---|---|---|
| r1 Links | Mike, Eric, Brook, Ryan | Drew, Paul, Matt, Tony |
| r2 Woodlands | Mike, Drew, Matt, Ryan | Paul, Eric, Brook, Tony |
| r4 Sedge (Tue) | Paul, Daniel, Matt, Ryan | Mike, Drew, Eric, Tony |
| r5 Mammoth | Daniel, Eric, Tony, Ryan | Mike, Paul, Brook, Matt |
| r6 Sedge (Wed) | Drew, Paul, Brook, Ryan | Mike, Daniel, Eric, Matt |
| r7 Sand Valley | Drew, Daniel, Eric, Brook | Mike, Paul, Tony, Ryan |

**Pinned by request — do not lose these when regenerating:**
- **r1 Sunday** is exactly the grid Drew picked.
- **r4 Tuesday AM** must have **Matt with Daniel** (Daniel's first 18).

**Properties this grid satisfies:** all **36 possible pairs** play together at least once,
**nobody paired more than 3 times**, and no round has its two groups more than **2.0 apart**
in average index. The Sandbox is excluded from partner tracking because everyone plays it
together; Thursday follows the standings.

**How it was produced.** Not greedily round-by-round — that plateaus around 35/36 with a 4.25
index gap. All six grouped rounds were optimized **jointly**: random restart plus hill-climbing
on cross-group swaps, with the pinned rounds held fixed. Optimizer is in Appendix A.

### In the app

All rounds carrying a baseline grid **start locked** so a stray tap on auto-generate can't wipe
a chosen pairing. Unlock is per round. Manual per-player dropdowns (Sitting / Group 1 / 2 / 3)
always work, locked or not, and every change re-renders the group preview, the sit-outs, the
Today tab and the partner matrix.

---

## 4. The app

Single self-contained `index.html`. No frameworks, no build, no external requests.
**No localStorage** — deliberately, so it also runs inside the Claude artifact sandbox.

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
  l: []                                              // legacy ledger, unused
}
```

`decode()` fills missing keys with defaults, so **older shared links keep working** as the
shape evolves. Preserve that when changing state.

### Key functions

| Function | Does |
|---|---|
| `chcp(idx, tee)` / `quotaFor(idx, tee)` | course handicap and quota; `tee = [name, CR, slope, par]` |
| `teeFor(rd, pi)` | that player's tee for that round, honoring per-player CR/slope overrides |
| `results(pi)` / `standing(pi)` / `board()` | round results, drop-worst-average, sorted leaderboard with tiebreaks |
| `commonsHcp(idx)` / `matchStrokes(a, b)` | the 65% rule and La Final stroke allocation |
| `historyUpTo(i)` | pair-frequency map across locked groups; **skips r3 (Sandbox)** |
| `generate(ids, sizes, hist, seed)` | seeded random-restart pairing search |
| `defaultPairings()` | seeds `BASE_GRID`, falls back to `generate()` |
| `isLocked(rd)` | true when the round has a baseline grid and isn't unlocked |
| `renderInfo / renderToday / renderEnter / renderStand / renderPair` | the five tabs |

### Tabs

**Info** (landing, unless opened during the trip dates → then Today) · **Today** (groups, format,
quotas) · **Enter** (nine number inputs plus editable CR/slope per player) · **Standings**
(leaderboard, bar chart, La Final card, pool) · **Pairings** (assignment dropdowns, generator,
partner matrix).

### Testing

Verified with jsdom (logic) and Playwright/Chromium (render + interaction). Checks worth
re-running after changes: quota math against a known table, partition validity, partner
coverage, drop-average against a hand calculation, URL round-trip, and every tab rendering
without a page error.

---

## 5. Open items

- [ ] **Who sits Mammoth (Tue PM) and Sand Valley (Wed PM).** Placeholders are Drew and Matt.
      Must be someone playing all other rounds (see the corollary above).
- [ ] **Ask Sand Valley for a third tee time** on those two rounds. Turns them into 3/3/3 so
      everyone plays, and threesomes walk faster.
- [ ] **Tuesday's turn is tight.** Sedge at 8:30/8:40 finishing at the resort's 4:15 pace lands
      12:45–12:55 against a 12:50 Mammoth tee. Moving Tuesday's Sedge earlier is worth more than
      the extra tee times. (Wednesday is fine: 7:40 is a pre-8am speed slot, under 4 hours.)
- [ ] **Confirm real handicap indexes.** All nine are placeholders.
- [ ] **Verify the Commons stroke-index row** against the physical scorecard.
- [ ] **Lido** — group is waitlisted for 2–8 golfers. If it lands, rounds shuffle; regenerate
      affected pairings.
- [ ] Confirm Brook's and Tony's exact skip rounds, and Ryan/Paul/Eric/Daniel's round plans.

---

## 6. Planned next step — real hosting with a save layer

Currently on GitHub Pages with state in the URL. That works but means texting a long link after
every update. The plan:

1. Keep the static page on Pages.
2. Drew holds a **fine-grained GitHub token** scoped to this repo with contents:write, kept in
   `localStorage` (fine on a real hosted page).
3. Save does a `PUT` to the **repo contents API**, committing `data.json`.
4. **Readers fetch through the contents API, not the Pages URL or `raw.githubusercontent.com`** —
   those are CDN-cached for up to ~10 minutes, which will feel broken when everyone refreshes
   after a round. Unauthenticated API is 60 req/hour per IP, plenty for nine phones.
5. The page checks for a token on load and **hides the Enter and Pairings tabs without one**, so
   the other eight get a clean read-only board on the same URL.

Migration is small: everything already funnels through `save()` and `load()`, so it's roughly
40 lines. The quota math, standings rule and pairing engine are untouched. Keep the URL-hash
path working as a fallback.

Alternatives considered: Cloudflare Workers + KV (faster, no token in the browser, but a second
service), and Supabase/Firebase (proper, and overkill for nine guys and five rounds).

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
const FIXED_R1=[[2,5,4,6],[1,7,0,3]];                 // Sunday, pinned
const OUT={r2:[8],r4:[4],r5:[1],r6:[3],r7:[0]};       // who sits each round
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
const cost=(s,plan)=>s.unmet*10000 + s.excess*60 + Math.max(0,s.max-3)*5000 + s.bal*8
  + (together(plan,'r4',0,8)?0:1000000);          // Matt + Daniel, Tuesday AM
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
console.log(`pairs met ${st.met}/36 | max repeat ${st.max} | worst index gap ${st.bal.toFixed(2)}`);
ALL.forEach(r=>console.log('  '+r+'  '+best[r].map(g=>g.map(i=>NAMES[i]).join('/')).join('   |   ')));
console.log('\nEMBED = '+JSON.stringify(best));
```
