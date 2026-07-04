import type { ShapeName, ShapeConfig, Dir } from './types';

// Each shape sets its own size scale, the "size" control's label, and which of
// tilt/direction apply (a sphere ignores both; a burst is symmetric).
export const SHAPES: Record<ShapeName, ShapeConfig> = {
  cone: { label: 'Cone size', sizes: [15, 30, 60, 90, 120], tilt: true, dir: true },
  burst: { label: 'Burst radius', sizes: [5, 10, 15, 20, 30, 60], tilt: false, dir: false },
  line: { label: 'Line length', sizes: [15, 30, 60, 90, 120], tilt: true, dir: true },
  cylinder: { label: 'Cylinder radius', sizes: [5, 10, 15, 20, 30, 60], tilt: false, dir: false, cylH: true },
  emanation: { label: 'Emanation radius', sizes: [5, 10, 15, 20, 30, 60], tilt: false, dir: false },
};

export const DIRS: Dir[] = [
  { name: 'N', vx: 0, vy: 1, diag: false },
  { name: 'NE', vx: 1, vy: 1, diag: true },
  { name: 'E', vx: 1, vy: 0, diag: false },
  { name: 'SE', vx: 1, vy: -1, diag: true },
  { name: 'S', vx: 0, vy: -1, diag: false },
  { name: 'SW', vx: -1, vy: -1, diag: true },
  { name: 'W', vx: -1, vy: 0, diag: false },
  { name: 'NW', vx: -1, vy: 1, diag: true },
];

export const HALF = Math.PI / 4;
export const COS_HALF = Math.cos(HALF); // a point is in-cone when its axis angle <= 45deg

// Data colours (must match the --ground / --air CSS vars; canvas can't read them).
export const C_GROUND = '#ec6a4f';
export const C_AIR = '#43b7c9';
export const C_GROUND_RGB = '236,106,79';

// n=1 Medium, 2 Large, 3 Huge, 4 Gargantuan.
export const SIZE_LETTER: Record<number, string> = { 1: 'M', 2: 'L', 3: 'H', 4: 'G' };
export const SIZE_NAME: Record<number, string> = {
  1: 'Medium',
  2: 'Large',
  3: 'Huge',
  4: 'Gargantuan',
};
