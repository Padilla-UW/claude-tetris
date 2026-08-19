'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#4a69bd', // J - blue
  '#ffb74d', // L - orange
  '#808000', // W - verde olivo
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,0,0],[8,8,0],[0,8,8]],                  // W - verde olivo
];

const PASTEL_COLORS = [
  null,
  '#a8dfe6', // I - cyan
  '#ffe9a8', // O - yellow
  '#dcb3e0', // T - purple
  '#bfe0c0', // S - green
  '#f0b8b8', // Z - red
  '#a8b8dc', // J - blue
  '#ffd3a8', // L - orange
  '#c2c28a', // W - verde olivo
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const LS_SCORES = 'tetris_scores';
const LS_BEST_COMBO = 'tetris_best_combo';
const LS_MAX_LINES = 'tetris_max_lines';
const VALID_THEMES = ['retro', 'neon', 'pastel', 'pixel'];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const overlaySave = document.getElementById('overlay-save');
const overlayLeaderboard = document.getElementById('overlay-leaderboard');
const playerNameInput = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const startScreen = document.getElementById('start-screen');
const startLeaderboard = document.getElementById('start-leaderboard');
const startBtn = document.getElementById('start-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const themeButtons = document.querySelectorAll('.theme-btn');
const pauseMenu = document.getElementById('pause-menu');
const pauseMain = document.getElementById('pause-main');
const pauseControls = document.getElementById('pause-controls');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const showControlsBtn = document.getElementById('show-controls-btn');
const backToPauseBtn = document.getElementById('back-to-pause-btn');
const startLevelSelect = document.getElementById('start-level-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let comboCount = 0, sessionBestCombo = 0;
let selectedStartLevel = 1;
let runStartLevel = 1;

function readStoredTheme() {
  try {
    return localStorage.getItem('tetris_theme');
  } catch (e) {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem('tetris_theme', theme);
  } catch (e) {
    // localStorage unavailable (e.g. file:// origin restrictions) - theme just won't persist.
  }
}

let currentTheme = readStoredTheme() || 'retro';
if (!VALID_THEMES.includes(currentTheme)) currentTheme = 'retro';

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = runStartLevel + Math.floor(lines / 10);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  const cleared = clearLines();
  if (cleared > 0) {
    comboCount++;
  } else {
    comboCount = 0;
  }
  sessionBestCombo = Math.max(sessionBestCombo, comboCount);
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function pathRoundedRect(context, x, y, w, h, r) {
  if (typeof context.roundRect === 'function') {
    context.beginPath();
    context.roundRect(x, y, w, h, r);
    return;
  }
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + w - r, y);
  context.arcTo(x + w, y, x + w, y + r, r);
  context.lineTo(x + w, y + h - r);
  context.arcTo(x + w, y + h, x + w - r, y + h, r);
  context.lineTo(x + r, y + h);
  context.arcTo(x, y + h, x, y + h - r, r);
  context.lineTo(x, y + r);
  context.arcTo(x, y, x + r, y, r);
  context.closePath();
}

function drawPixelTexture(context, px, py, size) {
  const half = size / 2;
  context.fillStyle = 'rgba(0,0,0,0.18)';
  context.fillRect(px + 1, py + 1, half - 1, half - 1);
  context.fillRect(px + half, py + half, half - 1, half - 1);
  context.fillStyle = 'rgba(255,255,255,0.16)';
  context.fillRect(px + half, py + 1, half - 1, half - 1);
  context.fillRect(px + 1, py + half, half - 1, half - 1);
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const px = x * size;
  const py = y * size;
  context.globalAlpha = alpha ?? 1;

  if (currentTheme === 'neon') {
    const color = COLORS[colorIndex];
    context.shadowBlur = 14;
    context.shadowColor = color;
    context.fillStyle = color;
    context.fillRect(px + 1, py + 1, size - 2, size - 2);
    context.shadowBlur = 0;
    context.fillStyle = 'rgba(255,255,255,0.18)';
    context.fillRect(px + 1, py + 1, size - 2, 4);
  } else if (currentTheme === 'pastel') {
    const color = PASTEL_COLORS[colorIndex] || COLORS[colorIndex];
    const r = Math.max(2, size / 5);
    pathRoundedRect(context, px + 1, py + 1, size - 2, size - 2, r);
    context.fillStyle = color;
    context.fill();
    context.save();
    context.clip();
    context.fillStyle = 'rgba(255,255,255,0.25)';
    context.fillRect(px + 1, py + 1, size - 2, 4);
    context.restore();
  } else if (currentTheme === 'pixel') {
    const color = COLORS[colorIndex];
    context.fillStyle = color;
    context.fillRect(px + 1, py + 1, size - 2, size - 2);
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(px + 1, py + 1, size - 2, 4);
    drawPixelTexture(context, px, py, size);
  } else {
    // retro (default) - unchanged original rendering
    const color = COLORS[colorIndex];
    context.fillStyle = color;
    context.fillRect(px + 1, py + 1, size - 2, size - 2);
    // highlight
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(px + 1, py + 1, size - 2, 4);
  }

  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = currentTheme === 'neon' ? '#26264a'
    : currentTheme === 'pastel' ? '#e0d5e8'
    : '#22222e';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderLeaderboard(containerEl, highlightIndex) {
  const scores = JSON.parse(localStorage.getItem(LS_SCORES) || '[]');
  const bestCombo = Number(localStorage.getItem(LS_BEST_COMBO) || 0);
  const maxLines = Number(localStorage.getItem(LS_MAX_LINES) || 0);

  const rows = scores.length
    ? scores.map((entry, i) => `
        <li class="${i === highlightIndex ? 'is-new' : ''}">
          <span class="lb-rank">${i + 1}</span>
          <span class="lb-name">${escapeHtml(entry.name)}</span>
          <span class="lb-score">${entry.score.toLocaleString()}</span>
        </li>`).join('')
    : '<li class="lb-empty">Sin puntuaciones aún</li>';

  containerEl.innerHTML = `
    <ol class="lb-list">${rows}</ol>
    <div class="lb-records">
      <span>Mejor combo: <strong>${bestCombo}</strong></span>
      <span>Máx. líneas: <strong>${maxLines}</strong></span>
    </div>`;
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  playerNameInput.value = '';
  saveScoreBtn.disabled = false;
  renderLeaderboard(overlayLeaderboard);
  overlaySave.classList.remove('hidden');
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseMenu.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    pauseMain.classList.remove('hidden');
    pauseControls.classList.add('hidden');
    pauseMenu.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (!gameOver) {
    animId = requestAnimationFrame(loop);
  }
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = selectedStartLevel;
  runStartLevel = selectedStartLevel;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  comboCount = 0;
  sessionBestCombo = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (!board) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

function applyTheme(theme) {
  if (!VALID_THEMES.includes(theme)) return;
  currentTheme = theme;
  storeTheme(theme);
  document.body.dataset.theme = theme;
  themeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
  if (board) draw();
  if (next) drawNext();
}

themeButtons.forEach(btn => {
  btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
});

restartBtn.addEventListener('click', () => {
  overlaySave.classList.add('hidden');
  init();
});

saveScoreBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim() || 'Jugador';
  const entry = { name, score, lines, level };

  const scores = JSON.parse(localStorage.getItem(LS_SCORES) || '[]');
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  const top5 = scores.slice(0, 5);
  localStorage.setItem(LS_SCORES, JSON.stringify(top5));

  const bestCombo = Number(localStorage.getItem(LS_BEST_COMBO) || 0);
  if (sessionBestCombo > bestCombo) {
    localStorage.setItem(LS_BEST_COMBO, String(sessionBestCombo));
  }

  const maxLines = Number(localStorage.getItem(LS_MAX_LINES) || 0);
  if (lines > maxLines) {
    localStorage.setItem(LS_MAX_LINES, String(lines));
  }

  const newIndex = top5.indexOf(entry);
  renderLeaderboard(overlayLeaderboard, newIndex === -1 ? undefined : newIndex);
  saveScoreBtn.disabled = true;
});

startBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  init();
});

resetRecordsBtn.addEventListener('click', () => {
  localStorage.removeItem(LS_SCORES);
  localStorage.removeItem(LS_BEST_COMBO);
  localStorage.removeItem(LS_MAX_LINES);
  renderLeaderboard(startLeaderboard);
});

resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', () => {
  pauseMenu.classList.add('hidden');
  init();
});
showControlsBtn.addEventListener('click', () => {
  pauseMain.classList.add('hidden');
  pauseControls.classList.remove('hidden');
});
backToPauseBtn.addEventListener('click', () => {
  pauseControls.classList.add('hidden');
  pauseMain.classList.remove('hidden');
});

function populateStartLevelSelect() {
  for (let lvl = 1; lvl <= 10; lvl++) {
    const option = document.createElement('option');
    option.value = lvl;
    option.textContent = lvl;
    if (lvl === selectedStartLevel) option.selected = true;
    startLevelSelect.appendChild(option);
  }
}

startLevelSelect.addEventListener('change', e => {
  selectedStartLevel = Number(e.target.value);
  if (board && !gameOver) {
    level = selectedStartLevel;
    runStartLevel = selectedStartLevel - Math.floor(lines / 10);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
});

populateStartLevelSelect();
applyTheme(currentTheme);
renderLeaderboard(startLeaderboard);
startScreen.classList.remove('hidden');
