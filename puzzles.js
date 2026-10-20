/* =====================================================================
   puzzles.js  -  sample puzzles (data only, no logic)

   Each puzzle is 81 characters: read the grid left-to-right, top-to-bottom.
   A digit is a clue, '0' is an empty cell.
   To add your own sample, copy one object below and change the text.
   ===================================================================== */

var SAMPLE_PUZZLES = [
  {
    key: 'easy',
    label: 'Easy',
    note: 'Few backtracks',
    puzzle: '003020600900305001001806400008102900700000008006708200002609500800203009005010300'
  },
  {
    key: 'medium',
    label: 'Medium',
    note: 'A few thousand calls',
    puzzle: '530070000600195000098000060800060003400803001700020006060000280000419005000080079'
  },
  {
    key: 'hard',
    label: 'Hard',
    note: 'Tens of thousands of calls',
    puzzle: '800000000003600000070090200050007000000045700000100030001000068008500010090000400'
  },
  {
    key: 'stress',
    label: 'Stress test',
    note: 'Hits the call limit',
    puzzle: '000000000000003085001020000000507000004000100090000000500000073002010000000040009'
  },
  {
    key: 'nosolution',
    label: 'No solution',
    note: 'Dead end at once',
    // Row 1 already holds 1-8 and column 9 holds a 9, so cell (1,9) has no legal digit.
    puzzle: '123456780000000009000000000000000000000000000000000000000000000000000000000000000'
  }
];

// Lets test.js (Node.js) import this file. Browsers ignore this line.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SAMPLE_PUZZLES;
}
