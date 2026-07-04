// Shared domain types for the AoE model.

export type ShapeName = 'cone' | 'burst' | 'line' | 'cylinder' | 'emanation';

// Geometry mode: 'geom' = true Euclidean shapes with smooth rotation;
// 'pf2e' = grid square-counting (alternating diagonals), facing snapped to 45deg.
export type Metric = 'geom' | 'pf2e';

// Per-shape config: size scale, the size control's label, which of tilt/direction
// apply (a burst is symmetric, so it ignores both), and whether the shape needs the
// extra cylinder-height control.
export interface ShapeConfig {
  label: string;
  sizes: number[];
  tilt: boolean;
  dir: boolean;
  cylH?: boolean;
}

// A compass direction and its integer grid vector (diag = the four diagonals).
export interface Dir {
  name: string;
  vx: number;
  vy: number;
  diag: boolean;
}

// A fully resolved scenario, derived from the control values. `dir` is a compass
// position (0=N, 1=NE, 2=E, ... clockwise); integer values are the eight compass
// points, fractional values are in-between azimuths used by the geometric mode.
export interface Params {
  shape: ShapeName;
  metric: Metric;
  size: number;
  H: number;
  tilt: number;
  dir: number;
  cylH: number; // cylinder height (only used by the cylinder shape)
}

// One affected grid square. zmin/zmax bound the effect's vertical span in this
// column; hitsGround is true where the effect reaches the floor (z = 0).
export interface Cell {
  cx: number;
  cy: number;
  hitsGround: boolean;
  horzFt: number;
  slant: number;
  zmin: number;
  zmax: number;
}

// A placed target creature: a cube of side n squares, floating at elevation elev.
export interface Target {
  cx: number;
  cy: number;
  n: number;
  elev: number;
}

// Unit axis of a cone/beam in 3D (z up).
export interface Axis {
  x: number;
  y: number;
  z: number;
}

// The vertical span an effect occupies in one column.
export interface ZSpan {
  lo: number;
  hi: number;
}

// Column key ("cx,cy") -> that column's vertical span. Used for target hit-tests.
export type ZMap = Map<string, ZSpan>;

// The last top-down transform, kept for click hit-testing.
export interface GridView {
  ox: number;
  oy: number;
  CELL: number;
}
