# Airburster

Geometrically accurate D&D / PF2e area-of-effect visualizer. Model a cone, burst,
or line — set size, caster height, tilt, and facing — and see the affected squares
in a top-down grid and a side-elevation cross-section, with placed target creatures
and a shareable URL.

Two geometry modes:

- **Geometric** — true Euclidean shapes; the cone rotates smoothly through any azimuth.
- **PF2e** — grid square-counting with the alternating-diagonal rule (1st diagonal
  5 ft, 2nd 10 ft, …), so bursts read as octagons and cones as quarter-circles; facing
  snaps to the eight compass points.

## Development

```bash
npm install     # once
npm run dev     # Vite dev server with hot reload
```

## Build & preview

```bash
npm run build   # type-checks (tsc) then bundles to dist/
npm run preview # serve the production build locally
```

## Deploy

Pushing to `main` triggers `.github/workflows/pages.yml`, which builds and publishes
`dist/` to GitHub Pages (served at the site root).

## Layout

```
index.html          Vite entry (markup only)
src/
  main.ts           app wiring: state, events, redraw loop
  types.ts          shared domain types
  constants.ts      shapes, directions, colours, size tables
  geometry.ts       pure AoE math: geometric + PF2e cone/burst/line, zoom, hit-tests
  state.ts          control params + share-URL (de)serialization
  dom.ts            typed element lookup
  render/grid.ts    top-down canvas
  render/side.ts    side-elevation canvas
  styles.css        all styles
```
