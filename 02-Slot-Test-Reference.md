# IGT Slot Demo — Consolidated Reference

A focused study guide built from the must-read sources in `01-Annotated-Source-Index.md`. Aimed at one specific outcome: passing the IGT GameDeveloper test (a playable 5×3 slot demo in JS/TS + PixiJS/Canvas with a mock JSON server, separated cleanly from the game) and explaining it well in the interview.

Everything here is sourced from real material. Where I quote a source by name, it's cited at the bottom of the section.

---

## 1. The vocabulary bible

Every term you might be asked about. Use these exactly — interviewers notice.

**Reel.** The vertical spinning column. A 5×3 game has 5 reels, each showing 3 visible rows.

**Reelstrip / reel band.** The full ordered list of symbols the reel cycles through. A reel of 64 stops is a 64-symbol reelstrip even though only 3 are visible at any time. In code it's just an array.

**Stop / stop position.** One slot on the reelstrip. Picking a "stop" = picking an index into the reelstrip array; the visible window is `[stop, stop+1, stop+2]` (with modulo for wrap-around, see §4).

**Play window.** The visible grid. For a 5×3 game that's 5 × 3 = 15 cells.

**Symbol / icon.** What's painted on each stop. Symbols are not unique to stops — the same symbol typically appears multiple times on a reel (its **weight** = its count on that reel).

**Payline.** A path through the window, one cell per reel. Defined as `[row1, row2, row3, row4, row5]` where each value is the row index hit on that reel (e.g. `[2,2,2,2,2]` = the center row). Up to 3⁵ = 243 paylines are possible in a 5×3 game.

**Paytable.** A list of pay rules. Each rule says "this combination of symbols wins this many credits."

**Combination.** A specific pattern that wins something. Written like `{A,A,A}` for "A on each of the first 3 reels." `{A,A,#A}` means "A on reels 1 and 2, NOT A on reel 3."

**Hit.** A single occurrence of a winning combination. The number of hits / cycle = the probability of that win.

**Cycle.** The total number of possible outcomes. For a 3-reel game with 10 stops each, cycle = 10³ = 1000. Used as denominator for probability calculations.

**RTP (Return to Player).** Long-run percentage of wagered credits paid back to the player. `RTP = average_win / bet`. A 95% RTP machine has a 5% house edge.

**Hit frequency / hit rate.** `hit_frequency = total_winning_outcomes / cycle`. Tells you how often a player wins something. 25% means "wins on 1 in 4 spins."

**Volatility / variance.** How spread out wins are. Two machines can have the same RTP — one paying 1 credit constantly, the other paying 1000 credits once per 1000 spins. Same RTP, wildly different volatility.

**Scatter.** A symbol that pays regardless of payline — it just needs to be visible anywhere in the window. Math is slightly different from regular symbols (you count visible occurrences in the whole window).

**Wild / substitute.** A symbol that stands in for other symbols. `{A, A, {A,W}}` means "A or W on the third reel counts."

**Expanding wild.** A wild that visually fills the entire reel after landing.

**Prioritisation / "highest pays".** When a stop matches multiple pay rules, only the highest-paying rule pays. Standard rule on virtually every game.

**Virtual reel.** A computer reel longer than the physical one. The RNG picks a number 1–128 (the virtual stop), which maps to one of 22 physical positions. Multiple virtual stops can map to the same physical stop, which is how you make reel positions feel "weighted" without changing physical reel size. Not directly relevant for a pure-video demo, but the interviewer will use the word.

**Near-miss.** The illusion that a player almost won. Created by weighting the virtual reel so blanks adjacent to the jackpot symbol are far more likely than the jackpot itself.

**243 ways.** An alternative to paylines. Instead of fixed paths, any matching symbol from left to right counts, with no concept of "above/below the line." A 5×3 game has up to 3⁵ = 243 such ways.

**PAR sheet.** "Probability and Accounting Report." The full blueprint for a slot: reel composition + paytable + computed RTP, hit frequency, volatility. The math team produces it; the dev team codes from it.

**RNG / PRNG / CSPRNG.** Random number generator. PRNG = pseudo (deterministic algorithm). CSPRNG = cryptographically secure (required for real-money play). For a demo: `Math.random()` is fine; for real-money production you must use `crypto.getRandomValues`.

Sources: Muir Ch. 2; Easy Vegas "How to Program"; Easy Vegas "How They Work"; kld.dev; Barboianu probability.infarom.ro.

---

## 2. The architecture — where the mock server fits

Easy Vegas gives the canonical two-mode setup. The IGT test asks for the second one (mock the server).

**Client-only mode** (no money on the line):
The browser does everything. RNG runs client-side. The page picks stops, evaluates wins, animates, updates balance.

**Server-based mode** (real money or "looks real"):
The server owns the RNG, the balance, and the win calculation. The client only renders and animates. On each spin:

1. Client posts `{playerId, gameId, bet, linesSelected}` to server.
2. Server verifies auth + balance.
3. Server's RNG picks stops, evaluates wins against the paytable.
4. Server logs result, updates balance, **then** returns the result to the client.
5. Client animates the reels into the server-chosen stops, displays wins.

**For your IGT test:** Implement mode 2 in a single browser context. Put all win-determination + RNG into a `mockedServer` module that returns a JSON response. The game module calls `mockedServer.getResponseData(bet)` and treats it as an opaque API call. Even though everything runs in the browser, the boundary should be *as if* the call went across the network — same shape, same semantics, no shared state with the game module.

This is exactly what the test brief asks for: *"You should have your 'server' logic separated from the game in a separate class/module, fetched by some simple API call."*

Sources: Easy Vegas "How to Program a Slot Machine" — section "Slot machine code for server-based games."

---

## 3. The PAR sheet — what to copy, what to compute

The math team's deliverable to you would normally be a PAR sheet. For your demo you make your own. The Easy Vegas "Bluejay Bonanza" PAR sheet is the cleanest one to copy because the underlying math is already worked through in another article.

**Bluejay Bonanza (3-reel, 99% RTP):**

```
Reel composition (identical for all 3 reels):
  2 JP  (jackpot)
  9 R7  (red seven)
 10 3B  (triple bar)
 14 2B  (double bar)
 20 1B  (single bar)
  9 CH  (cherry)
 64 BL  (blank)
 ---
128 total stops per reel

Paytable (97%-99% variant):
  JP JP JP             = 2000
  R7 R7 R7             = 150
  3B 3B 3B             = 100
  2B 2B 2B             =  60
  1B 1B 1B             =  40
  CH CH CH             =  25
  any 3 of 1B/2B/3B    =  10
  any 2 CH             =   8
  any 1 CH             =   1
```

For a 5-reel game, the public Lucky Larry's Lobstermania PAR sheet (referenced by kld.dev and the Harrigan/NH-Gov PDF) gives real numbers:

```
Symbol  | r1 | r2 | r3 | r4 | r5 |  x3  |  x4   |  x5
W (wild)|  4 |  2 |  1 |  4 |  2 |  100 |   500 | 10,000
LM      |  4 |  4 |  3 |  4 |  3 |   40 |   200 |  1,000
BU      |  4 |  4 |  5 |  4 |  4 |   25 |   100 |    500
BO      |  5 |  4 |  4 |  5 |  4 |   25 |   100 |    500
LH      |  5 |  4 |  4 |  6 |  4 |   10 |    50 |    500
TU      |  6 |  4 |  5 |  6 |  7 |   10 |    50 |    250
CL      |  7 |  6 |  6 |  5 |  6 |    5 |    30 |    200
SG      |  5 |  5 |  5 |  5 |  5 |    5 |    30 |    200
SF      |  8 |  5 |  5 |  5 |  5 |    5 |    30 |    150
LO bonus|  0 |  2 |  5 |  5 |  3 |  331 |   n/a |    n/a
LT scat |  2 |  2 |  2 |  2 |  2 |    5 |    25 |    200
TOTAL   | 50 | 47 | 46 | 48 | 50 |
RTP target: ~96.2%
```

Either set is fine for your demo. The Bluejay Bonanza one is simpler and easier to defend in the interview. The Lobstermania one is realistic and impressive — but you don't need to defend the math.

Sources: Easy Vegas PAR Sheets; kld.dev "Reels"; NH Gov Harrigan/Dixon PDF.

---

## 4. Building and stopping a reel — the code that matters

This is the operational core. From kld.dev's TypeScript article, adapted:

```typescript
// 1. Build the reelstrip from per-reel symbol weights
function generateReel(reelIndex: number,
                     weights: Record<Symbol, number[]>): Symbol[] {
  const reel: Symbol[] = [];
  for (const sym of SYMBOLS) {
    for (let i = 0; i < weights[sym][reelIndex]; i++) reel.push(sym);
  }
  return shuffleFisherYates(reel);
}

// 2. Pick a random stop (the only "RNG" call per reel)
function pickStop(reel: Symbol[]): number {
  return Math.floor(Math.random() * reel.length);
}

// 3. Read the 3 visible symbols, wrapping around with modulo
function visibleSymbols(reel: Symbol[], stop: number, rows = 3): Symbol[] {
  return Array.from({ length: rows },
    (_, i) => reel[(stop + i) % reel.length]);
}
```

Three things to note for the interview:

- **One RNG call per reel, period.** Not "many random numbers for animation." The randomness is fully determined before the spin animation starts — the spin is just a "courtesy to the player" (Easy Vegas's phrase). The reels could instantly snap into place and the math would be identical.
- **Modulo wraps the reel.** Without the `%`, your `pickStop` would have to exclude the last 2 stops, which would under-represent the first/last symbols of the reelstrip. The modulo wrap is the clean fix.
- **Fisher-Yates shuffle, not `Array.sort(() => Math.random() - 0.5)`.** The second one is biased; the first is the standard correct shuffle. Use it once when building reels, then keep the reelstrip stable across spins.

Sources: kld.dev "Writing a slot machine game: Reels"; Easy Vegas "How to Program a Slot Machine"; Easy Vegas "How They Work" — "By the time the reels are spinning, the game is already over."

---

## 5. RTP math — the one calculation you should be able to do on a whiteboard

You will not be asked to compute RTP. But you should be able to *explain* the formula in 30 seconds. From the Easy Vegas "How They Work" worked example on Bluejay Bonanza:

```
RTP = Σ (probability_of_combo × payout_of_combo)  over all winning combos
```

Concretely, with 128 stops/reel and the Bluejay paytable above:

```
Combo       Probability                  Payout   Contribution
JP JP JP    (2/128)^3 = 0.000004         2000      0.76%
R7 R7 R7    (9/128)^3 = 0.000347          150      5.21%
3B 3B 3B    (10/128)^3 = 0.000476         100      4.76%
2B 2B 2B    (14/128)^3 = 0.001306          60      7.84%
1B 1B 1B    (20/128)^3 = 0.003815          40     15.26%
CH CH CH    (9/128)^3 = 0.000347           25      0.87%
any 3 bars  big formula, see article       10     ~26%
any 2 CH    p(CH on 2 of 3 reels)           8     ~5%
any 1 CH    p(CH on 1 of 3 reels)           1     ~31%
                                             Total ≈ 98.99%
```

(The Bluejay Bonanza article shows the full formulas. The "any 3 of any bar" formula uses inclusion-exclusion: `((1B+2B+3B)/128)³ - (1B/128)³ - (2B/128)³ - (3B/128)³` to avoid double-counting the three triplet rules.)

**Verification by full-cycle simulation.** Easy Vegas's JS example also shows the orthogonal way: iterate every possible combination of stops and tally wins. For 3 reels of 128 stops, that's 128³ ≈ 2M iterations — milliseconds in JS. The result must match the analytical RTP exactly.

```javascript
function calculateRTP() {
  let wins = 0;
  for (let r1 = 0; r1 < reel.length; r1++)
    for (let r2 = 0; r2 < reel.length; r2++)
      for (let r3 = 0; r3 < reel.length; r3++)
        wins += evaluatePayline(reel[r1], reel[r2], reel[r3]);
  return wins / (reel.length ** 3);
}
```

Add a `verifyRTP()` button to your demo's debug panel. It impresses.

Sources: Easy Vegas "How They Work"; Easy Vegas "How to Program" — `calculateRTP()` function; Slot Game Design Tutorial 1.

---

## 6. Hit frequency, volatility, and how they feel

**Hit frequency** = how often a spin returns *something*. Typically 20–30%. Low HF + big jackpot = sky-high volatility. High HF + tiny wins = "grindy" play.

From the Easy Vegas Returns article:
- US land casinos average ~91% RTP.
- Online slots average ~96% RTP.
- Vegas Strip pennies: ~89%. Boulder Strip $1: ~95%.
- **The jackpot accounts for <1% of total RTP on most non-progressive games.** Megabucks is the exception at ~10%. Most of the RTP comes from small frequent wins (the "any 1 cherry" line in Bluejay alone contributes ~31%).

This is the killer interview talking point: *"The big jackpot is the marketing hook, but the small frequent pays are what actually fund the RTP."*

**Volatility metric:** standard deviation of per-spin payout. Not something you need to compute, but you should be able to say "two games can have identical RTP and feel completely different because of their volatility."

Sources: Easy Vegas Returns; Muir Ch. 2 "Volatility" section; Slot Game Design Tutorial 1.

---

## 7. Wilds, scatters, multipliers — the optional features

You can skip all of these in the demo and still pass the test (the green-marked items don't require any of them). But understanding them is the difference between a basic and a strong implementation.

**Wild substitution math.** From Slot Game Design Tutorial 2:

```
Without wild:  hits(3 Bell) = bells_r1 * bells_r2 * bells_r3
With 1 wild on reel 2:  hits(3 Bell) = bells_r1 * (bells_r2 + wilds_r2) * bells_r3
```

The Liberty Bell example shows that adding one wild to one reel jumps RTP from 75.4% to 88% — a 12.6-point swing from a single symbol. So wilds are powerful and you must adjust payouts down if you add them.

**Wilds on reel 1 cause complexity.** If your wilds appear on reel 1, the "highest pays" rule forces you to subtract overlapping hits, e.g. `hits(3 Hearts) = (h1 + w1)(h2 + w2)(h3 + w3) - w1*w2*w3`. Avoid this in your demo unless you specifically want the bonus points.

**Scatter wins.** Scatter symbols pay based on count anywhere in the window, not on a payline. So in a 5×3 window with 3 scatters total, the result is a win regardless of where on the reels they landed. Mathematically, scatter hits = product over reels of (scatters_visible_on_that_reel), where `scatters_visible = scatter_count_on_reel × window_height / reel_length`.

**Multipliers / expanding wilds / free spins / bonus rounds.** All real features. All out of scope for the IGT test. Mention you know about them; don't implement.

**Near-miss psychology.** Weighting the blanks immediately above/below the jackpot symbol much higher than the jackpot itself produces the illusion of "just missed." It's a deliberate design choice and a known regulatory concern. You don't need to implement it; you should know what it is.

Sources: Muir Ch. 2 (Wild, Scatter, Expanding Wild, Prioritisation sections); Slot Game Design Tutorial 2; Easy Vegas "How They Work" (Near-misses, Virtual reels).

---

## 8. Paylines vs 243 ways — the design choice

**Paylines (your default).** Define paylines as data, evaluate each one independently. The IGT test brief shows a 5×3 grid; the standard 5 paylines for a 5×3 game look like:

```typescript
const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1],  // top row
  [2, 2, 2, 2, 2],  // middle row
  [3, 3, 3, 3, 3],  // bottom row
  [1, 2, 3, 2, 1],  // V
  [3, 2, 1, 2, 3],  // ^
];
```

Each entry is the row index hit on that reel.

**243 ways (the alternative).** Skip paylines. Count "ways to win": for each symbol, count its occurrences per reel, and a left-to-right "way" exists for each combination across reels. Easier for the player to grasp; harder math (especially with wilds on reel 1, which you'd avoid anyway).

For your demo: stick with paylines (simpler, matches the brief). Make the payline definitions configurable (data, not hardcoded). Mention 243-ways as a future configuration option.

Sources: Muir Ch. 2 (Multiline), Ch. 3 (243 Ways Games); Barboianu probability.infarom.ro.

---

## 9. The mock server JSON — your contract

This is the single most scrutinized artifact in the test. The brief explicitly says: *"Result data (stop reel picture positions, winning lines, prize info) ideally come in form of a JSON, mimicking response from server."*

A solid schema, with vocabulary that matches everything above:

```json
{
  "spinId": "a4f3-9c21",
  "bet": 25,
  "reelStops": [12, 4, 19, 7, 0],
  "window": [
    ["A", "K", "Q"],
    ["W", "J", "10"],
    ["A", "A", "K"],
    ["Q", "J", "9"],
    ["A", "K", "Q"]
  ],
  "wins": [
    {
      "type": "payline",
      "paylineId": 2,
      "symbol": "A",
      "count": 3,
      "positions": [[0, 1], [2, 1], [4, 1]],
      "payout": 40
    }
  ],
  "scatterWins": [],
  "totalWin": 40,
  "newBalance": 9975,
  "features": {
    "freeSpinsAwarded": 0,
    "bonusTriggered": false
  }
}
```

Notes on the design:

- `reelStops` is the source of truth. The window is **derived** from the reel composition + stops; you could leave `window` out, but including it makes the client's animation logic trivial.
- `positions` use `[reelIndex, rowIndex]` so the client can highlight individual cells.
- `wins` is an array (not a single object), because multiple paylines can hit on one spin (coinciding wins).
- `scatterWins` is separate because the structure differs (no payline).
- `features` is the hook for free spins / bonus rounds without breaking the schema if you add them later.

The mock server is one function: `getResponseData(bet, paylinesPlayed) → ResponseJSON`. Internally it does steps 1–6 from §2 and §4. No shared state with the game module other than the response object.

Sources: synthesis of Easy Vegas server flow + kld.dev TypeScript types + Apiverve slotmachine-api shape.

---

## 10. Suggested architecture for the demo

Match the brief's emphasis on "code organization and structure."

```
src/
  config/
    paytable.ts       // pay rules (data only)
    reels.ts          // SYMBOLS_PER_REEL weights (data only)
    paylines.ts       // payline definitions (data only)
    bets.ts           // allowed bet values

  server/             // The "mocked server" — no PixiJS imports
    rng.ts            // wraps Math.random; swappable for crypto.getRandomValues
    reelBuilder.ts    // generateReel(reelIndex) using Fisher-Yates
    evaluator.ts      // resolves paylines + scatters against window
    mockedServer.ts   // public API: getResponseData(bet)
    rtpVerifier.ts    // optional: full-cycle iteration for proof

  game/               // The "client" — PixiJS / Canvas
    Reel.ts           // one reel: rendering, spin animation, bounce
    ReelSet.ts        // orchestrates the 5 reels
    WinPresenter.ts   // highlights winning lines, plays win animations
    BetSelector.ts    // bet UI (combo box)
    Game.ts           // top-level controller: bind UI → mockedServer → present

  index.ts            // bootstrap
```

Architectural points an interviewer will press on:

- **No PixiJS in `server/`.** That module must be importable in Node (or Jest) without errors. This is what makes it "mimicking a real server."
- **The game never reaches into the server's RNG or state.** It only ever calls `await mockedServer.getResponseData(bet)`.
- **Reel data is config, not code.** New paytable = JSON edit, not refactor.
- **Animation is independent of randomness.** The reel animates a "fall toward this stop index"; the actual stop is determined and frozen before the animation starts.
- **A debug panel** with: force a specific result, run 10k spins and show actual vs theoretical RTP, list current paylines. Smaller than it sounds, big payoff.

Sources: KseniiaPrytkova repo (debug mode pattern); Easy Vegas server flow; kld.dev module layout; IGT test brief.

---

## 11. Interview talking points — keep these ready

**"How does RTP get set?"** Reel composition (number of each symbol on each reel) and paytable (payouts per combination) together determine it. Change either and RTP changes. The same game (e.g. Phantom of the Opera) ships in 8 RTPs precisely by changing the reel composition.

**"How do you guarantee fairness across spins?"** Every spin is independent. The RNG is called once per reel per spin. There is no state from previous spins influencing the next.

**"Could you do it server-authoritative?"** Yes — for real money you must. The server owns the RNG and balance; the client only renders. My demo's `mockedServer` module is structured this way, just running in-process.

**"What's the difference between RTP and actual payout?"** RTP is theoretical/designed; payout is what happened over actual play. They converge over millions of spins.

**"What's volatility?"** How spread out the wins are around the average. Same RTP, different volatility = very different player experience.

**"What's a scatter?"** A symbol that pays based on window-visible count, not on a payline. Math is `count_per_reel × visible_rows / reel_length`, multiplied across reels.

**"What's a wild?"** A symbol that substitutes for others to complete a winning combination. Implementation note: avoid wilds on reel 1 to keep the math tractable.

**"How would you verify your RTP is correct?"** Two ways: (1) full-cycle iteration — feasible for 3-reel games (~2M combinations) but combinatorial explosion for 5-reel; (2) Monte Carlo — run N million random spins and compare actual to theoretical, within a 95% confidence interval. Both should be in the codebase as test/debug tools.

**"What's a PAR sheet?"** The math team's blueprint. Lists reel composition, paytable, computed RTP, hit frequency, volatility. Devs build from it.

**"What if the player disconnects mid-spin?"** Server-authoritative design: log result with "not yet seen" flag; on reconnect, replay the animation and clear the flag.

Sources: Easy Vegas Returns, Easy Vegas "How to Program"; Muir Ch. 2; common sense.

---

## 12. Source map — which source covers what

| Topic | Primary source | Backup source |
|---|---|---|
| Terminology | Muir Ch. 2 | Easy Vegas "How to Program" — Terms section |
| Architecture (client/server) | Easy Vegas "How to Program" | — |
| PAR sheet definition | Slot Game Design Tutorial 1 | Easy Vegas PAR Sheets, Muir Ch. 9 |
| PAR sheet data (real) | NH Gov Harrigan PDF | Wizard of Odds PAR Sheets |
| Reel building (code) | kld.dev "Reels" | Easy Vegas "How to Program" |
| RTP math (worked) | Easy Vegas "How They Work" | Slot Game Design Tutorial 1 |
| RTP verification | Easy Vegas "How to Program" `calculateRTP()` | Wizard of Vegas forum |
| Wilds | Slot Game Design Tutorial 2 | Muir Ch. 2 "Wild" |
| Scatters | Muir Ch. 2 "Scatter" | — |
| Paylines | Muir Ch. 2 "Multiline" | Barboianu |
| 243 ways | Muir Ch. 3 | — |
| Near-miss / virtual reels | Easy Vegas "How They Work" | Muir Ch. 2 "Virtual Reels" |
| Volatility | Muir Ch. 2 "Volatility" | Easy Vegas Returns |
| Online RTP benchmarks | Easy Vegas Returns | — |
| Sample mock-server response shape | Apiverve slotmachine-api repo | Easy Vegas server flow |
| Debug mode UX | KseniiaPrytkova repo README | — |
| Monte Carlo verification | Kavindi Herath Medium | Wizard of Vegas forum |

---

## 13. What to skip / what to ignore

- Anything past Muir Chapter 3 (math-team work).
- Free spins, progressives, bonus rounds, expanding wilds — out of scope; just know the words.
- All RNG-certifier sites (eCOGRA, GLI, iTech Labs). Vocabulary only.
- All YouTube videos in the source list (duplicate the text articles).
- All toy CLI Python repos (no architectural value).
- Cruise ship / state lottery / casino payout statistics. Trivia.

---

## 14. Final 30-second pitch you can give in the interview

"I built a 5×3 slot demo with a clean separation between a mock server module and the rendering layer. The server module owns the reel composition, paytable, RNG, and win evaluation — it has no dependency on PixiJS and could be lifted into a Node service unchanged. On each spin the client posts a bet, the server picks one random stop per reel using a weighted reelstrip, evaluates all paylines and scatters against the resulting window, and returns a JSON payload with stop indices, the win list (with cell positions for highlighting), and the new balance. The client animates the reels to their assigned stops and presents the wins. The reelstrips, paytable, and paylines are all data — swappable without code changes. I included a debug panel that lets me force a result and verify the theoretical RTP by either full-cycle iteration or a Monte Carlo run."

That's the talk track. Build to it.
