# IGT Slot Demo — Deep Code Walkthrough

## The one big idea first

Before any function, understand the **single architectural decision** everything else hangs off of. The code is split into three layers with a one-way dependency arrow:

```
config/   →   pure data (no logic, no imports from the game)
server/   →   game math (RNG, reels, win evaluation) — ZERO PixiJS imports
game/     →   rendering + input (PixiJS) — calls server like a network API
```

The client (`game/`) is forbidden from knowing how the math works. It calls exactly **one function** — `getResponseData(bet)` — the same way it would `fetch()` a real backend. You could delete the entire `game/` folder, point at a real server returning the same JSON shape, and the math layer wouldn't change a line. Keep this in mind; it explains a lot of "why is it done this way" later.

Now let's follow the code in the order it actually runs.

---

## 1. Bootstrap — how the app turns on

**`src/index.ts`** (the entire file, 9 lines):

```ts
const stage = document.getElementById('stage');
if (!stage) throw new Error('Missing #stage element');
const game = new Game(stage);
game.start().catch((err) => console.error('Failed to start game', err));
```

Step by step:
1. Find the `<div id="stage">` in `index.html:12` — this is where the PixiJS canvas will be injected.
2. If it's missing, crash loudly (fail-fast — better than a blank screen with no clue why).
3. Build a `Game` and call `start()`. `start()` is `async`, so `.catch()` handles any boot failure.

That's it. All complexity lives behind `new Game()`.

---

## 2. The config layer — the data that defines the game

These three files have **no logic**. They're the "PAR sheet" (the math spec sheet of a real slot machine) expressed as TypeScript.

### `src/config/constants.ts`

```ts
export const REEL_COUNT = 5;
export const ROW_COUNT = 3;
export const MIN_MATCH = 3;
export const BET_VALUES = [1, 2, 5, 10, 25, 50, 100] as const;
export const SPEED_LEVELS = [
  { label: 'Slow', multiplier: 0.5 }, { label: 'Normal', multiplier: 1.0 },
  { label: 'Fast', multiplier: 2.0 }, { label: 'Turbo', multiplier: 4.0 },
];
```

A 5×3 grid, minimum 3-of-a-kind to win. The **speed multiplier** is the clever bit — note in the comment it "scales both scroll speed and lifecycle timing." One number (0.5–4.0) later gets multiplied into the animation's delta-time, so Turbo doesn't just spin faster, it compresses the entire accelerate→stop sequence. We'll see this in `ReelSet.tick()`.

### `src/config/symbols.ts` — the most important data file

```ts
WD:   { id: 'WD', label: 'WILD', frequency: [1,2,2,2,1], pays: [0,0,0], isWild: true },
A:    { id: 'A',  label: 'A',    frequency: [3,3,3,3,3], pays: [4,16,50] },
...
NINE: { id: 'NINE', label: '9',  frequency: [8,8,8,8,8], pays: [1,4,10] },
```

Two arrays per symbol carry all the game math:

- **`frequency[5]`** — how many copies of this symbol go on each of the 5 reels. `A` appears 3 times per reel; `NINE` 8 times. **More copies = more common = lower pay.** This is how the house edge / RTP is tuned. The wild `WD` has frequency `[1,2,2,2,1]` — rare on the outer reels, slightly more common in the middle.
- **`pays[3]`** — payout for `[3-of-a-kind, 4-of-a-kind, 5-of-a-kind]`, expressed as credits per 1 credit bet. `A` pays `[4,16,50]`.

The genius of this layout: to rebalance the entire game's payout math, or add a brand-new symbol, you **only edit this file**. No code touches these numbers — they're read by the builder and evaluator at runtime.

### `src/config/paylines.ts`

Five winning patterns, each a list of `{reel, row}` cells walked left-to-right:

| ID | Name | Pattern (rows per reel) |
|----|------|--------------------------|
| 0 | Top | `0,0,0,0,0` (straight across top) |
| 1 | Middle | `1,1,1,1,1` |
| 2 | Bottom | `2,2,2,2,2` |
| 3 | V | `0,1,2,1,0` (a V shape) |
| 4 | Caret | `2,1,0,1,2` (an upside-down V) |

Again, pure data. Adding a zig-zag payline = append one object. The evaluator loops over whatever's in this array.

---

## 3. The server layer — the game math

This is where a spin's outcome is actually decided. Follow the dependency order: RNG → reel building → window assembly → evaluation → the public API that ties them together.

### `src/server/randomNumberGenerator.ts` — the single RNG swap point

```ts
export function pickStop(reelLen: number): number {
  return Math.floor(Math.random() * reelLen);
}
export function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
```

**`pickStop(reelLen)`** returns a random index `0..reelLen-1` — *where a reel stops*. This single call is the actual "roll" of the slot machine.

**`shuffle`** is a textbook **Fisher–Yates shuffle**: walk from the end, swap each element with a random earlier one. It copies first (`arr.slice()`) so it never mutates the input. Used once per reel at build time.

Why isolate this file? Both functions use `Math.random()`, which is **not** cryptographically secure. In a real certified slot you'd swap in `crypto.getRandomValues`. Because *every* random number flows through this one file, that swap is a one-file change — the whole point of the isolation.

### `src/server/reelBuilder.ts` — turning frequencies into physical reel strips

```ts
function buildReel(reelIndex: number): SymbolId[] {
  const strip: SymbolId[] = [];
  for (const id of SYMBOL_IDS) {
    const count = SYMBOLS[id].frequency[reelIndex];
    for (let i = 0; i < count; i++) strip.push(id);
  }
  return shuffle(strip);
}
```

This reads the frequency table and **expands it into an actual strip of symbols**. For reel 0: push 3 `A`s, 4 `K`s, 5 `Q`s … then `shuffle` so they're not in blocks. The result is one reel's worth of symbols in random-but-fixed order — exactly like the printed sticker strip wrapped around a physical mechanical reel.

`buildAllReels()` does this for all 5 reels and returns `SymbolId[][]`. **Crucial timing detail:** this runs *once* at module load (we'll see `const reels = buildAllReels()` in mockedServer). The strips are built once and stay fixed for the whole session. Individual spins don't rebuild reels — they just pick a stop index into these stable strips. This mirrors real hardware: the strip is permanent; only where it stops changes.

### `src/server/evaluator.ts` — the pure win-checking engine

This file has two jobs: assemble what's visible, then check it for wins.

#### `buildWindow(reels, stops)` — what the player sees

```ts
export function buildWindow(reels, stops): SymbolWindow {
  return reels.map((reel, r) => {
    const stop = stops[r];
    const col: SymbolId[] = [];
    for (let row = 0; row < ROW_COUNT; row++)
      col.push(reel[(stop + row) % reel.length]);
    return col;
  });
}
```

Given the 5 stop indices, produce the 5×3 grid of symbols actually showing. For each reel, take the symbol at `stop`, `stop+1`, `stop+2`.

The **`% reel.length`** is the key trick: a reel is a *loop*. If `stop` is the last index on the strip, `stop+1` and `stop+2` wrap back around to the beginning. The modulo makes the strip circular, so a stop near the end still shows three valid symbols. Result shape is `window[reel][row]`.

#### `payoutFor(symbol, count, bet)` — looking up the prize

```ts
function payoutFor(symbol, count, bet): number {
  if (count < MIN_MATCH) return 0;
  const meta = SYMBOLS[symbol];
  const idx = Math.min(count, MIN_MATCH + meta.pays.length - 1) - MIN_MATCH;
  return meta.pays[idx] * bet;
}
```

Translate a run length into a payout. The index math: `pays` is `[3x, 4x, 5x]`, so `count - MIN_MATCH` maps 3→0, 4→1, 5→2. The `Math.min(...)` clamps so that if a future 6-reel game produced a run of 6, it wouldn't read off the end of the array — it caps at the 5x entry. Then multiply the credit value by the bet. Clean and defensive.

#### `evaluatePayline(line, window, bet)` — the trickiest function in the server, where wilds live

```ts
let runSymbol: SymbolId | null = null;
let runCount = 0;

for (let i = 0; i < line.cells.length; i++) {
  const sym = window[cell.reel][cell.row];
  const isWild = SYMBOLS[sym].isWild === true;

  if (runCount === 0) {                       // first cell
    runSymbol = isWild ? null : sym;
    runCount = 1;
    positions.push([cell.reel, cell.row]);
    continue;
  }

  if (isWild || runSymbol === null || sym === runSymbol) {
    if (runSymbol === null && !isWild) runSymbol = sym; // wild streak resolves
    runCount++;
    positions.push([cell.reel, cell.row]);
  } else {
    break;                                    // mismatch — run ends
  }
}
const finalSymbol = runSymbol ?? 'WD';        // all-wilds pay as WD
```

Walk one payline left to right, building a "run" of matching symbols. The state is two variables: `runSymbol` (what we're matching) and `runCount` (how many in a row). Let me trace the wild logic, because it's subtle:

- **First cell:** if it's a wild, leave `runSymbol = null` (undecided — "this run could become anything"). Otherwise lock onto the concrete symbol. Either way the run starts at length 1.
- **Each next cell continues the run if** it's a wild (matches anything), *or* `runSymbol` is still null (we're still in a leading-wild streak), *or* it equals the current run symbol.
- **The resolve line:** `if (runSymbol === null && !isWild) runSymbol = sym`. This handles e.g. `[WD, WD, A, A]` — the two leading wilds left `runSymbol` null; when we hit the first real `A`, the run *retroactively becomes* an `A` run of length 3. The wilds count toward it.
- **Mismatch** (a different concrete symbol) → `break`. Paylines pay left-to-right contiguous only; one gap ends the run.
- **All wilds** (`[WD,WD,WD,...]`): `runSymbol` stays null, so `finalSymbol = runSymbol ?? 'WD'` pays it as the wild itself.

Then: if `runCount < MIN_MATCH` or payout is 0, return `null` (no win). Otherwise return a `Win` object carrying the payline info, the symbol, the count, the payout, **and `positions`** — the exact `[reel,row]` cells that won, which the renderer later highlights.

#### `evaluateWindow(window, bet)`

```ts
for (const line of PAYLINES) {
  const win = evaluatePayline(line, window, bet);
  if (win) wins.push(win);
}
```

Just runs `evaluatePayline` over all 5 paylines and collects the non-null results. A single spin can win on multiple lines at once.

### `src/server/mockedServer.ts` — the public API and the only thing the client talks to

The module owns the server-side state — and because it's a module, this state is a **singleton** that persists across spins:

```ts
const reels = buildAllReels();        // built once, fixed for the session
let balance = STARTING_BALANCE;       // 1000
let spinCounter = 0;
```

#### `getResponseData(bet)` — the heart of the server, the "network call"

```ts
export function getResponseData(bet: number): Promise<SpinResponse> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!Number.isFinite(bet) || bet <= 0) { resolve({... error: 'Invalid bet'}); return; }
      if (bet > balance)                      { resolve({... error: 'Insufficient balance'}); return; }

      balance -= bet;                         // 1. charge first

      try {
        const stops = [];
        for (let r = 0; r < REEL_COUNT; r++) stops.push(pickStop(reels[r].length));  // 2. roll
        const window = buildWindow(reels, stops);          // 3. assemble grid
        const wins = evaluateWindow(window, bet);          // 4. find wins
        const totalWin = wins.reduce((s, w) => s + w.payout, 0);
        balance += totalWin;                               // 5. pay out

        resolve({ spinId: nextSpinId(), bet, reelStops: stops, window, wins, totalWin, newBalance: balance });
      } catch (err) {
        balance += bet;                       // refund on failure — keep balance consistent
        reject(...);
      }
    }, fakeLatencyMs());                       // 80–200ms simulated network delay
  });
}
```

Read this as the canonical spin sequence:

1. **Returns a `Promise`** wrapped in `setTimeout` — it deliberately *doesn't* answer instantly. `fakeLatencyMs()` returns 80–200ms to simulate a real network round-trip. This forces the client to handle a loading state honestly (it can't assume the answer is instant).
2. **Validates** the bet, then **checks balance** before charging — returns a friendly `error` field rather than throwing for these expected cases.
3. **Charge-then-resolve ordering:** subtract the bet *first*, then compute the outcome, then add winnings. The `try/catch` refunds the bet if anything throws midway, so the balance can never silently lose money to a bug. This is exactly how you'd guard a real money transaction.
4. The actual outcome is just: pick 5 stops, build the window, evaluate, sum the wins.
5. Returns a fully-formed `SpinResponse` — the JSON shape a real backend would send: spin id, the stops, the visible window, the win list, total, and new balance.

#### `getReelInfo()` — defensive copies

```ts
return { reels: reels.map((r) => r.slice()), reelCount: REEL_COUNT, rowCount: ROW_COUNT };
```

The client needs the reel strips (to render the spinning symbols). But it hands back `r.slice()` — **copies**, not the originals. This way a buggy or malicious client can't reach in and mutate the server's master reel strips. Server state stays sovereign.

---

## 4. The game layer — rendering and input

Now the PixiJS side. This layer knows nothing about how wins are computed — it just calls `getResponseData` and animates whatever comes back.

### `src/game/utils.ts` — `computeSymbolSize(wrap)`

```ts
const fromW = Math.floor((availW - (REEL_COUNT - 1) * GAP - PADDING * 2) / REEL_COUNT);
const fromH = Math.floor((availH - PADDING * 2) / ROW_COUNT);
return Math.max(60, Math.min(MAX_SYMBOL_SIZE, fromW, fromH));
```

Compute the largest **square** symbol that fits the available space. Subtract gaps and padding, divide width by 5 reels and height by 3 rows, then take the smaller of the two (so symbols stay square and fit both ways). Clamp between 60px (never unusably tiny) and `MAX_SYMBOL_SIZE` 240px (never absurdly huge). This is the foundation of the responsive layout.

### `src/game/Game.ts` — the conductor

#### Constructor — set up the canvas

```ts
const wrap = parentEl.parentElement ?? parentEl;
this.responsiveSymbolSize = computeSymbolSize(wrap);
this.logicalW = REEL_COUNT * size + (REEL_COUNT - 1) * GAP + PADDING * 2;
this.logicalH = ROW_COUNT  * size + PADDING * 2;
this.app = new Application({ width, height, backgroundAlpha: 0, antialias: true,
                             resolution: window.devicePixelRatio || 1, autoDensity: true });
parentEl.appendChild(this.app.view);
this.fitToContainer(wrap);
new ResizeObserver(() => this.fitToContainer(wrap)).observe(wrap);
```

1. Measure available space, pick a symbol size, compute the **logical** canvas dimensions.
2. Create the PixiJS `Application` (the WebGL canvas). `backgroundAlpha: 0` makes it transparent so the CSS gradient behind shows through. `resolution: devicePixelRatio` + `autoDensity` makes it crisp on Retina/high-DPI screens.
3. Inject the canvas into `#stage`.
4. Register a **`ResizeObserver`** — every time the container resizes, re-fit. This is the responsiveness hook.

#### `fitToContainer(wrap)` — scale to fit

```ts
const scale = Math.min(1, availW / this.logicalW, availH / this.logicalH);
this.app.renderer.resize(this.logicalW * scale, this.logicalH * scale);
this.app.stage.scale.set(scale);
```

Compute a uniform scale factor that fits the logical size into the real container (capped at 1× — never upscale past native). Then resize the renderer and scale the whole stage. Everything inside is drawn at logical coordinates and scaled as a unit — so the game code never worries about pixels, only logical units.

#### `start()` — wire everything together

```ts
const info = server.getReelInfo();                          // get reel strips from "server"
const textures = buildSymbolTextures(this.app, size);       // pre-render symbol art
this.reelSet = new ReelSet({ app, reelStrips: info.reels, textures, symbolSize, initialStops: [0,0,0,0,0] });
this.winPresenter = new WinPresenter({ reelSet, ticker: app.ticker });
const root = new Container();
root.addChild(this.reelSet.container, this.winPresenter.container);  // win overlay ON TOP of reels
this.app.stage.addChild(root);
this.controls = bindControls();
this.controls.onSpin(() => this.handleSpin());
this.controls.onSpeedChange((m) => this.reelSet.setSpeedMultiplier(m));
this.controls.setBalance(server.getBalance());
```

The assembly line: fetch reel data, build textures, create the reel set, create the win overlay (added *after* the reels so it draws on top), then bind the HTML controls and connect the callbacks. After this, clicking SPIN calls `handleSpin()`.

#### `handleSpin()` — the spin choreography, the most important client function

```ts
if (this.busy) return;                    // guard: ignore clicks mid-spin
this.busy = true;
this.controls.setBusy(true);
try {
  this.controls.setWinText(''); this.winPresenter.clear();
  const bet = this.controls.getBet();
  if (server.getBalance() < bet) { this.controls.setWinText('Low balance'); return; }

  this.controls.setBalance(server.getBalance() - bet);   // optimistic UI: deduct immediately

  this.reelSet.startSpin();                               // ① start reels spinning NOW
  const response = await server.getResponseData(bet);    // ② fetch result IN PARALLEL

  if (response.error) { await this.reelSet.stopAt([0,0,0,0,0]); ...'Low balance'; return; }

  await this.reelSet.stopAt(response.reelStops);          // ③ stop reels on the real result

  if (response.totalWin > 0) {
    this.controls.setBalance(response.newBalance, true);  // celebrate=true → pop animation
    this.controls.setWinText(String(response.totalWin));
    this.controls.setLastWin(response.totalWin);
    this.winPresenter.show(response.wins);                // highlight winning lines
    await new Promise(r => setTimeout(r, 1000));          // let the win breathe
  } else { this.controls.setBalance(response.newBalance); this.controls.setWinText(''); }
} catch (err) { ...stopAt([0,0,0,0,0]); 'Server error'; }
finally { this.busy = false; this.controls.setBusy(false); }   // always re-enable
```

This is the cleverest piece of UX engineering in the codebase. The key insight is at ① and ②:

- **The reels start spinning *and* the server request fires at the same time.** `startSpin()` is not awaited; `getResponseData` is. So the reels are already cruising while the 80–200ms request is in flight. The player **never sees a freeze** waiting for the network — by the time the response lands, the reels are mid-spin and just need a target to stop on.
- **`busy` guard** at the top prevents a second spin from starting before the first finishes (no double-charges, no animation chaos).
- **Optimistic balance:** the bet is deducted from the *displayed* balance immediately for snappy feedback, then reconciled with `response.newBalance` (the authoritative server number) when it arrives.
- **`stopAt(response.reelStops)`** hands the reels their real landing positions — the animation resolves to match the math.
- **`finally`** guarantees the UI unlocks even if something throws. No stuck "SPINNING…" state.

This is the practical payoff of the async server boundary: the latency is *hidden inside the animation*.

### `src/game/Reel.ts` — a single reel's spin physics (the animation heart)

This is the most algorithmically dense file. One reel is modeled as a **state machine**:

```
idle → accelerating → cruising → decelerating → bouncing → idle
```

The core idea: `position` is a **floating-point index into the strip**. `position = 12.0` means symbol 12 sits exactly at row 0; `position = 12.5` means everything is scrolled half a symbol down. Animating the reel is just **increasing `position` over time** and redrawing.

#### The sprite pool — `rowCount + 2` sprites, recycled forever

```ts
for (let i = 0; i < this.rowCount + 2; i++) {
  const s = new Sprite(Texture.EMPTY);
  s.width = s.height = this.symbolSize;
  this.container.addChild(s);
  this.sprites.push(s);
}
this.container.mask = mask;     // clip to the 3-row visible window
```

A 3-row reel uses **5 sprites** (3 visible + 1 buffer above + 1 below). These same 5 sprite objects are reused for the *entire session* — the reel never creates or destroys sprites while spinning. It only **swaps their textures and moves them**. A `mask` clips everything to the visible 3-row window so the buffer sprites poking out the top/bottom are hidden. This is the standard high-performance "infinite scroll" technique.

#### `refreshSprites()` — drawing the current position (called every frame)

```ts
const intPos = Math.floor(this.position);
const frac = this.position - intPos;
for (let i = 0; i < this.sprites.length; i++) {
  const offsetFromTop = i - 1;                          // slot 0 sits ABOVE row 0
  const stripIndex = ((intPos + offsetFromTop) % stripLen + stripLen) % stripLen;
  const sprite = this.sprites[i];
  const tex = this.textures[this.strip[stripIndex]];
  if (sprite.texture !== tex) sprite.texture = tex;     // only swap if changed
  sprite.y = (offsetFromTop - frac) * this.symbolSize;
}
```

Split `position` into integer part (which symbol is at the top) and fractional part (how far between symbols we've scrolled). For each sprite:
- **`stripIndex`** picks which symbol it should show. The double-modulo `((x % n) + n) % n` is a JavaScript idiom for an *always-positive* modulo (plain `%` can return negatives for negative inputs) — it keeps the strip looping cleanly in both directions.
- **`if (sprite.texture !== tex)`** — only reassign the texture when it actually changed. Texture swaps are the expensive GPU operation; skipping no-op swaps is a real perf win.
- **`sprite.y = (offsetFromTop - frac) * size`** — position vertically. As `frac` grows from 0→1, every sprite slides down smoothly; when it crosses 1, `intPos` ticks up and the symbols renumber by one. The combination produces continuous scrolling from discrete symbols.

#### `update(deltaTime)` — the per-frame state machine

This `switch` runs every frame. Each state advances `position` differently:

**`accelerating`** — ease in from a standstill:
```ts
const t = Math.min(1, this.tweenT / this.tweenDuration);   // 0→1 over ACCEL_TIME (0.22s)
this.velocity = CRUISE_SPEED * (t * t);                    // quadratic ease-in
this.position += this.velocity * deltaTime;
if (t >= 1) { this.state = 'cruising'; this.velocity = CRUISE_SPEED; }
```
Velocity ramps up as `t²` (slow start, quickening) until it reaches `CRUISE_SPEED` (32 rows/sec), then flips to cruising.

**`cruising`** — constant speed until told to stop:
```ts
this.position += this.velocity * deltaTime;
this.cruiseElapsed += deltaTime;
if (this.cruiseElapsed >= MIN_CRUISE_TIME && this.pendingStop !== null)
  this.beginDeceleration(this.pendingStop);
```
Spin at constant speed. It will **not** decelerate until two conditions hold: it has cruised at least `MIN_CRUISE_TIME` (0.35s — guarantees the spin *looks* like a real spin even if the server answers in 80ms), **and** a stop target has been set. This is the mechanism that lets the reel keep cruising while waiting for the server, then stop on demand.

**`decelerating`** — ease out toward the target, with deliberate overshoot:
```ts
const t = Math.min(1, this.tweenT / this.tweenDuration);   // over DECEL_TIME 0.55s
const eased = 1 - Math.pow(1 - t, 3);                      // easeOutCubic
this.position = this.tweenFromPos + (this.tweenToPos - this.tweenFromPos) * eased;
```
Interpolate from the current position to `tweenToPos`, which is set to **just past** the real landing spot. The cubic ease-out decelerates smoothly. When done, transition to bouncing.

**`bouncing`** — the mechanical "thunk":
```ts
const eased = backOut(t, BOUNCE_BACK_S);                   // overshoots then settles
this.position = this.tweenFromPos + (this.tweenToPos - this.tweenFromPos) * eased;
if (t >= 1) {
  this.position = this.landingTarget;                      // snap exactly to final
  this.state = 'idle';
  if (this.resolveStop) this.resolveStop();                // resolve the Promise → reel done
}
```
Pull back from the overshoot to the true landing position using `backOut` easing — which itself overshoots slightly the other way and springs back. That recoil mimics a real mechanical reel slamming to a stop and bouncing. At the very end it **snaps exactly** to `landingTarget` (killing any float drift) and **resolves the Promise** from `requestStop` — that's the signal "this reel has come to rest."

#### `beginDeceleration(finalStop)` — the trickiest math in the client

```ts
const stripLen = this.strip.length;
const current = this.position;
let target = Math.ceil(current + MIN_SPIN_ROWS);                          // at least 18 rows ahead
const targetMod = ((target % stripLen) + stripLen) % stripLen;
const delta = ((finalStop - targetMod) % stripLen + stripLen) % stripLen; // forward distance to finalStop
target += delta;

this.landingTarget = target;                       // the TRUE resting position
this.tweenToPos = target + DECEL_OVERSHOOT_ROWS;   // overshoot, then bounce pulls back to landingTarget
```

The puzzle this solves: the reel is at some arbitrary float `position`, spinning. The server says "stop showing symbol index `finalStop` at the top." But we can't just jump there — the reel must (a) travel a believable distance and (b) land such that `position mod stripLen === finalStop`.

Step by step:
1. `target = ceil(current + MIN_SPIN_ROWS)` — go at least 18 whole rows further (so the stop never looks abrupt), rounded up to a whole symbol.
2. `targetMod` = where that provisional target lands on the looping strip.
3. `delta` = the *forward* distance from `targetMod` to the desired `finalStop`, kept positive by the always-positive modulo. (Reels only move one direction, so we can't go backward to reach it.)
4. Add `delta` so the final `target` is both ≥18 rows ahead **and** congruent to `finalStop` mod strip length.
5. `landingTarget` is that exact spot. `tweenToPos` is set `DECEL_OVERSHOOT_ROWS` (0.55) *past* it — the decel slides past, then the bounce phase pulls back to `landingTarget`. That overshoot-and-return is what sells the physical feel.

#### `backOut(t, s)` — the spring easing function

```ts
function backOut(t, s) { return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); }
```

A standard "back out" easing curve. For `t` from 0→1 it rises *past* 1 and settles back to exactly 1, with `s` (=3.0) controlling how far it overshoots. Applied during bouncing, it produces the recoil.

#### `requestStop(finalStop)` — bridging animation to Promises

```ts
requestStop(finalStop: number): Promise<void> {
  this.pendingStop = finalStop;
  return new Promise((resolve) => { this.resolveStop = resolve; });
}
```

Sets the target the cruising state is waiting for, and returns a Promise that stays unresolved until the bouncing state finishes (which calls the stashed `resolveStop`). This is how callers `await` a reel coming to rest — turning a frame-by-frame animation into something `async/await` can wait on.

### `src/game/ReelSet.ts` — orchestrating all 5 reels

#### Constructor — the cabinet frame + 5 reels

Draws the rounded golden-bordered frame (`drawRoundedRect(..., 14)` with a gold stroke and dark fill), then creates 5 `Reel`s, positioning each at `FRAME_PAD + r * (symbolSize + REEL_GAP)`. Then the critical line:

```ts
this.ticker = args.app.ticker;
this.ticker.add(this.tick, this);
```

**One shared ticker** drives all 5 reels. Not five timers — one.

#### `tick()` — the master clock, where the speed multiplier bites

```ts
private tick(): void {
  const deltaTime = (this.ticker.deltaMS / 1000) * this.speedMultiplier;
  for (const reel of this.reels) reel.update(deltaTime);
}
```

Every frame: take real elapsed time, **multiply by `speedMultiplier`**, and feed that scaled `dt` to every reel's `update`. This one multiplication is why Turbo mode works so elegantly — by scaling time itself, *every* duration inside `Reel` (accel, cruise, decel, bounce) compresses proportionally. The reel code never mentions speed; it just consumes `dt`. Slow = 0.5× (time runs at half speed), Turbo = 4× (everything 4× faster).

#### `startSpin()` — the staggered start wave

```ts
const stagger = START_STAGGER_MS / this.speedMultiplier;   // 80ms, compressed by speed
for (let i = 0; i < this.reels.length; i++)
  setTimeout(() => this.reels[i].startSpin(), i * stagger);
```

Reels don't all start at once — reel 0 starts, then reel 1 80ms later, etc. That left-to-right ripple is the classic slot look. The stagger is divided by speed, so in Turbo the reels start nearly together.

#### `stopAt(stops)` — staggered stop, resolves when ALL reels rest

```ts
const stagger = this.speedMultiplier >= 4 ? 0 : STOP_STAGGER_MS / this.speedMultiplier;
const promises = [];
for (let i = 0; i < this.reels.length; i++) {
  promises.push(new Promise<void>((resolve) => {
    setTimeout(() => { this.reels[i].requestStop(stops[i]).then(resolve); }, i * stagger);
  }));
}
await Promise.all(promises);
this.spinning = false;
```

Reels stop left-to-right too, 300ms apart (the suspense of watching reels land one by one). Each reel's stop is wrapped in a Promise; **`Promise.all`** waits for every reel to come fully to rest before `stopAt` resolves — which is what `handleSpin` awaits before showing the win. At Turbo (≥4×) the stop stagger collapses to **0** — all reels slam down together for maximum speed.

#### `cellPosition` and `setSpeedMultiplier`

`cellPosition` returns the pixel coordinates of any grid cell — the `WinPresenter` uses it to know where to draw highlights. `setSpeedMultiplier` updates the speed but **refuses to change mid-spin** (`|| this.spinning`) — so you can't warp the animation while it's running.

### `src/game/SymbolTextures.ts` — procedural art, zero asset files

`buildSymbolTextures` loops over every symbol and calls `renderOne`, which **draws a card with code** rather than loading a PNG:

```ts
const card = new Graphics();
card.lineStyle({ width: 2, color: 0x000000, alpha: 0.85 });
card.beginFill(meta.color); card.drawRoundedRect(...);
// white highlight on top 42% (light source), dark bevel on bottom 48% (depth)
const label = new Text(meta.label, style);     // serif, bold, drop-shadowed
container.addChild(card, bevel, highlight, label);
const rt = RenderTexture.create({ width: size, height: size, resolution: devicePixelRatio });
renderer.render(container, { renderTexture: rt });
container.destroy({ children: true });          // free the scratch objects
return rt;
```

Each symbol becomes a rounded rectangle in its config color, with a white highlight strip up top and a dark bevel below to fake 3D lighting, plus a centered serif letter. It's rendered **once** into a `RenderTexture` (a GPU texture), and the temporary drawing objects are destroyed. From then on every reel sprite just points at these 7 cached textures — cheap to reuse thousands of times. The payoff: no art pipeline, no missing-image risk, and crisp rendering at any resolution because it's drawn at `devicePixelRatio`.

### `src/game/WinPresenter.ts` — the pulsing win overlay

A transparent `Graphics` layer sitting *above* the reels.

```ts
show(wins)  → store wins, redraw
clear()     → wins = [], overlay.clear()

private tick() {                                  // runs every frame
  if (this.wins.length === 0) return;             // idle when no wins — cheap
  this.elapsedMs += this.ticker.deltaMS;
  const phase = (this.elapsedMs % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;   // 0→1 over 900ms
  const intensity = 0.45 + 0.55 * Math.sin(phase * Math.PI);           // breathe 0.45↔1.0
  this.redraw(intensity);
}
```

`tick` does nothing while there are no wins (a cheap early return). When wins are showing, it computes a **pulsing `intensity`** from a sine wave — alpha breathes between 0.45 and 1.0 every 900ms, the "glow" effect. Then `redraw(intensity)`:

```ts
for (const win of this.wins) {
  for (const [r, row] of win.positions) {                 // highlight each winning cell
    const c = this.reelSet.cellPosition(r, row);
    this.overlay.lineStyle({ width: 3, color: win.paylineColor, alpha: intensity });
    this.overlay.beginFill(win.paylineColor, intensity * 0.28);
    this.overlay.drawRoundedRect(c.x+2, c.y+2, c.size-4, c.size-4, 8);
  }
  // then draw a connecting line through the cell centers
  for (const [r, row] of win.positions) { ... moveTo / lineTo ... }
}
```

For every win, it draws a colored rounded-rect highlight on each winning cell, then connects the cells with a line tracing the payline's path — all in the payline's own color (from config), all pulsing. The `WinPresenter` doesn't know *why* those cells won; it just renders the `positions` array that came back from the evaluator. It asks `ReelSet.cellPosition` for coordinates, keeping rendering and layout decoupled.

### `src/game/BetSelector.ts` — all the HTML controls, and the `Controls` contract

This is the only file that touches the DOM. `Game` never does — it goes through the `Controls` interface this returns. That's deliberate: the UI is plain HTML/CSS (styleable, accessible, testable) rather than PixiJS, and `Game` stays decoupled from the DOM.

`bindControls()` grabs every button by id (from `index.html`), wires up:
- **Bet selection** two ways: `−`/`+` step buttons, *and* a popup grid (`#bet-popup-grid`) populated from `BET_VALUES`, opened by clicking the bet label. `refreshBet()` keeps the label, the disabled states of the arrows, and the popup's active highlight all in sync from one `betIndex`.
- **Spin** via the button click *and* the **Spacebar** (`keydown` on `Space`, suppressed while disabled or while the popup is open).
- **Speed** `−`/`+`, which calls `speedHandler` (wired to `ReelSet.setSpeedMultiplier` in `Game`).
- **Paytable** rendered from config by `renderPaytableHtml()`.

Then it returns the `Controls` object — the API surface `Game` uses:

```ts
getBet, setBalance(balance, celebrate?), setBusy(busy), setWinText(text),
setLastWin(amount), onSpin(handler), onSpeedChange(handler)
```

A few details worth noting:
- **`setBalance(balance, celebrate)`** — when `celebrate` is true (a win), it re-triggers a CSS "pop" animation with the classic reflow trick: `remove('pop'); void offsetWidth; add('pop')`. Reading `offsetWidth` forces the browser to flush styles so the animation restarts even on consecutive wins.
- **`setBusy(busy)`** — disables every control during a spin and flips the button text to "SPINNING…". This is the UI half of `Game`'s `busy` guard.
- **`setWinText`** — distinguishes errors (`'Low balance'`, `'Server error'`) from wins, styling them differently, and clears cleanly on empty string.

#### `renderPaytableHtml()`

Builds the paytable panel **entirely from config data** — finds the wild for its own section, then loops `SYMBOL_IDS` emitting a row per non-wild symbol with its `pays[0..2]`, colored by `s.color`, and a footer with `PAYLINES.length`. Add a symbol or payline to config and this panel updates itself. No hardcoded numbers.

---

## 5. The full spin, end to end

Tying every function above into one timeline — what happens when you hit SPIN:

1. **`BetSelector`** spin handler fires → calls `Game.handleSpin()`.
2. **`handleSpin`** sets `busy`, disables controls (`setBusy`), optimistically deducts the bet from the displayed balance.
3. It calls **`reelSet.startSpin()`** (reels begin a staggered accelerate→cruise) **and** `await server.getResponseData(bet)` **at the same time**. Reels cruise while the request is in flight.
4. **`getResponseData`** (after 80–200ms): validates, charges balance, calls `pickStop` ×5, `buildWindow`, `evaluateWindow`, sums wins, returns a `SpinResponse`.
5. Back in `handleSpin`, **`await reelSet.stopAt(response.reelStops)`** → each reel runs `beginDeceleration` (computing a landing congruent to its stop) → decelerate → bounce → resolve. `Promise.all` waits for all five.
6. If `totalWin > 0`: reconcile balance with a celebratory pop, show win text, and **`winPresenter.show(response.wins)`** lights up the winning cells and payline paths, pulsing. Pause 1s.
7. **`finally`**: clear `busy`, re-enable controls. Ready for the next spin.

Every frame throughout, the **single shared ticker** in `ReelSet.tick()` advances all reels (and the `WinPresenter` pulse) by `realDelta × speedMultiplier`.

---

## What makes this codebase good (the takeaways)

- **The server boundary is real.** `server/` has zero PixiJS imports and one public function. Swappable for a real backend with no client changes.
- **Data-driven.** Symbols, pays, frequencies, and paylines are all config. Rebalancing or extending the game = editing data, not logic.
- **One RNG choke point.** Every random number flows through `randomNumberGenerator.ts` — production crypto-RNG is a one-file swap.
- **Latency hidden in animation.** Spinning the reels *concurrently* with the fetch means network delay is never a visible freeze. This is the standout UX decision.
- **One number controls all timing.** The speed multiplier scales `dt`, so Turbo compresses the whole physics lifecycle for free — no special-casing.
- **Cheap rendering.** Fixed sprite pool with texture swaps (no allocation while spinning), procedural textures rendered once, a shared ticker, and early-returns when idle.
