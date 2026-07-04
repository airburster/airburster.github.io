import { autoZoom, targetHit } from '../geometry';
import { C_GROUND, C_AIR, SIZE_LETTER } from '../constants';
import type { Cell, Params, ZMap, Target, GridView } from '../types';

export interface DrawGridArgs {
  canvas: HTMLCanvasElement;
  cells: Cell[];
  p: Params;
  zmap: ZMap;
  targets: Target[];
  selected: number;
  gridW: number;
  gridH: number;
}

// Top-down view. Returns the transform used, so the caller can hit-test clicks.
export function drawGrid(args: DrawGridArgs): GridView {
  const { canvas: c, cells, p, zmap, targets, selected, gridW, gridH } = args;
  const ctx = c.getContext('2d')!;
  const CELL = autoZoom(p, gridW, gridH);
  c.width = gridW;
  c.height = gridH;
  const W = c.width;
  const H = c.height;
  const bg = '#12151e';
  const grid = 'rgba(255,255,255,0.08)';
  const cast = '#e9ebf2';
  const ox = W / 2;
  const oy = H / 2;
  const gridView: GridView = { ox, oy, CELL };
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = grid;
  ctx.lineWidth = 0.5;
  const nx = Math.ceil(W / 2 / CELL) + 1;
  const ny = Math.ceil(H / 2 / CELL) + 1; // fill both axes
  for (let i = -nx; i <= nx; i++) {
    const x = ox + i * CELL;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let i = -ny; i <= ny; i++) {
    const y = oy + i * CELL;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (const cc of cells) {
    const sx = ox + cc.cx * CELL;
    const sy = oy - (cc.cy + 1) * CELL;
    ctx.globalAlpha = cc.hitsGround ? 0.75 : 0.45;
    ctx.fillStyle = cc.hitsGround ? C_GROUND : C_AIR;
    ctx.fillRect(sx + 0.5, sy + 0.5, CELL - 1, CELL - 1);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = cast;
  ctx.beginPath();
  ctx.arc(ox, oy, 3.5, 0, 7);
  ctx.fill();
  ctx.strokeStyle = cast;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ox - 6, oy);
  ctx.lineTo(ox + 6, oy);
  ctx.moveTo(ox, oy - 6);
  ctx.lineTo(ox, oy + 6);
  ctx.stroke();

  // Placed target cubes: coral when the effect catches their body, grey when clear.
  // Labelled with an automatic number (identity); size letter tucked in the corner.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  targets.forEach((t, ti) => {
    const hit = targetHit(t, zmap);
    const wh = t.n * CELL;
    const sx = ox + t.cx * CELL;
    const sy = oy - (t.cy + t.n) * CELL;
    ctx.fillStyle = hit ? 'rgba(236,106,79,0.28)' : 'rgba(155,165,185,0.16)';
    ctx.fillRect(sx + 1, sy + 1, wh - 2, wh - 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = hit ? C_GROUND : 'rgba(184,193,212,0.85)';
    ctx.strokeRect(sx + 1, sy + 1, wh - 2, wh - 2);
    if (ti === selected) {
      // selection ring in the UI accent
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#8b7bf0';
      ctx.strokeRect(sx - 1, sy - 1, wh + 2, wh + 2);
    }
    ctx.fillStyle = hit ? '#ffd9cf' : 'rgba(214,220,232,0.95)';
    ctx.font = 'bold ' + Math.min(16, Math.round(wh * 0.5)) + 'px system-ui,sans-serif';
    ctx.fillText(String(ti + 1), sx + wh / 2, sy + wh / 2);
    if (wh >= 26) {
      // room for the size letter in the corner
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = 'bold ' + Math.round(wh * 0.22) + 'px system-ui,sans-serif';
      ctx.fillStyle = hit ? 'rgba(255,217,207,0.85)' : 'rgba(184,193,212,0.8)';
      ctx.fillText(SIZE_LETTER[t.n], sx + 3, sy + 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
    }
    if (t.elev) {
      // altitude badge for airborne creatures
      ctx.textBaseline = 'bottom';
      ctx.font = 'bold ' + Math.max(8, Math.round(wh * 0.2)) + 'px system-ui,sans-serif';
      ctx.fillStyle = hit ? 'rgba(255,217,207,0.9)' : 'rgba(184,193,212,0.85)';
      ctx.fillText('↑' + t.elev, sx + wh / 2, sy + wh - 2);
      ctx.textBaseline = 'middle';
    }
  });
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  return gridView;
}
