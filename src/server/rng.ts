// Thin RNG wrapper.
//
// Math.random() is fine for a demo. For real-money play this module would
// swap to crypto.getRandomValues — the rest of the codebase would not change.
//
// Also exposes a per-reel override hook used by the debug panel to force
// specific stops. The override is checked first; if it returns null/undefined
// the RNG falls through.

export type RngOverride = (reelIndex: number) => number | null | undefined;

let override: RngOverride | null = null;

export function setRngOverride(fn: RngOverride | null): void {
  override = fn;
}

export function pickStop(reelIndex: number, reelLen: number): number {
  const forced = override?.(reelIndex);
  if (typeof forced === 'number' && forced >= 0 && forced < reelLen) {
    return forced;
  }
  return Math.floor(Math.random() * reelLen);
}

// Unbiased Fisher-Yates shuffle. Used once when building each reelstrip.
export function shuffleFisherYates<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
