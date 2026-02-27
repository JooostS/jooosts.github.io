(() => {
  'use strict';

  const COLS = 7;
  const ROWS = 6;

  const PLAYER_RED = 'R';
  const PLAYER_YELLOW = 'Y';

  const STORAGE_KEY = 'connect4_pwa_state_v1';

  const el = {
    board: document.getElementById('board'),
    turnDot: document.getElementById('turnDot'),
    turnText: document.getElementById('turnText'),
    messageText: document.getElementById('messageText'),
    liveRegion: document.getElementById('liveRegion'),
    selectedColText: document.getElementById('selectedColText'),

    scoreRed: document.getElementById('scoreRed'),
    scoreYellow: document.getElementById('scoreYellow'),
    scoreDraw: document.getElementById('scoreDraw'),

    newGameBtn: document.getElementById('newGameBtn'),
    undoBtn: document.getElementById('undoBtn'),
    resetScoreBtn: document.getElementById('resetScoreBtn'),
    installBtn: document.getElementById('installBtn'),
  };

  /** @type {{
   *   board: string[][],
   *   currentPlayer: 'R'|'Y',
   *   gameOver: boolean,
   *   message: string,
   *   winner: null|'R'|'Y',
   *   winningCells: Array<{r:number,c:number}>,
   *   moves: Array<{c:number,r:number,p:'R'|'Y'}>,
   *   selectedCol: number,
   *   score: {R:number,Y:number,D:number}
   * }} */
  let state = getInitialState();

  // PWA install prompt (optional)
  let deferredInstallPrompt = null;

  function getInitialState() {
    return {
      board: createEmptyBoard(),
      currentPlayer: PLAYER_RED,
      gameOver: false,
      message: 'Gebruik muis/touch of pijltjes + Enter.',
      winner: null,
      winningCells: [],
      moves: [],
      selectedCol: 0,
      score: { R: 0, Y: 0, D: 0 }
    };
  }

  function createEmptyBoard() {
    return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ''));
  }

  function opponent(p) {
    return p === PLAYER_RED ? PLAYER_YELLOW : PLAYER_RED;
  }

  function playerLabel(p) {
    return p === PLAYER_RED ? 'Rood' : 'Geel';
  }

  function announce(text) {
    // Update both visible message and ARIA live region.
    el.messageText.textContent = text;
    // Force assistive tech to re-announce even if same text repeats:
    el.liveRegion.textContent = '';
    window.setTimeout(() => { el.liveRegion.textContent = text; }, 30);
  }

  // Required by assignment: dropDisc(col)
  function dropDisc(col) {
    if (state.gameOver) {
      announce('Het spel is afgelopen. Klik op "Nieuw spel".');
      return;
    }
    if (col < 0 || col >= COLS) return;

    const row = findDropRow(col);
    if (row === -1) {
      announce('Ongeldige zet: deze kolom is vol.');
      return;
    }

    state.board[row][col] = state.currentPlayer;
    state.moves.push({ c: col, r: row, p: state.currentPlayer });

    const win = checkWin();
    if (win.winner) {
      state.gameOver = true;
      state.winner = win.winner;
      state.winningCells = win.cells;

      if (win.winner === PLAYER_RED) state.score.R += 1;
      if (win.winner === PLAYER_YELLOW) state.score.Y += 1;

      announce(`${playerLabel(win.winner)} wint!`);
      saveState();
      render();
      return;
    }

    if (checkDraw()) {
      state.gameOver = true;
      state.winner = null;
      state.winningCells = [];
      state.score.D += 1;

      announce('Gelijkspel: het bord is vol.');
      saveState();
      render();
      return;
    }

    state.currentPlayer = opponent(state.currentPlayer);
    announce(`${playerLabel(state.currentPlayer)} is aan de beurt.`);
    saveState();
    render();
  }

  function findDropRow(col) {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (state.board[r][col] === '') return r;
    }
    return -1;
  }

  // Required by assignment: checkWin()
  function checkWin() {
    const b = state.board;

    // Directions: right, down, diag down-right, diag down-left
    const dirs = [
      { dr: 0, dc: 1 },
      { dr: 1, dc: 0 },
      { dr: 1, dc: 1 },
      { dr: 1, dc: -1 }
    ];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = b[r][c];
        if (!p) continue;

        for (const { dr, dc } of dirs) {
          const cells = [{ r, c }];

          for (let k = 1; k < 4; k++) {
            const rr = r + dr * k;
            const cc = c + dc * k;
            if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) break;
            if (b[rr][cc] !== p) break;
            cells.push({ r: rr, c: cc });
          }

          if (cells.length === 4) {
            return { winner: p, cells };
          }
        }
      }
    }
    return { winner: null, cells: [] };
  }

  // Required by assignment: checkDraw()
  function checkDraw() {
    // Draw if board has no empty cells and no winner
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (state.board[r][c] === '') return false;
      }
    }
    return true;
  }

  function undo() {
    if (state.moves.length === 0) {
      announce('Niets om ongedaan te maken.');
      return;
    }

    if (state.gameOver) {
      // If we undo after game over, we should also revert score if the last move ended the game.
      if (state.winner === PLAYER_RED) state.score.R = Math.max(0, state.score.R - 1);
      if (state.winner === PLAYER_YELLOW) state.score.Y = Math.max(0, state.score.Y - 1);
      if (state.winner === null) state.score.D = Math.max(0, state.score.D - 1);
    }

    const last = state.moves.pop();
    state.board[last.r][last.c] = '';

    state.gameOver = false;
    state.winner = null;
    state.winningCells = [];

    // After undo, it's the same player's turn as the undone move
    state.currentPlayer = last.p;
    announce(`Undo: ${playerLabel(state.currentPlayer)} is aan de beurt.`);

    saveState();
    render();
  }

  function newGame(keepScore = true) {
    const score = keepScore ? { ...state.score } : { R: 0, Y: 0, D: 0 };
    state = getInitialState();
    state.score = score;
    announce('Nieuw spel gestart. Rood begint.');
    saveState();
    render();
  }

  function resetScore() {
    state.score = { R: 0, Y: 0, D: 0 };
    announce('Score gereset.');
    saveState();
    render();
  }

  // Required by assignment: render()
  function render() {
    // Header / status
    el.turnText.textContent = state.gameOver
      ? (state.winner ? `${playerLabel(state.winner)} wint!` : 'Gelijkspel')
      : `${playerLabel(state.currentPlayer)} is aan de beurt`;

    el.turnDot.classList.toggle('dot-red', state.currentPlayer === PLAYER_RED);
    el.turnDot.classList.toggle('dot-yellow', state.currentPlayer === PLAYER_YELLOW);

    el.scoreRed.textContent = String(state.score.R);
    el.scoreYellow.textContent = String(state.score.Y);
    el.scoreDraw.textContent = String(state.score.D);

    el.selectedColText.textContent = String(state.selectedCol + 1);
    el.undoBtn.disabled = state.moves.length === 0;

    // Board UI (single re-render, simple & robust)
    el.board.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'grid';

    // Determine winning cell lookup
    const winSet = new Set(state.winningCells.map(({ r, c }) => `${r},${c}`));

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cellBtn = document.createElement('button');
        cellBtn.type = 'button';
        cellBtn.className = 'cell-btn';

        const isSelectedCol = (c === state.selectedCol);
        cellBtn.dataset.colSelected = isSelectedCol ? 'true' : 'false';

        // Accessible labeling: we primarily play by column, but label per cell for SR users.
        const cellValue = state.board[r][c];
        const vLabel = cellValue ? playerLabel(cellValue) : 'Leeg';
        cellBtn.setAttribute('aria-label', `Rij ${r + 1}, kolom ${c + 1}: ${vLabel}. Klik om in kolom ${c + 1} te spelen.`);

        // Click: play in this column
        cellBtn.addEventListener('click', () => {
          state.selectedCol = c;
          dropDisc(c);
        });

        // Disc element
        if (cellValue) {
          const disc = document.createElement('div');
          disc.className = `disc ${cellValue === PLAYER_RED ? 'red' : 'yellow'} show`;
          cellBtn.appendChild(disc);
        }

        // Winning highlight
        if (winSet.has(`${r},${c}`)) {
          cellBtn.classList.add('win');
        }

        grid.appendChild(cellBtn);
      }
    }

    el.board.appendChild(grid);

    // Keep focus on board after actions for keyboard users
    // (but only if focus is not on a button in the top controls)
    const active = document.activeElement;
    const inTopControls = active && active.closest && active.closest('.top-actions');
    if (!inTopControls) {
      el.board.focus({ preventScroll: true });
    }
  }

  // Required by assignment: saveState(), loadState()
  function saveState() {
    try {
      const data = {
        board: state.board,
        currentPlayer: state.currentPlayer,
        gameOver: state.gameOver,
        message: el.messageText.textContent,
        winner: state.winner,
        winningCells: state.winningCells,
        moves: state.moves,
        selectedCol: state.selectedCol,
        score: state.score
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {
      // If storage fails (private mode quota etc.), game still works.
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);

      // Minimal validation
      if (!data || !Array.isArray(data.board) || data.board.length !== ROWS) return false;

      state = {
        board: data.board,
        currentPlayer: data.currentPlayer === PLAYER_YELLOW ? PLAYER_YELLOW : PLAYER_RED,
        gameOver: !!data.gameOver,
        message: typeof data.message === 'string' ? data.message : 'Welkom terug.',
        winner: (data.winner === PLAYER_RED || data.winner === PLAYER_YELLOW) ? data.winner : null,
        winningCells: Array.isArray(data.winningCells) ? data.winningCells : [],
        moves: Array.isArray(data.moves) ? data.moves : [],
        selectedCol: Number.isInteger(data.selectedCol) ? clamp(data.selectedCol, 0, COLS - 1) : 0,
        score: data.score && typeof data.score === 'object'
          ? {
              R: toSafeInt(data.score.R),
              Y: toSafeInt(data.score.Y),
              D: toSafeInt(data.score.D)
            }
          : { R: 0, Y: 0, D: 0 }
      };

      announce(state.message);
      return true;
    } catch (_) {
      return false;
    }
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function toSafeInt(x) {
    const n = Number(x);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.floor(n));
  }

  // Keyboard controls on the board container
  function onBoardKeyDown(e) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      state.selectedCol = (state.selectedCol + COLS - 1) % COLS;
      render();
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      state.selectedCol = (state.selectedCol + 1) % COLS;
      render();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dropDisc(state.selectedCol);
      return;
    }
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      newGame(true);
      return;
    }
    if (e.key === 'u' || e.key === 'U') {
      e.preventDefault();
      undo();
      return;
    }
  }

  // Service Worker registration
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', async () => {
      try {
        await navigator.serviceWorker.register('./sw.js');
        // Optional: announce offline readiness after first install
        // announce('Service worker actief. Offline support beschikbaar na eerste load.');
      } catch (_) {
        // ignore
      }
    });
  }

  // beforeinstallprompt handling (optional)
  function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent auto mini-infobar
      e.preventDefault();
      deferredInstallPrompt = e;
      el.installBtn.classList.remove('hidden');
    });

    el.installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      el.installBtn.disabled = true;
      deferredInstallPrompt.prompt();
      try {
        await deferredInstallPrompt.userChoice;
      } finally {
        deferredInstallPrompt = null;
        el.installBtn.classList.add('hidden');
        el.installBtn.disabled = false;
      }
    });
  }

  function wireUI() {
    el.board.addEventListener('keydown', onBoardKeyDown);

    el.newGameBtn.addEventListener('click', () => newGame(true));
    el.undoBtn.addEventListener('click', undo);
    el.resetScoreBtn.addEventListener('click', resetScore);

    // Allow tapping/clicking board background to focus for keyboard
    el.board.addEventListener('pointerdown', () => {
      el.board.focus({ preventScroll: true });
    });
  }

  function init() {
    wireUI();
    setupInstallPrompt();
    registerServiceWorker();

    const loaded = loadState();
    if (!loaded) {
      announce('Nieuw spel. Rood begint.');
      saveState();
    }
    render();
  }

  init();
})();