// Symbol catalog and per-reel composition for the demo PAR sheet.
//
// Design choices, in case an interviewer asks:
//  - 7 symbols, no bonus / scatter / free-spins. Out of scope per the brief.
//  - "WD" is a wild that substitutes for any HIGH/LOW symbol (not for itself in lookup).
//  - Per-reel `frequency` controls reel composition (Mariana-style; md §16.6).
//  - `pays` indexed by [3-of-a-kind, 4-of-a-kind, 5-of-a-kind] -> credits per 1-credit bet.
//  - RTP target ~96%. Calibration is approximate — the brief doesn't require certified math.

export type SymbolId =
  | 'WD'  // wild
  | 'A'   // high
  | 'K'   // high
  | 'Q'   // mid
  | 'J'   // mid
  | 'TEN' // low
  | 'NINE'; // low

export type SymbolMeta = {
  id: SymbolId;
  label: string;
  color: number;       // PixiJS fill color used by the procedural texture
  textColor: number;
  frequency: [number, number, number, number, number];
  // Pays for [3, 4, 5] of a kind on a payline, in credits per credit bet.
  pays: [number, number, number];
  isWild?: boolean;
};

export const SYMBOLS: Record<SymbolId, SymbolMeta> = {
  WD:   { id: 'WD',   label: 'WILD', color: 0xffd166, textColor: 0x1a1a1a, frequency: [1, 2, 2, 2, 1], pays: [0, 0, 0], isWild: true },
  A:    { id: 'A',    label: 'A',    color: 0xef476f, textColor: 0xffffff, frequency: [3, 3, 3, 3, 3], pays: [10, 50, 200] },
  K:    { id: 'K',    label: 'K',    color: 0xf78c6b, textColor: 0xffffff, frequency: [4, 4, 4, 4, 4], pays: [8, 30, 150] },
  Q:    { id: 'Q',    label: 'Q',    color: 0x06d6a0, textColor: 0x0b0f17, frequency: [5, 5, 5, 5, 5], pays: [5, 20, 100] },
  J:    { id: 'J',    label: 'J',    color: 0x118ab2, textColor: 0xffffff, frequency: [6, 6, 6, 6, 6], pays: [3, 12, 60] },
  TEN:  { id: 'TEN',  label: '10',   color: 0x9b5de5, textColor: 0xffffff, frequency: [7, 7, 7, 7, 7], pays: [2, 8, 40] },
  NINE: { id: 'NINE', label: '9',    color: 0x6c757d, textColor: 0xffffff, frequency: [8, 8, 8, 8, 8], pays: [2, 6, 30] },
};

export const SYMBOL_IDS: SymbolId[] = Object.keys(SYMBOLS) as SymbolId[];

export function reelLength(reelIndex: number): number {
  return SYMBOL_IDS.reduce((sum, id) => sum + SYMBOLS[id].frequency[reelIndex], 0);
}
