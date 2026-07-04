import { C_GROUND, C_GROUND_RGB, HALF } from '../constants';
import { horizVec, targetHit } from '../geometry';
import type { Cell, Params, Target, ZMap } from '../types';

// Side view = vertical cross-section through the aim axis. World feet: origin at
// (0,0) = caster/centre at height H, +x = forward along the azimuth, +y = down.
// The view auto-fits so any shape/aim stays framed.
export function drawSide(
  canvas: HTMLCanvasElement,
  cells: Cell[],
  p: Params,
  sideH: number,
  targets: Target[],
  zmap: ZMap,
): void {
  const ctx = canvas.getContext('2d')!;
  const W = 200;
  const Hc = sideH;
  canvas.width = W;
  canvas.height = Hc;
  const bg = '#12151e';
  const grid = 'rgba(255,255,255,0.07)';
  const gnd = 'rgba(' + C_GROUND_RGB + ',0.55)';
  const shapeF = 'rgba(' + C_GROUND_RGB + ',0.16)';
  const shapeB = 'rgba(' + C_GROUND_RGB + ',0.85)';
  const axis = 'rgba(255,255,255,0.25)';
  const cast = '#e9ebf2';
  const lbl = 'rgba(255,255,255,0.4)';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, Hc);
  const { shape, size, H, tilt, dir, cylH } = p;
  const tiltRad = (tilt * Math.PI) / 180;
  const topA = tiltRad - HALF;
  const botA = tiltRad + HALF;

  // Content bounds: origin, ground depth H, and the shape's silhouette.
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = H;
  const ext = (x: number, y: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  if (shape === 'cone') {
    for (let i = 0; i <= 24; i++) {
      const a = topA + ((botA - topA) * i) / 24;
      ext(Math.cos(a) * size, Math.sin(a) * size);
    }
  } else if (shape === 'burst' || shape === 'emanation') {
    ext(-size, 0);
    ext(size, 0);
    ext(0, -size);
    ext(0, size);
  } else if (shape === 'cylinder') {
    // a column: width +/-R at the base (origin), rising cylH (negative y = up)
    ext(-size, 0);
    ext(size, 0);
    ext(-size, -cylH);
    ext(size, -cylH);
  } else {
    // line
    ext(Math.cos(tiltRad) * size, Math.sin(tiltRad) * size);
  }
  // Ground footprint = signed extent of ground cells projected onto the azimuth.
  const h = horizVec(dir);
  const ux = h.x;
  const uy = h.y;
  const g = cells.filter((cell) => cell.hitsGround);
  let fMin = 0;
  let fMax = 0;
  if (g.length) {
    const proj = g.map((cell) => ((cell.cx + 0.5) * ux + (cell.cy + 0.5) * uy) * 5);
    fMin = Math.min(...proj);
    fMax = Math.max(...proj);
    ext(fMin, H);
    ext(fMax, H);
  }

  // Placed tokens projected onto the aim axis: forward distance x the vertical band
  // [elev, elev + height]. The colour comes from the true 3D hit test, so it stays
  // accurate even though a cross-section collapses the sideways offset onto the axis.
  const tokenBoxes = targets.map((t, i) => {
    const bot = t.elev || 0;
    const fwd = ((t.cx + t.n / 2) * ux + (t.cy + t.n / 2) * uy) * 5;
    return {
      idx: i,
      fwd,
      yTop: H - (bot + t.n * 5), // token top (higher up = smaller world y)
      yBot: H - bot, // token bottom (rests on the ground when elev = 0)
      halfW: (t.n * 5) / 2,
      hit: targetHit(t, zmap),
    };
  });
  for (const b of tokenBoxes) {
    ext(b.fwd - b.halfW, b.yTop);
    ext(b.fwd + b.halfW, b.yBot);
  }

  // Fit transform (origin pixel = oX,oY).
  const m = 22;
  const bw = Math.max(maxX - minX, 1);
  const bh = Math.max(maxY - minY, 1);
  const scale = Math.min((W - 2 * m) / bw, (Hc - 2 * m) / bh, 4);
  const oX = (W - (maxX + minX) * scale) / 2;
  const oY = m - minY * scale;
  const PX = (wx: number, wy: number): [number, number] => [oX + wx * scale, oY + wy * scale];
  const [ax, ay] = PX(0, 0);
  const gY = oY + H * scale;
  const L = size * scale;

  // Grid (5 ft).
  ctx.strokeStyle = grid;
  ctx.lineWidth = 0.5;
  for (let i = Math.floor(minX / 5) - 1; i <= Math.ceil(maxX / 5) + 1; i++) {
    const x = PX(i * 5, 0)[0];
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, Hc);
    ctx.stroke();
  }
  for (let i = Math.floor(minY / 5) - 1; i <= Math.ceil(maxY / 5) + 1; i++) {
    const y = PX(0, i * 5)[1];
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Ground line.
  ctx.strokeStyle = gnd;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, gY);
  ctx.lineTo(W, gY);
  ctx.stroke();

  // Shape silhouette.
  ctx.fillStyle = shapeF;
  ctx.strokeStyle = shapeB;
  ctx.lineWidth = 1.2;
  if (shape === 'cone') {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + Math.cos(topA) * L, ay + Math.sin(topA) * L);
    ctx.arc(ax, ay, L, topA, botA);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + Math.cos(topA) * L, ay + Math.sin(topA) * L);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + Math.cos(botA) * L, ay + Math.sin(botA) * L);
    ctx.stroke();
  } else if (shape === 'burst' || shape === 'emanation') {
    ctx.beginPath();
    ctx.arc(ax, ay, L, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ax, ay, L, 0, 7);
    ctx.stroke();
  } else if (shape === 'cylinder') {
    // a rectangle: base at the origin (y=0), rising cylH (negative y = up)
    const [rx0, ry0] = PX(-size, -cylH);
    const [rx1, ry1] = PX(size, 0);
    ctx.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
    ctx.strokeRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
  } else {
    // line -- a beam from the origin at the tilt angle
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + Math.cos(tiltRad) * L, ay + Math.sin(tiltRad) * L);
    ctx.stroke();
  }

  // Two-sided ground footprint.
  if (g.length) {
    ctx.strokeStyle = C_GROUND;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(PX(fMin, H)[0], gY);
    ctx.lineTo(PX(fMax, H)[0], gY);
    ctx.stroke();
  }

  // Aim axis (cone only -- burst is symmetric, the line already is its axis).
  if (shape === 'cone') {
    ctx.strokeStyle = axis;
    ctx.lineWidth = 0.8;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + Math.cos(tiltRad) * L, ay + Math.sin(tiltRad) * L);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Height drop.
  if (H > 0) {
    ctx.strokeStyle = axis;
    ctx.lineWidth = 0.8;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax, gY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = lbl;
    ctx.font = '10px system-ui,sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(H + 'ft', ax - 5, (ay + gY) / 2 + 4);
  }

  // Placed tokens: coral when the effect catches the body, grey when clear
  // (same palette as the top-down view).
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const b of tokenBoxes) {
    const [x0, y0] = PX(b.fwd - b.halfW, b.yTop);
    const [x1, y1] = PX(b.fwd + b.halfW, b.yBot);
    const bw2 = x1 - x0;
    const bh2 = y1 - y0;
    ctx.fillStyle = b.hit ? 'rgba(236,106,79,0.28)' : 'rgba(155,165,185,0.16)';
    ctx.fillRect(x0, y0, bw2, bh2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = b.hit ? C_GROUND : 'rgba(184,193,212,0.85)';
    ctx.strokeRect(x0, y0, bw2, bh2);
    const box = Math.min(bw2, bh2);
    if (box >= 13) {
      // room for the identity number
      ctx.fillStyle = b.hit ? '#ffd9cf' : 'rgba(214,220,232,0.95)';
      ctx.font = 'bold ' + Math.min(14, Math.round(box * 0.6)) + 'px system-ui,sans-serif';
      ctx.fillText(String(b.idx + 1), (x0 + x1) / 2, (y0 + y1) / 2);
    }
  }
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';

  // Caster / centre.
  ctx.fillStyle = cast;
  ctx.beginPath();
  ctx.arc(ax, ay, 4, 0, 7);
  ctx.fill();
}
