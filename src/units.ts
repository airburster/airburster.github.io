// Display units. The model is ALWAYS in feet (one grid square = 5 ft internally);
// these helpers only change what the UI shows. Metric mode relabels each 5-ft
// square as 1 m -- a deliberate "1 square = 1 m" convention, not the true 3.28-ft
// metre -- so a 30-ft (6-square) cone reads as 6 m and elevation steps 1 m/square.
export type Units = 'ft' | 'm';

const PER_SQUARE_FT = 5; // one grid square, in feet

// Feet -> the numeric value shown in the chosen units.
export function conv(ft: number, u: Units): number {
  return u === 'm' ? ft / PER_SQUARE_FT : ft;
}

// A control value (size / height / elevation), trailing zeros trimmed ("6", "7.5").
export function fmtValue(ft: number, u: Units): string {
  return String(Math.round(conv(ft, u) * 100) / 100);
}

// A reach readout with its unit suffix (feet to the whole, metres to 0.1).
export function fmtReach(ft: number, u: Units): string {
  return u === 'm'
    ? Math.round((ft / PER_SQUARE_FT) * 10) / 10 + 'm'
    : Math.round(ft) + 'ft';
}

// The unit suffix on its own ("ft" / "m").
export function unitLabel(u: Units): string {
  return u === 'm' ? 'm' : 'ft';
}

// The "1 square = ___" caption text.
export function squareLabel(u: Units): string {
  return u === 'm' ? '1 m' : '5 ft';
}

// One elevation step (one square) in the chosen units, for the +/- button labels.
export function stepLabel(u: Units): string {
  return u === 'm' ? '1' : '5';
}
