// State machine: idle → accel → cruise → decel (overshoots) → bounce (backOut) → idle.
// position: float reelstrip index; integer = symbol at row 0. rowCount+2 sprite slots, textures swapped per frame.

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { SymbolId } from '../config/symbols';
import { SymbolTextureMap } from './SymbolTextures';

type ReelState = 'idle' | 'accelerating' | 'cruising' | 'decelerating' | 'bouncing';

const CRUISE_SPEED = 32;            // rows/sec
const ACCEL_TIME = 0.22;
const MIN_CRUISE_TIME = 0.35;       // must cruise this long before accepting a stop
const DECEL_TIME = 0.55;
const DECEL_OVERSHOOT_ROWS = 0.55;  // slides past landing before bounce pulls back
const BOUNCE_TIME = 0.36;
const BOUNCE_BACK_S = 3.0;          // backOut overshoot intensity
const MIN_SPIN_ROWS = 18;           // min travel per spin

// eases 0→overshoot→1; applied from overshoot back to landing for the mechanical thunk.
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
  private landingTarget = 0;
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
  startSpin(): void {
    if (this.state !== 'idle') return;
    if (this.resolveStop === null) this.pendingStop = null;
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
        // start decel once cruised long enough and target known
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
          this.position = this.landingTarget;
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

  // Finds next position >= current+MIN_SPIN_ROWS that lands on finalStop mod stripLen.
  private beginDeceleration(finalStop: number): void {
    const stripLen = this.strip.length;
    const current = this.position;
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

  // Slot 0 is buffer above row 0; frac shifts sprites downward as position advances.
  private refreshSprites(): void {
    const stripLen = this.strip.length;
    const intPos = Math.floor(this.position);
    const frac = this.position - intPos;
    for (let i = 0; i < this.sprites.length; i++) {
      const offsetFromTop = i - 1; // slot 0 → offset -1 (above row 0)
      const stripIndex = ((intPos + offsetFromTop) % stripLen + stripLen) % stripLen;
      const symbol = this.strip[stripIndex];
      const sprite = this.sprites[i];
      const tex = this.textures[symbol];
      if (sprite.texture !== tex) sprite.texture = tex;
      sprite.y = (offsetFromTop - frac) * this.symbolSize;
    }
  }
}
