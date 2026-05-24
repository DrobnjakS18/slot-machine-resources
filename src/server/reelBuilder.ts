// Builds the reelstrips from the configured symbol frequencies.

import { REEL_COUNT } from '../config/constants';
import { SYMBOLS, SYMBOL_IDS, SymbolId } from '../config/symbols';
import { shuffle } from './randomNumberGenerator';

export function buildReel(reelIndex: number): SymbolId[] {
  const strip: SymbolId[] = [];
  for (const id of SYMBOL_IDS) {
    const count = SYMBOLS[id].frequency[reelIndex];
    for (let i = 0; i < count; i++) strip.push(id);
  }
  return shuffle(strip);
}

export function buildAllReels(): SymbolId[][] {
  const reels: SymbolId[][] = [];
  for (let r = 0; r < REEL_COUNT; r++) reels.push(buildReel(r));
  return reels;
}

// Read the visible window for a single reel given its stop index.
// Modulo wraps the strip so we never have to special-case the end.
export function visibleSymbols(reel: SymbolId[], stop: number, rows: number): SymbolId[] {
  const out: SymbolId[] = [];
  for (let i = 0; i < rows; i++) out.push(reel[(stop + i) % reel.length]);
  return out;
}
