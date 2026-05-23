# Session Notes — Function & Class Explanations

Reference doc for the code discussed in this session.

---

## `SymbolTextures.ts`

### `renderOne(renderer, meta, size)`
Paints one symbol card off-screen and bakes it into a GPU texture. Steps:

1. **Container setup** — off-screen `Container`, never added to stage; a canvas for rendering.
2. **Geometry** — `inset = size * 0.06` (margin), `w/h = size - inset*2`, `radius = size * 0.14`.
3. **Layer stack (back → front):**
   | Layer | What | Why |
   |---|---|---|
   | `shadow` | black rounded rect, offset, 40% alpha | depth |
   | `card` | symbol color fill + black border | main surface |
   | `bevel` | black overlay on bottom 48% | beveled look |
   | `highlight` | white on top 42%, 24% alpha | top-left light source |
   | `rim` | 1px white inner border | edge polish |
4. **Label** — font size by type: WILD `size*0.22`, multi-char (e.g. "10") `size*0.34`, single char `size*0.42`. Georgia serif, bold, drop shadow. Anchored center, `y = size*0.47` (slightly high to offset Georgia's descender metrics).
5. **Bake** — `RenderTexture.create(...)`, `renderer.render(container, {renderTexture})`, then `container.destroy()` to free CPU memory. Returns the GPU texture.

### `window.devicePixelRatio`
Ratio of physical screen pixels to CSS pixels. Standard monitor = 1, Retina = 2, mobile OLED = 3.
Used as `resolution` in `RenderTexture.create` so textures allocate enough physical pixels to stay crisp on HiDPI screens. `|| 1` fallback for environments where it's undefined.

### `RenderTexture.create({ width, height, resolution })`
`width/height` = logical size (CSS px); `resolution` = physical px per logical px. Bakes the container into a reusable GPU texture, generated once at startup and used by every reel sprite.

---

## `ReelSet.ts`

Orchestrates all 5 reels: layout, staggered start/stop, single shared ticker.

- **Constants:** `REEL_GAP=8`, `FRAME_PAD=14`, `START_STAGGER_MS=80`, `STOP_STAGGER_MS=300`.
- **Fields:** `container` (root node), `width/height` (frame size), `reels[]`, shared `ticker`, `speedMultiplier`, `spinning` flag.
- **Constructor:** draws cabinet frame (gold border, dark fill), instantiates 5 `Reel`s positioned by `FRAME_PAD + r*(symbolSize+GAP)`, attaches one shared ticker.
- **`tick()`:** `deltaTime = (ticker.deltaMS/1000) * speedMultiplier`, then `reel.update(deltaTime)` for each. Scaling `deltaTime` makes Turbo speed up motion AND collapse lifecycle durations.
- **`startSpin()`:** sets `spinning = true`, fires each reel with `setTimeout(i*stagger)`. Returns immediately; reels cruise until `stopAt`.
- **`stopAt(stops)`:** assigns target stop per reel with stagger (0 on Turbo, `speedMultiplier >= 4`). Awaits `Promise.all` → resolves when last reel settles, then sets `spinning = false`.
- **`setSpeedMultiplier(m)`:** validated (finite, positive); **blocked mid-spin** via the `spinning` guard.
- **`cellPosition(reel, row)`:** returns `{x, y, size}` in container-local coords; used by `WinPresenter`.

### `deltaTime` (a.k.a. `dt`)
Time elapsed since last frame, in seconds (`ticker.deltaMS / 1000`), scaled by `speedMultiplier`.

---

## `BetSelector.ts`

### `bindControls()`
Wires all HTML controls, returns a `Controls` interface. Sections:

1. **DOM lookup** — grabs bet buttons, spin button, balance/win displays, paytable by ID.
2. **Bet controls** — `betIndex` into `BET_VALUES`; `refreshBet()` syncs label + disables at bounds; popup grid; all blocked when `betBusy`.
3. **Spin trigger** — stores `spinHandler`; button click and `Space` key fire it (Space guarded by `disabled`).
4. **Speed controls** — `speedIndex` into `SPEED_LEVELS`; `refreshSpeed()` updates label, disables at bounds, fires `speedHandler(multiplier)`.
5. **Returned `Controls`:** `getBet`, `setBalance(n, celebrate?)` (CSS `pop` reflow trick), `setBusy`, `setWinText`, `setLastWin`, `onSpin`, `onSpeedChange` (fires once on bind with default).
6. **`renderPaytableHtml()`** — pure data → HTML: WILD section, header, symbol rows with 3×/4×/5× pays, footer with payline count.

---

## `Reel.ts`

Single reel: sprite pool + spin state machine `idle → accelerating → cruising → decelerating → bouncing → idle`.

- **`startSpin()`** — idle → accelerating (no-op if already spinning). Does NOT clear `pendingStop` (so a stop arriving before spin start, possible on Turbo zero-stagger, is preserved).
- **`requestStop(finalStop)`** — sets `pendingStop`, returns a Promise resolved when the reel comes to rest.
- **`update(dt)`** — per-state tweening: accel (easeIn), cruise (constant), decel (easeOutCubic past target by overshoot), bounce (backOut wobble), then snap to integer landing and resolve the stop promise.
- **`beginDeceleration(finalStop)`** — computes `landingTarget` so `landingTarget % stripLen === finalStop`, traveling at least `MIN_SPIN_ROWS`; decel tween overshoots, bounce walks back.
- **`refreshSprites()`** — positions each of `rowCount+2` sprite slots and swaps textures. **Restored convention:** `stripIndex = (intPos + offsetFromTop) % stripLen`, `sprite.y = (offsetFromTop - frac) * symbolSize`.

---

## Bug fixes applied this session

- **Speed lock mid-spin** — `ReelSet.spinning` flag; `setSpeedMultiplier` no-ops while spinning.
- **Turbo stop fix** — removed `pendingStop = null` from `Reel.startSpin` so zero-stagger Turbo stops aren't wiped.
- **Win/display mismatch** — restored `evaluator.ts`, `reelBuilder.ts`, `rng.ts`, `Reel.ts` from the `backup` branch (matched strip-direction convention); trimmed unused `mockedServer.ts` imports.
