/* =====================================================================
   solver.js  -  THE ALGORITHM  (no HTML, CSS or buttons in this file)

   This file holds the recursive backtracking Sudoku solver. It is kept
   separate from the user interface so that:
     - teammates can read and explain the algorithm on its own, and
     - we can test it with Node.js (see test.js) without a browser.

   BACKTRACKING IN FIVE LINES
     1. Find the first empty cell.
     2. Try the digits 1..9 in it, one by one.
     3. If a digit does not break a Sudoku rule, WRITE it and call solve()
        again for the next empty cell (this is the recursion).
     4. If that deeper call fails, ERASE the digit (this is the BACKTRACK)
        and try the next digit.
     5. If no digit works, return false so the caller backtracks too.

   Boards are 9x9 arrays of numbers: board[row][col], 0 means "empty".
   ===================================================================== */

(function (root) {
  'use strict';

  var SIZE = 9; // the board is 9 x 9
  var BOX = 3;  // each small box is 3 x 3

  /* ---------- small helpers ---------- */

  function createEmptyBoard() {
    var board = [];
    for (var r = 0; r < SIZE; r++) {
      board.push([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    }
    return board;
  }

  function copyBoard(board) {
    var copy = [];
    for (var r = 0; r < SIZE; r++) {
      copy.push(board[r].slice());
    }
    return copy;
  }

  // "530070000..." (81 characters) -> 9x9 board. '0' or '.' means empty.
  function boardFromString(text) {
    var board = createEmptyBoard();
    for (var i = 0; i < SIZE * SIZE; i++) {
      var ch = text.charAt(i);
      board[Math.floor(i / SIZE)][i % SIZE] = (ch >= '1' && ch <= '9') ? Number(ch) : 0;
    }
    return board;
  }

  function boardToString(board) {
    var text = '';
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        text += board[r][c];
      }
    }
    return text;
  }

  // High-resolution clock in milliseconds (works in browsers and Node).
  function now() {
    return (typeof performance !== 'undefined') ? performance.now() : Date.now();
  }

  /* ---------- the Sudoku rules ---------- */

  // Can `num` be written at (row, col) without repeating a digit in the
  // same row, the same column or the same 3x3 box?  Costs 27 comparisons
  // at most, so it is O(1) for a 9x9 board.
  function isValidPlacement(board, row, col, num) {
    for (var i = 0; i < SIZE; i++) {
      if (board[row][i] === num) return false; // same row
      if (board[i][col] === num) return false; // same column
    }
    var boxRow = row - (row % BOX); // top-left corner of the 3x3 box
    var boxCol = col - (col % BOX);
    for (var r = 0; r < BOX; r++) {
      for (var c = 0; c < BOX; c++) {
        if (board[boxRow + r][boxCol + c] === num) return false; // same box
      }
    }
    return true;
  }

  // First empty cell (reading left-to-right, top-to-bottom) as [row, col],
  // or null when the board is full.
  function findEmptyCell(board) {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (board[r][c] === 0) return [r, c];
      }
    }
    return null;
  }

  // Input validation: list every filled cell that repeats a digit already
  // present in its row, column or box.  An empty list means "no clashes".
  function findConflicts(board) {
    var conflicts = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var value = board[r][c];
        if (value === 0) continue;
        board[r][c] = 0; // lift the digit up for a moment...
        var ok = isValidPlacement(board, r, c, value);
        board[r][c] = value; // ...and put it back
        if (!ok) conflicts.push([r, c]);
      }
    }
    return conflicts;
  }

  /* ---------- THE RECURSIVE BACKTRACKING SOLVER ---------- */

  /*
     solve(puzzle, options) -> result

     options (all optional):
       recordSteps : true  -> remember every move so the UI can replay it
       maxSteps    : stop recording after this many moves (default 50000)
       maxCalls    : safety limit on recursive calls (default 3,000,000) so a
                     very hard puzzle cannot freeze the browser forever

     result:
       solved     : true / false
       board      : the solved board (or a copy of the puzzle if not solved)
       stats      : { recursiveCalls, attempts, placements, backtracks }
       timeMs     : how long the search took
       steps      : recorded moves  { type, row, col, value }
                    type is 'try', 'reject', 'place' or 'backtrack'
       stopReason : null, 'maxCalls' (gave up) or 'maxSteps' (recording full)
  */
  function solve(puzzle, options) {
    options = options || {};
    var recordSteps = options.recordSteps === true;
    var maxSteps = options.maxSteps || 50000;
    var maxCalls = options.maxCalls || 3000000;

    var board = copyBoard(puzzle); // never change the caller's board
    var stats = { recursiveCalls: 0, attempts: 0, placements: 0, backtracks: 0 };
    var steps = [];
    var stopReason = null; // set when we stop early; makes every level return

    function record(type, row, col, value) {
      steps.push({ type: type, row: row, col: col, value: value });
      if (steps.length >= maxSteps) stopReason = 'maxSteps';
    }

    // ---- the recursive function: fills ALL remaining empty cells ----
    function solveRecursively() {
      stats.recursiveCalls++;
      if (stats.recursiveCalls > maxCalls) { stopReason = 'maxCalls'; return false; }

      var cell = findEmptyCell(board);
      if (cell === null) return true;        // BASE CASE: no empty cell, solved!
      var row = cell[0];
      var col = cell[1];

      for (var num = 1; num <= 9; num++) {   // candidate digits
        if (stopReason !== null) return false;

        stats.attempts++;
        if (recordSteps) record('try', row, col, num);

        if (isValidPlacement(board, row, col, num)) {
          board[row][col] = num;             // accept the digit
          stats.placements++;
          if (recordSteps) record('place', row, col, num);

          if (solveRecursively()) return true; // RECURSIVE CALL
          if (stopReason !== null) return false;

          board[row][col] = 0;               // BACKTRACK: undo the choice
          stats.backtracks++;
          if (recordSteps) record('backtrack', row, col, num);
        } else if (recordSteps) {
          record('reject', row, col, num);
        }
      }
      return false; // no digit fits here -> the caller must backtrack
    }

    var start = now();
    var solved = solveRecursively();
    var elapsed = now() - start;

    return {
      solved: solved,
      board: solved ? board : copyBoard(puzzle),
      stats: stats,
      timeMs: elapsed,
      steps: steps,
      stopReason: stopReason
    };
  }

  var api = {
    SIZE: SIZE,
    createEmptyBoard: createEmptyBoard,
    copyBoard: copyBoard,
    boardFromString: boardFromString,
    boardToString: boardToString,
    isValidPlacement: isValidPlacement,
    findEmptyCell: findEmptyCell,
    findConflicts: findConflicts,
    solve: solve
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;          // Node.js (used by test.js)
  } else {
    root.SudokuSolver = api;       // browser: window.SudokuSolver
  }
})(typeof window !== 'undefined' ? window : this);
