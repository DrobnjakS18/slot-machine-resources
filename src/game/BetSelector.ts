import { BET_VALUES, DEFAULT_SPEED_INDEX, SPEED_LEVELS, STARTING_BALANCE } from '../config/constants';
import { PAYLINES } from '../config/paylines';
import { SYMBOLS, SYMBOL_IDS } from '../config/symbols';

export type Controls = {
  getBet(): number;
  setBalance(balance: number, celebrate?: boolean): void;
  setBusy(busy: boolean): void;
  setWinText(text: string): void;
  setLastWin(amount: number): void;
  onSpin(handler: () => void): void;
  onSpeedChange(handler: (multiplier: number) => void): void;
};

// Wires all HTML controls and returns a Controls interface
export function bindControls(): Controls {
  const betDownBtn = document.getElementById('bet-down-btn') as HTMLButtonElement;
  const betUpBtn = document.getElementById('bet-up-btn') as HTMLButtonElement;
  const betLabelBtn = document.getElementById('bet-label-btn') as HTMLButtonElement;
  const betLabelEl = document.getElementById('bet-label') as HTMLSpanElement;
  const betPopupOverlay = document.getElementById('bet-popup-overlay') as HTMLDivElement;
  const betPopupGrid = document.getElementById('bet-popup-grid') as HTMLDivElement;
  const betPopupClose = document.getElementById('bet-popup-close') as HTMLButtonElement;

  const spinBtn = document.getElementById('spin-btn') as HTMLButtonElement;
  const balanceEl = document.getElementById('balance') as HTMLDivElement;
  const winEl = document.getElementById('win-text') as HTMLDivElement;
  const paytableEl = document.getElementById('paytable') as HTMLDivElement;
  const lastWinEl = document.getElementById('last-win') as HTMLDivElement;

  let betIndex = 0;
  let betBusy = false;

  const refreshBet = () => {
    betLabelEl.textContent = String(BET_VALUES[betIndex]);
    betDownBtn.disabled = betBusy || betIndex === 0;
    betUpBtn.disabled = betBusy || betIndex === BET_VALUES.length - 1;
    betPopupGrid.querySelectorAll<HTMLButtonElement>('.bet-option-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === betIndex);
    });
  };

  const openBetPopup = () => { betPopupOverlay.classList.add('open'); };
  const closeBetPopup = () => { betPopupOverlay.classList.remove('open'); };

  // Populate popup grid from BET_VALUES.
  for (let i = 0; i < BET_VALUES.length; i++) {
    const btn = document.createElement('button');
    btn.className = 'bet-option-btn';
    btn.textContent = String(BET_VALUES[i]);
    btn.addEventListener('click', () => {
      if (betBusy) return;
      betIndex = i;
      refreshBet();
      closeBetPopup();
    });
    betPopupGrid.appendChild(btn);
  }

  betDownBtn.addEventListener('click', () => {
    if (!betBusy && betIndex > 0) { betIndex--; refreshBet(); }
  });
  betUpBtn.addEventListener('click', () => {
    if (!betBusy && betIndex < BET_VALUES.length - 1) { betIndex++; refreshBet(); }
  });
  betLabelBtn.addEventListener('click', () => { if (!betBusy) openBetPopup(); });
  betPopupClose.addEventListener('click', closeBetPopup);
  betPopupOverlay.addEventListener('click', (e) => {
    if (e.target === betPopupOverlay) closeBetPopup();
  });

  refreshBet();

  // Initial balance.
  balanceEl.textContent = String(STARTING_BALANCE);

  // Render paytable so the player knows what they're chasing.
  paytableEl.innerHTML = renderPaytableHtml();

  // Spin handler set by the Game class once it's ready; fires on spin button click or spacebar press.
  let spinHandler: (() => void) | null = null;
  spinBtn.addEventListener('click', () => spinHandler?.());
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !spinBtn.disabled && !betPopupOverlay.classList.contains('open')) {
      e.preventDefault();
      spinHandler?.();
    }
  });

  const speedDownBtn = document.getElementById('speed-down-btn') as HTMLButtonElement;
  const speedUpBtn = document.getElementById('speed-up-btn') as HTMLButtonElement;
  const speedLabelEl = document.getElementById('speed-label') as HTMLSpanElement;
  let speedIndex = DEFAULT_SPEED_INDEX;
  let speedHandler: ((m: number) => void) | null = null;

  const refreshSpeed = () => {
    const level = SPEED_LEVELS[speedIndex];
    speedLabelEl.textContent = level.label;
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
    getBet: () => BET_VALUES[betIndex],
    setBalance: (balance, celebrate) => {
      balanceEl.textContent = String(balance);
      if (celebrate) {
        balanceEl.classList.remove('pop');
        void balanceEl.offsetWidth;
        balanceEl.classList.add('pop');
      }
    },
    setBusy: (busy) => {
      betBusy = busy;
      spinBtn.disabled = busy;
      betLabelBtn.disabled = busy;
      betDownBtn.disabled = busy || betIndex === 0;
      betUpBtn.disabled = busy || betIndex === BET_VALUES.length - 1;
      spinBtn.textContent = busy ? 'SPINNING…' : 'SPIN';
      speedDownBtn.disabled = busy || speedIndex === 0;
      speedUpBtn.disabled = busy || speedIndex === SPEED_LEVELS.length - 1;
    },
    setWinText: (text) => {
      const isError = text === 'Low balance' || text === 'Server error';
      const isEmpty = text === '';
      winEl.classList.toggle('error', isError);
      if (isEmpty) {
        winEl.textContent = text;
      } else if (isError) {
        winEl.innerHTML = `<span class="win-label">&nbsp;</span><span class="win-amount error">${text}</span>`;
      } else {
        winEl.innerHTML = `<span class="win-label">win</span><span class="win-amount">${text}</span>`;
      }
    },
    setLastWin: (amount) => {
      lastWinEl.textContent = `Last win  ${amount}`;
    },
    onSpin: (handler) => { spinHandler = handler; },
    onSpeedChange: (handler) => {
      speedHandler = handler;
      refreshSpeed();
    },
  };
}

// Renders the paytable from config data and injects into #paytable.
function renderPaytableHtml(): string {
  const rows: string[] = [];

  // Wild symbol section
  const wild = SYMBOLS[SYMBOL_IDS.find((id) => SYMBOLS[id].isWild)!];
  rows.push(
    `<div class="paytable-wild">` +
    `<span class="wild-label" style="color:#${wild.color.toString(16).padStart(6, '0')}">WILD</span>` +
    `<span class="wild-desc">Substitutes for any symbol</span>` +
    `</div>`
  );

  // Table header
  rows.push(`<div class="paytable-table">`);
  rows.push(
    `<div class="paytable-header">` +
    `<span class="col-symbol">Symbol</span>` +
    `<span class="col-pay">3×</span>` +
    `<span class="col-pay">4×</span>` +
    `<span class="col-pay">5×</span>` +
    `<span class="col-pay">6×</span>` +
    `</div>`
  );

  // Symbol rows
  for (const id of SYMBOL_IDS) {
    const s = SYMBOLS[id];
    if (!s.isWild) {
      rows.push(
        `<div class="paytable-row">` +
        `<span class="col-symbol" style="color:#${s.color.toString(16).padStart(6, '0')}"><b>${s.label}</b></span>` +
        `<span class="col-pay">${s.pays[0]}</span>` +
        `<span class="col-pay">${s.pays[1]}</span>` +
        `<span class="col-pay">${s.pays[2]}</span>` +
        `<span class="col-pay">${s.pays[3]}</span>` +
        `</div>`
      );
    }
  }
  rows.push(`</div>`);

  // Footer
  rows.push(`<div class="paytable-footer">${PAYLINES.length} paylines · left-to-right</div>`);
  return rows.join('');
}
