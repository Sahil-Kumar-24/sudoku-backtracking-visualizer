/* =====================================================================
   app.js  -  THE USER INTERFACE  (buttons, grid, animation)

   How the visualizer works, in plain words:
     1. When you press Solve, solver.js solves the puzzle TWICE:
          a) once with no recording, only to measure the real time and counters
          b) once recording every move ("try", "reject", "place", "backtrack")
     2. This file then REPLAYS the recorded moves on the board, a few per
        second, so you can watch the algorithm think.

   Sections:  1 elements | 2 state | 3 board | 4 typing and validation
              5 statistics and log | 6 replaying steps | 7 buttons
   ===================================================================== */

(function () {
  'use strict';

  var SIZE = 9;
  var MAX_STEPS = 50000; // longest animation we record (memory safety)

  // Slider position 1..10 -> how many steps are replayed per second
  var SPEEDS = [1, 3, 8, 20, 50, 120, 300, 800, 2500, 10000];

  /* ---------- 1. page elements ---------- */
  function $(id) { return document.getElementById(id); }

  var boardEl = $('board');
  var messageEl = $('message');
  var samplesEl = $('samples');
  var btnSolve = $('btn-solve');
  var btnPause = $('btn-pause');
  var btnStep = $('btn-step');
  var btnInstant = $('btn-instant');
  var btnReset = $('btn-reset');
  var btnClear = $('btn-clear');
  var speedEl = $('speed');
  var speedLabelEl = $('speed-label');
  var progressBarEl = $('progress-bar');
  var progressLabelEl = $('progress-label');
  var logEl = $('log');
  var logEmptyEl = $('log-empty');
  var statEls = {
    calls: $('stat-calls'),
    attempts: $('stat-attempts'),
    accepted: $('stat-accepted'),
    backtracks: $('stat-backtracks'),
    depth: $('stat-depth'),
    time: $('stat-time')
  };

  /* ---------- 2. state ---------- */
  function createGrid(fill) {
    var grid = [];
    for (var r = 0; r < SIZE; r++) {
      var row = [];
      for (var c = 0; c < SIZE; c++) row.push(fill);
      grid.push(row);
    }
    return grid;
  }

  var givens = SudokuSolver.createEmptyBoard();  // digits typed by the user / loaded sample
  var display = SudokuSolver.createEmptyBoard(); // digits currently shown on screen
  var status = createGrid('');                   // CSS state per cell: trying, placed, ...
  var conflictFlags = createGrid(false);         // true = this clue breaks a Sudoku rule
  var cells = [];                                // cells[row][col] = the <input> element

  // A "session" exists from the moment Solve/Step is pressed until Reset/Clear.
  // It holds the recorded steps and how far the replay has got.
  var session = null;
  var messageTag = '';                           // remembers what kind of message is showing

  /* ---------- 3. the board ---------- */
  function buildBoard() {
    for (var r = 0; r < SIZE; r++) {
      cells.push([]);
      for (var c = 0; c < SIZE; c++) {
        var input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'numeric';
        input.maxLength = 1;
        input.autocomplete = 'off';
        input.className = 'cell';
        input.setAttribute('aria-label', 'Row ' + (r + 1) + ', column ' + (c + 1));
        input.dataset.row = r;
        input.dataset.col = c;
        input.addEventListener('input', onCellInput);
        input.addEventListener('keydown', onCellKeyDown);
        input.addEventListener('focus', selectText);
        input.addEventListener('click', selectText);
        boardEl.appendChild(input);
        cells[r].push(input);
      }
    }
  }

  function selectText(e) { e.target.select(); } // typing replaces the old digit

  // Redraw one cell from the state arrays.
  function paintCell(r, c) {
    var el = cells[r][c];
    el.value = display[r][c] === 0 ? '' : String(display[r][c]);
    var cls = 'cell';
    if (givens[r][c] !== 0) cls += ' given';
    if (status[r][c]) cls += ' ' + status[r][c];
    if (conflictFlags[r][c]) cls += ' conflict';
    el.className = cls;
  }

  function paintAll() {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) paintCell(r, c);
    }
  }

  // Lock the grid while a session is active so nobody edits mid-search.
  function setLocked(locked) {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) cells[r][c].readOnly = locked;
    }
    boardEl.classList.toggle('locked', locked);
  }

  /* ---------- 4. typing and validation ---------- */
  function onCellInput(e) {
    var r = Number(e.target.dataset.row);
    var c = Number(e.target.dataset.col);
    if (session) { paintCell(r, c); return; } // locked, ignore

    var text = e.target.value.trim();
    if (text === '') {
      givens[r][c] = 0;
    } else if (/^[1-9]$/.test(text)) {
      givens[r][c] = Number(text);
    } else {
      // letters, 0, symbols: refuse and put the old value back
      showMessage('Only the digits 1-9 are allowed. Use Backspace to empty a cell.', 'error', 'invalid');
      paintCell(r, c);
      return;
    }
    display[r][c] = givens[r][c];
    refreshConflicts();
  }

  function onCellKeyDown(e) {
    var moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    var move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    var r = Number(e.target.dataset.row) + move[0];
    var c = Number(e.target.dataset.col) + move[1];
    if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) cells[r][c].focus();
  }

  // Mark every clue that repeats a digit in its row, column or box.
  // Returns how many cells are in conflict.
  function refreshConflicts() {
    conflictFlags = createGrid(false);
    var list = SudokuSolver.findConflicts(givens);
    for (var i = 0; i < list.length; i++) conflictFlags[list[i][0]][list[i][1]] = true;
    paintAll();
    if (list.length > 0) {
      showMessage(list.length + ' cells repeat a digit in their row, column or box. Fix the red cells before solving.', 'error', 'conflict');
    } else if (messageTag === 'conflict' || messageTag === 'invalid') {
      showMessage('Looks good. Press Solve to start.', 'info');
    }
    return list.length;
  }

  /* ---------- 5. messages, statistics and log ---------- */
  function showMessage(text, kind, tag) {
    messageEl.textContent = text;
    messageEl.className = 'message ' + (kind || 'info');
    messageTag = tag || '';
  }

  function fmt(n) { return Number(n).toLocaleString('en-US'); }

  function formatTime(ms) {
    if (ms < 0.01) return '<0.01 ms';
    if (ms < 1) return ms.toFixed(3) + ' ms';
    if (ms < 1000) return ms.toFixed(2) + ' ms';
    return (ms / 1000).toFixed(2) + ' s';
  }

  function renderStats(s) {
    statEls.calls.textContent = fmt(s.calls);
    statEls.attempts.textContent = fmt(s.attempts);
    statEls.accepted.textContent = fmt(s.accepted);
    statEls.backtracks.textContent = fmt(s.backtracks);
    statEls.depth.textContent = fmt(s.depth);
    statEls.time.textContent = s.timeMs === null ? '-' : formatTime(s.timeMs);
  }

  var ZERO_STATS = { calls: 0, attempts: 0, accepted: 0, backtracks: 0, depth: 0, timeMs: null };

  // Counters while the replay is running. A recursive call happens once at the
  // start and once per accepted digit, so calls = accepted + 1.
  function renderLiveStats() {
    var live = session.live;
    renderStats({
      calls: live.accepted + 1,
      attempts: live.attempts,
      accepted: live.accepted,
      backtracks: live.backtracks,
      depth: live.depth,
      timeMs: session.result.timeMs
    });
    var total = session.steps.length;
    progressBarEl.style.width = (total === 0 ? 100 : (session.index / total) * 100) + '%';
    progressLabelEl.textContent = 'Step ' + fmt(session.index) + ' of ' + fmt(total) +
      (session.animationCapped ? ' (animation limit)' : '');
  }

  function appendLog(lines) {
    for (var i = 0; i < lines.length; i++) {
      var li = document.createElement('li');
      li.className = lines[i].cls;
      li.textContent = lines[i].text;
      logEl.insertBefore(li, logEl.firstChild); // newest on top
    }
    while (logEl.children.length > 60) logEl.removeChild(logEl.lastChild);
    logEmptyEl.hidden = logEl.children.length > 0;
  }

  function clearLog() {
    logEl.innerHTML = '';
    logEmptyEl.hidden = false;
  }

  /* ---------- 6. replaying the recorded steps ---------- */

  // Build a session: run the solver and keep what the replay needs.
  // Returns false (with a message) if the puzzle cannot be solved yet.
  function createSession() {
    if (refreshConflicts() > 0) return false;

    if (SudokuSolver.findEmptyCell(givens) === null) {
      showMessage('The board is already full and valid, so there is nothing to solve.', 'success');
      return false;
    }

    var timed = SudokuSolver.solve(givens); // run 1: honest timing, no recording
    var recorded = SudokuSolver.solve(givens, { recordSteps: true, maxSteps: MAX_STEPS }); // run 2: for the animation

    session = {
      result: timed,
      steps: recorded.steps,
      animationCapped: recorded.stopReason === 'maxSteps',
      index: 0,
      playing: false,
      finished: false,
      timer: null,
      transient: null, // the one cell showing a temporary digit
      live: { attempts: 0, accepted: 0, backtracks: 0, depth: 0 }
    };
    setLocked(true);
    clearLog();
    renderLiveStats();
    return true;
  }

  // Show one recorded step on the board. Returns a log line.
  function applyStep(step) {
    var r = step.row, c = step.col, v = step.value;
    var live = session.live;
    var where = 'row ' + (r + 1) + ', col ' + (c + 1);

    // A digit that was only being tried in another cell disappears now.
    var t = session.transient;
    if (t && (t.r !== r || t.c !== c)) {
      display[t.r][t.c] = 0;
      status[t.r][t.c] = '';
      paintCell(t.r, t.c);
      session.transient = null;
    }

    var line;
    if (step.type === 'try') {
      display[r][c] = v;
      status[r][c] = 'trying';
      session.transient = { r: r, c: c };
      live.attempts++;
      line = { cls: 'l-try', text: 'Try ' + v + ' at ' + where };
    } else if (step.type === 'reject') {
      status[r][c] = 'rejected';
      session.transient = { r: r, c: c };
      line = { cls: 'l-reject', text: 'Reject ' + v + ': already in its row, column or box' };
    } else if (step.type === 'place') {
      status[r][c] = 'placed';
      session.transient = null;
      live.accepted++;
      live.depth++;
      line = { cls: 'l-place', text: 'Accept ' + v + ' at ' + where + ' (recursive call #' + fmt(live.accepted + 1) + ')' };
    } else { // 'backtrack'
      display[r][c] = v;
      status[r][c] = 'backtracked';
      session.transient = { r: r, c: c };
      live.backtracks++;
      live.depth--;
      line = { cls: 'l-back', text: 'Backtrack: remove ' + v + ' from ' + where };
    }
    paintCell(r, c);
    return line;
  }

  function stepsPerTick() {
    var sps = SPEEDS[Number(speedEl.value) - 1];
    return sps <= 50 ? 1 : Math.round(sps * 0.02); // at most 50 screen updates a second
  }

  function tickDelay() {
    var sps = SPEEDS[Number(speedEl.value) - 1];
    return sps <= 50 ? 1000 / sps : 20;
  }

  function tick() {
    if (!session || !session.playing) return;
    var n = stepsPerTick();
    var lines = [];
    for (var i = 0; i < n && session.index < session.steps.length; i++) {
      lines.push(applyStep(session.steps[session.index]));
      session.index++;
    }
    appendLog(lines.slice(-4)); // at high speed only the latest few lines are shown
    renderLiveStats();
    if (session.index >= session.steps.length) {
      finishSession();
    } else {
      session.timer = setTimeout(tick, tickDelay());
    }
  }

  function startPlaying() {
    if (!session || session.finished || session.playing) return;
    session.playing = true;
    showMessage('Searching... watch the board. Amber = trying, red = rejected, green = accepted, purple = backtracking.', 'info');
    session.timer = setTimeout(tick, 0);
    updateControls();
  }

  function pausePlaying() {
    if (!session) return;
    clearTimeout(session.timer);
    session.playing = false;
    updateControls();
  }

  // The replay is over (or skipped): show the final board and the real totals.
  function finishSession() {
    clearTimeout(session.timer);
    session.playing = false;
    session.finished = true;

    var res = session.result;
    var st = res.stats;

    // remove any leftover temporary digit, then draw the final board
    var t = session.transient;
    if (t) { display[t.r][t.c] = 0; status[t.r][t.c] = ''; session.transient = null; }
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (givens[r][c] !== 0) continue;
        if (res.solved) {
          display[r][c] = res.board[r][c];
          status[r][c] = 'solved';
        } else {
          display[r][c] = 0;
          status[r][c] = '';
        }
      }
    }
    paintAll();

    renderStats({
      calls: st.recursiveCalls,
      attempts: st.attempts,
      accepted: st.placements,
      backtracks: st.backtracks,
      depth: 0,
      timeMs: res.timeMs
    });
    progressBarEl.style.width = '100%';
    progressLabelEl.textContent = 'Finished';

    var totalSteps = 2 * st.attempts + st.backtracks;
    if (res.solved) {
      var text = 'Solved in ' + fmt(st.recursiveCalls) + ' recursive calls and ' + fmt(st.backtracks) + ' backtracks (' + formatTime(res.timeMs) + ').';
      if (session.animationCapped) {
        text += ' The animation covered the first ' + fmt(MAX_STEPS) + ' of ' + fmt(totalSteps) + ' steps; the rest ran instantly.';
      }
      showMessage(text, 'success');
    } else if (res.stopReason === 'maxCalls') {
      showMessage('Stopped after ' + fmt(st.recursiveCalls) + ' recursive calls (the safety limit). This puzzle is too hard for plain backtracking, which is the exponential worst case in action.', 'warn');
    } else {
      showMessage('No solution exists. The solver tried every possibility (' + fmt(st.attempts) + ' attempts, ' + fmt(st.backtracks) + ' backtracks).', 'warn');
    }
    appendLog([{ cls: 'l-info', text: res.solved ? 'Done: puzzle solved.' : 'Done: no solution found.' }]);
    updateControls();
  }

  // Remove the solver's digits, keep the clues, unlock the grid.
  function resetSolution() {
    if (session) clearTimeout(session.timer);
    session = null;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        display[r][c] = givens[r][c];
        status[r][c] = '';
      }
    }
    setLocked(false);
    paintAll();
    renderStats(ZERO_STATS);
    clearLog();
    progressBarEl.style.width = '0';
    progressLabelEl.textContent = 'No search running';
    updateControls();
  }

  /* ---------- 7. buttons ---------- */
  function updateControls() {
    var has = session !== null;
    var playing = has && session.playing;
    var done = has && session.finished;
    btnSolve.disabled = playing;
    btnPause.disabled = !has || done;
    btnPause.textContent = playing ? 'Pause' : (has && !done ? 'Resume' : 'Pause');
    btnStep.disabled = playing || done;
  }

  function onSolve() {
    if (session && session.finished) resetSolution(); // run it again from the clues
    if (!session && !createSession()) return;
    startPlaying();
  }

  function onPause() {
    if (!session || session.finished) return;
    if (session.playing) {
      pausePlaying();
      showMessage('Paused. Press Resume to continue or Step to move one move at a time.', 'info');
    } else {
      startPlaying();
    }
  }

  function onStep() {
    if (session && session.finished) return;
    if (!session && !createSession()) return;
    pausePlaying();
    if (session.index >= session.steps.length) { finishSession(); return; }
    appendLog([applyStep(session.steps[session.index])]);
    session.index++;
    renderLiveStats();
    showMessage('Stepping one move at a time. Press Step again, Resume to play, or Solve instantly to finish.', 'info');
    if (session.index >= session.steps.length) finishSession();
  }

  function onInstant() {
    if (session && session.finished) resetSolution();
    if (!session && !createSession()) return;
    clearTimeout(session.timer);
    session.index = session.steps.length;
    finishSession();
  }

  function onReset() {
    resetSolution();
    refreshConflicts();
    showMessage('Reset. The solver\'s digits are removed and your clues are kept.', 'info');
  }

  function onClear() {
    if (session) clearTimeout(session.timer);
    session = null;
    givens = SudokuSolver.createEmptyBoard();
    display = SudokuSolver.createEmptyBoard();
    status = createGrid('');
    conflictFlags = createGrid(false);
    setLocked(false);
    paintAll();
    renderStats(ZERO_STATS);
    clearLog();
    progressBarEl.style.width = '0';
    progressLabelEl.textContent = 'No search running';
    updateControls();
    showMessage('Board cleared. Type your own puzzle or load a sample.', 'info');
  }

  function loadSample(sample) {
    givens = SudokuSolver.boardFromString(sample.puzzle);
    resetSolution(); // also copies the clues to the display and unlocks the grid
    var clues = 0;
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) if (givens[r][c] !== 0) clues++;
    refreshConflicts();
    showMessage('Loaded "' + sample.label + '" (' + clues + ' clues). Press Solve to watch the search.', 'info');
  }

  function buildSampleButtons() {
    SAMPLE_PUZZLES.forEach(function (sample) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.sample = sample.key;
      b.innerHTML = '<span></span><small></small>';
      b.firstChild.textContent = sample.label;
      b.lastChild.textContent = sample.note;
      b.addEventListener('click', function () { loadSample(sample); });
      samplesEl.appendChild(b);
    });
  }

  function onSpeedChange() {
    speedLabelEl.textContent = fmt(SPEEDS[Number(speedEl.value) - 1]) + ' steps/sec';
  }

  /* ---------- start-up ---------- */
  buildBoard();
  buildSampleButtons();
  btnSolve.addEventListener('click', onSolve);
  btnPause.addEventListener('click', onPause);
  btnStep.addEventListener('click', onStep);
  btnInstant.addEventListener('click', onInstant);
  btnReset.addEventListener('click', onReset);
  btnClear.addEventListener('click', onClear);
  speedEl.addEventListener('input', onSpeedChange);
  onSpeedChange();
  renderStats(ZERO_STATS);
  updateControls();
  loadSample(SAMPLE_PUZZLES[0]); // start with the Easy puzzle so the page is never empty
})();
