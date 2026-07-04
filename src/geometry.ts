import { DIRS, COS_HALF } from './constants';
import type { Params, Cell, Axis, Target, ZMap } from './types';

// Horizontal unit vector for a compass position t (0=N, 1=NE, 2=E, ... clockwise).
// Integer t reproduces the eight DIRS vectors exactly; fractional t rotates smoothly
// (used by the geometric mode's continuous azimuth).
export function horizVec(t: number): { x: number; y: number } {
  const az = ((90 - 45 * t) * Math.PI) / 180; // math angle: 0deg = E, CCW positive
  return { x: Math.cos(az), y: Math.sin(az) };
}

// Snap a (possibly fractional) compass position to one of the eight DIRS.
function snapDir(t: number): number {
  return ((Math.round(t) % 8) + 8) % 8;
}

// Unit axis of the cone from compass position + tilt (tilt>0 = downward).
// Level -> horizontal in the compass direction; +/-90deg -> straight up/down.
export function coneAxis(tiltRad: number, t: number): Axis {
  const h = horizVec(t);
  const c = Math.cos(tiltRad);
  return { x: c * h.x, y: c * h.y, z: -Math.sin(tiltRad) };
}

// Is the point at offset (X,Y) horizontally and vz vertically (relative to the
// caster) inside the cone? Returns the 3D slant distance when in, else null.
export function coneHit(X: number, Y: number, vz: number, axis: Axis, coneL: number): number | null {
  const dist3d = Math.hypot(X, Y, vz);
  if (dist3d > coneL + 1e-6) return null;
  const cosAng = (X * axis.x + Y * axis.y + vz * axis.z) / dist3d;
  return cosAng >= COS_HALF - 1e-9 ? dist3d : null;
}

// --- PF2e grid distance: diagonals alternate 1st=5 ft, 2nd=10 ft, 3rd=5 ft, ... ---
// Squares from the caster's corner to a square at signed index i (always >= 1: the
// square touching the corner counts as 1). West/south indices are negative.
function nSquares(i: number): number {
  return i >= 0 ? i + 1 : -i;
}
// Horizontal PF2e distance in feet from the corner to square (cx,cy):
// 5 * (max + floor(min/2)) over the two square counts. The floor(min/2) term is
// exactly the alternating-diagonal discount, giving the familiar octagonal reach.
export function pf2eFeetH(cx: number, cy: number): number {
  const p = nSquares(cx);
  const q = nSquares(cy);
  const a = Math.max(p, q);
  const b = Math.min(p, q);
  return 5 * (a + Math.floor(b / 2));
}

export function computeCells(p: Params): Cell[] {
  const pf = p.metric === 'pf2e';
  if (p.shape === 'burst') return pf ? pf2eBurstCells(p) : burstCells(p);
  if (p.shape === 'line') return pf ? pf2eLineCells(p) : lineCells(p);
  if (p.shape === 'cylinder') return pf ? pf2eCylinderCells(p) : cylinderCells(p);
  if (p.shape === 'emanation') return pf ? pf2eEmanationCells(p) : emanationCells(p);
  return pf ? pf2eConeCells(p) : coneCells(p);
}

// Horizontal nearest-point distance from a cell to the 5 ft emanator square that is
// centred on the origin corner (spans -2.5..2.5 ft on each axis). Distance between
// two intervals [a,b] and [c,d] is max(0, a-d, c-b).
function emanatorGap(cx: number, cy: number): number {
  const gx = Math.max(0, cx * 5 - 2.5, -2.5 - (cx + 1) * 5);
  const gy = Math.max(0, cy * 5 - 2.5, -2.5 - (cy + 1) * 5);
  return Math.hypot(gx, gy);
}

// Cylinder = a vertical column: a disc of radius R (measured from the corner, like a
// burst) extruded from the base height H up to H + cylH. It reaches the ground only
// when its base sits on the floor (H = 0).
function cylinderCells(p: Params): Cell[] {
  const { size: R, H, cylH } = p;
  const lim = Math.ceil(R / 5);
  const hits = H <= 1e-6;
  const cells: Cell[] = [];
  for (let cx = -lim - 1; cx <= lim; cx++) {
    for (let cy = -lim - 1; cy <= lim; cy++) {
      const rho = Math.hypot((cx + 0.5) * 5, (cy + 0.5) * 5);
      if (rho > R + 1e-6) continue;
      cells.push({ cx, cy, hitsGround: hits, horzFt: rho, slant: rho, zmin: H, zmax: H + cylH });
    }
  }
  return cells;
}

// Emanation = a 3D area issuing from the emanator's whole 5 ft square (centred on the
// origin), reaching R in every direction -- so its footprint is centred on a square,
// not a corner. Sphere-swept vertically, so flyers within R are caught.
function emanationCells(p: Params): Cell[] {
  const { size: R, H } = p;
  const lim = Math.ceil(R / 5) + 1;
  const cells: Cell[] = [];
  for (let cx = -lim - 1; cx <= lim; cx++) {
    for (let cy = -lim - 1; cy <= lim; cy++) {
      const gap = emanatorGap(cx, cy);
      if (gap > R + 1e-6) continue;
      const s = Math.sqrt(Math.max(0, R * R - gap * gap));
      const groundDist = Math.hypot(gap, H);
      const hits = groundDist <= R + 1e-6;
      cells.push({ cx, cy, hitsGround: hits, horzFt: gap, slant: hits ? groundDist : 0, zmin: H - s, zmax: H + s });
    }
  }
  return cells;
}

function coneCells(p: Params): Cell[] {
  const { size, H, tilt, dir } = p;
  const tiltRad = (tilt * Math.PI) / 180;
  const axis = coneAxis(tiltRad, dir);
  const R = size / 5;
  const lim = Math.ceil(R);
  const cells: Cell[] = [];
  // Scan every square within horizontal reach (slant >= horizontal distance, so
  // anything in-cone lies within R). One true 3D cone test, all directions.
  for (let cx = -lim - 1; cx <= lim; cx++) {
    for (let cy = -lim - 1; cy <= lim; cy++) {
      const mx = cx + 0.5;
      const my = cy + 0.5;
      if (Math.hypot(mx, my) > R + 1e-9) continue;
      const X = mx * 5;
      const Y = my * 5;
      const horzFt = Math.hypot(X, Y);
      const slant = coneHit(X, Y, -H, axis, size); // 3D distance if the floor is in-cone
      // The cone's vertical span in this column (convex -> one interval). Scan z>=0
      // in 1 ft steps: zmin is what a creature's feet reach up to, zmax its ceiling.
      let lo: number | null = null;
      let hi = 0;
      for (let z = 0; z <= H + size; z++) {
        if (coneHit(X, Y, z - H, axis, size) !== null) {
          if (lo === null) lo = z;
          hi = z;
        } else if (lo !== null) {
          break; // exited the single contiguous band
        }
      }
      if (lo === null) continue; // cone never enters this column at z>=0
      cells.push({
        cx,
        cy,
        hitsGround: slant !== null,
        horzFt,
        slant: slant !== null ? slant : 0,
        zmin: lo,
        zmax: hi,
      });
    }
  }
  return cells;
}

// Burst = a sphere of radius R centered on the caster's corner at height H.
// Ground squares lie where the sphere reaches the floor; an airburst high up
// (H near/over R) leaves only air squares beneath it.
function burstCells(p: Params): Cell[] {
  const { size: R, H } = p;
  const lim = Math.ceil(R / 5);
  const cells: Cell[] = [];
  for (let cx = -lim - 1; cx <= lim; cx++) {
    for (let cy = -lim - 1; cy <= lim; cy++) {
      const X = (cx + 0.5) * 5;
      const Y = (cy + 0.5) * 5;
      const rho = Math.hypot(X, Y);
      if (rho > R + 1e-6) continue; // column never enters the sphere
      const s = Math.sqrt(Math.max(0, R * R - rho * rho)); // half-chord: sphere spans z in [H-s,H+s]
      const zmin = H - s;
      const zmax = H + s;
      const groundDist = Math.hypot(rho, H);
      if (groundDist <= R + 1e-6) {
        cells.push({ cx, cy, hitsGround: true, horzFt: rho, slant: groundDist, zmin, zmax });
      } else {
        cells.push({ cx, cy, hitsGround: false, horzFt: rho, slant: 0, zmin, zmax }); // sphere passes overhead only
      }
    }
  }
  return cells;
}

// Line = a 5 ft-wide beam from the corner along the direction, length = size.
// A single file of squares (PF2e-style, no diagonal overlap); with height/tilt
// the beam climbs or dives, so squares are "ground" only where it nears z=0.
function lineCells(p: Params): Cell[] {
  const { size: L, H, tilt } = p;
  const d = DIRS[snapDir(p.dir)]; // a line follows a grid direction even when the cone rotates freely
  const tiltRad = (tilt * Math.PI) / 180;
  const ct = Math.cos(tiltRad);
  const tt = Math.tan(tiltRad);
  const sx = Math.sign(d.vx);
  const sy = Math.sign(d.vy);
  const stepFt = Math.hypot(sx, sy) * 5; // 5 orthogonal, 5*sqrt2 diagonal
  const idx = (s: number, i: number) => (s > 0 ? i : s < 0 ? -1 - i : 0); // corner-anchored single file
  const cells: Cell[] = [];
  if (ct < 1e-6) return cells; // a perfectly vertical line has no footprint
  for (let i = 0; i < 400; i++) {
    const horzFt = (i + 0.5) * stepFt;
    const slant = horzFt / ct;
    if (slant > L + 1e-6) break;
    const z = H - horzFt * tt; // beam height over this square (tilt>0 dives)
    if (z < -2.5 - 1e-6) break; // beam has dropped below the floor
    // Beam is ~5 ft thick, so it spans 2.5 ft either side of the centreline.
    cells.push({
      cx: idx(sx, i),
      cy: idx(sy, i),
      hitsGround: z <= 2.5 + 1e-6,
      horzFt,
      slant,
      zmin: z - 2.5,
      zmax: z + 2.5,
    });
  }
  return cells;
}

// --- PF2e-mode variants: same shapes, but the horizontal reach is counted by the
// alternating-diagonal rule instead of measured as a straight line. The vertical
// treatment (tilt, caster height, air vs ground) stays geometric, so height/tilt
// and target elevation keep working. Facing is snapped to the eight compass dirs. ---

// PF2e cone: squares within the counted length AND inside the geometric 90 deg arc.
function pf2eConeCells(p: Params): Cell[] {
  const { size, H, tilt } = p;
  const dir = snapDir(p.dir);
  const tiltRad = (tilt * Math.PI) / 180;
  const axis = coneAxis(tiltRad, dir);
  const lim = Math.ceil(size / 5);
  const cells: Cell[] = [];
  for (let cx = -lim - 1; cx <= lim; cx++) {
    for (let cy = -lim - 1; cy <= lim; cy++) {
      if (pf2eFeetH(cx, cy) > size + 1e-9) continue; // PF2e horizontal range gate
      const X = (cx + 0.5) * 5;
      const Y = (cy + 0.5) * 5;
      const horzFt = Math.hypot(X, Y);
      const slant = coneHit(X, Y, -H, axis, size); // 90 deg arc + reach at the floor
      let lo: number | null = null;
      let hi = 0;
      for (let z = 0; z <= H + size; z++) {
        if (coneHit(X, Y, z - H, axis, size) !== null) {
          if (lo === null) lo = z;
          hi = z;
        } else if (lo !== null) {
          break;
        }
      }
      if (lo === null) continue;
      cells.push({
        cx,
        cy,
        hitsGround: slant !== null,
        horzFt,
        slant: slant !== null ? slant : 0,
        zmin: lo,
        zmax: hi,
      });
    }
  }
  return cells;
}

// PF2e burst: octagonal footprint by counted distance; sphere still spans vertically
// so airbursts (height H) keep their air/ground split.
function pf2eBurstCells(p: Params): Cell[] {
  const { size: R, H } = p;
  const lim = Math.ceil(R / 5);
  const cells: Cell[] = [];
  for (let cx = -lim - 1; cx <= lim; cx++) {
    for (let cy = -lim - 1; cy <= lim; cy++) {
      const hf = pf2eFeetH(cx, cy);
      if (hf > R + 1e-9) continue; // pf2eFeetH >= straight-line distance, so rho <= R below
      const X = (cx + 0.5) * 5;
      const Y = (cy + 0.5) * 5;
      const rho = Math.hypot(X, Y);
      const s = Math.sqrt(Math.max(0, R * R - rho * rho));
      const zmin = H - s;
      const zmax = H + s;
      const groundDist = Math.hypot(rho, H);
      const hits = groundDist <= R + 1e-6;
      cells.push({ cx, cy, hitsGround: hits, horzFt: hf, slant: hits ? groundDist : 0, zmin, zmax });
    }
  }
  return cells;
}

// PF2e line: same single file of squares, but its length is counted with the
// diagonal rule (a diagonal beam reaches fewer squares than an orthogonal one).
function pf2eLineCells(p: Params): Cell[] {
  const { size: L, H, tilt } = p;
  const d = DIRS[snapDir(p.dir)];
  const tiltRad = (tilt * Math.PI) / 180;
  const ct = Math.cos(tiltRad);
  const tt = Math.tan(tiltRad);
  const sx = Math.sign(d.vx);
  const sy = Math.sign(d.vy);
  const stepFt = Math.hypot(sx, sy) * 5;
  const idx = (s: number, i: number) => (s > 0 ? i : s < 0 ? -1 - i : 0);
  const cells: Cell[] = [];
  if (ct < 1e-6) return cells;
  for (let i = 0; i < 400; i++) {
    const cx = idx(sx, i);
    const cy = idx(sy, i);
    const reach = pf2eFeetH(cx, cy); // counted distance to this square
    if (reach > L + 1e-9) break; // beyond the counted length
    const horzFt = (i + 0.5) * stepFt; // geometric run, for tilt/height
    const z = H - horzFt * tt;
    if (z < -2.5 - 1e-6) break;
    cells.push({
      cx,
      cy,
      hitsGround: z <= 2.5 + 1e-6,
      horzFt: reach,
      slant: reach,
      zmin: z - 2.5,
      zmax: z + 2.5,
    });
  }
  return cells;
}

// PF2e cylinder: octagonal disc (counted radius) extruded from H to H + cylH.
function pf2eCylinderCells(p: Params): Cell[] {
  const { size: R, H, cylH } = p;
  const lim = Math.ceil(R / 5);
  const hits = H <= 1e-6;
  const cells: Cell[] = [];
  for (let cx = -lim - 1; cx <= lim; cx++) {
    for (let cy = -lim - 1; cy <= lim; cy++) {
      const hf = pf2eFeetH(cx, cy);
      if (hf > R + 1e-9) continue;
      cells.push({ cx, cy, hitsGround: hits, horzFt: hf, slant: hf, zmin: H, zmax: H + cylH });
    }
  }
  return cells;
}

// PF2e emanation: counted-distance octagon, sphere-swept vertically. (In RAW grid
// mode this counts from the origin like a burst; the creature-centred footprint of a
// true emanation is only distinct in Geometric mode.)
function pf2eEmanationCells(p: Params): Cell[] {
  const { size: R, H } = p;
  const lim = Math.ceil(R / 5);
  const cells: Cell[] = [];
  for (let cx = -lim - 1; cx <= lim; cx++) {
    for (let cy = -lim - 1; cy <= lim; cy++) {
      const hf = pf2eFeetH(cx, cy);
      if (hf > R + 1e-9) continue;
      const s = Math.sqrt(Math.max(0, R * R - hf * hf));
      const groundDist = Math.hypot(hf, H);
      const hits = groundDist <= R + 1e-6;
      cells.push({ cx, cy, hitsGround: hits, horzFt: hf, slant: hits ? groundDist : 0, zmin: H - s, zmax: H + s });
    }
  }
  return cells;
}

// Pixels per 5 ft so the shape's extent frames within the rectangle. Zoom is
// computed from the shape aimed S (t=4), not the live aim: because the window is
// wider than tall, pointing S loads the shape onto the shorter (vertical) axis --
// the tightest fit -- so that scale also frames every rotation. Fixing the
// reference stops the grid from jumping as you sweep the direction slider.
export function autoZoom(p: Params, gridW: number, gridH: number): number {
  // Direction-less shapes (burst / cylinder / emanation) frame from the live params;
  // aimed shapes frame from a fixed S reference so the zoom doesn't jump as you rotate.
  const symmetric = p.shape === 'burst' || p.shape === 'cylinder' || p.shape === 'emanation';
  const ref = symmetric ? computeCells(p) : computeCells({ ...p, dir: 4 });
  let hx = 1;
  let hy = 1;
  for (const cc of ref) {
    hx = Math.max(hx, Math.abs(cc.cx), Math.abs(cc.cx + 1));
    hy = Math.max(hy, Math.abs(cc.cy), Math.abs(cc.cy + 1));
  }
  const cw = (gridW / 2 - 14) / (hx + 0.5);
  const ch = (gridH / 2 - 14) / (hy + 0.5);
  return Math.max(6, Math.min(cw, ch, 46));
}

// A target (cube of side n, floating at elevation elev) occupies the vertical band
// [elev, elev+n*5]. It's hit if the effect's span [lo,hi] overlaps that band in any
// one of the n*n columns it covers.
export function targetHit(t: Target, zmap: ZMap): boolean {
  const bot = t.elev || 0;
  const top = bot + t.n * 5;
  for (let dx = 0; dx < t.n; dx++) {
    for (let dy = 0; dy < t.n; dy++) {
      const v = zmap.get(t.cx + dx + ',' + (t.cy + dy));
      if (v && v.lo <= top + 1e-6 && v.hi >= bot - 1e-6) return true;
    }
  }
  return false;
}
