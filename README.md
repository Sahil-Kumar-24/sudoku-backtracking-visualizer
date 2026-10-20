# Sudoku Solver - Interactive Backtracking Visualizer

A Design and Analysis of Algorithms (DAA) lab project. It solves Sudoku with **recursive backtracking** and shows every attempt, accepted digit and backtrack on a 9x9 board.

Built with plain HTML, CSS and JavaScript. No backend, no database, no API keys, no installation.

## How to run

1. Unzip the folder.
2. Double-click `index.html`. It opens in your browser (Chrome, Edge, Firefox or Safari).

That is all. It works offline. Keep the files in the same folder, because `index.html` loads `style.css`, `puzzles.js`, `solver.js` and `app.js` from next to it.

## Files

| File | What it does | Good for |
|---|---|---|
| `index.html` | Page layout, buttons, and the algorithm and complexity text | Member 3 |
| `style.css` | Colours, board, responsive layout | Member 3 |
| `puzzles.js` | The sample puzzles (data only) | anyone |
| `solver.js` | **The algorithm.** Recursive backtracking, rule checks, counters | Member 1 |
| `app.js` | Grid, typing checks, buttons, step-by-step replay, statistics | Member 2 |
| `test.js` | Automatic tests for `solver.js` (needs Node.js, optional) | Member 1 |

`solver.js` has no page code in it, so it can be explained and tested on its own.

## How to use the app

- **Sample puzzles**: Easy, Medium, Hard, Stress test, No solution.
- **Type your own puzzle**: click a cell and type 1-9. Backspace empties a cell. Arrow keys move between cells. Anything other than 1-9 is refused with a message. If a digit repeats in a row, column or box, those cells turn red and Solve will not start.
- **Solve**: plays the search step by step. Colours: amber = trying a digit, red = rejected, green = accepted, purple = backtracking.
- **Pause / Resume**: freezes or continues the replay.
- **Step**: moves exactly one move forward.
- **Solve instantly**: skips the animation and shows the final board and totals.
- **Speed slider**: 1 to 10,000 steps per second.
- **Reset**: removes the solver's digits but keeps your clues.
- **Clear**: empties the whole board.

While a search is active the grid is locked. Press Reset to edit again.

## The algorithm

```
solve(board):
  cell = first empty cell
  if there is no empty cell: return TRUE       # base case
  for digit = 1 to 9:
      if digit is safe in row, column and 3x3 box:
          place digit
          if solve(board): return TRUE         # recursive call
          remove digit                         # BACKTRACK
  return FALSE                                 # caller must backtrack
```

### What the counters mean

- **Recursive call**: one run of `solve()`. Calls = accepted placements + 1.
- **Attempted placement**: one candidate digit tested in a cell.
- **Accepted placement**: a candidate that passed the row, column and box check.
- **Backtrack**: an accepted digit that was erased again.
- **Execution time**: measured on a separate run with no animation.

## Complexity (m = number of empty cells, at most 81)

**Time**
- Best case O(m): the first valid digit is always right, so there are m + 1 calls and no backtracks.
- Worst case O(9^m): the recursion is at most m levels deep and every cell branches into at most 9 digits.
- Work per call is constant on a 9x9 board (scan at most 81 cells, check at most 9 digits with 27 comparisons each).
- The row, column and box check prunes most branches, so real puzzles need far fewer calls than 9^m.

**Space**
- O(m) for the recursion stack, at most 81 frames. The board is changed in place and never copied inside the recursion.
- O(1) for a fixed 9x9 board, O(n^2) for an n x n board.
- The step list recorded for the animation is extra memory used only by the visualizer.

Generalised Sudoku on larger boards is known to be NP-complete.

### Measured results (from `solver.js`, same on every computer)

| Puzzle | Recursive calls | Backtracks |
|---|---|---|
| Easy | 201 | 151 |
| Medium | 4,209 | 4,157 |
| Hard | 49,559 | 49,498 |
| Stress test | stops at the 3,000,000-call limit | - |
| No solution | 1 | 0 |

Time in milliseconds depends on your computer, so it is not listed here. The Stress test is a good demo of the exponential worst case.

## How the visualization works

1. On Solve, `solver.js` runs twice: once with no recording to measure real time, and once recording every move (`try`, `reject`, `place`, `backtrack`).
2. `app.js` replays the recorded moves on the board at the chosen speed.
3. At the end it shows the final board and the real totals.

Two safety limits keep the page responsive:
- The animation records at most **50,000 steps**. On longer searches (Hard has about 941,000) the first 50,000 are animated and the rest finishes instantly. The final board and statistics always cover the full run.
- The solver gives up after **3,000,000 recursive calls** (about a second) and says so.

Both numbers are at the top of `app.js` (`MAX_STEPS`) and in `solver.js` (`maxCalls`).

## Testing

`node test.js` runs 43 checks on the algorithm: rule checks, input validation, solving all samples, a known published answer, edge cases (no solution, empty board, full board, call limit) and the recorded steps.

The page itself was also checked in headless Chromium by clicking every button. That script is not part of the project because it needs extra tools.

## Ideas to extend it

- Try the digits in a different order, or pick the cell with the fewest candidates first (the MRV heuristic) and compare the counters.
- Add your own puzzles in `puzzles.js`.
- Add your team names and roll numbers to the footer in `index.html`.

## Troubleshooting

- Buttons do nothing: check that all five files are in the same folder and JavaScript is enabled.
- The page is unstyled: `style.css` is missing from the folder.
- Stress test says "Stopped after 3,000,000 recursive calls": expected. That puzzle defeats plain backtracking.
