// Top-level orchestrator. Owns the PixiJS Application and threads:
//   user clicks SPIN → controls.setBusy(true) → reelSet.startSpin()
//   → server response → reelSet.stopAt(stops) → winPresenter.show(wins)
//   → controls.setBusy(false)

import { Application, Container } from 'pixi.js';
import { ROW_COUNT, REEL_COUNT } from '../config/constants';
import * as server from '../server/mockedServer';
import { bindControls, Controls } from './BetSelector';
import { bindDebugPanel } from './DebugPanel';
import { ReelSet } from './ReelSet';
import { buildSymbolTextures } from './SymbolTextures';
import { WinPresenter } from './WinPresenter';

const SYMBOL_SIZE = 240;

export class Game {
  private readonly app: Application;
  private reelSet!: ReelSet;
  private winPresenter!: WinPresenter;
  private controls!: Controls;
  private busy = false;

  constructor(parentEl: HTMLElement) {
    const widthPx = REEL_COUNT * SYMBOL_SIZE + (REEL_COUNT - 1) * 8 + 14 * 2;
    const heightPx = ROW_COUNT * SYMBOL_SIZE + 14 * 2;


    this.app = new Application({
      width: widthPx,
      height: heightPx,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    parentEl.appendChild(this.app.view as HTMLCanvasElement);
  }

  async start(): Promise<void> {
    const info = server.getReelInfo();
    const textures = buildSymbolTextures(this.app, SYMBOL_SIZE);

    this.reelSet = new ReelSet({
      app: this.app,
      reelStrips: info.reels,
      textures,
      symbolSize: SYMBOL_SIZE,
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

    bindDebugPanel(info, server.setForceStops);
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
