import './styles.css';
import { SHAPES, DIRS, SIZE_NAME, SIZE_LETTER } from './constants';
import { computeCells, targetHit } from './geometry';
import { drawGrid } from './render/grid';
import { drawSide } from './render/side';
import { getParams, serializeTargets, parseTargets } from './state';
import type { Sliders } from './state';
import { fmtValue, fmtReach, unitLabel, squareLabel, stepLabel } from './units';
import type { Units } from './units';
import { $ } from './dom';
import type { ShapeName, Metric, Target, Cell, Params, ZMap, GridView } from './types';

type Tool = 'place' | 'delete';

// Mutable app state. `shape`/`targets` are part of the shared scenario; `brush`/
// `tool`/`selected` are transient editing state; `grid`/`dims` are layout cache.
const state = {
  shape: 'cone' as ShapeName,
  metric: 'geom' as Metric,
  units: 'ft' as Units, // display-only; the model is always in feet
  targets: [] as Target[],
  brush: 1,
  tool: 'place' as Tool,
  selected: -1,
  grid: { ox: 0, oy: 0, CELL: 1 } as GridView, // last top-down transform, for click hit-testing
  dims: { GRID_W: 680, GRID_H: 460, SIDE_H: 460 },
};

const MAX_BRUSH = 4; // brush cycles Medium(1) -> Gargantuan(4)
const SIZE_MIN = 5; // the AoE size slider is continuous feet, from 5 ft ...
const SIZE_STEP = 5; // ... in 5 ft steps up to each shape's largest preset

const sCone = $<HTMLInputElement>('sCone');
const sHeight = $<HTMLInputElement>('sHeight');
const sTilt = $<HTMLInputElement>('sTilt');
const sDir = $<HTMLInputElement>('sDir');
const sCylH = $<HTMLInputElement>('sCylH');
const sEma = $<HTMLInputElement>('sEma');
const gridCanvas = $<HTMLCanvasElement>('gridCanvas');
const sideCanvas = $<HTMLCanvasElement>('sideCanvas');
const sliders: Sliders = { cone: sCone, height: sHeight, tilt: sTilt, dir: sDir, cylH: sCylH, ema: sEma };

function updateLabels(): void {
  const p = getParams(state.shape, state.metric, sliders);
  $('vCone').textContent = fmtValue(p.size, state.units);
  $('vHeight').textContent = fmtValue(p.H, state.units);
  $('vCylH').textContent = fmtValue(p.cylH, state.units);
  $('vEma').textContent = SIZE_NAME[p.emaN] + ' (' + SIZE_LETTER[p.emaN] + ')';
  $('vTilt').textContent = String(Math.abs(p.tilt));
  $('tiltDir').textContent = p.tilt < 0 ? '(up)' : p.tilt > 0 ? '(down)' : '(level)';
  const near = ((Math.round(p.dir) % 8) + 8) % 8; // nearest compass point
  const bearing = (((Math.round(p.dir * 45) % 360) + 360) % 360); // compass bearing, N=0deg
  $('vDir').textContent = DIRS[near].name;
  $('dirType').textContent = `${bearing}° · ${DIRS[near].diag ? 'diagonal' : 'orthogonal'}`;
}

// Both view canvases are sized so all three columns end up the same height: the
// target is the controls column (content-driven, can't stretch), and each canvas
// is that target minus its own column's label + caption. Re-measured only on
// resize, so it stays put during slider interaction; the zoom auto-fits each redraw.
function chromeOf(col: HTMLElement | null): number {
  // label + caption height (incl. their 8px of margins)
  const lbl = col ? col.querySelector<HTMLElement>('.view-label') : null;
  const foot = col ? col.querySelector<HTMLElement>('.view-foot') : null;
  return (lbl ? lbl.offsetHeight : 0) + (foot ? foot.offsetHeight : 0) + 8;
}
function measureGrid(): void {
  const controls = document.querySelector<HTMLElement>('.controls');
  const top = $('topCol');
  const side = $('sideCol');
  const target = Math.max(240, controls ? controls.offsetHeight : 460);
  state.dims.GRID_W = Math.max(240, Math.round((top ? top.clientWidth : 680) || 680));
  state.dims.GRID_H = Math.max(200, Math.round(target - chromeOf(top)));
  state.dims.SIDE_H = Math.max(200, Math.round(target - chromeOf(side)));
}

function updateStats(cells: Cell[], p: Params, zmap: ZMap): void {
  const g = cells.filter((c) => c.hitsGround);
  const a = cells.filter((c) => !c.hitsGround);
  const mg = g.reduce((m, c) => Math.max(m, c.horzFt), 0);
  const ms = cells.reduce((m, c) => Math.max(m, c.slant), 0);
  $('sGndSq').textContent = String(g.length);
  $('sAirSq').textContent = String(a.length);
  $('sGndR').textContent = fmtReach(mg, state.units);
  $('sFwdR').textContent = fmtReach(ms, state.units);
  $('clearNote').style.display = g.length === 0 && p.H > 0 ? 'block' : 'none';
  const hitN = state.targets.reduce((n, t) => n + (targetHit(t, zmap) ? 1 : 0), 0);
  $('targetStat').textContent = state.targets.length ? ` · ${hitN}/${state.targets.length} hit` : '';
  $('clearTargets').style.display = state.targets.length ? '' : 'none';
}

function redraw(): void {
  updateLabels();
  const p = getParams(state.shape, state.metric, sliders);
  const cells = computeCells(p);
  const zmap: ZMap = new Map(cells.map((c) => [c.cx + ',' + c.cy, { lo: c.zmin, hi: c.zmax }]));
  state.grid = drawGrid({
    canvas: gridCanvas,
    cells,
    p,
    zmap,
    targets: state.targets,
    selected: state.selected,
    gridW: state.dims.GRID_W,
    gridH: state.dims.GRID_H,
    units: state.units,
  });
  drawSide(sideCanvas, cells, p, state.dims.SIDE_H, state.targets, zmap, state.units);
  updateStats(cells, p, zmap);
}

// Switch active shape: retitle/rescale the size control and hide the controls
// that don't apply (tilt/direction for a burst).
function setShape(s: ShapeName): void {
  state.shape = s;
  const cfg = SHAPES[s];
  document
    .querySelectorAll<HTMLElement>('.tab')
    .forEach((t) => t.classList.toggle('active', t.dataset.shape === s));
  $('sizeLabel').textContent = cfg.label;
  $('heightLabel').textContent =
    s === 'burst'
      ? 'Burst height'
      : s === 'cylinder'
        ? 'Base height'
        : s === 'emanation'
          ? 'Emanation height'
          : 'Caster height';
  // Continuous size in feet, from SIZE_MIN up to this shape's largest preset.
  const maxSize = cfg.sizes[cfg.sizes.length - 1];
  sCone.min = String(SIZE_MIN);
  sCone.max = String(maxSize);
  sCone.step = String(SIZE_STEP);
  sCone.value = String(Math.min(maxSize, Math.max(SIZE_MIN, +sCone.value)));
  $('boxCylH').style.display = cfg.cylH ? '' : 'none';
  $('boxEma').style.display = s === 'emanation' ? '' : 'none';
  $('boxTilt').style.display = cfg.tilt ? '' : 'none';
  $('boxDir').style.display = cfg.dir ? '' : 'none';
}

// The direction slider is a compass position (0=N..8=N). Geometric mode rotates
// smoothly; PF2e mode snaps to the eight compass points.
function applyDirRange(): void {
  if (state.metric === 'pf2e') {
    sDir.max = '7';
    sDir.step = '1';
    sDir.value = String(((Math.round(+sDir.value) % 8) + 8) % 8); // snap onto a compass point
  } else {
    sDir.max = '8'; // 8 wraps back to N, so the full circle is reachable
    sDir.step = '0.05';
  }
}
// Set the geometry mode + reconfigure the direction slider. `applyMetric` is the
// side-effect-free core (used during hash load); `setMetric` also repaints/persists.
function applyMetric(m: Metric): void {
  state.metric = m;
  $('modeGeom').classList.toggle('active', m === 'geom');
  $('modePf2e').classList.toggle('active', m === 'pf2e');
  applyDirRange();
}
function setMetric(m: Metric): void {
  applyMetric(m);
  redraw();
  writeHash();
}

// Display units (ft <-> m). This is purely a display relabelling of the same
// square-counted model, so it's a local preference (localStorage) kept OUT of the
// share URL -- a shared link renders in whatever units the viewer prefers.
const UNITS_KEY = 'airburster-units';
function applyUnits(u: Units): void {
  state.units = u;
  $('unitFt').classList.toggle('active', u === 'ft');
  $('unitM').classList.toggle('active', u === 'm');
  document.querySelectorAll('.js-unit').forEach((e) => (e.textContent = unitLabel(u)));
  document.querySelectorAll('.js-square').forEach((e) => (e.textContent = squareLabel(u)));
  $('elevDown').textContent = '–' + stepLabel(u); // one square down/up (5 ft = 1 m)
  $('elevUp').textContent = '+' + stepLabel(u);
}
function setUnits(u: Units): void {
  applyUnits(u);
  try {
    localStorage.setItem(UNITS_KEY, u);
  } catch {
    /* private mode / storage disabled: units just won't persist */
  }
  updateTools(); // refresh the selected-token elevation label
  redraw();
}

// --- shareable URL state: shape + each control's value as a short hash key ---
const CTRLS: Record<string, HTMLInputElement> = { h: sHeight, t: sTilt, d: sDir, y: sCylH, e: sEma };
function writeHash(): void {
  const parts = ['s=' + state.shape];
  if (state.metric !== 'geom') parts.push('m=' + state.metric); // omit default -> geom links stay unchanged
  parts.push('z=' + sCone.value); // AoE size in feet (supersedes the legacy index-based 'c')
  parts.push(...Object.entries(CTRLS).map(([k, el]) => k + '=' + el.value));
  if (state.targets.length) parts.push('t=' + serializeTargets(state.targets));
  history.replaceState(null, '', '#' + parts.join('&')); // live-update address bar (no history spam)
}
function readHash(): void {
  const q = new URLSearchParams(location.hash.slice(1));
  const s = q.get('s');
  if (s && s in SHAPES) setShape(s as ShapeName); // before reading size value
  applyMetric(q.get('m') === 'pf2e' ? 'pf2e' : 'geom'); // sets the dir slider range before its value
  // Size: new links carry 'z' (feet); legacy links carry 'c' (1-based preset index).
  if (q.has('z')) {
    const z = +q.get('z')!;
    if (Number.isFinite(z)) sCone.value = String(z); // slider clamps to the shape's range
  } else if (q.has('c')) {
    const sizes = SHAPES[state.shape].sizes;
    const idx = Math.min(Math.max(+q.get('c')!, 1), sizes.length) - 1;
    if (Number.isFinite(idx)) sCone.value = String(sizes[idx]);
  }
  for (const [k, el] of Object.entries(CTRLS)) {
    if (!q.has(k)) continue;
    const v = +q.get(k)!;
    if (Number.isFinite(v)) el.value = String(v); // range inputs clamp to their min/max/step
  }
  state.targets = q.has('t') ? parseTargets(q.get('t')!) : [];
  state.selected = -1;
}

const shareBtn = $<HTMLButtonElement>('shareBtn');
let shareTimer: ReturnType<typeof setTimeout> | undefined;
shareBtn.addEventListener('click', async () => {
  writeHash();
  try {
    await navigator.clipboard.writeText(location.href);
  } catch {
    /* clipboard may be unavailable; the URL bar is still updated */
  }
  shareBtn.textContent = 'Link copied ✓';
  shareBtn.classList.add('copied');
  clearTimeout(shareTimer);
  shareTimer = setTimeout(() => {
    shareBtn.textContent = 'Copy share link';
    shareBtn.classList.remove('copied');
  }, 1400);
});

[sCone, sHeight, sTilt, sDir, sCylH, sEma].forEach((s) =>
  s.addEventListener('input', () => {
    redraw();
    writeHash();
  }),
);
document.querySelectorAll<HTMLElement>('.tab').forEach((t) =>
  t.addEventListener('click', () => {
    setShape(t.dataset.shape as ShapeName);
    redraw();
    writeHash();
  }),
);

// Toolbar. Selection is always-on (a click picks the token under the cursor), so
// there's no Select tool: Place drops a new token on empty squares, Delete removes
// the one clicked. Keyboard users delete via Backspace instead.
function updateTools(): void {
  for (const [id, m] of [
    ['toolPlace', 'place'],
    ['toolDelete', 'delete'],
  ] as const) {
    $(id).classList.toggle('active', state.tool === m);
  }
  $('brushBtn').style.display = state.tool === 'place' ? '' : 'none';
  $('brushBtn').textContent = 'Size: ' + SIZE_NAME[state.brush];
  const sel = state.selected >= 0 && state.selected < state.targets.length;
  $('elevPanel').style.display = sel ? '' : 'none';
  if (sel) {
    const t = state.targets[state.selected];
    $('elevLabel').textContent = `#${state.selected + 1} ${SIZE_NAME[t.n]} · elev ${fmtValue(t.elev || 0, state.units)} ${unitLabel(state.units)}`;
  }
  gridCanvas.style.cursor = state.tool === 'place' ? 'crosshair' : 'pointer';
}
function changeElev(d: number): void {
  if (state.selected < 0 || state.selected >= state.targets.length) return;
  const t = state.targets[state.selected];
  t.elev = Math.max(0, (t.elev || 0) + d);
  updateTools();
  redraw();
  writeHash();
}
// Nudge the selected token one square. +dcy is north (up on screen), +dcx is east.
function moveSelected(dcx: number, dcy: number): void {
  if (state.selected < 0 || state.selected >= state.targets.length) return;
  const t = state.targets[state.selected];
  t.cx += dcx;
  t.cy += dcy;
  updateTools();
  redraw();
  writeHash();
}
function deleteSelected(): void {
  if (state.selected < 0 || state.selected >= state.targets.length) return;
  state.targets.splice(state.selected, 1);
  state.selected = -1;
  updateTools();
  redraw();
  writeHash();
}
$('toolPlace').addEventListener('click', () => {
  state.tool = 'place';
  updateTools();
});
$('toolDelete').addEventListener('click', () => {
  state.tool = 'delete';
  updateTools();
});
$('brushBtn').addEventListener('click', () => {
  state.brush = (state.brush % MAX_BRUSH) + 1;
  updateTools();
});
$('elevDown').addEventListener('click', () => changeElev(-5));
$('elevUp').addEventListener('click', () => changeElev(5));
$('modeGeom').addEventListener('click', () => setMetric('geom'));
$('modePf2e').addEventListener('click', () => setMetric('pf2e'));
$('unitFt').addEventListener('click', () => setUnits('ft'));
$('unitM').addEventListener('click', () => setUnits('m'));
gridCanvas.addEventListener('click', (e) => {
  const { ox, oy, CELL } = state.grid;
  const r = gridCanvas.getBoundingClientRect();
  const cx = Math.floor(((e.clientX - r.left) * (gridCanvas.width / r.width) - ox) / CELL);
  const cy = Math.floor((oy - (e.clientY - r.top) * (gridCanvas.height / r.height)) / CELL);
  const i = state.targets.findIndex((t) => cx >= t.cx && cx < t.cx + t.n && cy >= t.cy && cy < t.cy + t.n);
  if (state.tool === 'delete') {
    if (i >= 0) {
      state.targets.splice(i, 1);
      state.selected = -1;
    }
  } else if (i >= 0) {
    state.selected = i; // clicking a token always selects it (ready for WASD / arrows)
  } else {
    state.targets.push({ cx, cy, n: state.brush, elev: 0 }); // empty square: drop a new token
    state.selected = state.targets.length - 1; // ...and select it
  }
  updateTools();
  redraw();
  writeHash();
});
$('clearTargets').addEventListener('click', () => {
  state.targets = [];
  state.selected = -1;
  updateTools();
  redraw();
  writeHash();
});

// Keyboard control of the selected token: WASD moves it a square, arrows change
// elevation. Ignored while a form control is focused so it doesn't fight the
// sliders' own arrow-key handling (or hijack browser shortcuts).
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const el = document.activeElement;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
  if (state.selected < 0 || state.selected >= state.targets.length) return;
  let handled = true;
  switch (e.key.toLowerCase()) {
    case 'w': moveSelected(0, 1); break; // north
    case 's': moveSelected(0, -1); break; // south
    case 'a': moveSelected(-1, 0); break; // west
    case 'd': moveSelected(1, 0); break; // east
    case 'arrowup': changeElev(5); break; // raise
    case 'arrowdown': changeElev(-5); break; // lower
    case 'backspace': deleteSelected(); break;
    case 'delete': deleteSelected(); break;
    default: handled = false;
  }
  if (handled) e.preventDefault(); // stop the page scrolling / slider stealing arrows
});

// React to back/forward or a freshly pasted link.
window.addEventListener('hashchange', () => {
  readHash();
  redraw();
});
// Keep the window matched to the columns as the viewport / layout changes.
window.addEventListener('resize', () => {
  measureGrid();
  redraw();
});
window.addEventListener('load', () => {
  measureGrid();
  redraw();
});

setShape(state.shape);
readHash();
applyUnits(localStorage.getItem(UNITS_KEY) === 'm' ? 'm' : 'ft'); // restore local pref
updateTools();
measureGrid();
redraw();
