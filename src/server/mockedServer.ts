// No PixiJS imports — intentional separation. Public surface: getResponseData(bet).

import { REEL_COUNT, ROW_COUNT, STARTING_BALANCE } from '../config/constants';
import { SymbolId } from '../config/symbols';
import { buildAllReels } from './reelBuilder';
import { pickStop } from './randomNumberGenerator';
import { buildWindow, evaluateWindow, Win } from './evaluator';

export type SpinResponse = {
  spinId: string;
  bet: number;
  reelStops: number[];
  window: SymbolId[][]; // window[reel][row]
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
  return `${Date.now().toString(36)}-${spinCounter.toString(36)}`;
}

// simulated latency exercises client loading state
function fakeLatencyMs(): number {
  return 80 + Math.random() * 120;
}

// Defensive copies — client must not mutate server-owned reelstrips.
export function getReelInfo(): ReelInfo {
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
  return new Promise((resolve, reject) => {
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

      // Charge the bet first, then determine the outcome.
      balance -= bet;

      try {
        const stops: number[] = [];
        for (let r = 0; r < REEL_COUNT; r++) stops.push(pickStop(reels[r].length));
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
      } catch (err) {
        // Refund the charged bet so server balance stays consistent
        balance += bet;
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    }, fakeLatencyMs());
  });
}