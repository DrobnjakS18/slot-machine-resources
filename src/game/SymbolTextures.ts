import { Application, Container, Graphics, Renderer, RenderTexture, Text, TextStyle, Texture } from 'pixi.js';
import { SYMBOLS, SYMBOL_IDS, SymbolId } from '../config/symbols';

export type SymbolTextureMap = Record<SymbolId, Texture>;

// Generates a RenderTexture for every symbol at the given size and returns the map.
export function buildSymbolTextures(app: Application, symbolSize: number): SymbolTextureMap {
  const map = {} as SymbolTextureMap;
  for (const id of SYMBOL_IDS) {
    map[id] = renderOne(app.renderer as Renderer, SYMBOLS[id], symbolSize);
  }
  return map;
}

// Draws one symbol card (rounded rect + highlight + label) into a RenderTexture.
function renderOne(renderer: Renderer, meta: typeof SYMBOLS[SymbolId], size: number): Texture {
  const container = new Container();
  // debugger

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
