// Top-level numeric constants. Touch one file to reshape the cabinet.

export const REEL_COUNT = 5;
export const ROW_COUNT = 3;
export const MIN_MATCH = 3;                   // minimum consecutive matches for a payline win
export const STARTING_BALANCE = 1000;
export const BET_VALUES = [1, 2, 5, 10, 25, 50, 100] as const;
export type BetValue = (typeof BET_VALUES)[number];

// Spin speed steps. The multiplier scales BOTH the visual reel scroll AND
// the lifecycle timing (accel/cruise/decel/bounce) so a "Turbo" spin both
// looks faster and finishes faster. Index 1 is the normal default.
export const SPEED_LEVELS: { label: string; multiplier: number }[] = [
  { label: 'Slow',   multiplier: 0.5 },
  { label: 'Normal', multiplier: 1.0 },
  { label: 'Fast',   multiplier: 2.0 },
  { label: 'Turbo',  multiplier: 4.0 },
];
export const DEFAULT_SPEED_INDEX = 1;

// Cabinet layout dimensions.
export const MAX_SYMBOL_SIZE = 240;
export const GAP = 8;
export const PADDING = 14;
