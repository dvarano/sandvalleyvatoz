# Product idea: an AI tournament director for buddy golf trips

Sketched Oct 15 2026, after La Copa De Vatoz 2026. Drew's idea: a free product that sets up the
basics of a golf-trip site (itinerary, pairings, games, standings), plus a paid AI tier that
fine-tunes it, i.e. does what a professional tournament director does.

**The pitch:** the free tier is a good scoreboard. The paid tier is the friend who always ends up
running the trip: juggling pairing requests, inventing a fair rule when a tee time disappears,
and explaining a three-way tie at dinner.

---

## Design principle

**The AI never calculates a score.** It turns plain-English requests into configuration
(pairings, rules, formats, schedule changes), and ordinary deterministic code does the maths. The
AI proposes and explains; scoring is always checkable and repeatable. This is how the 2026 trip
was built: every request became a code change, and `verify.js` checked it.

---

## Free: "The Starter"

Everything needed to run a standard trip, with no AI.

- **Trip page:** itinerary, tee times and courses, shared by link with no app install (like the
  2026 GitHub Pages site).
- **Courses:** rating, slope and par per tee, with automatic course handicaps and quotas.
- **Roster:** handicap indexes, editable by the organiser only.
- **Standard formats:** stroke play, Stableford, quota, skins, Nassau, match play; net and gross.
- **Basic pairings:** random draw with "avoid repeat groups", plus manual drag-and-drop.
- **Scoring:** score entry, live leaderboard, drop-the-worst or best-N.
- **Limits:** one trip, up to 12 players, one organiser.

## Paid: "The Director" (per trip, roughly $29–49)

The AI fine-tuning: everything that was done by hand for the 2026 trip.

- **Pairings by request.**
  - Constraints in plain English: "Drew with Mike twice", "Matt and Daniel Tuesday morning",
    "everyone meets everyone", "nobody more than 3 times".
  - When a request is impossible, it says so and offers the nearest options with what each one
    costs: "Brook-only works but takes Drew out of Tony's group." (In 2026 this was done with
    exhaustive searches.)
- **Custom rules.**
  - Describe a format and get the rules, settings and Info-page write-up, e.g. "first 4 count,
    drop the worst, Lawsonia is a backup only if you miss a round".
  - **Fairness check** on any rule. 2026 examples: best-4-of-5 gave a 0.29σ edge to whoever
    played five rounds; a birdie worth two pars tilts toward low handicaps.
- **Changes mid-trip.** "We lost the 7:50 Sedge and got a 10:00 Lido." It re-plans the week,
  keeps the pins, and shows what changed and who loses what.
- **Data checks.**
  - Flags things that look wrong: a par that doesn't match the scorecard (2026's Mammoth par 73),
    an index changed after a counting round, a stroke-index row that isn't 1–18.
  - Offers a GHIN course-handicap check before each round.
- **Explanations and communication.**
  - Tie explainer, "based on current standings" labels, plain rule summaries.
  - Recaps: results narration script, a daily summary to text the group, trophy plate text.
- **Next year.** Carries the format, lessons and archive forward ("last year Paul won; same rules
  but rank points?").

**Possible add-ons:** a group-chat bot anyone can ask ("who am I playing with tomorrow?"); an
organiser co-pilot over text message.

**Pricing:** a flat fee per trip beats a subscription for a once-a-year event, and undercuts Golf
Genius Trip Manager (about $149 per trip). The AI cost per trip is small: a few dozen requests,
plus the pairing search, which is ordinary code, not AI.

---

## Names (a play on "tournament director")

| Name | Why it works |
|---|---|
| **The Committee** | In the Rules of Golf, "the Committee" runs the competition. The 2026 trip literally had "the committee (Drew + Matt)". Paid answers could be "Committee rulings". |
| **Director's Cut** | Pun on the AI fine-tune: free is the rough cut, paid is the director's cut. |
| **PocketTD** / **TD** | Short and literal: a tournament director in your pocket. Golf people already say "TD". |
| **The Starter** + **The Director** | Free tier is the starter who calls groups to the tee; paid tier is the director. Tier names under any brand. |
| **Draw Master** | "The draw" is golf for pairings; leads with the hardest problem. |
| **Field Marshal** | Golf field plus on-course marshal. Fun, but sounds military. |

**Current pick:** **The Committee** as the brand, with **Starter** (free) and **Director** (paid)
as the tiers. Tagline: "Let the Committee decide." Runner-up: **Director's Cut**.

**Not checked yet:** domains, trademarks and app-store names. "The Committee" in particular may
already be taken in some form.

---

## Competitive landscape (Oct 2026, from vendor pages, not hands-on)

**Run the trip (itinerary, pairings, scoring):**
- [Golf Genius Trip Manager](https://golfgenius.com/products/trip-manager): the incumbent, about
  $149 per trip. Automatic pairings avoiding repeats, live leaderboards, handicap games.
- [Caddi](https://www.caddigolf.app/): private trips of 8–40. Itinerary, pairings, leaderboards,
  who's in and who's paid.
- [Squabbit](https://squabbitgolf.com/): free (optional tips). 30+ formats, live leaderboards,
  handicap calculations. Strongest on scoring, light on itinerary.
- [CupTracker](https://cuptracker.com/): Ryder Cup-style team events.

**AI, but for planning where to go:**
- AwayGameGolf: AI trip builder, $4.99 per trip (courses, lodging, tee-time strategy, cost).
- Birdie by Open Links Golf (Oct 2025): AI itinerary from dates, budget and destination.
- FairwayPal: free itinerary planning the group can vote on.

**The gap:** nobody applies AI to the competition itself. Existing apps handle standard formats
and simple pairing rules, and the AI planners stop once the trip is booked. Custom constraints,
fairness, mid-trip re-planning and explanations are unowned.

---

## Hard parts a real product needs (the 2026 site deliberately skipped these)

- User accounts and roles (organiser vs player) instead of a pasted GitHub token.
- Real-time sync for everyone's view instead of the GitHub contents API with manual Refresh.
- Getting a group to adopt it: link-first web app, no install required, works on one bar of
  signal (the 2026 offline-first URL-hash approach is worth keeping).
- Course data: ratings, slopes, pars and stroke indexes for any course, verified (see Mammoth).

## What the 2026 build proves

`index.html` is a working single-trip prototype of the free tier (itinerary, quotas, split
rounds, pairings, standings, tie explainer). The conversation that built it is a working
prototype of the paid tier: every "Director" feature above was something Drew asked for in plain
English and got back as a rule, a pairing change, or an explanation.
