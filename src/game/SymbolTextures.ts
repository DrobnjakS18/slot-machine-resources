import {
  Application,
  Container,
  Graphics,
  Renderer,
  RenderTexture,
  Text,
  TextStyle,
  Texture,
} from "pixi.js";
import { SYMBOLS, SYMBOL_IDS, SymbolId } from "../config/symbols";

export type SymbolTextureMap = Record<SymbolId, Texture>;

// Generates a RenderTexture for every symbol at the given size and returns the map.
export function buildSymbolTextures(
  app: Application,
  symbolSize: number,
): SymbolTextureMap {
  const map = {} as SymbolTextureMap;
  for (const id of SYMBOL_IDS) {
    map[id] = renderOne(app.renderer as Renderer, SYMBOLS[id], symbolSize);
  }
  return map;
}

// Draws one symbol card into a RenderTexture.
function renderOne(
  renderer: Renderer,
  meta: (typeof SYMBOLS)[SymbolId],
  size: number,
): Texture {
  const container = new Container();

  const radius = size * 0.14;
  const cardMargin = size * 0.06;
  const w = size - cardMargin * 2;
  const h = size - cardMargin * 2;

  // Main card fill.
  const card = new Graphics();
  card.lineStyle({ width: 2, color: 0x000000, alpha: 0.85 });
  card.beginFill(meta.color);
  card.drawRoundedRect(cardMargin, cardMargin, w, h, radius);
  card.endFill();

  // Top highlight (light source from top-left).
  const highlight = new Graphics();
  highlight.beginFill(0xffffff, 0.24);
  highlight.drawRoundedRect(
    cardMargin + 3,
    cardMargin + 3,
    w - 6,
    h * 0.42,
    radius,
  );
  highlight.endFill();

  // Bottom half darkened for a beveled look.
  const bevel = new Graphics();
  bevel.beginFill(0x000000, 0.22);
  bevel.drawRoundedRect(cardMargin, cardMargin + h * 0.52, w, h * 0.48, radius);
  bevel.endFill();

  // Label
  const isMultiChar = !meta.isWild && meta.label.length > 1;
  const fontSize = meta.isWild
    ? size * 0.22
    : isMultiChar
      ? size * 0.34
      : size * 0.42;

  const style = new TextStyle({
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize,
    fontWeight: "700",
    fill: meta.textColor,
    stroke: 0x000000,
    strokeThickness: meta.isWild ? 1 : 3,
    align: "center",
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowAlpha: 0.55,
    dropShadowDistance: 2,
    dropShadowAngle: Math.PI / 3,
    dropShadowBlur: 2,
  });

  // Label positioning to the center
  const label = new Text(meta.label, style);
  label.anchor.set(0.5, 0.5);
  label.x = size / 2;
  label.y = size * 0.47;
  
  container.addChild(card, bevel, highlight, label);

  // Bake container into GPU texture
  const rt = RenderTexture.create({
    width: size,
    height: size,
    resolution: window.devicePixelRatio || 1,
  });
  renderer.render(container, { renderTexture: rt });
  container.destroy({ children: true });
  return rt;
}
