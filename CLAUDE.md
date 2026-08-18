# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris implementation. No dependencies, no build step, no package.json, no test suite, no linter. Just three files: `index.html`, `style.css`, `game.js`.

## Running the game

There is no build/lint/test command. To run and manually verify changes, open `index.html` directly or serve it with any static server, e.g.:

```bash
python3 -m http.server 8000
# or
npx serve .
# or
php -S localhost:8000
```

Then open the served URL (or the file directly) in a browser. Since there is no test suite, verify gameplay changes by actually playing the game (movement, rotation, line clears, scoring, pause, game over/restart).

## Architecture

All game logic lives in `game.js` (~300 lines, single file, no modules/classes — plain functions and module-level mutable state).

- **State**: a handful of module-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.) hold the entire game state. `init()` resets all of them and is also what the restart button calls.
- **Board model**: `board` is a `ROWS × COLS` matrix; each cell is `0` (empty) or a piece-color index `1–7`.
- **Pieces**: `PIECES` defines the 7 tetrominoes as square matrices of color indices. Rotation (`rotateCW`) is a generic transpose+reverse, not per-piece rotation tables.
- **Collision & wall kicks**: `collide(shape, ox, oy)` is the single source of truth for both movement and rotation legality. `tryRotate()` rotates then tries offsets `[0, -1, 1, -2, 2]` against `collide` to emulate wall kicks.
- **Game loop**: `loop(ts)` runs via `requestAnimationFrame`, accumulates elapsed time in `dropAccum`, and drops the piece one row once `dropAccum >= dropInterval`; otherwise it calls `lockPiece()` (merge → clear lines → spawn next).
- **Line clearing & scoring**: `clearLines()` scans bottom-up, splices completed rows and unshifts empty ones at the top, and scores via `LINE_SCORES` (`[0,100,300,500,800]`) multiplied by `level`. `level` increases every 10 lines cleared, which recomputes `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Rendering**: `draw()` clears and redraws the whole canvas every frame (grid, locked board, ghost piece, current piece) — there is no dirty-rect or diffing optimization. The ghost piece is drawn via `ghostY()` (projects `current` straight down until it would collide) with `globalAlpha = 0.2`. `drawNext()` renders the preview piece to a separate `next-canvas`.
- **Input**: a single `keydown` listener switches on `e.code` for movement/rotation/soft-drop/hard-drop; `KeyP` toggles pause independent of the paused/gameOver guard at the top of the handler.

## Tunable constants (top of `game.js`)

`COLS`, `ROWS`, `BLOCK` (cell size in px), `COLORS`, `LINE_SCORES`, initial `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, the `<canvas id="board">` `width`/`height` in `index.html` must be updated to match (`COLS × BLOCK`, `ROWS × BLOCK`).
