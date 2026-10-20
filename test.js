/* =====================================================================
   test.js - automatic checks for the solver.  Run with:  node test.js
   (Needs Node.js only for testing. The app itself needs nothing.)
   ===================================================================== */

var S = require('./solver.js');
var PUZZLES = require('./puzzles.js');

var passed = 0;
var failed = 0;

function check(name, condition) {
  if (condition) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
}

function sample(key) {
  return S.boardFromString(PUZZLES.filter(function (p) { return p.key === key; })[0].puzzle);
}

// A finished board is correct if every row, column and 3x3 box holds 1..9 once.
function isCompleteValidSolution(board) {
  for (var i = 0; i < 9; i++) {
    var row = {}, col = {}, box = {};
    for (var j = 0; j < 9; j++) {
      row[board[i][j]] = true;
      col[board[j][i]] = true;
      box[board[3 * Math.floor(i / 3) + Math.floor(j / 3)][3 * (i % 3) + (j % 3)]] = true;
    }
    for (var d = 1; d <= 9; d++) if (!row[d] || !col[d] || !box[d]) return false;
  }
  return true;
}

function keepsClues(puzzle, solution) {
  for (var r = 0; r < 9; r++)
    for (var c = 0; c < 9; c++)
      if (puzzle[r][c] !== 0 && puzzle[r][c] !== solution[r][c]) return false;
  return true;
}

function countEmpty(board) {
  var n = 0;
  for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++) if (board[r][c] === 0) n++;
  return n;
}

console.log('Rule checks');
var b = S.createEmptyBoard();
b[0][0] = 5;
check('same row is rejected', !S.isValidPlacement(b, 0, 8, 5));
check('same column is rejected', !S.isValidPlacement(b, 8, 0, 5));
check('same 3x3 box is rejected', !S.isValidPlacement(b, 2, 2, 5));
check('different row, column and box is accepted', S.isValidPlacement(b, 4, 4, 5));
check('a different digit in the same row is accepted', S.isValidPlacement(b, 0, 8, 6));

console.log('Input validation');
check('sample puzzles have no clashes', PUZZLES.every(function (p) { return S.findConflicts(S.boardFromString(p.puzzle)).length === 0; }));
var bad = S.createEmptyBoard();
bad[0][0] = 7; bad[0][5] = 7; // two 7s in one row
check('duplicate in a row is found (both cells)', S.findConflicts(bad).length === 2);
bad = S.createEmptyBoard();
bad[1][1] = 3; bad[2][2] = 3; // two 3s in one box
check('duplicate in a box is found', S.findConflicts(bad).length === 2);

console.log('Solving the sample puzzles');
['easy', 'medium', 'hard'].forEach(function (key) {
  var puzzle = sample(key);
  var copy = S.copyBoard(puzzle);
  var res = S.solve(puzzle);
  check(key + ': solved', res.solved === true);
  check(key + ': every row, column and box holds 1-9', isCompleteValidSolution(res.board));
  check(key + ': original clues are kept', keepsClues(puzzle, res.board));
  check(key + ': input board was not modified', JSON.stringify(puzzle) === JSON.stringify(copy));
  check(key + ': recursive calls = accepted placements + 1', res.stats.recursiveCalls === res.stats.placements + 1);
  check(key + ': accepted - backtracks = number of empty cells', res.stats.placements - res.stats.backtracks === countEmpty(puzzle));
});

console.log('Known answer (Medium puzzle, first row of the published solution)');
check('first row is 534678912', S.solve(sample('medium')).board[0].join('') === '534678912');

console.log('Edge cases');
var none = S.solve(sample('nosolution'));
check('no-solution puzzle reports solved = false', none.solved === false && none.stopReason === null);
check('no-solution puzzle returns the original board', S.boardToString(none.board) === PUZZLES.filter(function (p) { return p.key === 'nosolution'; })[0].puzzle);
var empty = S.solve(S.createEmptyBoard());
check('empty board is solved with a valid grid', empty.solved && isCompleteValidSolution(empty.board));
var full = S.solve(empty.board);
check('already complete board: 1 call, 0 attempts', full.solved && full.stats.recursiveCalls === 1 && full.stats.attempts === 0);
var limited = S.solve(sample('stress'), { maxCalls: 1000 });
check('call limit stops the search (stopReason = maxCalls)', limited.solved === false && limited.stopReason === 'maxCalls');

console.log('Recorded steps (used by the animation)');
['easy', 'medium'].forEach(function (key) {
  var puzzle = sample(key);
  var res = S.solve(puzzle, { recordSteps: true, maxSteps: 1000000 });
  var counts = { 'try': 0, reject: 0, place: 0, backtrack: 0 };
  var replay = S.copyBoard(puzzle);
  res.steps.forEach(function (s) {
    counts[s.type]++;
    if (s.type === 'place') replay[s.row][s.col] = s.value;
    if (s.type === 'backtrack') replay[s.row][s.col] = 0;
  });
  check(key + ': "try" steps match attempts', counts['try'] === res.stats.attempts);
  check(key + ': "place" steps match placements', counts.place === res.stats.placements);
  check(key + ': "backtrack" steps match backtracks', counts.backtrack === res.stats.backtracks);
  check(key + ': replaying place/backtrack steps rebuilds the solution', JSON.stringify(replay) === JSON.stringify(res.board));
  check(key + ': total steps = 2 x attempts + backtracks', res.steps.length === 2 * res.stats.attempts + res.stats.backtracks);
});
var capped = S.solve(sample('hard'), { recordSteps: true, maxSteps: 500 });
check('recording stops at maxSteps', capped.steps.length === 500 && capped.stopReason === 'maxSteps');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
