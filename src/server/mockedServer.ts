// The "server" module. Self-contained: no PixiJS imports.
//
// Public surface intentionally small — the client only calls getResponseData(bet).
// Everything else (reelstrips, balance, RNG) is server-owned state.
//
// The response shape mirrors what a real slot service would return so the
// client doesn't know it's talking to an in-process mock (md §9).

import { REEL_COUNT, ROW_COUNT, STARTING_BALANCE } from '../config/constants';
import { SymbolId } from '../config/symbols';
import { buildAllReels } from './reelBuilder';
import { pickStop, setRngOverride, RngOverride } from './rng';
import { buildWindow, evaluateWindow, Win } from './evaluator';

export type SpinResponse = {
  spinId: string;
  bet: number;
  reelStops: number[];
  window: SymbolId[][];          // window[reel][row]
  wins: Win[];
  totalWin: number;
  newBalance: number;
  error?: string;
};

export type ReelInfo = {
  reels: SymbolId[][];
  reelCount: number;
  rowCount: number;
};

const reels: SymbolId[][] = buildAllReels();
let balance = STARTING_BALANCE;
let spinCounter = 0;

function nextSpinId(): string {
  spinCounter++;
  // Tiny readable id; not security-sensitive.
  return `${Date.now().toString(36)}-${spinCounter.toString(36)}`;
}

// Simulated network round-trip so the client's loading state is exercised.
function fakeLatencyMs(): number {
  return 80 + Math.random() * 120;
}

export function getReelInfo(): ReelInfo {
  // Returns a defensive copy so the client can't mutate server-owned data.
  return {
    reels: reels.map((r) => r.slice()),
    reelCount: REEL_COUNT,
    rowCount: ROW_COUNT,
  };
}

export function getBalance(): number {
  return balance;
}

export function getResponseData(bet: number): Promise<SpinResponse> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!Number.isFinite(bet) || bet <= 0) {
        resolve({
          spinId: nextSpinId(), bet, reelStops: [], window: [],
          wins: [], totalWin: 0, newBalance: balance,
          error: 'Invalid bet',
        });
        return;
      }
      if (bet > balance) {
        resolve({
          spinId: nextSpinId(), bet, reelStops: [], window: [],
          wins: [], totalWin: 0, newBalance: balance,
          error: 'Insufficient balance',
        });
        return;
      }

      // Charge the bet first — a real server would do this in a transaction.
      balance -= bet;

      const stops: number[] = [];
      for (let r = 0; r < REEL_COUNT; r++) stops.push(pickStop(r, reels[r].length));
      const window = buildWindow(reels, stops);
      const wins = evaluateWindow(window, bet);
      const totalWin = wins.reduce((s, w) => s + w.payout, 0);
      balance += totalWin;

      resolve({
        spinId: nextSpinId(),
        bet,
        reelStops: stops,
        window,
        wins,
        totalWin,
        newBalance: balance,
      });
    }, fakeLatencyMs());
  });
}

// Test seam used by the debug panel. The game module passes a per-reel function
// that returns a forced stop (or null to fall through to RNG).
export function setForceStops(fn: RngOverride | null): void {
  setRngOverride(fn);
}
