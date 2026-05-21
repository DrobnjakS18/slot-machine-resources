import { REEL_COUNT } from "../config/constants";
import { SYMBOLS, SYMBOL_IDS, SymbolId } from "../config/symbols";
import { shuffle } from "./rng";

// Builds a single shuffled reelstrip by repeating each symbol N times per its frequency on this reel.
export function buildReel(reelIndex: number): SymbolId[] {
  const strip: SymbolId[] = [];

  for (const id of SYMBOL_IDS) {
    const count = SYMBOLS[id].frequency[reelIndex];
    for (let i = 0; i < count; i++) strip.push(id);
  }

  return shuffle(strip);
}

// Builds reelstrips for all reels; called once at startup.
export function buildAllReels(): SymbolId[][] {
  const reels: SymbolId[][] = [];
  for (let r = 0; r < REEL_COUNT; r++) reels.push(buildReel(r));
  return reels;
}