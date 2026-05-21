// HTML-side controls (kept out of the PixiJS layer so they're trivially styleable
// with CSS and accessible to screen readers). Wraps the bet <select>, spin
// button, balance display, and win text.

import { BET_VALUES, DEFAULT_SPEED_INDEX, SPEED_LEVELS, STARTING_BALANCE } from '../config/constants';
import { PAYLINES } from '../config/paylines';
import { SYMBOLS, SYMBOL_IDS } from '../config/symbols';

export type Controls = {
  getBet(): number;
  setBalance(balance: number): void;
  setBusy(busy: boolean): void;
  setWinText(text: string): void;
  onSpin(handler: () => void): void;
  // Speed control — calls back with the new multiplier whenever the user
  // taps +/-. The handler is also invoked once on bind with the default.
  onSpeedChange(handler: (multiplier: number) => void): void;
};

// Wires all HTML controls and returns a Controls interface for Game to drive.
export function bindControls(): Controls {
  const select = document.getElementById('bet-select') as HTMLSelectElement;
  const spinBtn = document.getElementById('spin-btn') as HTMLButtonElement;
  const balanceEl = document.getElementById('balance') as HTMLDivElement;
  const winEl = document.getElementById('win-text') as HTMLDivElement;
  const paytableEl = document.getElementById('paytable') as HTMLDivElement;

  // Populate the bet combo box from the configured BET_VALUES.
  for (const v of BET_VALUES) {
    const opt = document.createElement('option');
    opt.value = String(v);
    opt.textContent = `${v} credits`;
    select.appendChild(opt);
  }
  select.value = String(BET_VALUES[0]);

  // Initial balance.
  balanceEl.textContent = String(STARTING_BALANCE);

  // Render paytable so the player knows what they're chasing.
  paytableEl.innerHTML = renderPaytableHtml();

  let spinHandler: (() => void) | null = null;
  spinBtn.addEventListener('click', () => spinHandler?.());

  // Speed up / slow down controls.
  const speedDownBtn = document.getElementById('speed-down-btn') as HTMLButtonElement;
  const speedUpBtn = document.getElementById('speed-up-btn') as HTMLButtonElement;
  const speedLabelEl = document.getElementById('speed-label') as HTMLSpanElement;
  let speedIndex = DEFAULT_SPEED_INDEX;
  let speedHandler: ((m: number) => void) | null = null;

  const refreshSpeed = () => {
    const level = SPEED_LEVELS[speedIndex];
    speedLabelEl.textContent = `${level.label} (${level.multiplier}×)`;
    speedDownBtn.disabled = speedIndex === 0;
    speedUpBtn.disabled = speedIndex === SPEED_LEVELS.length - 1;
    speedHandler?.(level.multiplier);
  };
  speedDownBtn.addEventListener('click', () => {
    if (speedIndex > 0) { speedIndex--; refreshSpeed(); }
  });
  speedUpBtn.addEventListener('click', () => {
    if (speedIndex < SPEED_LEVELS.length - 1) { speedIndex++; refreshSpeed(); }
  });

  return {
    getBet: () => Number(select.value),
    setBalance: (balance) => { balanceEl.textContent = String(balance); },
    setBusy: (busy) => {
      spinBtn.disabled = busy;
      select.disabled = busy;
      spinBtn.textContent = busy ? 'SPINNING…' : 'SPIN';
      // Speed buttons stay enabled mid-spin so the player can adjust live.
      // Re-evaluate the clamp-disabled state.
      speedDownBtn.disabled = speedIndex === 0;
      speedUpBtn.disabled = speedIndex === SPEED_LEVELS.length - 1;
    },
    setWinText: (text) => { winEl.textContent = text; },
    onSpin: (handler) => { spinHandler = handler; },
    onSpeedChange: (handler) => {
      speedHandler = handler;
      refreshSpeed(); // fire once with the default
    },
  };
}

// Renders the paytable from config data as an HTML string injected into #paytable.
function renderPaytableHtml(): string {
  const rows: string[] = [];
  for (const id of SYMBOL_IDS) {
    const s = SYMBOLS[id];
    if (s.isWild) {
      rows.push(`<div><b style="color:#${s.color.toString(16).padStart(6, '0')}">${s.label}</b> — substitutes for any symbol</div>`);
    } else {
      rows.push(`<div><b style="color:#${s.color.toString(16).padStart(6, '0')}">${s.label}</b> — x3 ${s.pays[0]} / x4 ${s.pays[1]} / x5 ${s.pays[2]}</div>`);
    }
  }
  rows.push(`<div style="margin-top:6px;">${PAYLINES.length} paylines · left-to-right · highest pays</div>`);
  return rows.join('');
}
