import { REEL_COUNT, ROW_COUNT, GAP, PADDING, MAX_SYMBOL_SIZE } from '../config/constants';

// For responsiveness, computes the largest square symbol size that fits the grid inside the wrapper.
export function computeSymbolSize(wrap: HTMLElement): number {
  const availW = wrap.clientWidth  || window.innerWidth  * 0.65;
  const availH = wrap.clientHeight || window.innerHeight * 0.90;
  const fromW = Math.floor((availW - (REEL_COUNT - 1) * GAP - PADDING * 2) / REEL_COUNT);
  const fromH = Math.floor((availH - PADDING * 2) / ROW_COUNT);
  return Math.max(60, Math.min(MAX_SYMBOL_SIZE, fromW, fromH));
}
