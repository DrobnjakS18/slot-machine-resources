# IGT Slot Demo — Project Walkthrough

A presentation-ready tour of the codebase: how the pieces fit, the path a single
spin takes through the system, and what every file is responsible for.

> **Stack:** TypeScript · PixiJS 7 · Vite — 5×3 video slot, 5 paylines, wild symbol, ~96% RTP target.

---

## 1. The One Big Idea: a hard client/server split

Everything in this project is organized around one architectural decision:

```
config/   ── pure data (the "PAR sheet": symbols, pays, paylines, constants)
   │
   ▼
server/   ── game math. NO PixiJS. Owns balance, reelstrips, RNG, win evaluation.
   │            Exposes ONE function to the outside world: getResponseData(bet)
   ▼
game/     ── rendering & input (PixiJS + HTML). Knows nothing about the math.
              Calls the server like it would a real REST/WebSocket backend.
```

Why it matters (and what to say when presenting): the `server/` folder has **zero
PixiJS imports**. Its `getResponseData(bet)` returns the same `SpinResponse` shape a
real money backend would. You could delete the whole `game/` folder, point the client
at a real server, and the math layer wouldn't change a line. That's the headline.

---

## 2. The Roadmap — follow a single spin end to end

This is the story to tell when walking someone through the project. Each step names
the file doing the work.

1. **Page loads** → [index.html](index.html) provides the DOM skeleton (`#stage`,
   bet controls, spin button, paytable). The `<script>` boots [src/index.ts](src/index.ts).

2. **Bootstrap** → [src/index.ts](src/index.ts) finds `#stage`, constructs `Game`,
   calls `game.start()`.

3. **Game sets up the cabinet** → [game/Game.ts](src/game/Game.ts) asks the server
   for reel strips (`getReelInfo()`), builds textures, creates the `ReelSet` and
   `WinPresenter`, and wires the HTML controls via `bindControls()`.

4. **Player hits SPIN** → [game/BetSelector.ts](src/game/BetSelector.ts) fires the
   `onSpin` handler → `Game.handleSpin()`.

5. **Two things happen in parallel:**
   - **The visual spin starts immediately** → `ReelSet.startSpin()` kicks each
     [game/Reel.ts](src/game/Reel.ts) into its accelerate→cruise loop (with an 80 ms
     stagger so the reels start in a wave).
   - **The server call fires** → `server.getResponseData(bet)`.

6. **The server computes the result** → [server/mockedServer.ts](src/server/mockedServer.ts):
   validates the bet, charges the balance, picks a random stop per reel
   ([server/randomNumberGenerator.ts](src/server/randomNumberGenerator.ts)), builds the
   visible window, and evaluates wins ([server/evaluator.ts](src/server/evaluator.ts)).
   Returns a `SpinResponse` after a simulated network delay.

7. **Reels land on the real result** → `ReelSet.stopAt(response.reelStops)` tells each
   reel to decelerate, overshoot, and bounce onto its assigned stop (300 ms stagger;
   collapses to 0 at Turbo).

8. **Win presentation** → if `totalWin > 0`, [game/WinPresenter.ts](src/game/WinPresenter.ts)
   pulses highlights over the winning cells and draws the payline path; the balance and
   win text update in the side panel.

9. **Ready for the next spin** → `busy` flag clears, button re-enables.

The key timing trick (step 5): the animation and the network request run concurrently.
The reels "cruise" indefinitely until the response lands and tells them where to stop —
so there's never a frozen wait, no matter how slow the (simulated) server is.

---

## 3. File-by-file explanation

### Config layer — `src/config/` (pure data, no logic)

**[config/constants.ts](src/config/constants.ts)**
The cabinet's dimensions and tunables in one place: `REEL_COUNT` (5), `ROW_COUNT` (3),
`MIN_MATCH` (3-of-a-kind), `STARTING_BALANCE` (1000), the allowed `BET_VALUES`, and the
`SPEED_LEVELS` (Slow/Normal/Fast/Turbo) whose multiplier scales both visual scroll speed
*and* lifecycle timing. Change the grid shape here and the whole app follows.

**[config/symbols.ts](src/config/symbols.ts)**
The "PAR sheet." Defines the 7 symbols (`WD` wild + A, K, Q, J, 10, 9), each with its
color, per-reel `frequency` (how many copies appear on each reel — this is what shapes
the odds), and `pays` array indexed `[3x, 4x, 5x]`. Adding a symbol is an edit to *this
file only*. Also exports `reelLength()` — total stops on a given reel.

**[config/paylines.ts](src/config/paylines.ts)**
The 5 winning lines as plain data: 3 horizontals (Top/Middle/Bottom) plus a V and a
Caret (^). Each payline is an ordered list of `{reel, row}` cells the evaluator walks
left to right. Adding a payline = append to this array, no code changes.

### Server layer — `src/server/` (game math, no PixiJS)

**[server/randomNumberGenerator.ts](src/server/randomNumberGenerator.ts)**
Thin randomness wrapper. `pickStop()` returns a random stop index per reel; it first
checks an optional override hook (the debug/test seam via `setRngOverride`) before falling
back to `Math.random()`. Also exports an unbiased Fisher–Yates `shuffle`. **The swap
point:** to go to real-money-grade randomness you replace `Math.random()` here with
`crypto.getRandomValues` and nothing else changes.

**[server/reelBuilder.ts](src/server/reelBuilder.ts)**
Turns frequency tables into actual reelstrips. For each reel it pushes N copies of each
symbol (N = its frequency), then Fisher–Yates shuffles once. The shuffled array *is* the
reelstrip — stable across spins. `visibleSymbols()` reads the 3-row window at a given
stop, using modulo so the strip wraps seamlessly.

**[server/evaluator.ts](src/server/evaluator.ts)**
The pure win-checking engine — the mathematical heart. For each payline it walks the
cells left to right, tracking the current run symbol and count. Wilds match anything; a
leading wild streak resolves to the first concrete symbol it hits (and an all-wild run
pays as wild). It stops at the first mismatch and emits a `Win` (with payout scaled by
bet and the exact `[reel, row]` positions to highlight) if the run is ≥ `MIN_MATCH`.
`buildWindow()` assembles the `window[reel][row]` grid from reels + stops.

**[server/mockedServer.ts](src/server/mockedServer.ts)**
The public boundary — the *only* file the client talks to for game results. Owns
server-side state: the reelstrips, the balance, the spin counter. `getResponseData(bet)`
validates the bet, charges the balance, rolls stops, evaluates wins, credits winnings,
and resolves a `SpinResponse` after a fake 80–200 ms latency (to exercise the client's
loading state). `getReelInfo()` hands the client *defensive copies* of the strips so it
can't mutate server data. `getBalance()` rounds out the public surface.

### Game layer — `src/game/` (rendering + input, PixiJS)

**[game/utils.ts](src/game/utils.ts)**
Game-layer utility functions. `computeSymbolSize(wrap)` calculates the largest square
symbol size that fits the 5×3 grid in the wrapper element, clamped between 60 px and
`MAX_SYMBOL_SIZE`. Extracted here so `Game.ts` stays focused on orchestration.

**[game/Game.ts](src/game/Game.ts)**
The conductor. Mounted by `index.ts`. Sizes the PixiJS canvas responsively using
`computeSymbolSize()` from `utils.ts`, fits to container, re-fits on resize via
`ResizeObserver`. In `start()` it wires everything together; in `handleSpin()` it runs
the spin choreography from §2 — guarding against double-spins with a `busy` flag,
handling errors (insufficient balance, server error), and driving win text, balance, and
`setLastWin`. This is the file that orchestrates the parallel "spin visuals + server
call" dance.

**[game/BetSelector.ts](src/game/BetSelector.ts)**
The HTML controls, deliberately kept *out* of the PixiJS layer so they're CSS-styleable
and accessible. Bet is selected via `±` step buttons or a popup grid that opens when the
player clicks the bet label — no `<select>` element. Renders the paytable from config,
wires the spin button (also triggered by spacebar) and speed +/- buttons, and exposes a
clean `Controls` interface (`getBet`, `setBalance`, `setBusy`, `setWinText`, `setLastWin`,
`onSpin`, `onSpeedChange`) so `Game` never touches the DOM directly.

**[game/SymbolTextures.ts](src/game/SymbolTextures.ts)**
Generates each symbol's texture procedurally with PixiJS `Graphics` — a colored rounded
card with a highlight and a centered label — rendered once into a `RenderTexture`. No
external art assets, so the build is fully self-contained and resolution-independent.

**[game/Reel.ts](src/game/Reel.ts)**
A single reel's rendering + spin physics. Runs a state machine:
`idle → accelerating → cruising → decelerating → bouncing → idle`. `position` is a
continuous float index into the strip (integer part = top symbol, fraction = scroll
offset). It reuses `rowCount + 2` sprite slots and just swaps textures + repositions
each frame (no rebuilds). The deceleration overshoots the landing target, then a
`backOut` bounce settles it — giving the mechanical-reel "thunk." `requestStop()` returns
a promise that resolves when the reel comes to rest.

**[game/ReelSet.ts](src/game/ReelSet.ts)**
Orchestrates the 5 reels: draws the frame, lays out and constructs each `Reel`, and runs
*one shared ticker* that drives them all (scaling `dt` by the speed multiplier so Turbo
mode speeds up both motion and timing). `startSpin()` staggers reel starts (80 ms);
`stopAt(stops)` staggers stops (300 ms, collapsed to 0 at Turbo) and resolves once all
reels rest. `cellPosition()` lets the `WinPresenter` look up screen coords for any cell.

**[game/WinPresenter.ts](src/game/WinPresenter.ts)**
Draws the win feedback on a transparent overlay above the reels: rounded highlights on
each winning cell plus a line connecting them along the payline. It pulses via a sine
wave (using the shared ticker) so coinciding wins are readable, and loops while idle.
`show(wins)` / `clear()` are its whole interface.

### Entry & build files

**[index.html](index.html)** — DOM skeleton + side panel; loads `src/index.ts` as a module.
**[src/index.ts](src/index.ts)** — 9-line bootstrap: grab `#stage`, `new Game(...).start()`.
**[style.css](style.css)** — layout/theme for the stage and side panel.
**[package.json](package.json)** — scripts (`dev`/`build`/`preview`) and deps (pixi.js, typescript, vite).
**[vite.config.ts](vite.config.ts)** / **[tsconfig.json](tsconfig.json)** — build + TypeScript config.

---

## 4. The talking points (design decisions worth highlighting)

- **Swappable server boundary** — `server/` is PixiJS-free and returns a real-shaped
  `SpinResponse`. The client is decoupled from local state.
- **Data-driven PAR sheet** — symbols, pays, paylines, and grid size live in `config/`.
  Reshaping the game is a data edit, not a code change.
- **Single RNG swap point** — `Math.random()` lives in `randomNumberGenerator.ts` only;
  production crypto-RNG is a one-file change.
- **Concurrent spin + fetch** — reels cruise until the response lands, so latency is never
  a visible freeze.
- **Self-contained visuals** — procedural textures mean zero art assets and crisp
  rendering at any resolution.
- **Reel physics for "feel"** — overshoot + `backOut` bounce reproduce the mechanical
  reel thunk; one shared ticker keeps all reels in sync and makes Turbo mode trivial.

---

## 5. Debug seam

A programmatic RNG override hook (`setRngOverride` in `randomNumberGenerator.ts`) allows
tests or manual verification to force specific reel stops without any UI. There is no
`DebugPanel.ts` or debug checkbox — the hook is purely a code-level test seam.
