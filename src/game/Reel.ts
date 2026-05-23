// Single reel: rendering + spin lifecycle.
//
// State machine: idle → accelerating → cruising → decelerating → bouncing → idle.
//   accelerate: velocity tweens 0 → cruiseSpeed (rows/sec) over accelTime
//   cruise:     constant velocity until requestStop(stopIndex) called
//   decelerate: position eases past the landing target by DECEL_OVERSHOOT_ROWS,
//               so the reel visibly slides past where it'll come to rest
//   bounce:     position eases back to the landing target using a backOut curve
//               that briefly overshoots in the opposite direction (a damped wobble),
//               giving the mechanical-reel "thunk" the brief asks for
//
// `position` is a continuous float index into the reelstrip.
//   Integer part === the symbol currently at row 0 (top of visible window).
//   Fractional part === how far it has scrolled downward toward the next stop.
//
// Sprites are reused: there are rowCount + 2 sprite slots (one buffer top, one
// bottom). Each frame we update each slot's texture from the reelstrip and
// position it relative to `position`. No splice or rebuild — just texture swaps.

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { SymbolId } from '../config/symbols';
import { SymbolTextureMap } from './SymbolTextures';

type ReelState = 'idle' | 'accelerating' | 'cruising' | 'decelerating' | 'bouncing';

const CRUISE_SPEED = 32;            // rows per second during cruise
const ACCEL_TIME = 0.22;            // seconds, 0 → cruise
const MIN_CRUISE_TIME = 0;          // reels respond to stop immediately; MIN_SPIN_ROWS guarantees min travel
const DECEL_TIME = 0.55;            // seconds for the deceleration tween
const DECEL_OVERSHOOT_ROWS = 0.55;  // reel slides this far PAST its landing during decel
const BOUNCE_TIME = 0.36;           // seconds for the bounce-back tween
const BOUNCE_BACK_S = 3.0;          // backOut overshoot intensity for the secondary wobble
const MIN_SPIN_ROWS = 18;           // minimum total rows traveled per spin

// Quintessential "back.out" easing — eases from 0 to 1 but overshoots past 1
// before settling. Used in reverse here: the reel is sliding BACK from the
// overshoot toward the landing target, and this curve makes it briefly pass
// the target in the upward direction before settling.
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

  // Tween scratch.
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
    // Clip the reel to the 3-row play window so the buffer sprites above and
    // below stay hidden and never bleed into adjacent reels. A Graphics rect is
    // an axis-aligned scissor/stencil mask — pixel-perfect and cheaper than an
    // alpha (Sprite) mask.
    const mask = new Graphics();
    mask.beginFill(0xffffff);
    mask.drawRect(0, 0, this.symbolSize, this.symbolSize * this.rowCount);
    mask.endFill();
    this.container.addChild(mask);
    this.container.mask = mask;

    // Create rowCount + 2 sprite slots.
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

  // Transitions from idle to accelerating; no-op if already spinning.
  startSpin(): void {
    if (this.state !== 'idle') return;
    this.state = 'accelerating';
    this.velocity = 0;
    this.tweenT = 0;
    this.tweenDuration = ACCEL_TIME;
    this.cruiseElapsed = 0;
  }

  // Returns a promise that resolves when the reel comes to rest at `finalStop`.
  requestStop(finalStop: number): Promise<void> {
    this.pendingStop = finalStop;
    return new Promise((resolve) => {
      this.resolveStop = resolve;
    });
  }

  // Called by the orchestrator each tick. dt in seconds.
  update(dt: number): void {
    switch (this.state) {
      case 'idle':
        return;

      case 'accelerating': {
        this.tweenT += dt;
        const t = Math.min(1, this.tweenT / this.tweenDuration);
        // easeIn (quad) gives the reel a satisfying kick.
        this.velocity = CRUISE_SPEED * (t * t);
        this.position += this.velocity * dt;
        if (t >= 1) {
          this.state = 'cruising';
          this.velocity = CRUISE_SPEED;
        }
        break;
      }

      case 'cruising': {
        this.position += this.velocity * dt;
        this.cruiseElapsed += dt;
        // Begin deceleration as soon as we've cruised long enough AND have a target.
        if (this.cruiseElapsed >= MIN_CRUISE_TIME && this.pendingStop !== null) {
          this.beginDeceleration(this.pendingStop);
        }
        break;
      }

      case 'decelerating': {
        this.tweenT += dt;
        const t = Math.min(1, this.tweenT / this.tweenDuration);
        // easeOutCubic — strong start, soft landing. tweenToPos is the landing
        // target PLUS DECEL_OVERSHOOT_ROWS, so the reel slides visibly past
        // where it'll come to rest.
        const eased = 1 - Math.pow(1 - t, 3);
        this.position = this.tweenFromPos + (this.tweenToPos - this.tweenFromPos) * eased;
        if (t >= 1) {
          // Begin bounce-back from the overshoot position toward the landing target.
          this.state = 'bouncing';
          this.tweenT = 0;
          this.tweenDuration = BOUNCE_TIME;
          this.tweenFromPos = this.tweenToPos;        // sitting at overshoot
          this.tweenToPos = this.landingTarget;       // settle exactly here
        }
        break;
      }

      case 'bouncing': {
        this.tweenT += dt;
        const t = Math.min(1, this.tweenT / this.tweenDuration);
        // backOut goes 0 → past 1 → 1, so applied to a from→to range it briefly
        // overshoots `to` in the opposite direction of travel and settles.
        // Here travel direction is upward (back toward landing), so the secondary
        // overshoot dips the position briefly BELOW landingTarget — exactly the
        // mechanical "thunk-and-wobble" feel.
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

  // Compute the landing target so that, when the spin finally settles,
  //   position === finalStop (mod stripLength).
  // Also ensure we travel at least MIN_SPIN_ROWS rows from the current position,
  // so the player always sees a satisfying spin even on rapid back-to-back stops.
  //
  // The deceleration tween runs PAST the landing target by DECEL_OVERSHOOT_ROWS;
  // the subsequent bounce phase walks back to landingTarget. Splitting the two
  // gives a visible "overshoot then snap back" rather than a single dead stop.
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

  // Position every sprite slot based on the current `position`.
  // Slot 0 is the buffer ABOVE the play window; slot rowCount+1 is the buffer below.
  // The strip texture in each slot is computed by adding the slot's row offset
  // to the integer part of `position`, modulo strip length.
  private refreshSprites(): void {
    const stripLen = this.strip.length;
    const intPos = Math.floor(this.position);
    const frac = this.position - intPos;
    for (let i = 0; i < this.sprites.length; i++) {
      const offsetFromTop = i - 1; // slot 0 is above row 0 → offset -1
      // Reversed strip reading: row 0 = strip[intPos], row 1 = strip[intPos-1], ...
      // The buffer slot above (offset -1) shows strip[intPos+1] — the next symbol
      // to enter from the top as position advances.
      const stripIndex = ((intPos - offsetFromTop) % stripLen + stripLen) % stripLen;
      const symbol = this.strip[stripIndex];
      const sprite = this.sprites[i];
      const tex = this.textures[symbol];
      if (sprite.texture !== tex) sprite.texture = tex;
      // Sprites move downward as position advances (frac increases toward 1).
      sprite.y = (offsetFromTop + frac) * this.symbolSize;
    }
  }
}
