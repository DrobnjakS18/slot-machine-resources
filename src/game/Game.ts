import { Application, Container } from 'pixi.js';
import { ROW_COUNT, REEL_COUNT } from '../config/constants';
import * as server from '../server/mockedServer';
import { bindControls, Controls } from './BetSelector';
import { ReelSet } from './ReelSet';
import { buildSymbolTextures } from './SymbolTextures';
import { WinPresenter } from './WinPresenter';

const MAX_SYMBOL_SIZE = 240;
const GAP = 8;
const PADDING = 14;

function computeSymbolSize(wrap: HTMLElement): number {
  const availW = wrap.clientWidth  || window.innerWidth  * 0.65;
  const availH = wrap.clientHeight || window.innerHeight * 0.90;
  const fromW = Math.floor((availW - (REEL_COUNT - 1) * GAP - PADDING * 2) / REEL_COUNT);
  const fromH = Math.floor((availH - PADDING * 2) / ROW_COUNT);
  return Math.max(60, Math.min(MAX_SYMBOL_SIZE, fromW, fromH));
}

export class Game {
  private readonly app: Application;
  private readonly symbolSize: number;
  private readonly logicalW: number;
  private readonly logicalH: number;
  private reelSet!: ReelSet;
  private winPresenter!: WinPresenter;
  private controls!: Controls;
  private busy = false;

  constructor(parentEl: HTMLElement) {
    const wrap = parentEl.parentElement ?? parentEl;
    this.symbolSize = computeSymbolSize(wrap);
    this.logicalW = REEL_COUNT * this.symbolSize + (REEL_COUNT - 1) * GAP + PADDING * 2;
    this.logicalH = ROW_COUNT  * this.symbolSize + PADDING * 2;

    this.app = new Application({
      width: this.logicalW,
      height: this.logicalH,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    parentEl.appendChild(this.app.view as HTMLCanvasElement);

    this.fitToContainer(wrap);
    new ResizeObserver(() => this.fitToContainer(wrap)).observe(wrap);
  }

  private fitToContainer(wrap: HTMLElement): void {
    const availW = wrap.clientWidth;
    const availH = wrap.clientHeight;
    if (!availW || !availH) return;
    const scale = Math.min(1, availW / this.logicalW, availH / this.logicalH);
    this.app.renderer.resize(this.logicalW * scale, this.logicalH * scale);
    this.app.stage.scale.set(scale);
  }

  async start(): Promise<void> {
    const info = server.getReelInfo();
    const textures = buildSymbolTextures(this.app, this.symbolSize);

    this.reelSet = new ReelSet({
      app: this.app,
      reelStrips: info.reels,
      textures,
      symbolSize: this.symbolSize,
      initialStops: new Array(info.reelCount).fill(0),
    });

    this.winPresenter = new WinPresenter({ reelSet: this.reelSet, ticker: this.app.ticker });

    const root = new Container();
    root.addChild(this.reelSet.container, this.winPresenter.container);
    this.app.stage.addChild(root);

    this.controls = bindControls();
    this.controls.onSpin(() => this.handleSpin());
    this.controls.onSpeedChange((m) => this.reelSet.setSpeedMultiplier(m));
    this.controls.setBalance(server.getBalance());

  }

  private async handleSpin(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.controls.setBusy(true);
    this.controls.setWinText('');
    this.winPresenter.clear();

    const bet = this.controls.getBet();

    let response;
    try {
      response = await server.getResponseData(bet);
    } catch (err) {
      console.error(err);
      this.controls.setWinText('Server error');
      this.busy = false;
      this.controls.setBusy(false);
      return;
    }

    if(response.error === 'Insufficient balance') {
      this.controls.setWinText('Insufficient balance');
      this.busy = false;
      this.controls.setBusy(false);
      return;
    }

    // Kick off the visual spin AND fire the server call in parallel — the
    // animation will keep cruising until the response lands and we know where
    // to stop.
    this.reelSet.startSpin();

    if (response.error) {
      // Stop reels on whatever was showing before — pick stops [0,0,0,0,0] for simplicity.
      await this.reelSet.stopAt(new Array(REEL_COUNT).fill(0));
      this.controls.setWinText(response.error);
      this.busy = false;
      this.controls.setBusy(false);
      return;
    }

    await this.reelSet.stopAt(response.reelStops);

    this.controls.setBalance(response.newBalance);
    if (response.totalWin > 0) {
      const parts = response.wins.map((w) => `${w.paylineName}: ${w.count}× ${w.symbol} (${w.payout})`);
      this.controls.setWinText(`WIN ${response.totalWin} — ${parts.join(' · ')}`);
      this.winPresenter.show(response.wins);
    } else {
      this.controls.setWinText('No win');
    }

    this.busy = false;
    this.controls.setBusy(false);
  }
}
