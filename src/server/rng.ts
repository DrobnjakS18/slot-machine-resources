export type RngOverride = (reelIndex: number) => number | null | undefined;

let override: RngOverride | null = null;

// Registers a hook that can force specific stop indices — used for testing/debug.
export function setRngOverride(fn: RngOverride | null): void {
  override = fn;
}

// Returns a stop index for one reel, using the override hook if set, else Math.random().
export function pickStop(reelIndex: number, reelLen: number): number {
  const forced = override?.(reelIndex);
  if (typeof forced === 'number' && forced >= 0 && forced < reelLen) {
    return forced;
  }
  return Math.floor(Math.random() * reelLen);
}


// Fisher-Yates shuffle — returns a new shuffled copy, does not mutate the input.
export function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();  
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
