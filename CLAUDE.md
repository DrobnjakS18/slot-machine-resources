# CLAUDE.md — IGT Slot Demo

A 5×3 video slot built as an IGT GameDeveloper technical test submission.
**Stack:** TypeScript · PixiJS 7 · Vite · no external art assets.

---

## Running the project

```bash
npm install
npm run dev      # dev server at http://localhost:5173 (auto-opens)
npm run build    # tsc --noEmit then vite build → dist/
npm run preview  # serve the production dist/
```

---

## Folder structure

```
igt-slot-demo/
├── index.html              # DOM skeleton + side panel markup
├── style.css               # All CSS (dark theme, grid layout)
├── vite.config.ts          # Vite config (port 5173, base './', target es2020)
├── tsconfig.json           # Strict TS, noEmit, ES2020
├── package.json            # pixi.js ^7.4, typescript ^5.4, vite ^5.2
├── README.md               # Quick-start + game rules table
├── PROJECT_WALKTHROUGH.md  # Presentation-ready walkthrough of the architecture
└── src/
    ├── index.ts            # 9-line bootstrap: finds #stage, new Game().start()
    ├── config/             # Pure data — no logic, no PixiJS
    │   ├── constants.ts    # Grid dimensions, bet values, speed levels
    │   ├── symbols.ts      # PAR sheet: symbol catalog, colors, frequencies, pays
    │   └── paylines.ts     # 5 payline definitions as plain data
    ├── server/             # Game math — ZERO PixiJS imports
    │   ├── randomNumberGenerator.ts  # Math.random() wrapper + Fisher-Yates shuffle
    │   ├── reelBuilder.ts  # Builds reelstrips from frequency tables
    │   ├── evaluator.ts    # Pure win evaluator (payline walk + wild logic)
    │   └── mockedServer.ts # Public API: getResponseData(bet), balance, spin IDs
    └── game/               # Rendering + input (PixiJS)
        ├── Game.ts         # Conductor: canvas sizing, spin choreography, busy guard
        ├── BetSelector.ts  # HTML controls (bet popup, spin btn, speed +/−, paytable)
        ├── Reel.ts         # Single reel: sprites + state machine (accel/cruise/decel/bounce)
        ├── ReelSet.ts      # 5-reel orchestrator: frame, layout, shared ticker, stagger
        ├── SymbolTextures.ts  # Procedural RenderTexture per symbol (no art files)
        ├── WinPresenter.ts # Pulsing win overlay (cell highlights + payline path)
        └── utils.ts        # Game-layer utilities (computeSymbolSize)
```

---

## Architecture: the hard client/server split

The single most important design decision: `server/` has **zero PixiJS imports** and exposes one function to the outside world: `getResponseData(bet)`. The client calls it exactly like it would call a real REST/WebSocket backend. You could delete all of `game/`, point at a real server, and the math layer would not change a line.

```
config/   ── pure data (PAR sheet)
   ↓
server/   ── game math (balance, reelstrips, RNG, win eval) — no PixiJS
   ↓
game/     ── rendering + input — knows nothing about math, calls server like a network call
```

---

## File-by-file

### `src/index.ts`
Bootstraps the app in 9 lines. Grabs `#stage`, constructs `Game`, calls `.start()`.

### `src/config/constants.ts`
Single source of truth for cabinet dimensions and tunables:
- `REEL_COUNT = 5`, `ROW_COUNT = 3`, `MIN_MATCH = 3`
- `STARTING_BALANCE = 1000`
- `BET_VALUES = [1, 2, 5, 10, 25, 50, 100]`
- `SPEED_LEVELS`: Slow (0.5×), Normal (1×), Fast (2×), Turbo (4×). The multiplier scales **both** visual scroll speed and lifecycle timing (accel/cruise/decel/bounce durations).

### `src/config/symbols.ts`
The PAR sheet. 7 symbols, each with:
- `color` (PixiJS hex fill) and `textColor` for the procedural card texture
- `frequency[5]` — copies per reel, drives reel composition (Mariana-style)
- `pays[3]` — payouts for [3×, 4×, 5×] of a kind, credits per 1-credit bet

| Symbol | Label | Color       | 3× | 4×  | 5×  |
|--------|-------|-------------|-----|-----|-----|
| WD     | WILD  | `#ffd166`   | —   | —   | —   |
| A      | A     | `#ef476f`   | 10  | 50  | 200 |
| K      | K     | `#f78c6b`   | 8   | 30  | 150 |
| Q      | Q     | `#06d6a0`   | 5   | 20  | 100 |
| J      | J     | `#118ab2`   | 3   | 12  | 60  |
| TEN    | 10    | `#9b5de5`   | 2   | 8   | 40  |
| NINE   | 9     | `#6c757d`   | 2   | 6   | 30  |

WD is wild (substitutes for any non-wild symbol). Adding a symbol = edit this file only.

### `src/config/paylines.ts`
5 paylines as plain `{reel, row}` cell arrays. Adding a payline = append to the array, no code changes.

| ID | Name   | Color     | Shape                            |
|----|--------|-----------|----------------------------------|
| 0  | Top    | `#ef476f` | row 0 across all 5 reels         |
| 1  | Middle | `#ffd166` | row 1 across all 5 reels         |
| 2  | Bottom | `#06d6a0` | row 2 across all 5 reels         |
| 3  | V      | `#118ab2` | 0,1,2,1,0 (V shape)              |
| 4  | Caret  | `#9b5de5` | 2,1,0,1,2 (∧ shape)              |

### `src/server/randomNumberGenerator.ts`
Thin wrapper around `Math.random()`. `pickStop(reelIndex, reelLen)` first checks an optional override hook (the debug/test seam), then falls back to random. Fisher-Yates shuffle lives here. **The swap point:** to use production-grade randomness, replace `Math.random()` in this file only — nothing else changes.

### `src/server/reelBuilder.ts`
Builds reelstrips from frequency tables: for each reel, push N copies of each symbol (N = frequency), then Fisher-Yates shuffle once. The shuffled array is the stable reelstrip; individual spins just pick a stop index.

### `src/server/evaluator.ts`
The pure win-checking engine. For each payline, walks cells left-to-right:
- Tracks current run symbol and count
- Wilds match anything; a leading wild streak resolves to the first concrete symbol
- An all-wild run pays as WD itself
- Stops at the first mismatch; emits a `Win` if run ≥ `MIN_MATCH`
- Returns `positions: [reel, row][]` for the WinPresenter to highlight

`buildWindow(reels, stops)` assembles `window[reel][row]` from reels + stop indices.

### `src/server/mockedServer.ts`
The **only** file the client talks to for game results. Owns server-side state: reelstrips, balance, spin counter. `getResponseData(bet)`:
1. Validates bet
2. Checks balance (returns `error: 'Insufficient balance'` if short)
3. Charges bet
4. Picks stops via RNG
5. Builds window, evaluates wins, credits winnings
6. Resolves `SpinResponse` after a simulated 80–200 ms latency (exercises client loading state)

Returns defensive copies of reelstrips so the client can't mutate server state.

### `src/game/utils.ts`
Game-layer utility functions. `computeSymbolSize(wrap)` calculates the largest square symbol size that fits the grid inside the wrapper element, clamped between 60 px and `MAX_SYMBOL_SIZE`. Called once in `Game` constructor; `ResizeObserver` re-calls it on resize.

### `src/game/Game.ts`
The conductor. Responsibilities:
- **Canvas sizing**: delegates to `computeSymbolSize()` in `utils.ts`. `ResizeObserver` re-fits on resize via `fitToContainer()`.
- **Bootstrap** (`start()`): gets reel info from server, builds textures, creates `ReelSet` + `WinPresenter`, binds controls via `bindControls()`.
- **Spin choreography** (`handleSpin()`): `busy` flag prevents double-spins. Kicks off `reelSet.startSpin()` and `server.getResponseData(bet)` **in parallel** — reels cruise until the response lands, so there's never a visible freeze. Handles insufficient balance and server errors. Calls `setLastWin` on wins.

### `src/game/BetSelector.ts`
All HTML controls, deliberately outside PixiJS so they're CSS-styleable and accessible. Bet is selected via `±` step buttons (`#bet-down-btn` / `#bet-up-btn`) or a popup grid (`#bet-popup-overlay`, `#bet-popup-grid`) opened by clicking the bet label button (`#bet-label-btn`). Renders the paytable from config, wires speed +/− buttons. Spacebar triggers spin. Exposes a `Controls` interface: `getBet`, `setBalance`, `setBusy`, `setWinText`, `setLastWin`, `onSpin`, `onSpeedChange`. `Game` never touches the DOM directly.

### `src/game/Reel.ts`
Single reel: sprite pool + spin state machine. States:
`idle → accelerating → cruising → decelerating → bouncing → idle`

Key constants:
- `CRUISE_SPEED = 32` rows/sec
- `ACCEL_TIME = 0.22` s (easeIn quad)
- `MIN_CRUISE_TIME = 0.35` s
- `DECEL_TIME = 0.55` s (easeOutCubic), overshoots by `DECEL_OVERSHOOT_ROWS = 0.55`
- `BOUNCE_TIME = 0.36` s using `backOut` easing (`BOUNCE_BACK_S = 3.0`) — gives the mechanical "thunk"
- `MIN_SPIN_ROWS = 18` — minimum travel per spin

Uses `rowCount + 2` sprite slots (buffer above + below). Each frame: texture swap + y-position update. No rebuilds. `requestStop(finalStop)` returns a Promise resolved when the reel comes to rest.

### `src/game/ReelSet.ts`
Orchestrates all 5 reels. Draws the cabinet frame (`lineStyle: 3px #ffd166 0.85α, fill: #10162a`, `borderRadius: 14`). One shared ticker drives all reels; `dt` is scaled by `speedMultiplier` so Turbo speeds up both motion and timing. Stagger: 80 ms start, 300 ms stop (both divided by speedMultiplier; stop stagger collapses to 0 at Turbo, i.e. speedMultiplier ≥ 4). `stopAt()` resolves when **all** reels are at rest. `cellPosition(reel, row)` gives the WinPresenter screen coords.

### `src/game/SymbolTextures.ts`
Generates each symbol's `RenderTexture` procedurally — no external art. Each symbol is a rounded card (`radius = size * 0.12`, `inset = size * 0.06`) with:
- Colored fill + `0x0b0f17` border
- White highlight (`alpha 0.18`) on the top half for depth
- Centered label in `Georgia, "Times New Roman", serif`, bold, `fontSize = size * 0.42` (0.22 for WILD)

### `src/game/WinPresenter.ts`
Transparent overlay above the reels. On win: draws rounded rect highlights on each winning cell and a connecting line through cell centers, colored by payline. Pulses via a sine wave (`PULSE_PERIOD_MS = 900`): `intensity = 0.45 + 0.55 * sin(phase * π)`. Loops while wins are showing.

---

## Design choices

### Colors (dark casino theme)
- **Page background:** `#0b0f17`
- **Stage background:** radial gradient `#1a2030 → #0b0f17`
- **Panel background:** `#131a26`, border `#25304a`
- **Reel frame:** `#10162a` fill, `#ffd166` border
- **Balance text:** `#ffd166` (gold)
- **Win text:** `#06d6a0` (teal/green)
- **Muted text / labels:** `#9fb0d0`, `#6b7a99`
- **Primary text:** `#e6edf3`
- **Buttons (idle):** `#1c2435` bg, `#2c3a55` border; hover: `#25304a`

### Fonts
- **UI / page:** `system-ui, -apple-system, Segoe UI, Roboto, sans-serif`
- **Symbol labels on cards:** `Georgia, "Times New Roman", serif` — weight 700, with black stroke

### Layout
- CSS Grid: `1fr 280px` (stage left, side panel right), `gap: 16px`, `padding: 16px`, `height: 100vh`
- Stage wrap: flex-centered, radial gradient bg, `border-radius: 12px`
- Side panel: flex column, `gap: 12px`, 3 `.panel` sections (Balance, Controls, Paytable)
- Responsive breakpoint at `max-width: 900px`: stacks to single column, `height: auto`
- Spin button: `flex: 1`, `padding: 10px` — full-width in the row
- Speed label: `flex: 1`, centered, `font-weight: 600`, gold (`#ffd166`)

### HTML sections (index.html)
- `#app` — grid root
- `#stage-wrap` → `#stage` — PixiJS canvas mounts here
- `#side` — right panel
  - `.panel` Balance: `#balance` (large gold number) + `#win-text` (teal)
  - `.panel` Controls: bet `#bet-down-btn` / `#bet-label-btn` (`#bet-label`) / `#bet-up-btn` + popup (`#bet-popup-overlay`, `#bet-popup-grid`, `#bet-popup-close`), speed `#speed-down-btn` / `#speed-label` / `#speed-up-btn`, `#spin-btn`, `#last-win`
  - `.panel` Paytable: `#paytable` (populated by BetSelector from config data)

---

## Key design decisions (for presentations)

1. **Swappable server boundary** — `server/` has zero PixiJS imports. `getResponseData()` returns a real-shaped `SpinResponse`. The client is fully decoupled.
2. **Data-driven PAR sheet** — adding a symbol or payline is a data edit in `config/`, no code changes.
3. **Single RNG swap point** — `Math.random()` lives only in `randomNumberGenerator.ts`. Production crypto-RNG is a one-file change.
4. **Concurrent spin + fetch** — reels cruise until the response lands, so network latency is never a visible freeze.
5. **Procedural textures** — zero art assets; crisp at any resolution; fully self-contained build.
6. **Reel physics for feel** — overshoot + `backOut` bounce reproduces the mechanical-reel thunk. One shared ticker makes Turbo mode trivial (scale `dt`).
7. **Speed multiplier scales timing, not just speed** — Turbo collapses the whole lifecycle (accel/cruise/decel/bounce), not just the scroll rate.

---

## Known notes / caveats

- RTP target is ~96% (approximate demo math — not certified).
- `Math.random()` is used for RNG (fine for a demo; see swap point above).
- No bonus symbols, scatters, or free spins — out of scope per the brief.
