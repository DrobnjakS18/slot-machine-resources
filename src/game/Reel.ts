// State machine: idle → accelerating → cruising → decelerating → bouncing → idle.
//   decelerate: slides past landing by DECEL_OVERSHOOT_ROWS
//   bounce: backOut curve walks back, briefly overshooting in reverse
//
// position: float index into reelstrip. Integer = symbol at row 0; fractional = scroll progress.
//
// rowCount + 2 sprite slots (one buffer above, one below); textures swapped each frame.

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { SymbolId } from '../config/symbols';
import { SymbolTextureMap } from './SymbolTextures';

type ReelState = 'idle' | 'accelerating' | 'cruising' | 'decelerating' | 'bouncing';

const CRUISE_SPEED = 32;            // rows per second during cruise
const ACCEL_TIME = 0.22;            // seconds
const MIN_CRUISE_TIME = 0.35;       // minimum cruise before a stop is accepted
const DECEL_TIME = 0.55;            // seconds
const DECEL_OVERSHOOT_ROWS = 0.55;  // reel slides this far PAST its landing during decel
const BOUNCE_TIME = 0.36;           // seconds
const BOUNCE_BACK_S = 3.0;          // backOut easing overshoot intensity
const MIN_SPIN_ROWS = 18;           // minimum total rows traveled per spin

// backOut(t): eases 0→past 1→1. Used in reverse: reel slides back from overshoot,
// briefly passing the landing target before settling.
function backOut(t: number, s: number): number {
  return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
}

export class Reel {
  readonly container: Container;
  readonly reelIndex: number;
  private readonly strip: SymbolId[];
  private readonly textures: SymbolTextureMap;
  private readonly symbolSize: number;
  private readonly rowCount: number;

  private readonly sprites: Sprite[] = [];
  private position = 0;
  private velocity = 0;
  private state: ReelState = 'idle';

  private tweenT = 0;
  private tweenDuration = 0;
  private tweenFromPos = 0;
  private tweenToPos = 0;
  private landingTarget = 0;        // the position the reel must settle on (no overshoot)
  private cruiseElapsed = 0;
  private pendingStop: number | null = null;

  private resolveStop: (() => void) | null = null;

  constructor(args: {
    reelIndex: number;
    strip: SymbolId[];
    textures: SymbolTextureMap;
    symbolSize: number;
    rowCount: number;
    initialStop: number;
  }) {
    this.reelIndex = args.reelIndex;
    this.strip = args.strip;
    this.textures = args.textures;
    this.symbolSize = args.symbolSize;
    this.rowCount = args.rowCount;
    this.position = args.initialStop;

    this.container = new Container();
    // Clip to play window so buffer sprites above/below stay hidden.
    const mask = new Graphics();
    mask.beginFill(0xffffff);
    mask.drawRect(0, 0, this.symbolSize, this.symbolSize * this.rowCount);
    mask.endFill();
    this.container.addChild(mask);
    this.container.mask = mask;

    for (let i = 0; i < this.rowCount + 2; i++) {
      const s = new Sprite(Texture.EMPTY);
      s.width = this.symbolSize;
      s.height = this.symbolSize;
      s.x = 0;
      this.container.addChild(s);
      this.sprites.push(s);
    }

    this.refreshSprites();
  }

  get isIdle(): boolean {
    return this.state === 'idle';
  }

  startSpin(): void {
    if (this.state !== 'idle') return;
    this.pendingStop = null;
    this.state = 'accelerating';
    this.velocity = 0;
    this.tweenT = 0;
    this.tweenDuration = ACCEL_TIME;
    this.cruiseElapsed = 0;
  }

  requestStop(finalStop: number): Promise<void> {
    this.pendingStop = finalStop;
    return new Promise((resolve) => {
      this.resolveStop = resolve;
    });
  }

  // deltaTime in seconds
  update(deltaTime: number): void {
    switch (this.state) {
      case 'idle':
        return;

      case 'accelerating': {
        this.tweenT += deltaTime;
        const t = Math.min(1, this.tweenT / this.tweenDuration);
        this.velocity = CRUISE_SPEED * (t * t);
        this.position += this.velocity * deltaTime;
        if (t >= 1) {
          this.state = 'cruising';
          this.velocity = CRUISE_SPEED;
        }
        break;
      }

      case 'cruising': {
        this.position += this.velocity * deltaTime;
        this.cruiseElapsed += deltaTime;
        // Begin deceleration as soon as we've cruised long enough AND have a target.
        if (this.cruiseElapsed >= MIN_CRUISE_TIME && this.pendingStop !== null) {
          this.beginDeceleration(this.pendingStop);
        }
        break;
      }

      case 'decelerating': {
        this.tweenT += deltaTime;
        const t = Math.min(1, this.tweenT / this.tweenDuration);
        const eased = 1 - Math.pow(1 - t, 3);
        this.position = this.tweenFromPos + (this.tweenToPos - this.tweenFromPos) * eased;
        if (t >= 1) {
          this.state = 'bouncing';
          this.tweenT = 0;
          this.tweenDuration = BOUNCE_TIME;
          this.tweenFromPos = this.tweenToPos;
          this.tweenToPos = this.landingTarget;
        }
        break;
      }

      case 'bouncing': {
        this.tweenT += deltaTime;
        const t = Math.min(1, this.tweenT / this.tweenDuration);
        const eased = backOut(t, BOUNCE_BACK_S);
        this.position = this.tweenFromPos + (this.tweenToPos - this.tweenFromPos) * eased;
        if (t >= 1) {
          this.position = this.landingTarget; // clamp to exact integer landing
          this.state = 'idle';
          this.velocity = 0;
          const r = this.resolveStop;
          this.resolveStop = null;
          if (r) r();
        }
        break;
      }
    }
    this.refreshSprites();
  }

  // Landing target: next position >= current + MIN_SPIN_ROWS congruent to finalStop mod stripLen.
  private beginDeceleration(finalStop: number): void {
    const stripLen = this.strip.length;
    const current = this.position;
    // Find the next position >= current + MIN_SPIN_ROWS that is congruent to finalStop mod stripLen.
    let target = Math.ceil(current + MIN_SPIN_ROWS);
    const targetMod = ((target % stripLen) + stripLen) % stripLen;
    const delta = ((finalStop - targetMod) % stripLen + stripLen) % stripLen;
    target += delta;

    this.state = 'decelerating';
    this.tweenT = 0;
    this.tweenDuration = DECEL_TIME;
    this.tweenFromPos = current;
    this.landingTarget = target;
    this.tweenToPos = target + DECEL_OVERSHOOT_ROWS;
  }

  // Slot 0 is the buffer above row 0 (offsetFromTop = -1).
  // frac scrolls everything downward as position advances.
  private refreshSprites(): void {
    const stripLen = this.strip.length;
    const intPos = Math.floor(this.position);
    const frac = this.position - intPos;
    for (let i = 0; i < this.sprites.length; i++) {
      const offsetFromTop = i - 1; // slot 0 is above row 0 → offset -1
      const stripIndex = ((intPos + offsetFromTop) % stripLen + stripLen) % stripLen;
      const symbol = this.strip[stripIndex];
      const sprite = this.sprites[i];
      const tex = this.textures[symbol];
      if (sprite.texture !== tex) sprite.texture = tex;
      sprite.y = (offsetFromTop - frac) * this.symbolSize;
    }
  }
}
