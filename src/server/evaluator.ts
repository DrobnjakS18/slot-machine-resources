// Payline evaluator. Walk each payline left-to-right; wild matches anything.

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

function payoutFor(symbol: SymbolId, count: number, bet: number): number {
  if (count < MIN_MATCH) return 0;
  const meta = SYMBOLS[symbol];
  const idx = Math.min(count, MIN_MATCH + meta.pays.length - 1) - MIN_MATCH;
  return meta.pays[idx] * bet;
}

function evaluatePayline(line: Payline, window: SymbolWindow, bet: number): Win | null {
  let runSymbol: SymbolId | null = null;
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

    if (isWild || runSymbol === null || sym === runSymbol) {
      if (runSymbol === null && !isWild) runSymbol = sym; // wild streak resolves to first concrete
      runCount++;
      positions.push([cell.reel, cell.row]);
    } else {
      break;
    }
  }

  // Unresolved all-wild run: pay as 'WD'.
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

export function evaluateWindow(window: SymbolWindow, bet: number): Win[] {
  const wins: Win[] = [];
  for (const line of PAYLINES) {
    const win = evaluatePayline(line, window, bet);
    if (win) wins.push(win);
  }
  return wins;
}

export function buildWindow(reels: SymbolId[][], stops: number[]): SymbolWindow {
  return reels.map((reel, r) => {
    const stop = stops[r];
    const col: SymbolId[] = [];
    for (let row = 0; row < ROW_COUNT; row++) col.push(reel[(stop + row) % reel.length]);
    return col;
  });
}
