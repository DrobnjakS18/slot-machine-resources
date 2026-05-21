// Pure win evaluator. Input: a window of symbols. Output: a list of wins.
//
// Algorithm (md §16.3):
//  For each payline, walk cells left-to-right.
//   - Track currentSymbolType, currentCount.
//   - Wild matches anything; on first wild, currentSymbolType stays "WILD-pending"
//     until a concrete symbol resolves it, then it upgrades.
//   - Stop walking on the first mismatch; emit a win if currentCount >= MIN_MATCH.
//   - Highest-pays prioritization is implicit: there's only one rule per symbol
//     (the [3,4,5] pays array), so the longest run automatically pays the most.
//
// Returns the win plus the exact [reel, row] positions to highlight.

import { MIN_MATCH, ROW_COUNT } from '../config/constants';
import { PAYLINES, Payline } from '../config/paylines';
import { SYMBOLS, SymbolId } from '../config/symbols';

export type Win = {
  paylineId: number;
  paylineName: string;
  paylineColor: number;
  symbol: SymbolId;
  count: number;
  payout: number;                    // credits, scaled by bet
  positions: [number, number][];     // [reelIndex, rowIndex] pairs
};

export type SymbolWindow = SymbolId[][]; // window[reel][row]

// Looks up the payout for a symbol+count combination scaled by bet; 0 if below MIN_MATCH.
function payoutFor(symbol: SymbolId, count: number, bet: number): number {
  if (count < MIN_MATCH) return 0;
  const meta = SYMBOLS[symbol];
  const idx = Math.min(count, MIN_MATCH + meta.pays.length - 1) - MIN_MATCH;
  return meta.pays[idx] * bet;
}

// Walks one payline left-to-right and returns a Win if run length >= MIN_MATCH, else null.
function evaluatePayline(line: Payline, window: SymbolWindow, bet: number): Win | null {
  let runSymbol: SymbolId | null = null; // null = "still all-wild, undetermined"
  let runCount = 0;
  const positions: [number, number][] = [];

  for (let i = 0; i < line.cells.length; i++) {
    const cell = line.cells[i];
    const sym = window[cell.reel][cell.row];
    const isWild = SYMBOLS[sym].isWild === true;

    if (runCount === 0) {
      runSymbol = isWild ? null : sym;
      runCount = 1;
      positions.push([cell.reel, cell.row]);
      continue;
    }

    // Match if: wild (matches anything), or first concrete after a wild streak,
    // or same symbol as the resolved run.
    if (isWild || runSymbol === null || sym === runSymbol) {
      if (runSymbol === null && !isWild) runSymbol = sym; // wild streak resolves to first concrete
      runCount++;
      positions.push([cell.reel, cell.row]);
    } else {
      break;
    }
  }

  // An all-wild run never resolves to a concrete symbol. Pay it as wild.
  const finalSymbol: SymbolId = runSymbol ?? 'WD';

  if (runCount < MIN_MATCH) return null;
  const payout = payoutFor(finalSymbol, runCount, bet);
  if (payout <= 0) return null;

  return {
    paylineId: line.id,
    paylineName: line.name,
    paylineColor: line.color,
    symbol: finalSymbol,
    count: runCount,
    payout,
    positions,
  };
}

// Evaluates all configured paylines against the window; returns every win found.
export function evaluateWindow(window: SymbolWindow, bet: number): Win[] {
  const wins: Win[] = [];
  for (const line of PAYLINES) {
    const win = evaluatePayline(line, window, bet);
    if (win) wins.push(win);
  }
  return wins;
}

// Helper used by mockedServer to assemble the window from reels + stops.
export function buildWindow(reels: SymbolId[][], stops: number[]): SymbolWindow {
  return reels.map((reel, r) => {
    const stop = stops[r];
    const col: SymbolId[] = [];
    for (let row = 0; row < ROW_COUNT; row++) col.push(reel[(stop + row) % reel.length]);
    return col;
  });
}
