# Ebbets — project notes for Claude

## What this is

A React component library (`ebbets`) that provides a softball lineup manager. The single exported component is `LineupManager`, a controlled component that handles batting order and field position assignment with drag-and-drop.

## Commands

```bash
npm run dev           # Vite dev server
npm run storybook     # Storybook on :6006
npm run build         # Library build → dist/ (ES + CJS)
npm run build:app     # Full app build
npm test              # Unit + component tests (Vitest)
npm run test:watch    # Same, in watch mode
npm run test:e2e      # Playwright browser tests
```

Install with `--legacy-peer-deps` — Storybook 7 has peer conflicts with some ESLint plugins.

## Test layout

- `src/lineup.test.js` — 54 unit tests for all pure functions in `src/lineup.js`
- `src/LineupManager.test.jsx` — 32 RTL component tests (toggle props, player CRUD, position swap, auto-config, strip)
- `tests/e2e/lineup.spec.js` — 42 Playwright tests run in two projects: `desktop` (1024px) and `mobile` (390px chromium)
- `vitest.config.js` — uses `happy-dom` environment; excludes `tests/e2e/`
- `playwright.config.js` — spins up `npm run dev` as the web server; `reuseExistingServer` is on for local dev
- `src/test-setup.js` — jest-dom matchers, ResizeObserver/IntersectionObserver stubs, RTL cleanup

## Key files

- `src/components/LineupManager.jsx` — the entire component tree in one file
- `src/components/LineupManager.module.css` — all styling; desktop breakpoint at 820px
- `src/App.jsx` — state container used by the dev server; not part of the library
- `src/index.js` — library barrel export (`LineupManager`)
- `src/stories/LineupManager.stories.jsx` — Storybook stories; each wraps the component in a `Scenario` stateful helper
- `vite.config.lib.js` — library build config (separate from `vite.config.js` used for the dev app)

## Architecture

`LineupManager` is a **controlled component**. It owns no data state — only UI state (`view`, `activeId`, `activeType`). The parent supplies `players`, `lineup`, and `onLineupChange`.

All mutations end in a call to `emit(newPlayers, lineupOverrides)`, which calls `onLineupChange` with the full next state. The shape is always `{ players, lineup }`.

### Drag-and-drop

There is a **single `DndContext`** that wraps both the lineup list and the field diagram. This is intentional — it enables cross-panel drops (drag a lineup row onto a field position chip).

A custom `pointerCollision` detector is used instead of `closestCenter`. The built-in `closestCenter` uses the bounding-box center of the dragged element, which is wrong for wide lineup rows (a ~360px wide element dragged from its left edge would register drops far to the right of the cursor). The custom function uses `pointerCoordinates` directly.

Three drag interaction types are handled in `handleDragEnd`:
1. `player → fieldPos` — assign player to position (or swap with existing occupant)
2. `fieldPos → fieldPos` — swap two field positions
3. `player → player` — reorder batting lineup

### Auto-config

Derived from `players.length`:
- ≥10 players: `effectiveOutfield` is forced to `'4'` regardless of the `lineup.outfield` prop
- >10 players: one EH slot per extra player (`autoEhCount = players.length - 10`)

When the roster size changes, `cleanAfterCountChange` clears positions that are no longer valid (e.g. `CF` is cleared when switching to 4OF; `EH2` is cleared if the roster drops back to 10).

EH position IDs are `EH`, `EH2`, `EH3`, … (not `EH1`).

### CSS

CSS Modules (`LineupManager.module.css`). The library build uses `vite-plugin-css-injected-by-js` so consumers don't need a separate CSS import — styles inject at runtime when the JS loads.

### SVG field diagram

The outfield fence arc uses `sweep-flag=1` (clockwise in SVG coordinates, which traces the short arc upward through the outfield). `sweep-flag=0` traces the 270° arc going downward through the diamond — wrong.

The pitcher mound is rendered as an SVG `<circle>` at `[250, 270]`. The dirt infield is an `<ellipse>` clipped to `y < 290` so it doesn't bleed below the 1B/3B base line.

## Storybook

Stories live in `src/stories/`. Each story uses a local `Scenario` wrapper component that holds state and passes it to the controlled `LineupManager`. This replaces the old `initialState` uncontrolled prop pattern.

The `component` in the default export points to `Scenario`, not `LineupManager` directly, because Storybook renders the wrapper.
