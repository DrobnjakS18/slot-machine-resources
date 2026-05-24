// Highlights winning cells and draws the payline path on top of the reel set.
// Pulses on/off so the player can absorb multiple coinciding wins one by one,

import { Container, Graphics, Ticker } from 'pixi.js';
import { Win } from '../server/evaluator';
import { ReelSet } from './ReelSet';

const PULSE_PERIOD_MS = 900;

export class WinPresenter {
  readonly container: Container;
  private readonly reelSet: ReelSet;
  private readonly ticker: Ticker;
  private wins: Win[] = [];
  private overlay: Graphics;
  private elapsedMs = 0;

  constructor(args: { reelSet: ReelSet; ticker: Ticker }) {
    this.reelSet = args.reelSet;
    this.ticker = args.ticker;
    this.container = new Container();
    this.overlay = new Graphics();
    this.container.addChild(this.overlay);
    this.ticker.add(this.tick, this);
  }

  // Stores the win list and starts the pulse animation from the beginning.
  show(wins: Win[]): void {
    this.wins = wins;
    this.elapsedMs = 0;
    this.redraw(1);
  }

  clear(): void {
    this.wins = [];
    this.overlay.clear();
  }

  private tick(): void {
    if (this.wins.length === 0) return;
    this.elapsedMs += this.ticker.deltaMS;
    const phase = (this.elapsedMs % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
    // 0 → 1 → 0 sine wave gives a smooth pulse.
    const intensity = 0.45 + 0.55 * Math.sin(phase * Math.PI);
    this.redraw(intensity);
  }

  // Draws cell highlight rects and connecting payline paths at the given alpha intensity.
  private redraw(intensity: number): void {
    this.overlay.clear();
    for (const win of this.wins) {
      // Filled cell highlight (pulses in and out).
      for (const [r, row] of win.positions) {
        const c = this.reelSet.cellPosition(r, row);
        this.overlay.lineStyle({ width: 3, color: win.paylineColor, alpha: intensity });
        this.overlay.beginFill(win.paylineColor, intensity * 0.28);
        this.overlay.drawRoundedRect(c.x + 2, c.y + 2, c.size - 4, c.size - 4, 8);
        this.overlay.endFill();
      }
      // Connecting payline through cell centers.
      this.overlay.lineStyle({ width: 3, color: win.paylineColor, alpha: intensity * 0.9 });
      let started = false;
      for (const [r, row] of win.positions) {
        const c = this.reelSet.cellPosition(r, row);
        const cx = c.x + c.size / 2;
        const cy = c.y + c.size / 2;
        if (!started) { this.overlay.moveTo(cx, cy); started = true; }
        else this.overlay.lineTo(cx, cy);
      }
    }
  }
}
