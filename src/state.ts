import type { Params, ShapeName, Metric, Target } from './types';

// The range inputs that make up a shared scenario.
export interface Sliders {
  cone: HTMLInputElement;
  height: HTMLInputElement;
  tilt: HTMLInputElement;
  dir: HTMLInputElement;
  cylH: HTMLInputElement;
}

export function getParams(shape: ShapeName, metric: Metric, s: Sliders): Params {
  return {
    shape,
    metric,
    size: +s.cone.value, // continuous size in feet (the slider clamps to the shape's range)
    H: +s.height.value,
    tilt: +s.tilt.value,
    dir: +s.dir.value,
    cylH: +s.cylH.value,
  };
}

// Compact per-target encoding for the share URL: cx.cy.n.elev, joined by '_'.
export function serializeTargets(targets: Target[]): string {
  return targets.map((t) => t.cx + '.' + t.cy + '.' + t.n + '.' + (t.elev || 0)).join('_');
}

export function parseTargets(str: string): Target[] {
  return str
    .split('_')
    .map((s) => {
      const a = s.split('.').map(Number);
      return {
        cx: a[0],
        cy: a[1],
        n: Math.min(4, Math.max(1, a[2] || 1)),
        elev: Math.max(0, a[3] || 0),
      };
    })
    .filter((t) => Number.isFinite(t.cx) && Number.isFinite(t.cy));
}
