// Procedurally generated symbol textures.
//
// The brief says graphics aren't judged and explicitly allows AI-found graphics,
// but procedural textures keep the build dependency-free and let us regenerate
// them at any resolution. Each symbol is a rounded card with a centered label.

import { Application, Container, Graphics, Renderer, RenderTexture, Text, TextStyle, Texture } from 'pixi.js';
import { SYMBOLS, SYMBOL_IDS, SymbolId } from '../config/symbols';

export type SymbolTextureMap = Record<SymbolId, Texture>;

export function buildSymbolTextures(app: Application, symbolSize: number): SymbolTextureMap {
  const map = {} as SymbolTextureMap;
  for (const id of SYMBOL_IDS) {
    map[id] = renderOne(app.renderer as Renderer, SYMBOLS[id], symbolSize);
  }
  return map;
}

function renderOne(renderer: Renderer, meta: typeof SYMBOLS[SymbolId], size: number): Texture {
  const container = new Container();

  const radius = size * 0.12;
  const inset = size * 0.06;

  // Outer card with a subtle border.
  const card = new Graphics();
  card.lineStyle({ width: 3, color: 0x0b0f17, alpha: 0.6 });
  card.beginFill(meta.color);
  card.drawRoundedRect(inset, inset, size - inset * 2, size - inset * 2, radius);
  card.endFill();

  // Inner highlight to give the card some depth.
  const highlight = new Graphics();
  highlight.beginFill(0xffffff, 0.18);
  highlight.drawRoundedRect(inset + 4, inset + 4, size - inset * 2 - 8, (size - inset * 2 - 8) * 0.45, radius);
  highlight.endFill();

  container.addChild(card, highlight);

  // Label.
  const style = new TextStyle({
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: meta.isWild ? size * 0.22 : size * 0.42,
    fontWeight: '700',
    fill: meta.textColor,
    stroke: 0x000000,
    strokeThickness: 2,
    align: 'center',
  });
  const label = new Text(meta.label, style);
  label.anchor.set(0.5);
  label.x = size / 2;
  label.y = size / 2;
  container.addChild(label);

  const rt = RenderTexture.create({ width: size, height: size, resolution: window.devicePixelRatio || 1 });
  renderer.render(container, { renderTexture: rt });
  container.destroy({ children: true });
  return rt;
}
