// Builds the reelstrips from the configured symbol frequencies.
//
// Per md §16.6: for each reel, push N copies of each symbol where N = its
// frequency on that reel, then Fisher-Yates shuffle. The shuffled array
// IS the reelstrip — stable across spins, indexed by the chosen stop.

import { REEL_COUNT } from '../config/constants';
import { SYMBOLS, SYMBOL_IDS, SymbolId } from '../config/symbols';
import { shuffleFisherYates } from './rng';

export function buildReel(reelIndex: number): SymbolId[] {
  const strip: SymbolId[] = [];
  for (const id of SYMBOL_IDS) {
    const count = SYMBOLS[id].frequency[reelIndex];
    for (let i = 0; i < count; i++) strip.push(id);
  }
  return shuffleFisherYates(strip);
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
