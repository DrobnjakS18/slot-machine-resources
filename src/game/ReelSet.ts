// 5-reel orchestrator: wave-staggered start/stop, single shared ticker.

import { Application, Container, Graphics, Ticker } from 'pixi.js';
import { REEL_COUNT, ROW_COUNT } from '../config/constants';
import { SymbolId } from '../config/symbols';
import { Reel } from './Reel';
import { SymbolTextureMap } from './SymbolTextures';

const REEL_GAP = 8;
const FRAME_PAD = 14;
const START_STAGGER_MS = 80;
const STOP_STAGGER_MS = 300;

export class ReelSet {
  readonly container: Container;
  readonly symbolSize: number;

  private readonly reels: Reel[] = [];
  private readonly ticker: Ticker;
  private speedMultiplier = 1;
  private spinning = false;

  constructor(args: {
    app: Application;
    reelStrips: SymbolId[][];
    textures: SymbolTextureMap;
    symbolSize: number;
    initialStops: number[];
  }) {
    this.symbolSize = args.symbolSize;
    this.container = new Container();

    const frame = new Graphics();
    const innerW = REEL_COUNT * args.symbolSize + (REEL_COUNT - 1) * REEL_GAP;
    const innerH = ROW_COUNT * args.symbolSize;
    const totalW = innerW + FRAME_PAD * 2;
    const totalH = innerH + FRAME_PAD * 2;
    frame.lineStyle({ width: 3, color: 0xffd166, alpha: 0.85 });
    frame.beginFill(0x10162a);
    frame.drawRoundedRect(0, 0, totalW, totalH, 14);
    frame.endFill();
    this.container.addChild(frame);

    for (let r = 0; r < REEL_COUNT; r++) {
      const reel = new Reel({
        reelIndex: r,
        strip: args.reelStrips[r],
        textures: args.textures,
        symbolSize: args.symbolSize,
        rowCount: ROW_COUNT,
        initialStop: args.initialStops[r],
      });
      reel.container.x = FRAME_PAD + r * (args.symbolSize + REEL_GAP);
      reel.container.y = FRAME_PAD;
      this.container.addChild(reel.container);
      this.reels.push(reel);
    }

    this.ticker = args.app.ticker;
  }

  private tick(): void {
    const deltaTime = (this.ticker.deltaMS / 1000) * this.speedMultiplier;
    for (const reel of this.reels) reel.update(deltaTime);
  }

  // Speed multiplier affects spin speed and stagger timing 
  setSpeedMultiplier(m: number): void {
    if (!Number.isFinite(m) || m <= 0 || this.spinning) return;
    this.speedMultiplier = m;
  }
 
  async startSpin(): Promise<void> {
    this.spinning = true;
    this.ticker.add(this.tick, this);
    const stagger = START_STAGGER_MS / this.speedMultiplier;
    for (let i = 0; i < this.reels.length; i++) {
      const reel = this.reels[i];
      setTimeout(() => reel.startSpin(), i * stagger);
    }
  }

  // Resolves when all reels are at rest.
  async stopAt(stops: number[]): Promise<void> {
    if (stops.length !== this.reels.length) {
      throw new Error(`stopAt: expected ${this.reels.length} stops, got ${stops.length}`);
    }
    const stagger = this.speedMultiplier >= 4 ? 0 : STOP_STAGGER_MS / this.speedMultiplier;
    const promises: Promise<void>[] = [];
    for (let i = 0; i < this.reels.length; i++) {
      const reel = this.reels[i];
      const stop = stops[i];
      promises.push(
        new Promise<void>((resolve) => {
          setTimeout(() => {
            reel.requestStop(stop).then(resolve);
          }, i * stagger);
        }),
      );
    }
    await Promise.all(promises);
    this.ticker.remove(this.tick, this);
    this.spinning = false;
  }

  // For the WinPresenter to query absolute screen coords for a [reel, row] cell.
  cellPosition(reelIndex: number, rowIndex: number): { x: number; y: number; size: number } {
    return {
      x: FRAME_PAD + reelIndex * (this.symbolSize + REEL_GAP),
      y: FRAME_PAD + rowIndex * this.symbolSize,
      size: this.symbolSize,
    };
  }
}
