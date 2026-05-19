// Debug panel — five number inputs that force the next spin's stops.
// Wires into mockedServer.setForceStops via the supplied callback.

import { REEL_COUNT } from '../config/constants';
import { ReelInfo } from '../server/mockedServer';
import { RngOverride } from '../server/rng';

export function bindDebugPanel(info: ReelInfo, setForceStops: (fn: RngOverride | null) => void): void {
  const toggle = document.getElementById('debug-toggle') as HTMLInputElement;
  const grid = document.getElementById('debug-stops') as HTMLDivElement;

  const inputs: HTMLInputElement[] = [];
  for (let r = 0; r < REEL_COUNT; r++) {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = String(info.reels[r].length - 1);
    input.placeholder = `r${r + 1}`;
    input.title = `Stop for reel ${r + 1} (0..${info.reels[r].length - 1})`;
    grid.appendChild(input);
    inputs.push(input);
  }

  const apply = () => {
    if (!toggle.checked) { setForceStops(null); return; }
    setForceStops((reelIndex) => {
      const v = inputs[reelIndex].value.trim();
      if (v === '') return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n >= info.reels[reelIndex].length) return null;
      return n;
    });
  };

  toggle.addEventListener('change', apply);
  for (const input of inputs) input.addEventListener('input', apply);
}
