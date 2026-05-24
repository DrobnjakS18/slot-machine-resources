import { Application, Container } from 'pixi.js';
import { REEL_COUNT, ROW_COUNT, GAP, PADDING } from '../config/constants';
import { computeSymbolSize } from './utils';
import * as server from '../server/mockedServer';
import { bindControls, Controls } from './BetSelector';
import { ReelSet } from './ReelSet';
import { buildSymbolTextures } from './SymbolTextures';
import { WinPresenter } from './WinPresenter';

export class Game {
  private readonly app: Application;
  private readonly responsiveSymbolSize: number;
  private readonly logicalW: number;
  private readonly logicalH: number;
  private reelSet!: ReelSet;
  private winPresenter!: WinPresenter;
  private controls!: Controls;
  private busy = false;

  constructor(parentEl: HTMLElement) {
    const wrap = parentEl.parentElement ?? parentEl;
    this.responsiveSymbolSize = computeSymbolSize(wrap);
    this.logicalW = REEL_COUNT * this.responsiveSymbolSize + (REEL_COUNT - 1) * GAP + PADDING * 2;
    this.logicalH = ROW_COUNT  * this.responsiveSymbolSize + PADDING * 2;

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
    const textures = buildSymbolTextures(this.app, this.responsiveSymbolSize);

    this.reelSet = new ReelSet({
      app: this.app,
      reelStrips: info.reels,
      textures,
      symbolSize: this.responsiveSymbolSize,
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

  // Visual spin and server call run in parallel; reels settle once the response lands.
  private async handleSpin(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.controls.setBusy(true);

    try {
      this.controls.setWinText('');
      this.winPresenter.clear();

      const bet = this.controls.getBet();

      // Client-side balance guard — avoids spinning the reels only to show an error.
      if (server.getBalance() < bet) {
        this.controls.setWinText('Low balance');
        return;
      }

      this.controls.setBalance(server.getBalance() - bet);

      // Spin starts immediately; server response arrives while reels are already cruising.
      this.reelSet.startSpin();

      let response;
      try {
        response = await server.getResponseData(bet);
      } catch (err) {
        await this.reelSet.stopAt(new Array(REEL_COUNT).fill(0));
        this.controls.setBalance(server.getBalance());
        this.controls.setWinText('Server error');
        return;
      }

      if (response.error) {
        await this.reelSet.stopAt(new Array(REEL_COUNT).fill(0));
        this.controls.setBalance(server.getBalance());
        this.controls.setWinText('Low balance');
        return;
      }

      await this.reelSet.stopAt(response.reelStops);

      if (response.totalWin > 0) {
        this.controls.setBalance(response.newBalance, true);
        this.controls.setWinText(String(response.totalWin));
        this.controls.setLastWin(response.totalWin);
        this.winPresenter.show(response.wins);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        this.controls.setBalance(response.newBalance);
        this.controls.setWinText('');
      }
    } catch (err) {
      console.error('Unhandled spin error:', err);
    } finally {
      this.busy = false;
      this.controls.setBusy(false);
    }
  }
}
