# IGT Slot Demo

A 5×3 video slot demo built for the IGT GameDeveloper technical test.

**Stack:** TypeScript · PixiJS 7 · Vite

---

## Quick Start

```bash
npm install
npm run dev        # opens http://localhost:5173
npm run build      # type-check + bundle → dist/
npm run preview    # preview the production build
```

---

## Architecture

The codebase is split into two strict layers:

```
src/
├── config/
│   ├── symbols.ts      # PAR sheet: symbol catalog, frequencies, pay tables
│   └── paylines.ts     # Payline definitions (data only, no logic)
├── server/             # "Server" boundary — no PixiJS imports
│   ├── rng.ts          # RNG wrapper + debug override hook
│   ├── reelBuilder.ts  # Reelstrip construction from frequency tables
│   ├── evaluator.ts    # Pure win evaluator
│   └── mockedServer.ts # Public API: getResponseData(), balance, spin IDs
└── game/               # Client / rendering layer (PixiJS)
    ├── SymbolTextures.ts
    ├── WinPresenter.ts
    ├── DebugPanel.ts
    └── Game.ts         # Entry class mounted by index.ts
```

The client only calls `getResponseData(bet)` on the mock server — the same contract a real backend would expose — so the client/server boundary is clean and swappable.

---

## Game Rules

| Property | Value |
|---|---|
| Reels × Rows | 5 × 3 |
| Paylines | 5 (3 horizontal + V + Caret) |
| Min match | 3-of-a-kind |
| Wild (`WD`) | Substitutes for any HIGH/LOW symbol |
| RTP target | ~96% (approximate, demo math) |

### Symbols

| Symbol | Label | Type | 3x | 4x | 5x |
|---|---|---|---|---|---|
| WD | WILD | Wild | — | — | — |
| A  | A    | High | 10 | 50 | 200 |
| K  | K    | High | 8  | 30 | 150 |
| Q  | Q    | Mid  | 5  | 20 | 100 |
| J  | J    | Mid  | 3  | 12 | 60  |
| TEN | 10  | Low  | 2  | 8  | 40  |
| NINE | 9  | Low  | 2  | 6  | 30  |

Pays shown in credits per 1-credit bet.

---

## Debug Panel

Toggle the **Debug** checkbox in the UI to reveal per-reel stop inputs. Enter a stop index (0–N) for any reel to force that stop on the next spin. Leave a field blank to let that reel spin freely under RNG.

The debug seam is wired through `rng.setRngOverride` — no game logic is bypassed; the same evaluator and server path run regardless.

---

## Key Design Decisions

- **Mock server boundary** — `src/server/` has zero PixiJS imports. `getResponseData()` returns the same `SpinResponse` shape a real REST/WebSocket endpoint would, so the client is not coupled to local state.
- **PAR sheet as data** — Adding a symbol or payline is an edit to `symbols.ts` or `paylines.ts` only; no code changes required.
- **RNG swap point** — `rng.ts` uses `Math.random()` for the demo. Replacing it with `crypto.getRandomValues` requires changes to one file only.
- **Procedural textures** — No external art assets. `SymbolTextures.ts` renders colored tiles via PixiJS `Graphics` so the demo is fully self-contained.
