// ══════════════════════════════════════════════════════════════════
// ── ⌨️  ЕДИНЫЙ ОБРАБОТЧИК КЛАВИАТУРЫ (только Desktop) ─────────────
// ══════════════════════════════════════════════════════════════════
// На мобиле (touch-only) клавиши недоступны — ничего не делаем.
// На десктопе WASD / ← → ↑ ↓ маршрутизируются в активную игру.
// ──────────────────────────────────────────────────────────────────
(function() {
  // Определяем, есть ли физическая клавиатура (десктоп)
  const isDesktop = () => !('ontouchstart' in window) || navigator.maxTouchPoints === 0 || window.__desktopMode;

  // Текущая активная игра (ставится через gameWindowOpen / eggStartGame)
  window._activeGame = null;

  const DIR = {
    ArrowUp:    [0, -1], ArrowDown:  [0,  1], ArrowLeft:  [-1, 0], ArrowRight: [1,  0],
    KeyW:       [0, -1], KeyS:       [0,  1], KeyA:       [-1, 0], KeyD:       [1,  0],
    'w':        [0, -1], 's':        [0,  1], 'a':        [-1, 0], 'd':        [1,  0],
  };

  document.addEventListener('keydown', function(e) {
    if (!isDesktop()) return;

    // Не перехватываем если фокус в поле ввода
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const game = window._activeGame;
    if (!game) return;

    const code = e.code; // e.g. 'ArrowUp', 'KeyW', 'Space'

    // ── Змейка ──────────────────────────────────────────────────
    if (game === 'snake') {
      const d = DIR[code];
      if (d) { e.preventDefault(); snakeDir(d[0], d[1]); return; }
      if (code === 'Space' || code === 'Enter') { e.preventDefault(); snakeTogglePause(); }
    }

    // ── Понг ────────────────────────────────────────────────────
    // Горизонтальное управление: ← A → D двигают ракетку
    if (game === 'pong') {
      if (!window._pongKeys) window._pongKeys = {};
      if (code === 'ArrowLeft'  || code === 'KeyA') { e.preventDefault(); window._pongKeys.left  = true; }
      if (code === 'ArrowRight' || code === 'KeyD') { e.preventDefault(); window._pongKeys.right = true; }
      if (code === 'ArrowUp'    || code === 'KeyW') { e.preventDefault(); window._pongKeys.up    = true; }
      if (code === 'ArrowDown'  || code === 'KeyS') { e.preventDefault(); window._pongKeys.down  = true; }
      if (code === 'Space' || code === 'Enter') { e.preventDefault(); if (!pongRunning && !pongMissed) pongStart(); }
    }

    // ── Тетрис ──────────────────────────────────────────────────
    if (game === 'tetris') {
      if (code === 'ArrowLeft'  || code === 'KeyA') { e.preventDefault(); tetMove(-1); }
      if (code === 'ArrowRight' || code === 'KeyD') { e.preventDefault(); tetMove(1); }
      if (code === 'ArrowDown'  || code === 'KeyS') { e.preventDefault(); tetDrop(); }
      if (code === 'ArrowUp'    || code === 'KeyW') { e.preventDefault(); tetRotate(); }
      if (code === 'Space')                         { e.preventDefault(); tetHardDrop(); }
      if (code === 'Enter')                         { e.preventDefault(); tetTogglePause(); }
    }

    // ── Динозаврик ──────────────────────────────────────────────
    if (game === 'dino') {
      if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') { e.preventDefault(); _cdTap(); }
      if (code === 'ArrowDown' || code === 'KeyS') { e.preventDefault(); _cdDuck(true); }
    }

    // ── Флаппи ──────────────────────────────────────────────────
    if (game === 'flappy') {
      if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') { e.preventDefault(); flappyFlap(); }
    }

    // ── Geometry Dash ───────────────────────────────────────────
    if (game === 'geodash') {
      if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') { e.preventDefault(); geoJump(); }
    }

    // ── 2048 ────────────────────────────────────────────────────
    if (game === '2048') {
      const map = { ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down',
                    KeyA:'left', KeyD:'right', KeyW:'up', KeyS:'down' };
      if (map[code]) { e.preventDefault(); g2048Swipe(map[code]); }
    }

    // ── Шашки ───────────────────────────────────────────────────
    // R = рестарт
    if (game === 'checkers') {
      if (code === 'KeyR') { e.preventDefault(); chkRestart(); }
    }

    // ── Шахматы ─────────────────────────────────────────────────
    if (game === 'chess') {
      if (code === 'KeyR') { e.preventDefault(); chessRestart(); }
    }

  });

  document.addEventListener('keyup', function(e) {
    if (!isDesktop()) return;
    if (window._activeGame === 'pong') {
      if (!window._pongKeys) return;
      if (e.code === 'ArrowLeft'  || e.code === 'KeyA') window._pongKeys.left  = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') window._pongKeys.right = false;
      if (e.code === 'ArrowUp'    || e.code === 'KeyW') window._pongKeys.up    = false;
      if (e.code === 'ArrowDown'  || e.code === 'KeyS') window._pongKeys.down  = false;
    }
    // Дино — отпустили присед
    if (window._activeGame === 'dino') {
      if (e.code === 'ArrowDown' || e.code === 'KeyS') _cdDuck(false);
    }
  });
})();

// ── 🐍 ЗМЕЙКА (v1.6.0) ───────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
let snakeRaf = null, snakeRunning = false, snakePaused = false;
let snakeGrid, snakeCells, snakeDir_v, snakeNextDir, snakeFood, snakeLen;
let snakeHi = 0, snakeSW, snakeSH, snakeCellSize;
const SNAKE_COLS = 20, SNAKE_ROWS = 24;
let snakeDifficulty = 'normal';
let dinoDifficulty   = 'normal'; // алиас для кнопок в HTML
const SNAKE_DIFF = { easy: {baseDelay:280, step:3}, normal: {baseDelay:200, step:4}, hard: {baseDelay:120, step:6} };

function snakeInit() {
  snakeHi = getHi('snake');
  const canvas = document.getElementById('snake-canvas');
  const maxW = Math.min(window.innerWidth - 64, 320);
  snakeCellSize = Math.floor(maxW / SNAKE_COLS);
  canvas.width  = snakeCellSize * SNAKE_COLS;
  canvas.height = snakeCellSize * SNAKE_ROWS;
  snakeSW = canvas.width; snakeSH = canvas.height;

  // Свайп управление
  let tx0, ty0;
  canvas.ontouchstart = e => { e.preventDefault(); tx0 = e.touches[0].clientX; ty0 = e.touches[0].clientY; };
  canvas.ontouchend   = e => {
    e.preventDefault();
    const dx = e.changedTouches[0].clientX - tx0;
    const dy = e.changedTouches[0].clientY - ty0;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) { snakeTogglePause(); return; }
    if (Math.abs(dx) > Math.abs(dy)) snakeDir(dx > 0 ? 1 : -1, 0);
    else snakeDir(0, dy > 0 ? 1 : -1);
  };
  snakeRestart();
}

function snakeRestart() {
  snakeStop();
  snakeGrid = Array.from({length: SNAKE_ROWS}, () => new Array(SNAKE_COLS).fill(0));
  const sx = Math.floor(SNAKE_COLS / 2), sy = Math.floor(SNAKE_ROWS / 2);
  snakeCells = [{x: sx, y: sy}, {x: sx-1, y: sy}, {x: sx-2, y: sy}];
  snakeCells.forEach(c => snakeGrid[c.y][c.x] = 1);
  snakeDir_v = {x: 1, y: 0}; snakeNextDir = {x: 1, y: 0};
  snakeLen = 3;
  snakePlaceFood();
  snakeRunning = true; snakePaused = false;
  snakeDraw();
  snakeSchedule();
}

function snakeStop() {
  snakeRunning = false;
  clearTimeout(snakeRaf); snakeRaf = null;
}

function snakeTogglePause() {
  if (!snakeRunning) { snakeRestart(); return; }
  snakePaused = !snakePaused;
  if (!snakePaused) snakeSchedule();
}

function snakeDir(dx, dy) { SFX.play('snakeTurn');
  // Нельзя развернуться назад
  if (dx === -snakeDir_v.x && dy === -snakeDir_v.y) return;
  snakeNextDir = {x: dx, y: dy};
}

function snakePlaceFood() {
  const empty = [];
  for (let y = 0; y < SNAKE_ROWS; y++)
    for (let x = 0; x < SNAKE_COLS; x++)
      if (!snakeGrid[y][x]) empty.push({x, y});
  if (!empty.length) return;
  snakeFood = empty[Math.floor(Math.random() * empty.length)];
}

function snakeSchedule() {
  if (!snakeRunning || snakePaused) return;
  const d = SNAKE_DIFF[snakeDifficulty] || SNAKE_DIFF.normal;
  const delay = Math.max(60, d.baseDelay - (snakeLen - 3) * d.step);
  snakeRaf = setTimeout(() => { snakeTick(); snakeDraw(); snakeSchedule(); }, delay);
}

function snakeTick() {
  snakeDir_v = {...snakeNextDir};
  const head = snakeCells[0];
  let nx = (head.x + snakeDir_v.x + SNAKE_COLS) % SNAKE_COLS;
  let ny = (head.y + snakeDir_v.y + SNAKE_ROWS) % SNAKE_ROWS;

  // Столкновение с собой (читы — игнорируем)
  if (!window._cheatSnakeWalls && snakeGrid[ny][nx] === 1) {
    snakeRunning = false;
    snakeDrawGameOver();
    SFX.play('snakeDie');
    triggerScreamer();
    if (snakeLen - 3 > snakeHi) snakeHi = saveHi('snake', snakeLen - 3);
    snakeUpdateScore();
    toast('🐍 Игра окончена! Счёт: ' + (snakeLen - 3));
    return;
  }

  const ate = snakeFood && nx === snakeFood.x && ny === snakeFood.y;
  snakeCells.unshift({x: nx, y: ny});
  snakeGrid[ny][nx] = 1;

  if (!ate) {
    const tail = snakeCells.pop();
    snakeGrid[tail.y][tail.x] = 0;
  } else {
    snakeLen++;
    SFX.play('snakeEat');
    snakePlaceFood();
    snakeUpdateScore();
  }
}

function snakeUpdateScore() {
  const el = document.getElementById('snake-score-label');
  if (el) el.textContent = 'Счёт: ' + (snakeLen - 3) + ' • Рекорд: ' + snakeHi;
}

function snakeDraw() {
  const canvas = document.getElementById('snake-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const accent = getAccent();
  const cs = snakeCellSize;

  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, snakeSW, snakeSH);

  // Сетка
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= SNAKE_COLS; x++) { ctx.beginPath(); ctx.moveTo(x*cs,0); ctx.lineTo(x*cs,snakeSH); ctx.stroke(); }
  for (let y = 0; y <= SNAKE_ROWS; y++) { ctx.beginPath(); ctx.moveTo(0,y*cs); ctx.lineTo(snakeSW,y*cs); ctx.stroke(); }

  // Еда
  if (snakeFood) {
    ctx.shadowColor = '#ff4e00'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#ff4e00';
    ctx.beginPath();
    ctx.arc(snakeFood.x*cs + cs/2, snakeFood.y*cs + cs/2, cs/2 - 2, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Змея
  snakeCells.forEach((c, i) => {
    const alpha = i === 0 ? 1 : Math.max(0.35, 1 - i / snakeCells.length * 0.65);
    ctx.shadowColor = accent; ctx.shadowBlur = i === 0 ? 10 : 0;
    // Для тела парсим accent и применяем с прозрачностью
    let bodyColor;
    if (i === 0) {
      bodyColor = accent;
    } else {
      // Пробуем распарсить HEX в RGB для прозрачности
      const hex = accent.replace('#','');
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0,2),16);
        const g2 = parseInt(hex.slice(2,4),16);
        const b2 = parseInt(hex.slice(4,6),16);
        bodyColor = `rgba(${r},${g2},${b2},${alpha})`;
      } else {
        bodyColor = accent;
      }
    }
    ctx.fillStyle = bodyColor;
    const pad = i === 0 ? 1 : 2;
    if (ctx.roundRect) ctx.roundRect(c.x*cs+pad, c.y*cs+pad, cs-pad*2, cs-pad*2, 3);
    else ctx.rect(c.x*cs+pad, c.y*cs+pad, cs-pad*2, cs-pad*2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  if (snakePaused) {
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(0, snakeSH/2-26, snakeSW, 52);
    ctx.fillStyle = '#f0ede8';
    ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('⏸ Пауза — тапни чтобы продолжить', snakeSW/2, snakeSH/2+6);
  }
}

function snakeDrawGameOver() {
  const canvas = document.getElementById('snake-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  snakeDraw();
  ctx.fillStyle = 'rgba(0,0,0,.6)';
  ctx.fillRect(0, snakeSH/2-32, snakeSW, 64);
  ctx.fillStyle = '#f0ede8';
  ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('💀 Игра окончена!', snakeSW/2, snakeSH/2-6);
  ctx.font = '13px sans-serif'; ctx.fillStyle = getAccent();
  ctx.fillText('Нажми «Заново» чтобы сыграть снова', snakeSW/2, snakeSH/2+16);
}

// ══════════════════════════════════════════════════════════════════
// ── ❌ КРЕСТИКИ-НОЛИКИ (v1.7.0) — minimax IG ─────────────────────
// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// ── ❌ КРЕСТИКИ-НОЛИКИ с мультиплеером ───────────────────────────
// ══════════════════════════════════════════════════════════════════
let tttBoard, tttXWins = 0, tttOWins = 0, tttDraws = 0, tttGameOver;
let tttMode = 'ai';       // 'ai' | 'local' | 'lan'
let tttLocalTurn = 'X';   // для local mode
let tttLanRole = null;    // 'host' | 'guest'
let tttLanPeer = null, tttLanConn = null, tttLanSymbol = null;
let tttLanReady = false;

function tttInit() { tttSetMode('ai'); }

function tttSetMode(mode) {
  tttMode = mode;
  ['ai','local','lan'].forEach(m => {
    const btn = document.getElementById('ttt-mode-' + m);
    if (btn) btn.classList.toggle('active', m === mode);
  });
  const lanPanel = document.getElementById('ttt-lan-panel');
  if (lanPanel) lanPanel.style.display = mode === 'lan' ? '' : 'none';
  // Update score labels
  const lx = document.getElementById('ttt-label-x');
  const lo = document.getElementById('ttt-label-o');
  if (mode === 'ai')    { if(lx)lx.textContent='Ты (✕)'; if(lo)lo.textContent='ИИ (◯)'; }
  if (mode === 'local') { if(lx)lx.textContent='Игрок 1 (✕)'; if(lo)lo.textContent='Игрок 2 (◯)'; }
  if (mode === 'lan')   { if(lx)lx.textContent='✕'; if(lo)lo.textContent='◯'; }
  if (mode !== 'lan') { tttLanDisconnect(); tttRestart(); }
}

function tttRestart() {
  tttBoard = Array(9).fill(null);
  tttGameOver = false;
  tttLocalTurn = 'X';
  tttRenderBoard();
  if (tttMode === 'ai')    document.getElementById('ttt-status').textContent = 'Твой ход — ставь ✕';
  if (tttMode === 'local') document.getElementById('ttt-status').textContent = 'Игрок 1 (✕) ходит';
  if (tttMode === 'lan') {
    const myTurn = tttLanSymbol === 'X';
    document.getElementById('ttt-status').textContent = tttLanReady ? (myTurn ? 'Твой ход' : 'Ждём хода противника...') : 'Ждём подключения...';
  }
  if (tttLanConn && tttLanReady) tttLanSend({type:'restart'});
}

function tttRenderBoard() {
  const el = document.getElementById('ttt-board');
  if (!el) return;
  el.innerHTML = '';
  tttBoard.forEach((v, i) => {
    const cell = document.createElement('div');
    cell.className = 'ttt-cell' + (v === 'X' ? ' x-cell' : v === 'O' ? ' o-cell' : '');
    cell.textContent = v === 'X' ? '✕' : v === 'O' ? '◯' : '';
    const canClick = !v && !tttGameOver && tttCanMove();
    if (canClick) cell.onclick = () => tttMove(i);
    el.appendChild(cell);
  });
}

function tttCanMove() {
  if (tttMode === 'ai') return true;
  if (tttMode === 'local') return true;
  if (tttMode === 'lan') return tttLanReady && !tttGameOver;
  return false;
}

function tttMove(i) {
  if (tttBoard[i] || tttGameOver) return;

  if (tttMode === 'ai') {
    SFX.play('tttPlace');
    tttBoard[i] = 'X';
    tttRenderBoard();
    const win = tttCheck(tttBoard);
    if (win === 'X') { SFX.play('tttWin'); tttEndGame('✨ Ты победил!', win); return; }
    if (tttFull(tttBoard)) { SFX.play('tttDraw'); tttEndGame('🤝 Ничья!', null); return; }
    document.getElementById('ttt-status').textContent = '🤔 ИИ думает...';
    setTimeout(() => {
      const best = tttMinimax(tttBoard, 'O', -Infinity, Infinity);
      tttBoard[best.idx] = 'O';
      SFX.play('tttPlace');
      tttRenderBoard();
      const win2 = tttCheck(tttBoard);
      if (win2 === 'O') { SFX.play('tttLose'); tttEndGame('🤖 ИИ победил!', win2); return; }
      if (tttFull(tttBoard)) { SFX.play('tttDraw'); tttEndGame('🤝 Ничья!', null); return; }
      document.getElementById('ttt-status').textContent = 'Твой ход — ставь ✕';
    }, 250);
    return;
  }

  if (tttMode === 'local') {
    SFX.play('tttPlace');
    tttBoard[i] = tttLocalTurn;
    tttRenderBoard();
    const win = tttCheck(tttBoard);
    if (win) { SFX.play(win === 'X' ? 'tttWin' : 'tttLose'); tttEndGame('🏆 Игрок ' + (win === 'X' ? '1' : '2') + ' победил!', win); return; }
    if (tttFull(tttBoard)) { SFX.play('tttDraw'); tttEndGame('🤝 Ничья!', null); return; }
    tttLocalTurn = tttLocalTurn === 'X' ? 'O' : 'X';
    document.getElementById('ttt-status').textContent = 'Игрок ' + (tttLocalTurn === 'X' ? '1' : '2') + ' (' + (tttLocalTurn === 'X' ? '✕' : '◯') + ') ходит';
    return;
  }

  if (tttMode === 'lan') {
    if (!tttLanReady || !tttLanConn) return;
    // Check it's our turn
    const myTurn = (tttLanSymbol === 'X' && tttCheck(tttBoard) === null && tttBoard.filter(Boolean).length % 2 === 0)
                || (tttLanSymbol === 'O' && tttCheck(tttBoard) === null && tttBoard.filter(Boolean).length % 2 === 1);
    if (!myTurn) return;
    SFX.play('tttPlace');
    tttBoard[i] = tttLanSymbol;
    tttLanSend({type:'move', idx: i, board: tttBoard});
    tttRenderBoard();
    const win = tttCheck(tttBoard);
    if (win) {
      SFX.play(win === tttLanSymbol ? 'tttWin' : 'tttLose');
      tttEndGame(win === tttLanSymbol ? '🏆 Ты победил!' : '😢 Противник победил', win);
      return;
    }
    if (tttFull(tttBoard)) { SFX.play('tttDraw'); tttEndGame('🤝 Ничья!', null); return; }
    document.getElementById('ttt-status').textContent = 'Ждём хода противника...';
  }
}

function tttCheck(b) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,c,d] of lines) if (b[a] && b[a]===b[c] && b[a]===b[d]) return b[a];
  return null;
}
function tttFull(b) { return b.every(v => v); }

function tttMinimax(b, player, alpha, beta) {
  const win = tttCheck(b);
  if (win === 'O') return {score: 10};
  if (win === 'X') return {score: -10};
  if (tttFull(b))  return {score: 0};
  let best = player === 'O' ? {score: -Infinity, idx: -1} : {score: Infinity, idx: -1};
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = player;
    const res = tttMinimax(b, player === 'O' ? 'X' : 'O', alpha, beta);
    b[i] = null; res.idx = i;
    if (player === 'O') { if (res.score > best.score) best = res; alpha = Math.max(alpha, best.score); }
    else                { if (res.score < best.score) best = res; beta  = Math.min(beta,  best.score); }
    if (beta <= alpha) break;
  }
  return best;
}

function tttEndGame(msg, winner) {
  tttGameOver = true;
  document.getElementById('ttt-status').textContent = msg;
  if (winner === 'X') tttXWins++;
  else if (winner === 'O') tttOWins++;
  else tttDraws++;
  document.getElementById('ttt-score-x').textContent = tttXWins;
  document.getElementById('ttt-score-o').textContent = tttOWins;
  document.getElementById('ttt-score-d').textContent = tttDraws;
  if (winner) {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const cells = document.getElementById('ttt-board')?.children;
    if (cells) for (const [a,c,d] of lines) {
      if (tttBoard[a] === winner && tttBoard[c] === winner && tttBoard[d] === winner) {
        [a,c,d].forEach(idx => cells[idx].classList.add('win')); break;
      }
    }
  }
}

// ── TTT LAN (PeerJS) ──────────────────────────────────────────────
function tttLanSetStatus(msg) {
  const el = document.getElementById('ttt-lan-status');
  if (el) el.textContent = msg;
}

// Надёжная конфигурация ICE — STUN + бесплатный TURN от open-relay
// TURN нужен для работы через VPN, мобильный NAT, корпоративные сети
const PEER_ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    // Бесплатный TURN от Open Relay Project
    {
      urls: [
        'turn:openrelayproject.org:443?transport=tcp',
        'turn:openrelayproject.org:443?transport=udp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

function makePeer(id) {
  // Если id задан — создаём с явным ID, иначе случайный
  const opts = {
    config: PEER_ICE_CONFIG,
    debug: 0,
  };
  return id ? new window.Peer(id, opts) : new window.Peer(opts);
}

// Ждём открытия пира с таймаутом 15 секунд
function waitPeerOpen(peer, onOpen, onError) {
  const timer = setTimeout(() => {
    onError('Сервер недоступен. Проверь интернет-соединение (15с таймаут)');
  }, 15000);
  peer.on('open', () => { clearTimeout(timer); onOpen(); });
  peer.on('error', e => { clearTimeout(timer); onError(e.message || String(e)); });
}

async function tttLoadPeer() {
  if (window.Peer) return window.Peer;
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.2/peerjs.min.js';
    s.onload = () => res(window.Peer);
    s.onerror = () => rej(new Error('PeerJS не загрузился — проверь интернет'));
    document.head.appendChild(s);
  });
}

async function tttLanHost() {
  tttLanSetStatus('⏳ Загружаем модуль...');
  try {
    await tttLoadPeer();
    tttLanDisconnect();
    const code = Math.random().toString(36).slice(2,8).toUpperCase();
    tttLanPeer = makePeer('ttt-' + code);
    tttLanRole = 'host'; tttLanSymbol = 'X';
    tttLanSetStatus('⏳ Подключение к серверу...');
    waitPeerOpen(tttLanPeer,
      () => {
        tttLanSetStatus('✅ Комната создана! Жди друга...');
        const cw = document.getElementById('ttt-lan-code-wrap');
        const cc = document.getElementById('ttt-lan-code');
        if (cw) cw.style.display = '';
        if (cc) cc.textContent = code;
      },
      msg => tttLanSetStatus('❌ ' + msg)
    );
    tttLanPeer.on('connection', conn => { tttLanConn = conn; tttLanSetupConn(conn); });
  } catch(e) { tttLanSetStatus('❌ ' + e.message); }
}

async function tttLanJoinPrompt() {
  const code = prompt('Введи код комнаты:');
  if (!code) return;
  tttLanSetStatus('⏳ Загружаем модуль...');
  try {
    await tttLoadPeer();
    tttLanDisconnect();
    tttLanPeer = makePeer(null);
    tttLanRole = 'guest'; tttLanSymbol = 'O';
    tttLanSetStatus('⏳ Подключение к серверу...');
    waitPeerOpen(tttLanPeer,
      () => {
        tttLanSetStatus('⏳ Соединяемся с хостом...');
        const conn = tttLanPeer.connect('ttt-' + code.trim().toUpperCase(), { reliable: true });
        tttLanConn = conn;
        tttLanSetupConn(conn);
      },
      msg => tttLanSetStatus('❌ ' + msg)
    );
  } catch(e) { tttLanSetStatus('❌ ' + e.message); }
}

function tttLanSetupConn(conn) {
  conn.on('open', () => {
    tttLanReady = true;
    tttLanSetStatus('🟢 Подключено! ' + (tttLanSymbol === 'X' ? 'Ты ходишь первым (✕)' : 'Противник ходит первым (◯ — ты)'));
    const cw = document.getElementById('ttt-lan-code-wrap');
    if (cw) cw.style.display = 'none';
    tttRestart();
  });
  conn.on('data', data => {
    if (data.type === 'move') {
      tttBoard = data.board;
      SFX.play('tttPlace');
      tttRenderBoard();
      const win = tttCheck(tttBoard);
      if (win) {
        SFX.play(win === tttLanSymbol ? 'tttWin' : 'tttLose');
        tttEndGame(win === tttLanSymbol ? '🏆 Ты победил!' : '😢 Противник победил', win);
        return;
      }
      if (tttFull(tttBoard)) { SFX.play('tttDraw'); tttEndGame('🤝 Ничья!', null); return; }
      document.getElementById('ttt-status').textContent = 'Твой ход';
    }
    if (data.type === 'restart') {
      tttBoard = Array(9).fill(null); tttGameOver = false;
      tttRenderBoard();
      const myTurn = tttLanSymbol === 'X';
      document.getElementById('ttt-status').textContent = myTurn ? 'Твой ход' : 'Ждём хода противника...';
    }
  });
  conn.on('close', () => { tttLanReady = false; tttLanSetStatus('🔴 Соединение потеряно'); });
  conn.on('error', e => tttLanSetStatus('❌ ' + e.message));
}

function tttLanSend(data) { if (tttLanConn) tttLanConn.send(data); }

function tttLanCopyCode() {
  const code = document.getElementById('ttt-lan-code')?.textContent;
  if (code && navigator.clipboard) navigator.clipboard.writeText(code).then(() => toast('📋 Код скопирован: ' + code));
  else toast('Код: ' + code);
}

function tttLanDisconnect() {
  tttLanReady = false;
  if (tttLanConn) { try { tttLanConn.close(); } catch(e){} tttLanConn = null; }
  if (tttLanPeer) { try { tttLanPeer.destroy(); } catch(e){} tttLanPeer = null; }
  const cw = document.getElementById('ttt-lan-code-wrap');
  if (cw) cw.style.display = 'none';
}

// ══════════════════════════════════════════════════════════════════
// ── 🏓 ПИНГ-ПОНГ с мультиплеером (v2.0) ─────────────────────────
// ══════════════════════════════════════════════════════════════════
let pongRaf = null, pongRunning = false;
let pongScore = 0, pongHi = 0;
let pongBall, pongPad, pongPad2, pongW, pongH, pongSpeed, pongMissed;
let pongDifficulty = 'normal';
let pongLastTime = 0;
let pongMode = 'ai';       // 'ai' | 'local' | 'lan'
let pongLanRole = null;    // 'host' | 'guest'
let pongLanPeer = null, pongLanConn = null;
let pongLanReady = false;
let pongScoreP1 = 0, pongScoreP2 = 0; // для 2p режимов
// Touch tracking для 2-player local
let pongTouch1 = null, pongTouch2 = null;

const PONG_DIFF = {
  easy:   { initSpeed: 2.0, maxSpeed: 7,  padW: 0.38 },
  normal: { initSpeed: 3.0, maxSpeed: 10, padW: 0.30 },
  hard:   { initSpeed: 4.5, maxSpeed: 14, padW: 0.22 },
};

function pongSetMode(mode) {
  pongMode = mode;
  ['ai','local','lan'].forEach(m => {
    const btn = document.getElementById('pong-mode-' + m);
    if (btn) btn.classList.toggle('active', m === mode);
  });
  const lanPanel = document.getElementById('pong-lan-panel');
  const diffPicker = document.getElementById('pong-diff-picker');
  const hint = document.getElementById('pong-local-hint');
  if (lanPanel)   lanPanel.style.display   = mode === 'lan'   ? '' : 'none';
  if (diffPicker) diffPicker.style.display = mode === 'ai'    ? '' : 'none';
  if (hint)       hint.style.display       = mode === 'local' ? '' : 'none';
  if (mode !== 'lan') { pongLanDisconnect(); }
  pongScoreP1 = 0; pongScoreP2 = 0;
  pongStop();
  setTimeout(pongInit, 50);
}

function pongInit() {
  const canvas = document.getElementById('pong-canvas');
  if (!canvas) return;
  const side = Math.min(window.innerWidth - 36, 380);
  canvas.width = side;
  // В 2p режимах нужно больше высоты — обе ракетки
  canvas.height = Math.round(side * (pongMode === 'ai' ? 1.1 : 1.25));
  pongW = canvas.width; pongH = canvas.height;
  pongHi = getHi('pong');
  pongRestart();

  // Убираем старые обработчики
  canvas.ontouchstart = null; canvas.ontouchmove = null;
  canvas.ontouchend = null; canvas.onmousemove = null; canvas.onclick = null;

  if (pongMode === 'ai') {
    // Оригинальное управление — одна ракетка снизу
    const movePad = (clientX) => {
      const rect = canvas.getBoundingClientRect();
      const scale = pongW / rect.width;
      pongPad.x = Math.max(pongPad.w/2, Math.min(pongW - pongPad.w/2, (clientX - rect.left) * scale));
    };
    canvas.ontouchstart = e => { e.preventDefault(); movePad(e.touches[0].clientX); if (!pongRunning && !pongMissed) pongStart(); };
    canvas.ontouchmove  = e => { e.preventDefault(); movePad(e.touches[0].clientX); };
    canvas.onmousemove  = e => movePad(e.clientX);
    canvas.onclick = () => { if (!pongRunning && !pongMissed) pongStart(); };
  } else {
    // 2-player: multi-touch — каждый палец управляет своей ракеткой
    // Верхняя половина → Игрок 2 (pongPad2) / Нижняя половина → Игрок 1 (pongPad)
    const handleTouches = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const scale = pongW / rect.width;
      const mid = rect.top + rect.height / 2;
      for (const t of e.touches) {
        const tx = (t.clientX - rect.left) * scale;
        if (t.clientY > mid) {
          // Bottom half → Player 1
          pongPad.x = Math.max(pongPad.w/2, Math.min(pongW - pongPad.w/2, tx));
        } else {
          // Top half → Player 2
          if (pongPad2) pongPad2.x = Math.max(pongPad2.w/2, Math.min(pongW - pongPad2.w/2, tx));
          // In LAN mode, send position to opponent
          if (pongMode === 'lan' && pongLanReady) pongLanSend({type:'pad', x: pongPad.x});
        }
      }
      if (!pongRunning && !pongMissed) pongStart();
    };
    canvas.ontouchstart = handleTouches;
    canvas.ontouchmove  = handleTouches;
    canvas.onmousemove = e => {
      const rect = canvas.getBoundingClientRect();
      const scale = pongW / rect.width;
      const tx = (e.clientX - rect.left) * scale;
      if (e.clientY > rect.top + rect.height / 2) {
        pongPad.x = Math.max(pongPad.w/2, Math.min(pongW - pongPad.w/2, tx));
      } else if (pongPad2 && pongMode === 'local') {
        pongPad2.x = Math.max(pongPad2.w/2, Math.min(pongW - pongPad2.w/2, tx));
      }
    };
    canvas.onclick = () => { if (!pongRunning) pongStart(); };
  }
}

function pongRestart() {
  pongStop();
  pongLastTime = 0;
  const diff = PONG_DIFF[pongDifficulty] || PONG_DIFF.normal;
  const padW = Math.round(pongW * diff.padW);
  pongPad  = {x: pongW/2, w: padW, h: 10, y: pongH - 22};
  pongPad2 = {x: pongW/2, w: padW, h: 10, y: 12};
  pongSpeed = diff.initSpeed; pongScore = 0; pongMissed = false; pongRunning = false;
  const angle = (Math.random() * 60 + 60) * (Math.PI/180) * (Math.random() > .5 ? 1 : -1);
  const vy = pongMode === 'ai' ? -Math.abs(Math.sin(angle)*pongSpeed) : (Math.random()>.5?1:-1)*Math.abs(Math.sin(angle)*pongSpeed);
  pongBall = {x: pongW/2, y: pongH/2, r: 8, vx: Math.cos(angle)*pongSpeed, vy, sx:1, sy:1, sqT:0, trail:[]};
  pongUpdateScore();
  pongDraw();
  if (pongMode === 'lan' && !pongLanReady) {
    _drawPongMsg('Ждём подключения...');
  } else {
    _drawPongMsg(pongMode === 'ai' ? 'Тапни для старта 🏓' : 'Тапни для старта\n↑ Игрок 2 | Игрок 1 ↓');
  }
}

function pongStart() {
  if (pongRunning) return;
  if (pongMode === 'lan' && !pongLanReady) return;
  pongRunning = true;
  if (pongMode === 'lan') pongLanSend({type:'start', ball: pongBall});
  pongLoop();
}

function pongStop() { cancelAnimationFrame(pongRaf); pongRaf = null; pongRunning = false; }

function pongLoop(ts) {
  if (!pongRunning) return;
  const dt = pongLastTime ? Math.min((ts - pongLastTime) / 16.667, 3) : 1;
  pongLastTime = ts;
  pongTick(dt); pongDraw();
  pongRaf = requestAnimationFrame(pongLoop);
}

function pongTick(dt) {
  const b = pongBall, p = pongPad, p2 = pongPad2;

  // ── Клавиатурное управление (Desktop) ───────────────────────
  if (window._pongKeys && window._activeGame === 'pong') {
    const speed = (pongW / 18) * dt;
    if (window._pongKeys.left)  p.x = Math.max(p.w/2, p.x - speed);
    if (window._pongKeys.right) p.x = Math.min(pongW - p.w/2, p.x + speed);
    // В режиме local — Игрок 2 (p2) управляется стрелками ↑↓ (W/S)
    if (p2 && pongMode === 'local') {
      if (window._pongKeys.up)   p2.x = Math.max(p2.w/2, p2.x - speed);
      if (window._pongKeys.down) p2.x = Math.min(pongW - p2.w/2, p2.x + speed);
    }
  }

  b.x += b.vx * dt; b.y += b.vy * dt;

  const now1 = performance.now();
  b.trail.push({x: b.x, y: b.y, ts: now1});
  while (b.trail.length > 0 && now1 - b.trail[0].ts > 160) b.trail.shift();

  if (b.sqT > 0) {
    b.sqT = Math.max(0, b.sqT - dt * 0.17);
    const k = b.sqT;
    b.sx = 1 + (b._sqTx || 0) * k; b.sy = 1 + (b._sqTy || 0) * k;
  } else { b.sx = 1; b.sy = 1; }

  // Wall bounce
  if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); b.sx=0.84;b.sy=1.14;b._sqTx=-0.16;b._sqTy=0.14;b.sqT=1; SFX.play('pongWall'); }
  if (b.x + b.r > pongW) { b.x = pongW - b.r; b.vx = -Math.abs(b.vx); b.sx=0.84;b.sy=1.14;b._sqTx=-0.16;b._sqTy=0.14;b.sqT=1; SFX.play('pongWall'); }

  // Bottom wall / pad1
  const padLeft = p.x - p.w/2, padRight = p.x + p.w/2;
  if (b.vy > 0 && b.y+b.r >= p.y && b.y+b.r <= p.y+p.h+4 && b.x >= padLeft-b.r && b.x <= padRight+b.r) {
    b.y = p.y - b.r;
    const hit = (b.x - p.x) / (p.w/2);
    const ba = hit * 65 * (Math.PI/180);
    pongSpeed = Math.min(pongSpeed + 0.18, PONG_DIFF[pongDifficulty].maxSpeed);
    b.vx = Math.sin(ba) * pongSpeed; b.vy = -Math.cos(ba) * pongSpeed;
    b.sx=1.16;b.sy=0.86;b._sqTx=0.16;b._sqTy=-0.14;b.sqT=1;
    SFX.play('pongHit'); SFX.play('pongScore');
    if (pongMode === 'ai') {
      pongScore++; if (pongScore > pongHi) pongHi = saveHi('pong', pongScore);
      pongUpdateScore();
    } else {
      pongScoreP1++;
      pongUpdateScore();
      if (pongMode === 'lan') pongLanSend({type:'ball', ball: b, score1: pongScoreP1, score2: pongScoreP2});
    }
  }

  // Top wall / pad2
  if (pongMode === 'ai') {
    if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); b.sx=1.14;b.sy=0.84;b._sqTx=0.14;b._sqTy=-0.16;b.sqT=1; }
  } else {
    // pad2 (top)
    const pad2Left = p2.x - p2.w/2, pad2Right = p2.x + p2.w/2;
    if (b.vy < 0 && b.y-b.r <= p2.y+p2.h && b.y-b.r >= p2.y-4 && b.x >= pad2Left-b.r && b.x <= pad2Right+b.r) {
      b.y = p2.y + p2.h + b.r;
      const hit = (b.x - p2.x) / (p2.w/2);
      const ba = hit * 65 * (Math.PI/180);
      pongSpeed = Math.min(pongSpeed + 0.18, PONG_DIFF['normal'].maxSpeed);
      b.vx = Math.sin(ba) * pongSpeed; b.vy = Math.cos(ba) * pongSpeed;
      b.sx=1.16;b.sy=0.86;b._sqTx=0.16;b._sqTy=-0.14;b.sqT=1;
      SFX.play('pongHit'); SFX.play('pongScore');
      if (pongMode === 'lan') pongLanSend({type:'ball', ball: b, score1: pongScoreP1, score2: pongScoreP2});
    }
    // Ball out top
    if (b.y - b.r < 0) {
      pongRunning = false; pongMissed = true;
      cancelAnimationFrame(pongRaf);
      SFX.play('pongLose');
      pongScoreP2++;
      pongUpdateScore();
      pongDraw();
      _drawPongRoundEnd(2);
      return;
    }
  }

  // Ball out bottom
  if (b.y - b.r > pongH) {
    pongRunning = false; pongMissed = true;
    cancelAnimationFrame(pongRaf);
    SFX.play('pongLose');
    if (pongMode === 'ai') {
      pongDraw();
      _drawPongMsg('💀 Промах! Тапни — заново');
      toast('💀 Счёт: ' + pongScore);
    } else {
      pongScoreP1++;
      pongUpdateScore();
      pongDraw();
      _drawPongRoundEnd(1);
    }
  }
}

function pongDraw() {
  const canvas = document.getElementById('pong-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const b = pongBall, p = pongPad, p2 = pongPad2;
  const accent = getAccent();
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, pongW, pongH);

  // Center line
  ctx.setLineDash([6,6]); ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, pongH/2); ctx.lineTo(pongW, pongH/2); ctx.stroke();
  ctx.setLineDash([]);

  // 2P score overlay
  if (pongMode !== 'ai') {
    ctx.font = 'bold 28px "JetBrains Mono",monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillText(pongScoreP2, pongW/2, pongH/2 - 10);
    ctx.fillText(pongScoreP1, pongW/2, pongH/2 + 30);
    // Player labels
    ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText(pongMode === 'lan' ? '👆 Противник' : '👆 Игрок 2', pongW/2, 28);
    ctx.fillText(pongMode === 'lan' ? '👇 Ты'       : '👇 Игрок 1', pongW/2, pongH - 30);
  }

  // Trail
  const trail = b.trail || [], trailDur = 160, nowT = performance.now();
  for (let i = 0; i < trail.length; i++) {
    const age = nowT - trail[i].ts, t = Math.max(0, 1 - age / trailDur);
    ctx.globalAlpha = t * t * 0.45;
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(trail[i].x, trail[i].y, b.r * (0.25 + t * 0.55), 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Ball
  const sx = b.sx||1, sy = b.sy||1;
  ctx.save(); ctx.translate(b.x, b.y); ctx.scale(sx, sy);
  ctx.shadowColor = accent; ctx.shadowBlur = 16; ctx.fillStyle = accent;
  ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0; ctx.restore();

  // Paddle 1 (bottom)
  const drawPad = (pad, color) => {
    const grad = ctx.createLinearGradient(pad.x-pad.w/2, 0, pad.x+pad.w/2, 0);
    grad.addColorStop(0, 'rgba(255,255,255,.15)'); grad.addColorStop(.5, color); grad.addColorStop(1, 'rgba(255,255,255,.15)');
    ctx.fillStyle = grad; ctx.shadowColor = color; ctx.shadowBlur = 10;
    if (ctx.roundRect) ctx.roundRect(pad.x-pad.w/2, pad.y, pad.w, pad.h, 6); else ctx.rect(pad.x-pad.w/2, pad.y, pad.w, pad.h);
    ctx.fill(); ctx.shadowBlur = 0;
  };
  drawPad(p, accent);
  // Paddle 2 (top) only in 2P modes
  if (pongMode !== 'ai' && p2) drawPad(p2, '#60cdff');

  ctx.textAlign = 'left';
}

function _drawPongRoundEnd(scorer) {
  // scorer = 1 (нижний игрок) или 2 (верхний игрок)
  const canvas = document.getElementById('pong-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const accent = getAccent();
  // Полупрозрачный тёмный фон
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, pongW, pongH);
  // Большой текст
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 28px "JetBrains Mono",monospace';
  ctx.fillText(scorer === 1 ? 'Игрок 1' : 'Игрок 2', pongW/2, pongH/2 - 22);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('забил! 🏓', pongW/2, pongH/2 + 8);
  // Счёт
  ctx.font = '14px "JetBrains Mono",monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(pongScoreP1 + ' : ' + pongScoreP2, pongW/2, pongH/2 + 34);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('Тапни — продолжить', pongW/2, pongH/2 + 56);
}

function _drawPongMsg(msg) {
  const canvas = document.getElementById('pong-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const lines = msg.split('\n');
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, pongH/2-40, pongW, lines.length*24+32);
  ctx.fillStyle = '#f0ede8'; ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    ctx.font = i === 0 ? 'bold 15px sans-serif' : '12px sans-serif';
    ctx.fillText(line, pongW/2, pongH/2 - 10 + i * 22);
  });
  canvas.onclick = () => { pongMissed = false; pongRestart(); if (pongMode !== 'lan') pongStart(); };
}

function pongUpdateScore() {
  const el = document.getElementById('pong-score-label');
  if (!el) return;
  if (pongMode === 'ai') el.textContent = 'Счёт: ' + pongScore + ' • Рекорд: ' + pongHi;
  else el.textContent = '🟠 Игрок 1: ' + pongScoreP1 + '  |  🔵 Игрок 2: ' + pongScoreP2;
}

// ── PONG LAN (PeerJS) ──────────────────────────────────────────────
function pongLanSetStatus(msg) {
  const el = document.getElementById('pong-lan-status');
  if (el) el.textContent = msg;
}

async function pongLanHost() {
  pongLanSetStatus('⏳ Загружаем модуль...');
  try {
    await tttLoadPeer(); // переиспользуем загрузчик
    pongLanDisconnect();
    const code = Math.random().toString(36).slice(2,8).toUpperCase();
    pongLanPeer = makePeer('pong-' + code);
    pongLanRole = 'host';
    pongLanSetStatus('⏳ Подключение к серверу...');
    waitPeerOpen(pongLanPeer,
      () => {
        pongLanSetStatus('✅ Комната создана! Жди друга...');
        const cw = document.getElementById('pong-lan-code-wrap');
        const cc = document.getElementById('pong-lan-code');
        if (cw) cw.style.display = '';
        if (cc) cc.textContent = code;
      },
      msg => pongLanSetStatus('❌ ' + msg)
    );
    pongLanPeer.on('connection', conn => pongLanSetupConn(conn));
  } catch(e) { pongLanSetStatus('❌ ' + e.message); }
}

async function pongLanJoinPrompt() {
  const code = prompt('Введи код комнаты:');
  if (!code) return;
  pongLanSetStatus('⏳ Загружаем модуль...');
  try {
    await tttLoadPeer();
    pongLanDisconnect();
    pongLanPeer = makePeer(null);
    pongLanRole = 'guest';
    pongLanSetStatus('⏳ Подключение к серверу...');
    waitPeerOpen(pongLanPeer,
      () => {
        pongLanSetStatus('⏳ Соединяемся с хостом...');
        const conn = pongLanPeer.connect('pong-' + code.trim().toUpperCase(), { reliable: true });
        pongLanSetupConn(conn);
      },
      msg => pongLanSetStatus('❌ ' + msg)
    );
  } catch(e) { pongLanSetStatus('❌ ' + e.message); }
}

function pongLanSetupConn(conn) {
  pongLanConn = conn;
  conn.on('open', () => {
    pongLanReady = true;
    // Host = controls bottom pad, Guest = controls top pad
    pongLanSetStatus('🟢 Подключено! ' + (pongLanRole === 'host' ? 'Ты управляешь нижней ракеткой 👇' : 'Ты управляешь верхней ракеткой 👆'));
    const cw = document.getElementById('pong-lan-code-wrap');
    if (cw) cw.style.display = 'none';
    pongRestart();
    if (pongLanRole === 'host') pongStart();
  });
  conn.on('data', data => {
    if (data.type === 'pad') {
      // Opponent moved their paddle
      if (pongLanRole === 'host') { if (pongPad2) pongPad2.x = data.x; }
      else { if (pongPad) pongPad.x = data.x; }
    }
    if (data.type === 'ball') {
      // Sync ball state from host
      if (pongLanRole === 'guest') {
        Object.assign(pongBall, data.ball);
        pongScoreP1 = data.score1; pongScoreP2 = data.score2;
        pongUpdateScore();
      }
    }
    if (data.type === 'start') {
      if (!pongRunning) { Object.assign(pongBall, data.ball); pongStart(); }
    }
  });
  conn.on('close', () => { pongLanReady = false; pongLanSetStatus('🔴 Соединение потеряно'); pongStop(); });
  conn.on('error', e => pongLanSetStatus('❌ ' + e.message));
}

function pongLanSend(data) { if (pongLanConn) pongLanConn.send(data); }

function pongLanCopyCode() {
  const code = document.getElementById('pong-lan-code')?.textContent;
  if (code && navigator.clipboard) navigator.clipboard.writeText(code).then(() => toast('📋 Код скопирован: ' + code));
  else toast('Код: ' + code);
}

function pongLanDisconnect() {
  pongLanReady = false;
  if (pongLanConn) { try { pongLanConn.close(); } catch(e){} pongLanConn = null; }
  if (pongLanPeer) { try { pongLanPeer.destroy(); } catch(e){} pongLanPeer = null; }
  const cw = document.getElementById('pong-lan-code-wrap');
  if (cw) cw.style.display = 'none';
}

// ══════════════════════════════════════════════════════════════════
// ── 🧱 ТЕТРИС (v1.9.0) ───────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
const TET_COLS = 10, TET_ROWS = 20;
const TET_PIECES = [
  { shape: [[1,1,1,1]],             color: '#00e5ff' }, // I
  { shape: [[1,1],[1,1]],           color: '#f5c518' }, // O
  { shape: [[0,1,0],[1,1,1]],       color: '#a78bfa' }, // T
  { shape: [[1,0],[1,0],[1,1]],     color: '#e87722' }, // L
  { shape: [[0,1],[0,1],[1,1]],     color: '#60cdff' }, // J
  { shape: [[0,1,1],[1,1,0]],       color: '#4caf7d' }, // S
  { shape: [[1,1,0],[0,1,1]],       color: '#c94f4f' }, // Z
];

let tetGrid, tetPiece, tetNext, tetX, tetY;
let tetScore = 0, tetHi = 0, tetLevel = 1, tetLines = 0;
let tetInterval = null, tetRunning = false, tetDead = false;
let tetCellSize, tetCanvasW, tetCanvasH;
let tetSwipeX0, tetSwipeY0, tetSwipeLastX;
let tetDifficulty = 'normal';
const TET_DIFF = { easy: {speedBase:600, minSpeed:150}, normal: {speedBase:500, minSpeed:80}, hard: {speedBase:300, minSpeed:50} };

function tetInit() {
  tetHi = getHi('tetris');
  const canvas = document.getElementById('tet-canvas');
  const maxW = Math.min(window.innerWidth - 64, 220);
  tetCellSize = Math.floor(maxW / TET_COLS);
  canvas.width  = tetCellSize * TET_COLS;
  canvas.height = tetCellSize * TET_ROWS;
  tetCanvasW = canvas.width; tetCanvasH = canvas.height;

  // Свайп: влево/вправо — двигать, вниз — ускорить, вверх — повернуть
  canvas.ontouchstart = e => {
    e.preventDefault();
    tetSwipeX0 = tetSwipeLastX = e.touches[0].clientX;
    tetSwipeY0 = e.touches[0].clientY;
  };
  canvas.ontouchmove = e => {
    e.preventDefault();
    const dx = e.touches[0].clientX - tetSwipeLastX;
    if (Math.abs(dx) >= tetCellSize) {
      tetMove(dx > 0 ? 1 : -1);
      tetSwipeLastX = e.touches[0].clientX;
    }
  };
  canvas.ontouchend = e => {
    e.preventDefault();
    const dy = e.changedTouches[0].clientY - tetSwipeY0;
    const dx = e.changedTouches[0].clientX - tetSwipeX0;
    if (dy > 40 && Math.abs(dx) < 40) tetDrop();
    else if (dy < -40 && Math.abs(dx) < 40) tetRotate();
  };

  tetRestart();
}

function tetRestart() {
  tetStop();
  tetGrid = Array.from({length: TET_ROWS}, () => new Array(TET_COLS).fill(null));
  tetScore = 0; tetLevel = 1; tetLines = 0; tetDead = false;
  tetNext = tetRandomPiece();
  tetSpawn();
  tetRunning = true;
  tetSchedule();
  tetDraw();
}

function tetStop() {
  clearInterval(tetInterval); tetInterval = null;
  tetRunning = false;
}

function tetRandomPiece() {
  return JSON.parse(JSON.stringify(TET_PIECES[Math.floor(Math.random() * TET_PIECES.length)]));
}

function tetSpawn() {
  tetPiece = tetNext;
  tetNext  = tetRandomPiece();
  tetX = Math.floor((TET_COLS - tetPiece.shape[0].length) / 2);
  tetY = 0;
  if (tetCollide(tetPiece.shape, tetX, tetY)) {
    tetDead = true; tetStop();
    SFX.play('tetGameOver');
    triggerScreamer();
    if (tetScore > tetHi) tetHi = saveHi("tetris", tetScore);
    tetUpdateScore();
    tetDraw();
    tetDrawMsg('💀 Игра окончена!');
    toast('🧱 Тетрис: ' + tetScore + ' очков');
  }
}

function tetSchedule() {
  if (window._cheatTetSlow) { setTimeout(() => { tetFall(); tetSchedule(); }, tetSpeed * 3); return; }
  const d = TET_DIFF[tetDifficulty] || TET_DIFF.normal;
  const delay = Math.max(d.minSpeed, d.speedBase - (tetLevel - 1) * 45);
  tetInterval = setInterval(() => { tetGravity(); tetDraw(); }, delay);
}

function tetGravity() {
  if (!tetRunning || tetDead) return;
  if (!tetCollide(tetPiece.shape, tetX, tetY + 1)) { tetY++; }
  else { tetLock(); }
}

function tetCollide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) {
        const nx = ox + c, ny = oy + r;
        if (nx < 0 || nx >= TET_COLS || ny >= TET_ROWS) return true;
        if (ny >= 0 && tetGrid[ny][nx]) return true;
      }
  return false;
}

function tetLock() {
  for (let r = 0; r < tetPiece.shape.length; r++)
    for (let c = 0; c < tetPiece.shape[r].length; c++)
      if (tetPiece.shape[r][c] && tetY+r >= 0)
        tetGrid[tetY+r][tetX+c] = tetPiece.color;
  tetClearLines();
  tetSpawn();
}

function tetClearLines() {
  let cleared = 0;
  for (let r = TET_ROWS - 1; r >= 0; r--) {
    if (tetGrid[r].every(v => v)) {
      tetGrid.splice(r, 1);
      tetGrid.unshift(new Array(TET_COLS).fill(null));
      cleared++; r++;
    }
  }
  if (cleared) {
    SFX.play('tetLine');
    const pts = [0, 100, 300, 500, 800][cleared] * tetLevel;
    tetScore += pts; tetLines += cleared;
    tetLevel = Math.floor(tetLines / 10) + 1;
    if (tetScore > tetHi) tetHi = saveHi("tetris", tetScore);
    tetUpdateScore();
    // Перезапланировать с новой скоростью
    tetStop();
    tetRunning = true;
    tetSchedule();
  }
}

function tetMove(dx) {
  if (tetDead || !tetRunning) return;
  if (!tetCollide(tetPiece.shape, tetX + dx, tetY)) { tetX += dx; SFX.play('tetMove'); tetDraw(); }
}

function tetRotate() {
  if (tetDead || !tetRunning) return;
  const rows = tetPiece.shape.length, cols = tetPiece.shape[0].length;
  const rotated = Array.from({length: cols}, (_, c) => Array.from({length: rows}, (_, r) => tetPiece.shape[rows-1-r][c]));
  // Kick: пробуем оригинальное место, ±1, ±2
  for (const kick of [0, -1, 1, -2, 2]) {
    if (!tetCollide(rotated, tetX + kick, tetY)) {
      tetPiece.shape = rotated; tetX += kick; SFX.play('tetRotate'); tetDraw(); return;
    }
  }
}

function tetDrop() {
  if (tetDead || !tetRunning) return;
  while (!tetCollide(tetPiece.shape, tetX, tetY + 1)) { tetY++; tetScore += 1; }
  tetUpdateScore();
  SFX.play('tetDrop');
  tetLock(); tetDraw();
}

function tetUpdateScore() {
  const el = document.getElementById('tet-score-label');
  if (el) el.textContent = 'Счёт: ' + tetScore + ' • Рекорд: ' + tetHi + ' • Уровень: ' + tetLevel;
}

function tetDraw() {
  const canvas = document.getElementById('tet-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cs = tetCellSize;
  const accent = getAccent();

  // Фон
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, tetCanvasW, tetCanvasH);

  // Сетка
  ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = .5;
  for (let x = 0; x <= TET_COLS; x++) { ctx.beginPath(); ctx.moveTo(x*cs,0); ctx.lineTo(x*cs,tetCanvasH); ctx.stroke(); }
  for (let y = 0; y <= TET_ROWS; y++) { ctx.beginPath(); ctx.moveTo(0,y*cs); ctx.lineTo(tetCanvasW,y*cs); ctx.stroke(); }

  // Уложенные блоки
  for (let r = 0; r < TET_ROWS; r++)
    for (let c = 0; c < TET_COLS; c++)
      if (tetGrid[r][c]) { _tetDrawCell(ctx, c, r, tetGrid[r][c], cs); }

  // Тень (ghost piece)
  if (!tetDead && tetRunning) {
    let ghostY = tetY;
    while (!tetCollide(tetPiece.shape, tetX, ghostY + 1)) ghostY++;
    if (ghostY !== tetY) {
      for (let r = 0; r < tetPiece.shape.length; r++)
        for (let c = 0; c < tetPiece.shape[r].length; c++)
          if (tetPiece.shape[r][c]) {
            ctx.fillStyle = 'rgba(255,255,255,.1)';
            ctx.fillRect((tetX+c)*cs+1, (ghostY+r)*cs+1, cs-2, cs-2);
          }
    }

    // Активная фигура
    for (let r = 0; r < tetPiece.shape.length; r++)
      for (let c = 0; c < tetPiece.shape[r].length; c++)
        if (tetPiece.shape[r][c]) { _tetDrawCell(ctx, tetX+c, tetY+r, tetPiece.color, cs); }
  }
}

function _tetDrawCell(ctx, cx, cy, color, cs) {
  ctx.shadowColor = color; ctx.shadowBlur = 2;
  ctx.fillStyle = color;
  if (ctx.roundRect) ctx.roundRect(cx*cs+1, cy*cs+1, cs-2, cs-2, 3);
  else ctx.rect(cx*cs+1, cy*cs+1, cs-2, cs-2);
  ctx.fill();
  // Блик
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.fillRect(cx*cs+2, cy*cs+2, cs-4, Math.floor((cs-4)*0.4));
  ctx.shadowBlur = 0;
}

function tetDrawMsg(msg) {
  const canvas = document.getElementById('tet-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(0, tetCanvasH/2-34, tetCanvasW, 68);
  ctx.fillStyle = '#f0ede8'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(msg, tetCanvasW/2, tetCanvasH/2-8);
  ctx.font = '12px sans-serif'; ctx.fillStyle = getAccent();
  ctx.fillText('Нажми «Заново» чтобы ещё раз', tetCanvasW/2, tetCanvasH/2+16);
}

// ══════════════════════════════════════════════════════════════════
// ── 🦕 CHROME DINO (v3.0 — pixel-perfect canvas, official style) ──
// ══════════════════════════════════════════════════════════════════

// ── SCREAMER (15% шанс на проигрыш в любой игре) ─────────────────
// ── Кэш: загружаем кастомное изображение скримера 1 раз ──────────
let _screamerCustomImg = null;      // null = не проверяли, false = нет файла, string = путь к файлу
let _screamerImgChecked = false;

async function _loadScreamerImage() {
  if (_screamerImgChecked) return _screamerCustomImg;
  _screamerImgChecked = true;
  // Fetch API не поддерживает file:// в Android WebView — используем Image для проверки
  const exts = ['gif','jpg','jpeg','png','webp'];
  for (const ext of exts) {
    const src = 'sounds/screamer.' + ext;
    const exists = await new Promise(resolve => {
      const img = new Image();
      img.onload  = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
    if (exists) {
      _screamerCustomImg = src;
      console.log('[SCREAMER] Image found: ' + src);
      return _screamerCustomImg;
    }
  }
  _screamerCustomImg = false;
  return false;
}
// Предзагрузка при старте (без блокировки)
setTimeout(_loadScreamerImage, 3000);

function triggerScreamer() {
  if (Math.random() > 0.15) return;
  console.log('[SCREAMER] triggered!');

  // 1. Белый экран поверх всего
  const overlay = document.createElement('div');
  overlay.id = 'screamer-overlay';
  overlay.style.cssText = [
    'position:fixed;inset:0;z-index:999999;background:#fff;',
    'display:flex;align-items:center;justify-content:center;',
    'animation:none;pointer-events:all;'
  ].join('');

  // Используем кастомное изображение если есть, иначе — встроенный SVG
  if (_screamerCustomImg) {
    overlay.innerHTML = `<img src="${_screamerCustomImg}" style="max-width:100%;max-height:100%;object-fit:contain;pointer-events:none">`;
  } else {
  // Встроенное SVG-лицо
  overlay.innerHTML = `<svg width="280" height="280" viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="140" cy="140" rx="120" ry="130" fill="#c9a87c"/>
    <ellipse cx="140" cy="160" rx="115" ry="125" fill="#d4b896"/>
    <!-- глаза -->
    <ellipse cx="95" cy="110" rx="32" ry="38" fill="#fff"/>
    <ellipse cx="185" cy="110" rx="32" ry="38" fill="#fff"/>
    <ellipse cx="95" cy="118" rx="22" ry="26" fill="#1a0a00"/>
    <ellipse cx="185" cy="118" rx="22" ry="26" fill="#1a0a00"/>
    <ellipse cx="88" cy="110" rx="9" ry="10" fill="#ff0000"/>
    <ellipse cx="178" cy="110" rx="9" ry="10" fill="#ff0000"/>
    <ellipse cx="83" cy="106" rx="3" ry="4" fill="#fff"/>
    <ellipse cx="173" cy="106" rx="3" ry="4" fill="#fff"/>
    <!-- брови -->
    <path d="M63 82 Q95 60 127 78" stroke="#3a1a00" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M153 78 Q185 60 217 82" stroke="#3a1a00" stroke-width="8" fill="none" stroke-linecap="round"/>
    <!-- нос -->
    <ellipse cx="140" cy="155" rx="14" ry="10" fill="#b8896a"/>
    <circle cx="132" cy="158" r="5" fill="#8a5a3a"/>
    <circle cx="148" cy="158" r="5" fill="#8a5a3a"/>
    <!-- рот открытый -->
    <path d="M80 195 Q140 260 200 195" fill="#1a0000" stroke="#3a0000" stroke-width="3"/>
    <path d="M80 195 Q140 220 200 195" fill="#cc2200"/>
    <!-- зубы -->
    <rect x="100" y="195" width="18" height="22" rx="3" fill="#fff"/>
    <rect x="122" y="195" width="18" height="26" rx="3" fill="#fff"/>
    <rect x="144" y="195" width="18" height="26" rx="3" fill="#fff"/>
    <rect x="166" y="195" width="14" height="22" rx="3" fill="#fff"/>
    <!-- язык -->
    <ellipse cx="140" cy="238" rx="25" ry="18" fill="#cc0033"/>
    <!-- кровь -->
    <path d="M105 220 Q110 245 108 260" stroke="#cc0000" stroke-width="4" fill="none"/>
    <path d="M160 222 Q165 248 162 265" stroke="#cc0000" stroke-width="3" fill="none"/>
    <!-- уши -->
    <ellipse cx="22" cy="140" rx="22" ry="30" fill="#c9a87c"/>
    <ellipse cx="258" cy="140" rx="22" ry="30" fill="#c9a87c"/>
  </svg>`;
  } // end if custom image

  document.body.appendChild(overlay);

  // 2. Яркость на максимум через Android bridge
  let prevBrightness = -1;
  try {
    if (window.Android && typeof window.Android.getScreenBrightness === 'function') {
      prevBrightness = window.Android.getScreenBrightness();
    }
    if (window.Android && typeof window.Android.setScreenBrightness === 'function') {
      window.Android.setScreenBrightness(255);
    }
  } catch(e) { console.warn('[SCREAMER] brightness error:', e); }

  // 3. Страшный звук через Web Audio API
  _screamerPlaySound();

  // 4. Убираем через 2 секунды
  setTimeout(() => {
    if (overlay.parentNode) overlay.remove();
    try {
      if (window.Android && typeof window.Android.setScreenBrightness === 'function') {
        window.Android.setScreenBrightness(prevBrightness >= 0 ? prevBrightness : -1);
      }
    } catch(e) {}
    console.log('[SCREAMER] done');
  }, 2000);
}

function _screamerPlaySound() {
  // Если в папке sounds/ есть screamer.ogg — используем его
  if (typeof SFX !== 'undefined' && !SFX.isMuted()) {
    // Попробуем воспроизвести из папки (громче, для скримера)
    try { SFX.play('screamer', 1.0); } catch(e) {}
  }
  // Продолжаем с процедурным звуком как дополнительный слой / fallback
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    // ── Слой 1: высокий скрим-тон (нарастающий) ──
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(200, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(3800, ctx.currentTime + 0.6);
    osc1.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 1.2);
    gain1.gain.setValueAtTime(0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 0.05);
    gain1.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.8);
    gain1.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.8);
    osc1.connect(gain1); gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 1.8);

    // ── Слой 2: второй скрим чуть ниже ──
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(180, ctx.currentTime + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(3200, ctx.currentTime + 0.7);
    osc2.frequency.setValueAtTime(900, ctx.currentTime + 1.0);
    gain2.gain.setValueAtTime(0, ctx.currentTime + 0.05);
    gain2.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 0.15);
    gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.9);
    osc2.connect(gain2); gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.05); osc2.stop(ctx.currentTime + 1.9);

    // ── Слой 3: белый шум (хрип) ──
    const bufSize = ctx.sampleRate * 1.5;
    const noiseBuffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 2000;
    noiseFilter.Q.value = 0.5;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, ctx.currentTime);
    noiseGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
    noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(ctx.destination);
    noise.start(ctx.currentTime); noise.stop(ctx.currentTime + 1.5);

    // ── Слой 4: низкий удар ──
    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(80, ctx.currentTime);
    boom.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.5);
    boomGain.gain.setValueAtTime(0.9, ctx.currentTime);
    boomGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    boom.connect(boomGain); boomGain.connect(ctx.destination);
    boom.start(ctx.currentTime); boom.stop(ctx.currentTime + 0.5);

    setTimeout(() => { try { ctx.close(); } catch(e){} }, 2500);
  } catch(e) { console.warn('[SCREAMER] audio error:', e); }
}

// ── Патчим все die-функции ────────────────────────────────────────
const _origDinoDie  = window.dinoDie;
const _origFlappyDie = window.flappyDie;
const _origGeoDie   = window.geoDie;

// ── CHROME DINO STATE ─────────────────────────────────────────────
let cdRaf = null, cdRunning = false, cdOver = false;
let cdW, cdH, cdGround;
let cdScore = 0, cdHi = 0;
let cdSpeed, cdFrameCount, cdLastTime;
let cdDayNight = 0; // 0=day, 1=night transition
let cdNightAlpha = 0;
let cdDifficulty = 'normal';

// Dino state
let cdDino = {};
// Obstacles
let cdObstacles = [];
// Clouds
let cdClouds = [];
// Stars (night)
let cdStars = [];
// Particles (dust)
let cdDust = [];
// Birds
let cdBirds = [];

const CD_DIFF = {
  easy:   { speed: 5.5, accel: 0.001,  jumpV: -13.5, gravity: 0.65 },
  normal: { speed: 7,   accel: 0.0025, jumpV: -15.5, gravity: 0.75 },
  hard:   { speed: 10,  accel: 0.005,  jumpV: -16.5, gravity: 0.90 }
};

// ══════════════════════════════════════════════════════════════════
// 🦕 CHROME DINO — точные спрайты из оригинала Chromium (canvas pixel art)
// ══════════════════════════════════════════════════════════════════

// T-Rex стоит (44×47 → 14×20 пикселей, 1=тело, 2=глаз, 3=светлый)
const CD_TREX_STAND = [
  [0,0,0,0,0,0,0,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,1,1,1,1,1,1,1,1],
  [0,0,0,0,0,0,1,1,2,1,1,1,1,1],
  [0,0,0,0,0,0,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [1,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [1,1,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,1,1,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,1,1,1,1,0,0,0,0,0,0,0],
  [0,0,0,1,1,0,1,1,0,0,0,0,0,0],
  [0,0,1,1,0,0,0,1,1,0,0,0,0,0],
  [0,0,1,0,0,0,0,0,0,0,0,0,0,0],
];

const CD_TREX_RUN1 = [
  [0,0,0,0,0,0,0,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,1,1,1,1,1,1,1,1],
  [0,0,0,0,0,0,1,1,2,1,1,1,1,1],
  [0,0,0,0,0,0,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [1,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [1,1,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,1,1,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,1,1,1,1,0,0,0,0,0,0,0],
  [0,0,0,0,1,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,1,1,0,0,0,0,0,0,0,0],
  [0,0,0,1,1,0,0,0,0,0,0,0,0,0],
];

const CD_TREX_RUN2 = [
  [0,0,0,0,0,0,0,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,1,1,1,1,1,1,1,1],
  [0,0,0,0,0,0,1,1,2,1,1,1,1,1],
  [0,0,0,0,0,0,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [1,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [1,1,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,1,1,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,1,1,1,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,0,0,0,0,0],
  [0,0,0,0,1,1,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,0,0,0,0],
];

const CD_TREX_DEAD = [
  [0,0,0,0,0,0,0,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,1,1,1,1,1,1,1,1],
  [0,0,0,0,0,0,1,1,1,1,1,1,1,1],
  [0,0,0,0,0,0,1,4,1,1,4,1,1,1], // 4=X-eye
  [0,0,0,0,0,0,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [1,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [1,1,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,1,1,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,1,1,1,1,0,0,0,0,0,0,0],
  [0,0,0,1,1,0,1,1,0,0,0,0,0,0],
  [0,0,1,1,0,0,0,1,1,0,0,0,0,0],
  [0,0,1,0,0,0,0,0,0,0,0,0,0,0],
];

const CD_TREX_DUCK1 = [
  [0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,1,2,1,1,1,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,0,1,1,1,0,0,0,0,0,0],
  [1,1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0],
];

const CD_TREX_DUCK2 = [
  [0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,1,2,1,1,1,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
  [0,1,1,1,1,0,1,1,1,0,1,0,0,0,0,0,0,0],
  [1,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0],
];

// Птеродактиль (крылья вверх/вниз)
const CD_PTERO_UP = [
  [0,0,0,1,1,0,0,0,0,0,0,0],
  [0,0,1,1,1,1,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,0,0,0,0],
  [1,1,1,1,1,1,1,1,1,0,0,0],
  [1,1,1,2,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,0,1,1,1,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,0,0,0],
];

const CD_PTERO_DOWN = [
  [0,0,0,0,0,0,1,0,0,0,0,0],
  [0,0,0,0,0,1,1,1,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,0,0,0],
  [1,1,1,1,1,1,1,1,1,1,1,0],
  [1,1,1,2,1,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,0,0,0,0,0],
  [0,0,1,1,0,0,0,0,0,0,0,0],
  [0,1,1,0,0,0,0,0,0,0,0,0],
];

// ── Отрисовка пиксельного спрайта ───────────────────────────────
function _cdDrawPixelSprite(ctx, grid, x, y, ps, color, eyeColor) {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const v = grid[r][c];
      if (!v) continue;
      if (v === 2) {
        ctx.fillStyle = eyeColor;
        ctx.fillRect(Math.round(x + c*ps), Math.round(y + r*ps), ps, ps);
      } else if (v === 4) {
        // X-eyes (dead)
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(x + c*ps), Math.round(y + r*ps), ps, ps);
        ctx.fillStyle = eyeColor;
        const s = Math.max(1, Math.floor(ps*0.35));
        ctx.fillRect(Math.round(x + c*ps), Math.round(y + r*ps), s, s);
        ctx.fillRect(Math.round(x + c*ps + ps-s), Math.round(y + r*ps), s, s);
        ctx.fillRect(Math.round(x + c*ps + Math.floor(ps/2)-Math.floor(s/2)), Math.round(y + r*ps + Math.floor(ps/2)-Math.floor(s/2)), s, s);
      } else {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(x + c*ps), Math.round(y + r*ps), ps, ps);
      }
    }
  }
}

// ── Кактусы (точный Chrome-стиль) ────────────────────────────────
// Типы: sm1/sm2/sm3 (маленькие 1-3 шт), lg1/lg2/lg3 (большие)
function _cdDrawCactus(ctx, obs, color) {
  const { x, y, type, ps } = obs;
  ctx.fillStyle = color;
  if (type.startsWith('sm')) {
    const count = parseInt(type[2]);
    const cw = ps * 5, ch = ps * 8;
    const gap = ps * 2;
    for (let i = 0; i < count; i++) {
      const bx = x + i * (cw + gap);
      // Ствол
      ctx.fillRect(bx + ps, y, ps * 3, ch);
      // Верхушка
      ctx.fillRect(bx + ps*1.5, y - ps, ps*2, ps);
      // Левая рука
      ctx.fillRect(bx, y + ch*0.25, ps, ch*0.3);
      ctx.fillRect(bx, y + ch*0.25, ps*2, ps);
      ctx.fillRect(bx + ps, y + ch*0.25 - ps, ps, ps);
      // Правая рука
      ctx.fillRect(bx + ps*4, y + ch*0.35, ps, ch*0.3);
      ctx.fillRect(bx + ps*3, y + ch*0.35, ps*2, ps);
      ctx.fillRect(bx + ps*3, y + ch*0.35 - ps, ps, ps);
    }
  } else {
    // Большой кактус
    const count = parseInt(type[2]);
    const cw = ps * 7, ch = ps * 12;
    const gap = ps * 2;
    for (let i = 0; i < count; i++) {
      const bx = x + i * (cw + gap);
      // Ствол
      ctx.fillRect(bx + ps*2, y, ps*3, ch);
      // Верхушка
      ctx.fillRect(bx + ps*2, y - ps, ps*3, ps);
      // Левая рука
      ctx.fillRect(bx, y + ch*0.2, ps*2, ch*0.3);
      ctx.fillRect(bx, y + ch*0.2, ps*3, ps*2);
      ctx.fillRect(bx + ps, y + ch*0.2 - ps*2, ps*2, ps*2);
      // Правая рука
      ctx.fillRect(bx + ps*5, y + ch*0.3, ps*2, ch*0.3);
      ctx.fillRect(bx + ps*4, y + ch*0.3, ps*3, ps*2);
      ctx.fillRect(bx + ps*4, y + ch*0.3 - ps*2, ps*2, ps*2);
    }
  }
}

// ── Облако ────────────────────────────────────────────────────────
function _cdDrawCloud(ctx, c, color) {
  ctx.fillStyle = `rgba(${color === '#535353' ? '83,83,83' : '200,200,200'},0.5)`;
  const { x, y, w } = c;
  const h = w * 0.28;
  ctx.beginPath();
  ctx.arc(x + w*0.22, y + h*0.6, h*0.55, Math.PI, 0);
  ctx.arc(x + w*0.45, y + h*0.3, h*0.75, Math.PI, 0);
  ctx.arc(x + w*0.72, y + h*0.55, h*0.5, Math.PI, 0);
  ctx.arc(x + w*0.88, y + h*0.65, h*0.38, Math.PI, 0);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
}

// ── Spawn obstacle ────────────────────────────────────────────────
function _cdSpawnObstacle() {
  const ps = _cdPixelSize();

  // Birds: начинают появляться после score 300, чаще при высокой скорости
  if (cdScore > 300 && cdSpeed > 9 && Math.random() < 0.28) {
    // Три высоты: низко (можно утиться), средне (прыгай), высоко (стой)
    const hy = [
      cdGround - ps*9,    // низко — надо пригнуться
      cdGround - ps*15,   // средне — можно прыгнуть
      cdGround - ps*22,   // высоко — просто беги
    ];
    const by = hy[Math.floor(Math.random() * hy.length)];
    cdBirds.push({ x: cdW + 20, y: by, wing: 0, wingTick: 0, ps });
    return;
  }

  // Кактус
  const types = ['sm1','sm1','sm1','sm2','sm2','sm3','lg1','lg1','lg2','lg3'];
  const type = types[Math.floor(Math.random() * types.length)];
  const cps = ps; // pixel size для кактуса = тот же

  let w, h;
  if (type.startsWith('sm')) {
    const count = parseInt(type[2]);
    h = cps * 8;
    w = count * (cps*5) + (count-1)*(cps*2);
  } else {
    const count = parseInt(type[2]);
    h = cps * 12;
    w = count * (cps*7) + (count-1)*(cps*2);
  }

  cdObstacles.push({
    x: cdW + 20,
    y: cdGround - h,
    w, h, type, ps: cps
  });
}

// ── Pixel size ────────────────────────────────────────────────────
function _cdPixelSize() { return Math.max(2, Math.round(cdH / 60)); }

// ── Init ──────────────────────────────────────────────────────────
function dinoInit() {
  cdHi = getHi('dino');
  const canvas = document.getElementById('dino-canvas');
  if (!canvas) return;
  const parent = canvas.parentElement;
  canvas.width  = Math.min(parent.offsetWidth - 4, 560);
  canvas.height = Math.round(canvas.width * 0.32);
  cdW = canvas.width; cdH = canvas.height;
  cdGround = Math.round(cdH * 0.82);
  _cdInitStars();
  _cdDrawIdle();
  canvas.ontouchstart = (e) => { e.preventDefault(); _cdTap(); };
  canvas.onclick = _cdTap;
  document.addEventListener('keydown', _cdKeyDown);
  document.addEventListener('keyup',   _cdKeyUp);
}

function _cdKeyDown(e) {
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); _cdTap(); }
  if (e.code === 'ArrowDown') { e.preventDefault(); _cdDuck(true); }
}
function _cdKeyUp(e) {
  if (e.code === 'ArrowDown') _cdDuck(false);
}

function _cdInitStars() {
  cdStars = [];
  for (let i = 0; i < 25; i++) {
    cdStars.push({
      x: Math.random() * cdW,
      y: Math.random() * (cdGround * 0.55),
      r: Math.random() < 0.5 ? 1 : 1.5,
      twinkle: Math.random()
    });
  }
}

function _cdTap() {
  if (cdOver) { dinoRestart(); return; }
  if (!cdRunning) { _cdStartGame(); return; }
  if (cdDino.onGround) _cdJump();
  else if (!cdDino.ducking) cdDino.vy = Math.max(cdDino.vy, 5); // fast fall
}

function _cdDuck(on) {
  if (!cdRunning || cdOver) return;
  cdDino.ducking = on;
  if (on && !cdDino.onGround) cdDino.vy = Math.max(cdDino.vy, 6);
}

function _cdJump() {
  if (!cdDino.onGround || cdDino.ducking) return;
  const d = CD_DIFF[cdDifficulty] || CD_DIFF.normal;
  cdDino.vy = d.jumpV;
  cdDino.onGround = false;
  SFX.play && SFX.play('dinoJump');
}

function _cdStartGame() {
  const d = CD_DIFF[cdDifficulty] || CD_DIFF.normal;
  cdRunning = true; cdOver = false;
  cdScore = 0; cdSpeed = d.speed;
  cdFrameCount = 0; cdLastTime = 0;
  cdObstacles = []; cdClouds = []; cdBirds = [];
  cdDust = [];
  cdNightAlpha = 0; cdDayNight = 0;
  cdScoreFlash = 0;

  const ps = _cdPixelSize();
  const dinoH = CD_TREX_STAND.length * ps;
  const dinoW = CD_TREX_STAND[0].length * ps;
  cdDino = {
    x: Math.round(cdW * 0.10),
    y: cdGround - dinoH,
    w: dinoW, h: dinoH,
    vy: 0, onGround: true,
    ducking: false, frame: 0, frameTick: 0
  };

  for (let i = 0; i < 3; i++) {
    cdClouds.push({
      x: cdW * (0.25 + i * 0.3),
      y: 20 + Math.random() * (cdGround * 0.35),
      w: 60 + Math.random() * 35
    });
  }

  _cdJump();
  cdRaf = requestAnimationFrame(_cdLoop);
  dinoUpdateScore();
}

function dinoRestart() {
  if (cdRaf) cancelAnimationFrame(cdRaf);
  cdRunning = false; cdOver = false;
  cdDifficulty = dinoDifficulty;
  _cdStartGame();
}

let cdScoreFlash = 0;
let cdGroundOffset = 0;

function _cdLoop(ts) {
  if (!cdRunning) return;
  const dt = Math.min(ts - (cdLastTime || ts), 50);
  cdLastTime = ts;
  cdRaf = requestAnimationFrame(_cdLoop);
  _cdTick(dt);
  _cdDraw();
}

function _cdTick(dt) {
  const d = CD_DIFF[cdDifficulty] || CD_DIFF.normal;
  const dtf = dt / 16.67;

  cdSpeed = Math.min(cdSpeed + d.accel * dtf, 20);
  cdFrameCount++;
  const prevScore = cdScore;
  cdScore = Math.floor(cdFrameCount * cdSpeed / 9);

  // Score milestone flash & sound
  const milestone = Math.floor(cdScore / 100);
  if (milestone > Math.floor(prevScore / 100) && milestone > 0) {
    cdScoreFlash = 20;
    SFX.play && SFX.play('btnClick');
  }
  if (cdScoreFlash > 0) cdScoreFlash--;

  // Day/Night каждые 700 очков
  const cycle = Math.floor(cdScore / 700) % 2;
  if (cycle !== cdDayNight) { cdDayNight = cycle; }
  if (cdDayNight === 1 && cdNightAlpha < 1) cdNightAlpha = Math.min(1, cdNightAlpha + 0.004 * dtf);
  if (cdDayNight === 0 && cdNightAlpha > 0) cdNightAlpha = Math.max(0, cdNightAlpha - 0.004 * dtf);

  const ps = _cdPixelSize();

  // Dino physics
  if (!cdDino.onGround) {
    cdDino.vy += d.gravity * dtf;
    cdDino.y  += cdDino.vy * dtf;
  }
  const duckGrid = cdDino.frame === 0 ? CD_TREX_DUCK1 : CD_TREX_DUCK2;
  const dinoH = cdDino.ducking ? duckGrid.length * ps : CD_TREX_STAND.length * ps;
  const groundY = cdGround - dinoH;
  if (cdDino.y >= groundY) {
    cdDino.y = groundY; cdDino.vy = 0; cdDino.onGround = true;
  }

  // Анимация ног
  cdDino.frameTick += dtf;
  const animSpeed = Math.max(3, 10 - cdSpeed * 0.4);
  if (cdDino.frameTick >= animSpeed) { cdDino.frame = 1 - cdDino.frame; cdDino.frameTick = 0; }

  // Земля (offset для текстуры)
  cdGroundOffset = (cdGroundOffset + cdSpeed * dtf) % 600;

  // Облака
  for (const c of cdClouds) c.x -= cdSpeed * 0.2 * dtf;
  cdClouds = cdClouds.filter(c => c.x + c.w > -10);
  if (!cdClouds.length || cdClouds[cdClouds.length-1].x < cdW - 180) {
    cdClouds.push({ x: cdW + 20, y: 15 + Math.random() * cdGround * 0.4, w: 55 + Math.random() * 40 });
  }

  // Препятствия
  const minGap = cdW * 0.35 + Math.random() * cdW * 0.35;
  const last = cdObstacles[cdObstacles.length - 1];
  const lastB = cdBirds[cdBirds.length - 1];
  const lastAny = (last ? last.x : -9999);
  const lastBX  = (lastB ? lastB.x : -9999);
  if (Math.max(lastAny, lastBX) < cdW - minGap) {
    _cdSpawnObstacle();
  }

  // Collision & move obstacles
  const dinoGrid = cdDino.ducking ? duckGrid : CD_TREX_STAND;
  const dw = dinoGrid[0].length * ps;
  const dh = dinoH;
  const margin = ps * 1.5;

  for (const obs of cdObstacles) {
    obs.x -= cdSpeed * dtf;
    if (!window._cheatNoHitbox &&
        cdDino.x + dw - margin > obs.x + margin &&
        cdDino.x + margin < obs.x + obs.w - margin &&
        cdDino.y + dh - margin > obs.y + margin &&
        cdDino.y + margin < obs.y + obs.h - margin) {
      _cdDie(); return;
    }
  }
  cdObstacles = cdObstacles.filter(o => o.x + o.w > -40);

  // Birds
  for (const b of cdBirds) {
    b.x -= cdSpeed * 1.05 * dtf;
    b.wingTick += dtf;
    const wSpeed = Math.max(5, 18 - cdSpeed);
    if (b.wingTick >= wSpeed) { b.wing = 1 - b.wing; b.wingTick = 0; }
    const bGrid = b.wing ? CD_PTERO_UP : CD_PTERO_DOWN;
    const bps = b.ps || ps;
    const bw = bGrid[0].length * bps, bh = bGrid.length * bps;
    if (!window._cheatNoHitbox &&
        cdDino.x + dw - margin > b.x + margin &&
        cdDino.x + margin < b.x + bw - margin &&
        cdDino.y + dh - margin > b.y + margin &&
        cdDino.y + margin < b.y + bh - margin) {
      _cdDie(); return;
    }
  }
  cdBirds = cdBirds.filter(b => b.x + 80 > 0);

  dinoUpdateScore();
}

function _cdDie() {
  cdRunning = false; cdOver = true;
  if (cdRaf) cancelAnimationFrame(cdRaf);
  if (cdScore > cdHi) cdHi = saveHi('dino', cdScore);
  SFX.play && SFX.play('dinoCactus');
  _cdDraw();
  dinoUpdateScore();
  toast('🦕 Счёт: ' + cdScore);
  triggerScreamer();
}

// ── DRAW ──────────────────────────────────────────────────────────
function _cdDraw() {
  const canvas = document.getElementById('dino-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const ps  = _cdPixelSize();

  // Тема
  const isDark = document.documentElement.getAttribute('data-theme') !== null &&
    document.documentElement.getAttribute('data-theme') !== 'light';
  const dayBgColor   = isDark ? '#1a1a1a' : '#ffffff';
  const nightBgColor = isDark ? '#050510' : '#0d0d2b';
  const dinoCol  = isDark
    ? `rgba(240,240,240,${0.6 + cdNightAlpha * 0.4})`
    : `rgba(83,83,83,${1 - cdNightAlpha * 0.2})`;
  const dinoNight = isDark ? '#e8e8f0' : '#ffffff';
  const mainCol  = cdNightAlpha > 0.5 ? dinoNight : dinoCol;
  const eyeCol   = cdNightAlpha > 0.5
    ? (isDark ? '#050510' : '#0d0d2b')
    : (isDark ? '#1a1a1a' : '#ffffff');

  // Фон
  ctx.fillStyle = dayBgColor;
  ctx.fillRect(0, 0, cdW, cdH);
  if (cdNightAlpha > 0) {
    ctx.globalAlpha = cdNightAlpha;
    ctx.fillStyle = nightBgColor;
    ctx.fillRect(0, 0, cdW, cdH);
    ctx.globalAlpha = 1;

    // Звёзды
    for (const s of cdStars) {
      const twink = 0.5 + 0.5 * Math.sin(s.twinkle + cdFrameCount * 0.05);
      ctx.globalAlpha = cdNightAlpha * (0.4 + 0.6 * twink);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fill();
      s.twinkle += 0.02;
    }
    ctx.globalAlpha = 1;

    // Луна
    const moonX = cdW * 0.82, moonY = cdGround * 0.25;
    ctx.globalAlpha = cdNightAlpha;
    ctx.fillStyle = '#d4e0ff';
    ctx.beginPath();
    ctx.arc(moonX, moonY, ps * 4.5, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = nightBgColor;
    ctx.beginPath();
    ctx.arc(moonX + ps*1.5, moonY - ps*1, ps * 4, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Облака
  for (const c of cdClouds) _cdDrawCloud(ctx, c, mainCol);

  // Земля — основная линия
  ctx.fillStyle = mainCol;
  const groundH = Math.max(2, ps);
  ctx.fillRect(0, cdGround, cdW, groundH);

  // Земля — текстура (движущиеся точки и черточки)
  ctx.fillStyle = mainCol;
  const gOff = cdGroundOffset;
  // Большие камни
  const bigStones = [0, 120, 240, 320, 440, 520, 600];
  for (const base of bigStones) {
    const gx = ((base - gOff % 600) % 600 + 600) % 600;
    if (gx < cdW) {
      ctx.fillRect(Math.round(gx * (cdW/600)), cdGround + groundH, ps*3, ps);
    }
  }
  // Мелкие точки
  const smStones = [50, 150, 200, 310, 390, 470, 530, 590];
  for (const base of smStones) {
    const gx = ((base - gOff % 600) % 600 + 600) % 600;
    if (gx < cdW) {
      ctx.fillRect(Math.round(gx * (cdW/600)), cdGround + groundH + ps, ps, ps);
    }
  }

  // Кактусы
  for (const obs of cdObstacles) {
    _cdDrawCactus(ctx, obs, mainCol);
  }

  // Птеродактили
  for (const b of cdBirds) {
    const bGrid = b.wing ? CD_PTERO_UP : CD_PTERO_DOWN;
    const bps = b.ps || ps;
    _cdDrawPixelSprite(ctx, bGrid, b.x, b.y, bps, mainCol, eyeCol);
  }

  // Динозавр
  const dino = cdDino;
  if (cdDino.ducking) {
    const dGrid = dino.frame === 0 ? CD_TREX_DUCK1 : CD_TREX_DUCK2;
    const dh = dGrid.length * ps;
    _cdDrawPixelSprite(ctx, dGrid, dino.x, cdGround - dh, ps, mainCol, eyeCol);
  } else if (cdOver) {
    // Мигающий мёртвый T-Rex
    if (Math.floor(cdFrameCount / 4) % 2 === 0) {
      _cdDrawPixelSprite(ctx, CD_TREX_DEAD, dino.x, dino.y, ps, mainCol, eyeCol);
    }
  } else if (!cdRunning) {
    _cdDrawPixelSprite(ctx, CD_TREX_STAND, dino.x, dino.y, ps, mainCol, eyeCol);
  } else {
    const runGrid = dino.onGround
      ? (dino.frame === 0 ? CD_TREX_RUN1 : CD_TREX_RUN2)
      : CD_TREX_STAND;
    _cdDrawPixelSprite(ctx, runGrid, dino.x, dino.y, ps, mainCol, eyeCol);
  }

  // ── Score display ─────────────────────────────────────────────
  const scoreVisible = cdScoreFlash === 0 || Math.floor(cdScoreFlash / 3) % 2 === 0;
  if (scoreVisible) {
    ctx.fillStyle = mainCol;
    ctx.font = `bold ${Math.max(10, ps * 3.5)}px 'JetBrains Mono', 'Courier New', monospace`;
    ctx.textAlign = 'right';
    const hi    = 'HI ' + String(cdHi).padStart(5, '0');
    const score = String(cdScore).padStart(5, '0');
    ctx.fillText(hi + '   ' + score, cdW - ps, ps * 5);
    ctx.textAlign = 'left';
  }

  // ── Overlay messages ──────────────────────────────────────────
  if (!cdRunning && !cdOver) {
    _cdDrawStartMsg(ctx, ps, mainCol, eyeCol);
  }
  if (cdOver) {
    _cdDrawGameOver(ctx, ps, mainCol, eyeCol);
  }
}

function _cdDrawStartMsg(ctx, ps, color, bg) {
  const cx = cdW / 2, cy = cdH * 0.38;
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.max(11, ps*3)}px inherit`;
  ctx.textAlign = 'center';
  ctx.fillText('Нажми или тапни, чтобы начать', cx, cy);
  ctx.textAlign = 'left';
}

function _cdDrawGameOver(ctx, ps, color, bg) {
  const cx = cdW / 2, cy = cdH * 0.33;
  const textH = Math.max(13, ps * 4);
  // GAME OVER
  ctx.fillStyle = color;
  ctx.font = `900 ${textH}px 'JetBrains Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', cx, cy);
  // Restart icon — круговая стрелка
  const r = Math.max(12, ps * 5);
  const iconY = cy + r * 1.6;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, ps * 0.8);
  ctx.beginPath();
  ctx.arc(cx, iconY, r, -Math.PI * 0.1, Math.PI * 1.7);
  ctx.stroke();
  // Стрелка наконечник
  const ax = cx + r * Math.cos(-Math.PI * 0.1);
  const ay = iconY + r * Math.sin(-Math.PI * 0.1);
  const arrowSize = Math.max(4, ps * 1.5);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(ax, ay - arrowSize);
  ctx.lineTo(ax + arrowSize * 1.2, ay);
  ctx.lineTo(ax - arrowSize * 0.3, ay + arrowSize * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = 'left';
}

function _cdDrawIdle() {
  const canvas = document.getElementById('dino-canvas');
  if (!canvas) return;
  const ps = _cdPixelSize();
  const dinoH = CD_TREX_STAND.length * ps;
  const dinoW = CD_TREX_STAND[0].length * ps;
  cdDino = {
    x: Math.round(cdW * 0.10),
    y: cdGround - dinoH,
    w: dinoW, h: dinoH,
    vy: 0, onGround: true, ducking: false, frame: 0, frameTick: 0
  };
  cdRunning = false; cdOver = false; cdScore = 0; cdSpeed = 0;
  cdNightAlpha = 0; cdClouds = []; cdObstacles = []; cdBirds = [];
  cdGroundOffset = 0; cdFrameCount = 0;
  _cdDraw();
  _cdDrawStartMsg(
    document.getElementById('dino-canvas').getContext('2d'),
    ps,
    document.documentElement.getAttribute('data-theme') !== null &&
      document.documentElement.getAttribute('data-theme') !== 'light'
      ? 'rgba(240,240,240,0.6)' : 'rgba(83,83,83,1)',
    ''
  );
}

function dinoStop() {
  if (cdRaf) cancelAnimationFrame(cdRaf);
  cdRunning = false;
  document.removeEventListener('keydown', _cdKeyDown);
  document.removeEventListener('keyup',   _cdKeyUp);
}



function dinoUpdateScore() {
  const el = document.getElementById('dino-score-label');
  if (el) el.textContent = 'Счёт: ' + cdScore + ' • Рекорд: ' + cdHi;
}


// ══════════════════════════════════════════════════════════════════
// ── 🟦 BLOCK BLAST (v2.0.0) ──────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
const BB_ROWS = 8, BB_COLS = 8;
let bbGrid, bbScore = 0, bbHi = 0, bbPieces, bbDragging = null;
let bbCellSize, bbDifficulty = 'normal';

const BB_SHAPES = [
  [[1,1],[1,1]],      // 2x2
  [[1,1,1]],          // 1x3
  [[1],[1],[1]],      // 3x1
  [[1,1,1],[0,1,0]], // T-shape
  [[1,0],[1,1]],     // L small
  [[0,1],[1,1]],     // J small
  [[1,1,0],[0,1,1]], // S
  [[0,1,1],[1,1,0]], // Z
  [[1,1,1,1]],       // I
  [[1]],             // dot
  [[1,1,1],[1,0,0]], // L
  [[1,1,1],[0,0,1]], // J
];

const BB_COLORS = ['#e87722','#00e5ff','#a78bfa','#4caf7d','#f5c518','#c94f4f','#60cdff','#f472b6'];

function bbInit() {
  bbHi = getHi("blockblast");
  const wrap = document.getElementById('bb-board-wrap');
  const maxW = Math.min(window.innerWidth - 64, 280);
  bbCellSize = Math.floor(maxW / BB_COLS);
  bbRestart();
}

function bbRestart() {
  bbGrid = Array.from({length: BB_ROWS}, () => Array(BB_COLS).fill(null));
  bbScore = 0;
  bbUpdateScore();
  bbGeneratePieces();
  bbRenderBoard();
}

function bbRandomPiece() {
  const shape = BB_SHAPES[Math.floor(Math.random() * BB_SHAPES.length)];
  const color = BB_COLORS[Math.floor(Math.random() * BB_COLORS.length)];
  return { shape, color, placed: false };
}

function bbGeneratePieces() {
  bbPieces = [bbRandomPiece(), bbRandomPiece(), bbRandomPiece()];
  bbRenderPieces();
}

function bbUpdateScore() {
  const el = document.getElementById('bb-score-label');
  if (el) el.textContent = 'Счёт: ' + bbScore + ' • Рекорд: ' + bbHi;
}

function bbRenderBoard() {
  const wrap = document.getElementById('bb-board-wrap');
  if (!wrap) return;
  const cs = bbCellSize;
  const bw = cs * BB_COLS, bh = cs * BB_ROWS;

  wrap.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.id = 'bb-canvas';
  canvas.width = bw; canvas.height = bh;
  canvas.style.borderRadius = '12px';
  canvas.style.border = '1.5px solid var(--surface3)';
  wrap.appendChild(canvas);

  canvas.addEventListener('dragover', e => { e.preventDefault(); bbOnDragOver(e, canvas); });
  canvas.addEventListener('drop',     e => { e.preventDefault(); bbOnDrop(e, canvas); });
  // Touch events for mobile drag-and-drop
  canvas.addEventListener('touchmove',  e => { e.preventDefault(); bbOnTouchMove(e, canvas); }, {passive:false});
  canvas.addEventListener('touchend',   e => { e.preventDefault(); bbOnTouchEnd(e, canvas); }, {passive:false});

  bbDrawBoard();
}

function bbDrawBoard() {
  const canvas = document.getElementById('bb-canvas'); if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cs = bbCellSize;
  ctx.fillStyle = '#181818'; ctx.fillRect(0, 0, cs*BB_COLS, cs*BB_ROWS);
  for (let r = 0; r < BB_ROWS; r++) for (let c = 0; c < BB_COLS; c++) {
    const v = bbGrid[r][c];
    if (v) {
      ctx.fillStyle = v; ctx.shadowColor = v; ctx.shadowBlur = 4;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(c*cs+1.5, r*cs+1.5, cs-3, cs-3, 3); ctx.fill(); }
      else ctx.fillRect(c*cs+1.5, r*cs+1.5, cs-3, cs-3);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(c*cs+2.5, r*cs+2.5, cs-5, (cs-5)*0.35);
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 0.5;
      ctx.strokeRect(c*cs+0.5, r*cs+0.5, cs-1, cs-1);
    }
  }
  // Drop preview
  if (bbDragging && bbDragging.previewR !== undefined) {
    const piece = bbDragging.piece;
    const pr = bbDragging.previewR, pc = bbDragging.previewC;
    const canPlace = bbCanPlace(piece.shape, pr, pc);
    piece.shape.forEach((row, dr) => row.forEach((v, dc) => {
      if (!v) return;
      const gr = pr + dr, gc = pc + dc;
      if (gr < 0 || gr >= BB_ROWS || gc < 0 || gc >= BB_COLS) return;
      ctx.fillStyle = canPlace ? (piece.color + '80') : 'rgba(201,79,79,0.5)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(gc*cs+1.5, gr*cs+1.5, cs-3, cs-3, 3); ctx.fill(); }
      else ctx.fillRect(gc*cs+1.5, gr*cs+1.5, cs-3, cs-3);
    }));
  }
}

// Piece mini-canvas rendering + drag setup
function bbRenderPieces() {
  const wrap = document.getElementById('bb-pieces-wrap'); if (!wrap) return;
  wrap.innerHTML = '';
  // Remove old global touch listeners
  document.removeEventListener('touchmove', bbDocTouchMove);
  document.removeEventListener('touchend', bbDocTouchEnd);

  bbPieces.forEach((piece, idx) => {
    if (piece.placed) { const ph = document.createElement('div'); ph.style.width='80px'; wrap.appendChild(ph); return; }
    const cs = Math.floor(bbCellSize * 0.85);
    const pw = piece.shape[0].length * cs, ph2 = piece.shape.length * cs;
    const cv = document.createElement('canvas');
    cv.width = pw; cv.height = ph2;
    cv.style.cursor = 'grab';
    cv.style.touchAction = 'none';
    cv.style.opacity = '1';
    cv.style.display = 'block';
    cv.style.flexShrink = '0';
    cv.style.transition = 'transform .15s, opacity .15s';
    wrap.appendChild(cv);
    const ctx2 = cv.getContext('2d');
    piece.shape.forEach((row, r) => row.forEach((v, c) => {
      if (!v) return;
      ctx2.fillStyle = piece.color; ctx2.shadowColor = piece.color; ctx2.shadowBlur = 3;
      if (ctx2.roundRect) { ctx2.beginPath(); ctx2.roundRect(c*cs+1, r*cs+1, cs-2, cs-2, 3); ctx2.fill(); }
      else ctx2.fillRect(c*cs+1, r*cs+1, cs-2, cs-2);
      ctx2.shadowBlur = 0;
      ctx2.fillStyle = 'rgba(255,255,255,.15)'; ctx2.fillRect(c*cs+2, r*cs+2, cs-4, (cs-4)*0.35);
    }));

    // Desktop drag
    cv.setAttribute('draggable', 'true');
    cv.addEventListener('dragstart', e => {
      // Track where within piece the user grabbed (in cell units)
      const rect = cv.getBoundingClientRect();
      const localX = e.clientX - rect.left, localY = e.clientY - rect.top;
      const grabCol = Math.floor(localX / cs), grabRow = Math.floor(localY / cs);
      bbDragging = { piece, idx, pieceCS: cs, grabRow, grabCol };
      cv.style.opacity = '0.5';
      e.dataTransfer.effectAllowed = 'move';
    });
    cv.addEventListener('dragend', () => { if (cv) cv.style.opacity = '1'; bbDragging = null; bbDrawBoard(); });

    // Mobile touch drag
    cv.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      const rect = cv.getBoundingClientRect();
      const localX = t.clientX - rect.left, localY = t.clientY - rect.top;
      const grabCol = Math.floor(localX / cs), grabRow = Math.floor(localY / cs);
      bbDragging = { piece, idx, pieceCS: cs, grabRow, grabCol };
      cv.style.transform = 'scale(1.15)';
      cv.style.opacity = '0.7';
      // Attach global doc listeners so we track movement outside piece canvas
      document.addEventListener('touchmove', bbDocTouchMove, {passive:false});
      document.addEventListener('touchend', bbDocTouchEnd, {passive:false});
    }, {passive:false});
  });
}

function bbDocTouchMove(e) {
  if (!bbDragging) return;
  e.preventDefault();
  const t = e.touches[0];
  const canvas = document.getElementById('bb-canvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const cs = bbCellSize;
  const x = t.clientX - rect.left, y = t.clientY - rect.top;
  const touchCol = Math.floor(x / cs), touchRow = Math.floor(y / cs);
  const pr = touchRow - (bbDragging.grabRow || 0);
  const pc = touchCol - (bbDragging.grabCol || 0);
  bbDragging.previewR = pr; bbDragging.previewC = pc;
  bbDrawBoard();
}

function bbDocTouchEnd(e) {
  if (!bbDragging) return;
  e.preventDefault();
  document.removeEventListener('touchmove', bbDocTouchMove);
  document.removeEventListener('touchend', bbDocTouchEnd);
  // Remove visual feedback from all piece canvases
  const wrap = document.getElementById('bb-pieces-wrap');
  if (wrap) wrap.querySelectorAll('canvas').forEach(cv => { cv.style.transform = ''; cv.style.opacity = '1'; });
  const pr = bbDragging.previewR, pc = bbDragging.previewC;
  if (pr !== undefined) {
    bbTryPlaceDirect(pr, pc);
  } else {
    bbDragging = null; bbDrawBoard();
  }
}

function bbGetGridCell(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const cs = bbCellSize;
  const x = (e.clientX !== undefined ? e.clientX : (e.touches ? e.touches[0].clientX : 0)) - rect.left;
  const y = (e.clientY !== undefined ? e.clientY : (e.touches ? e.touches[0].clientY : 0)) - rect.top;
  return { r: Math.floor(y / cs), c: Math.floor(x / cs) };
}

function bbOnDragOver(e, canvas) {
  if (!bbDragging) return;
  const { r, c } = bbGetGridCell(e, canvas);
  const pr = r - (bbDragging.grabRow || Math.floor(bbDragging.piece.shape.length / 2));
  const pc = c - (bbDragging.grabCol || Math.floor(bbDragging.piece.shape[0].length / 2));
  bbDragging.previewR = pr; bbDragging.previewC = pc;
  bbDrawBoard();
}

function bbOnTouchMove(e, canvas) {
  // handled by document-level bbDocTouchMove
}

function bbOnDrop(e, canvas) {
  if (!bbDragging) return;
  const { r, c } = bbGetGridCell(e, canvas);
  bbTryPlace(r, c);
}

function bbOnTouchEnd(e, canvas) {
  if (!bbDragging) return;
  // Use last known position from last touchmove
  const pr = bbDragging.previewR, pc = bbDragging.previewC;
  if (pr !== undefined) {
    bbTryPlaceDirect(pr, pc);
  }
  // Reset piece visuals
  const wrap = document.getElementById('bb-pieces-wrap');
  if (wrap) wrap.querySelectorAll('canvas').forEach(cv => { cv.style.transform = ''; });
  bbDragging = null;
  bbDrawBoard();
}

function bbTryPlace(r, c) {
  if (!bbDragging) return;
  const pr = r - (bbDragging.grabRow || Math.floor(bbDragging.piece.shape.length / 2));
  const pc = c - (bbDragging.grabCol || Math.floor(bbDragging.piece.shape[0].length / 2));
  bbTryPlaceDirect(pr, pc);
}

function bbCanPlace(shape, pr, pc) {
  for (let dr = 0; dr < shape.length; dr++) for (let dc = 0; dc < shape[dr].length; dc++) {
    if (!shape[dr][dc]) continue;
    const gr = pr + dr, gc = pc + dc;
    if (gr < 0 || gr >= BB_ROWS || gc < 0 || gc >= BB_COLS || bbGrid[gr][gc]) return false;
  }
  return true;
}

function bbTryPlaceDirect(pr, pc) {
  if (!bbDragging) return;
  const piece = bbDragging.piece;
  if (!bbCanPlace(piece.shape, pr, pc)) {
    toast('❌ Не влезает!'); bbDragging = null; bbDrawBoard(); return;
  }
  // Place
  piece.shape.forEach((row, dr) => row.forEach((v, dc) => {
    if (v) bbGrid[pr + dr][pc + dc] = piece.color;
  }));
  bbDragging.piece.placed = true;
  bbDragging = null;
  SFX.play('bbPlace');

  // Count cells
  let cells = 0; piece.shape.forEach(r => r.forEach(v => { if(v) cells++; }));
  bbScore += cells;
  if (bbScore > bbHi) bbHi = saveHi("blockblast", bbScore);

  bbClearLines();
  bbDrawBoard();
  bbUpdateScore();

  // If all placed, generate new
  if (bbPieces.every(p => p.placed)) setTimeout(() => { bbGeneratePieces(); bbDrawBoard(); }, 300);
  else bbRenderPieces();
}

function bbClearLines() {
  const toClear = new Set();
  // Check rows
  for (let r = 0; r < BB_ROWS; r++) if (bbGrid[r].every(v => v)) {
    for (let c = 0; c < BB_COLS; c++) toClear.add(`${r},${c}`);
  }
  // Check cols
  for (let c = 0; c < BB_COLS; c++) {
    let full = true;
    for (let r = 0; r < BB_ROWS; r++) if (!bbGrid[r][c]) { full = false; break; }
    if (full) for (let r = 0; r < BB_ROWS; r++) toClear.add(`${r},${c}`);
  }
  if (!toClear.size) return;
  SFX.play('bbLine');
  bbScore += toClear.size * 10;
  if (bbScore > bbHi) bbHi = saveHi("blockblast", bbScore);

  const canvas = document.getElementById('bb-canvas'); if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cs = bbCellSize;

  // Collect cell data for animation
  const cells = [];
  toClear.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    cells.push({ r, c, color: bbGrid[r][c], scale: 1, alpha: 1, vy: 0 });
  });

  const startTime = performance.now();
  const DURATION = 380;

  function animFrame(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / DURATION, 1);
    // Easing: fast at start, smooth out
    const ease = 1 - Math.pow(1 - t, 3);

    bbDrawBoard();

    // Draw animating cells on top
    for (const cell of cells) {
      const sc = 1 - ease * 0.8; // shrink
      const alpha = 1 - ease;
      const x = cell.c * cs + cs / 2;
      const y = cell.r * cs + cs / 2 + ease * cs * 0.4; // slight drop

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.scale(sc, sc);
      ctx.fillStyle = cell.color;
      ctx.shadowColor = cell.color;
      ctx.shadowBlur = 8 * (1 - ease);
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-cs/2 + 1.5, -cs/2 + 1.5, cs - 3, cs - 3, 3); ctx.fill(); }
      else ctx.fillRect(-cs/2 + 1.5, -cs/2 + 1.5, cs - 3, cs - 3);
      // Gleam flash at start
      if (t < 0.3) {
        ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - t / 0.3)})`;
        ctx.fillRect(-cs/2 + 1.5, -cs/2 + 1.5, cs - 3, (cs - 3) * 0.5);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;

    if (t < 1) {
      requestAnimationFrame(animFrame);
    } else {
      toClear.forEach(key => { const [r, c] = key.split(',').map(Number); bbGrid[r][c] = null; });
      bbDrawBoard();
      bbUpdateScore();
    }
  }
  requestAnimationFrame(animFrame);
}

// ══════════════════════════════════════════════════════════════════
// ── 🧱 АРКАНОИД (v2.1.0) ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
const BR_COLS = 8, BR_BRICK_ROWS = 5;
let brRaf = null, brRunning = false, brLastTime = 0;
let brScore = 0, brHi = 0, brLives = 3, brDifficulty = 'normal';
let brW, brH, brBall, brPad, brBricks, brSpeed;
let brParticles = [];
let brWaiting = true;

const BR_DIFF = {
  easy:   { speed: 4.5, padW: 0.35 },
  normal: { speed: 5.5, padW: 0.27 },
  hard:   { speed: 7,   padW: 0.20 },
};

const BR_BRICK_COLORS = [
  ['#c94f4f','#c94f4f','#c94f4f','#c94f4f','#c94f4f','#c94f4f','#c94f4f','#c94f4f'],
  ['#e87722','#e87722','#e87722','#e87722','#e87722','#e87722','#e87722','#e87722'],
  ['#f5c518','#f5c518','#f5c518','#f5c518','#f5c518','#f5c518','#f5c518','#f5c518'],
  ['#4caf7d','#4caf7d','#4caf7d','#4caf7d','#4caf7d','#4caf7d','#4caf7d','#4caf7d'],
  ['#60cdff','#60cdff','#60cdff','#60cdff','#60cdff','#60cdff','#60cdff','#60cdff'],
];

function brInit() {
  brHi = getHi("breakout");
  const canvas = document.getElementById('br-canvas');
  const w = Math.min(window.innerWidth - 36, 360);
  canvas.width = w;
  canvas.height = Math.round(w * 1.3);
  brW = canvas.width; brH = canvas.height;
  const movePad = (clientX) => {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    brPad.x = Math.max(brPad.w/2, Math.min(brW - brPad.w/2, x));
    if (brWaiting) brBall.x = brPad.x;
  };
  canvas.ontouchmove = e => { e.preventDefault(); movePad(e.touches[0].clientX); };
  canvas.ontouchstart = e => { e.preventDefault(); movePad(e.touches[0].clientX); if (brWaiting && brRunning) brLaunch(); };
  canvas.onmousemove = e => movePad(e.clientX);
  canvas.onclick = () => { if (brWaiting && brRunning) brLaunch(); };
  brRestart();
}

function brRestart() {
  brStop();
  brLastTime = 0;
  brScore = 0; brLives = 3; brWaiting = true;
  const d = BR_DIFF[brDifficulty] || BR_DIFF.normal;
  brSpeed = d.speed;
  const padW = Math.round(brW * d.padW);
  brPad = { x: brW/2, w: padW, h: 10, y: brH - 28 };
  brBall = { x: brW/2, y: brPad.y - 9, r: 7, vx: 0, vy: 0, sx:1, sy:1, sqT:0, trail:[] };
  brBricks = [];
  const bw = Math.floor((brW - 16) / BR_COLS);
  const bh = Math.round(bw * 0.38);
  const startY = 30;
  for (let row = 0; row < BR_BRICK_ROWS; row++) {
    for (let col = 0; col < BR_COLS; col++) {
      brBricks.push({
        x: 8 + col * bw, y: startY + row * (bh + 4),
        w: bw - 3, h: bh,
        color: BR_BRICK_COLORS[row][col],
        alive: true, hits: row < 2 ? 2 : 1
      });
    }
  }
  brUpdateScore();
  brRunning = true;
  brRaf = requestAnimationFrame(brLoop);
}

function brLaunch() {
  if (!brWaiting) return;
  brWaiting = false;
  const angle = (Math.random() * 40 + 70) * Math.PI / 180;
  brBall.vx = Math.cos(angle) * brSpeed * (Math.random() > 0.5 ? 1 : -1);
  brBall.vy = -Math.abs(Math.sin(angle) * brSpeed);
}

function brStop() { cancelAnimationFrame(brRaf); brRaf = null; brRunning = false; }

function brLoop(ts) {
  if (!brRunning) return;
  const dt = brLastTime ? Math.min((ts - brLastTime) / 16.667, 3) : 1;
  brLastTime = ts;
  if (!brWaiting) brTick(dt);
  brDraw();
  brRaf = requestAnimationFrame(brLoop);
}

function brTick(dt) {
  const b = brBall;
  b.x += b.vx * dt; b.y += b.vy * dt;

  // Trail — храним с временной меткой
  if (!b.trail) b.trail = [];
  const now2 = performance.now();
  b.trail.push({x: b.x, y: b.y, ts: now2});
  while (b.trail.length > 0 && now2 - b.trail[0].ts > 160) b.trail.shift();

  // Squish recovery
  if (b.sqT > 0) {
    b.sqT = Math.max(0, b.sqT - dt * 0.17);
    b.sx = 1 + (b._sqTx || 0) * b.sqT;
    b.sy = 1 + (b._sqTy || 0) * b.sqT;
  } else { b.sx = 1; b.sy = 1; }

  if (b.x - b.r < 0) {
    b.x = b.r; b.vx = Math.abs(b.vx);
    b.sx = 0.84; b.sy = 1.14; b._sqTx = -0.16; b._sqTy = 0.14; b.sqT = 1;
    SFX.play('brWall');
  }
  if (b.x + b.r > brW) {
    b.x = brW - b.r; b.vx = -Math.abs(b.vx);
    b.sx = 0.84; b.sy = 1.14; b._sqTx = -0.16; b._sqTy = 0.14; b.sqT = 1;
    SFX.play('brWall');
  }
  if (b.y - b.r < 0) {
    b.y = b.r; b.vy = Math.abs(b.vy);
    b.sx = 1.14; b.sy = 0.84; b._sqTx = 0.14; b._sqTy = -0.16; b.sqT = 1;
  }
  const pl = brPad.x - brPad.w/2, pr2 = brPad.x + brPad.w/2;
  if (b.vy > 0 && b.y + b.r >= brPad.y && b.y + b.r <= brPad.y + brPad.h + 4
      && b.x >= pl - b.r && b.x <= pr2 + b.r) {
    b.y = brPad.y - b.r;
    const hit = (b.x - brPad.x) / (brPad.w / 2);
    const angle = hit * 65 * Math.PI / 180;
    const spd = Math.sqrt(b.vx*b.vx + b.vy*b.vy);
    b.vx = Math.sin(angle) * spd;
    b.vy = -Math.cos(angle) * spd;
    b.sx = 1.16; b.sy = 0.86; b._sqTx = 0.16; b._sqTy = -0.14; b.sqT = 1;
    SFX.play('brPaddle');
  }
  let brokeCount = 0;
  for (const bk of brBricks) {
    if (!bk.alive) continue;
    if (b.x + b.r > bk.x && b.x - b.r < bk.x + bk.w &&
        b.y + b.r > bk.y && b.y - b.r < bk.y + bk.h) {
      bk.hits--;
      if (bk.hits <= 0) {
        bk.alive = false; brokeCount++;
        // Brick death particles
        if (!brParticles) brParticles = [];
        for (let i = 0; i < 8; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd2 = 1.5 + Math.random() * 2.5;
          brParticles.push({ x: bk.x + bk.w/2, y: bk.y + bk.h/2, vx: Math.cos(ang)*spd2, vy: Math.sin(ang)*spd2, life: 1, color: bk.color });
        }
        SFX.play('brBrick');
      } else {
        bk.hitTime = performance.now(); // hit flash timestamp
      }
      const overlapL = (b.x + b.r) - bk.x, overlapR = (bk.x + bk.w) - (b.x - b.r);
      const overlapT = (b.y + b.r) - bk.y, overlapB = (bk.y + bk.h) - (b.y - b.r);
      if (Math.min(overlapL, overlapR) < Math.min(overlapT, overlapB)) {
        b.vx = -b.vx;
        b.sx = 0.86; b.sy = 1.14; b._sqTx = -0.14; b._sqTy = 0.14; b.sqT = 1;
      } else {
        b.vy = -b.vy;
        b.sx = 1.14; b.sy = 0.86; b._sqTx = 0.14; b._sqTy = -0.14; b.sqT = 1;
      }
      break;
    }
  }
  if (brokeCount) { brScore += brokeCount * 10; if (brScore > brHi) brHi = saveHi("breakout", brScore); brUpdateScore(); }
  if (brBricks.every(bk => !bk.alive)) {
    brStop(); brWaiting = true;
    SFX.play('brLevelUp');
    setTimeout(() => { brRestart(); toast('🎉 Уровень пройден!'); }, 400);
    return;
  }
  if (!window._cheatBrBounce && b.y - b.r > brH) {
    brLives--;
    SFX.play('brLive');
    brUpdateScore();
    if (brLives <= 0) {
      brStop(); brRunning = false;
      brDraw(); brDrawMsg('💀 Игра окончена! Тапни чтобы снова');
      triggerScreamer();
      toast('🧱 Счёт: ' + brScore); return;
    }
    brWaiting = true;
    b.x = brPad.x; b.y = brPad.y - b.r - 2; b.vx = 0; b.vy = 0;
    b.trail = [];
    toast('❤️ Осталось жизней: ' + brLives);
  }
  // Update particles
  if (brParticles) {
    for (let i = brParticles.length - 1; i >= 0; i--) {
      const p2 = brParticles[i];
      p2.x += p2.vx * dt * 0.5; p2.y += p2.vy * dt * 0.5;
      p2.life -= dt * 0.003;
      if (p2.life <= 0) brParticles.splice(i, 1);
    }
  }
}

function brDraw() {
  const canvas = document.getElementById('br-canvas'); if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const accent = getAccent();
  ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0, 0, brW, brH);

  // Bricks
  for (const bk of brBricks) {
    if (!bk.alive) continue;
    const flashAge = bk.hitTime ? performance.now() - bk.hitTime : Infinity;
    const flashT = Math.max(0, 1 - flashAge / 120);
    ctx.globalAlpha = bk.hits > 1 ? 1 : 0.82;
    ctx.fillStyle = flashT > 0 ? `rgba(255,255,255,${flashT})` : bk.color;
    ctx.shadowColor = bk.color; ctx.shadowBlur = bk.hits > 1 ? 8 : 3;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bk.x, bk.y, bk.w, bk.h, 3); ctx.fill(); }
    else ctx.fillRect(bk.x, bk.y, bk.w, bk.h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(bk.x + 2, bk.y + 2, bk.w - 4, Math.floor((bk.h - 4) * 0.4));
    ctx.globalAlpha = 1;
  }

  // Particles
  if (brParticles) {
    for (const p2 of brParticles) {
      ctx.globalAlpha = Math.max(0, p2.life * 0.9);
      ctx.fillStyle = p2.color;
      ctx.shadowColor = p2.color; ctx.shadowBlur = 4;
      const sz = 3 * p2.life;
      ctx.fillRect(p2.x - sz/2, p2.y - sz/2, sz, sz);
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }

  // Paddle
  const grad = ctx.createLinearGradient(brPad.x - brPad.w/2, 0, brPad.x + brPad.w/2, 0);
  grad.addColorStop(0, 'rgba(255,255,255,.15)'); grad.addColorStop(.5, accent); grad.addColorStop(1, 'rgba(255,255,255,.15)');
  ctx.fillStyle = grad; ctx.shadowColor = accent; ctx.shadowBlur = 10;
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(brPad.x - brPad.w/2, brPad.y, brPad.w, brPad.h, 6); ctx.fill(); }
  else ctx.fillRect(brPad.x - brPad.w/2, brPad.y, brPad.w, brPad.h);
  ctx.shadowBlur = 0;

  // Ball trail — по возрасту точки
  const bt = brBall.trail || [];
  const brTrailDur = 160;
  const nowBr = performance.now();
  for (let i = 0; i < bt.length; i++) {
    const age = nowBr - bt[i].ts;
    const t = Math.max(0, 1 - age / brTrailDur);
    const alpha = t * t * 0.5;
    const r = brBall.r * (0.2 + t * 0.6);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = accent; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(bt[i].x, bt[i].y, r, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;

  // Ball with squish
  const sx = brBall.sx || 1, sy = brBall.sy || 1;
  ctx.save();
  ctx.translate(brBall.x, brBall.y);
  ctx.scale(sx, sy);
  ctx.fillStyle = '#fff'; ctx.shadowColor = accent; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.arc(0, 0, brBall.r, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  if (brWaiting && brRunning) {
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, brH/2 - 20, brW, 40);
    ctx.fillStyle = '#f0ede8'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Тапни для запуска 🏓', brW/2, brH/2 + 6); ctx.textAlign = 'left';
  }
}

function brDrawMsg(msg) {
  const canvas = document.getElementById('br-canvas'); if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(0, brH/2-30, brW, 60);
  ctx.fillStyle = '#f0ede8'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(msg, brW/2, brH/2 + 6); ctx.textAlign = 'left';
  canvas.ontouchstart = () => brRestart();
  canvas.onclick = () => brRestart();
}

function brUpdateScore() {
  const el = document.getElementById('br-score-label'); if (!el) return;
  const hearts = '❤️'.repeat(Math.max(0,brLives)) + '🖤'.repeat(Math.max(0, 3 - brLives));
  el.textContent = 'Счёт: ' + brScore + ' • Рекорд: ' + brHi + ' • ' + hearts;
}


// ══════════════════════════════════════════════════════════════════
// ── 🎵 OSU! BUBBLES (v3.0.0) ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
const OSU_COLORS = ['#ff66aa','#ffaa00','#66ddff','#aaffaa','#ff6666','#cc88ff','#ffee66','#44ffcc'];

let bubRaf = null, bubRunning = false, bubLastTime = 0;
let bubScore = 0, bubHi = 0, bubLives = 3;
let bubW, bubH, bubCircles = [], bubNum = 0, bubDifficulty = 'normal', bubLevel = 1;
let bubLevelTimer = 0, bubCombo = 0, bubComboTimer = 0;
let bubBPM = 120, bubBeatInterval = 500; // ms per beat
let bubAudioCtx = null, bubAudioSource = null, bubAudioBuf = null;
let bubAudioPlaying = false, bubAudioStartTime = 0, bubAudioOffset = 0;
let bubLastBeat = 0, bubBeatPhase = 0;
let bubSpawnQueue = [], bubAutoMode = true; // auto = no audio
// legacy alias
const bubBubbles = { filter: () => [] }; // unused shim

const OSU_DIFF = {
  easy:   { approachMs: 1800, radius: 38, maxOnScreen: 6,  hitWindow: 250 },
  normal: { approachMs: 1200, radius: 30, maxOnScreen: 10, hitWindow: 180 },
  hard:   { approachMs: 700,  radius: 22, maxOnScreen: 14, hitWindow: 100 },
};

// ── BPM DETECTION via Web Audio ──
async function osuDetectBPM(audioBuffer) {
  const rate = audioBuffer.sampleRate;
  const data = audioBuffer.getChannelData(0);
  const winSize = Math.floor(rate * 0.01); // 10ms windows
  const energies = [];
  for (let i = 0; i < data.length - winSize; i += winSize) {
    let e = 0;
    for (let j = 0; j < winSize; j++) e += data[i+j] * data[i+j];
    energies.push(e / winSize);
  }
  // Find beats: local maxima above threshold
  const avg = energies.reduce((a,b)=>a+b,0) / energies.length;
  const threshold = avg * 2.8;
  const beatTimes = [];
  let lastBeat = -Infinity;
  for (let i = 1; i < energies.length - 1; i++) {
    if (energies[i] > threshold && energies[i] > energies[i-1] && energies[i] > energies[i+1]) {
      const t = i * 0.01; // seconds
      if (t - lastBeat > 0.2) { beatTimes.push(t); lastBeat = t; }
    }
  }
  if (beatTimes.length < 4) return 120;
  // Median interval
  const intervals = [];
  for (let i = 1; i < Math.min(beatTimes.length, 60); i++) intervals.push(beatTimes[i] - beatTimes[i-1]);
  intervals.sort((a,b)=>a-b);
  const med = intervals[Math.floor(intervals.length/2)];
  const bpm = Math.round(60 / med);
  return Math.max(60, Math.min(240, bpm));
}

function bubInit() {
  bubHi = getHi("bubbles");
  const canvas = document.getElementById('bub-canvas');
  // Overlay теперь fullscreen — вычисляем высоту с учётом UI-элементов сверху
  const safeTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-top') || '0') || 0;
  const topUi = safeTop + 50 + 36 + 28 + 38 + 28 + 16; // back + title + diff + audio + score
  const botUi = 44 + 16; // restart button + padding
  const availH = window.innerHeight - topUi - botUi;
  const w = Math.min(window.innerWidth - 28, 400);
  const h = Math.max(200, Math.min(availH, Math.round(w * 1.15)));
  canvas.width = w;
  canvas.height = h;
  bubW = canvas.width; bubH = canvas.height;

  // Setup tap handler
  const handleTap = (clientX, clientY) => {
    if (!bubRunning) return;
    const rect = canvas.getBoundingClientRect();
    const tx = (clientX - rect.left) * (bubW / rect.width);
    const ty = (clientY - rect.top) * (bubH / rect.height);
    let hit = false;
    // Find lowest numbered unhit circle in hit window
    const d = OSU_DIFF[bubDifficulty] || OSU_DIFF.normal;
    const now = performance.now();
    let bestCircle = null, bestNum = Infinity;
    for (const c of bubCircles) {
      if (c.hit || c.missed) continue;
      const age = now - c.spawnAt;
      if (age < 0 || age > c.approachMs + d.hitWindow) continue;
      const dx = tx - c.x, dy = ty - c.y;
      if (dx*dx + dy*dy <= (c.r + 12)*(c.r + 12)) {
        if (c.num < bestNum) { bestNum = c.num; bestCircle = c; }
      }
    }
    if (bestCircle) {
      const c = bestCircle;
      const age = now - c.spawnAt;
      const timing = Math.abs(age - c.approachMs);
      // Score based on timing accuracy
      let pts, verdict;
      if (timing < d.hitWindow * 0.25)       { pts = 300; verdict = '300'; }
      else if (timing < d.hitWindow * 0.6)   { pts = 100; verdict = '100'; }
      else                                   { pts = 50;  verdict = '50';  }
      c.hit = true; c.hitTime = now; c.verdict = verdict;
      bubCombo++; bubComboTimer = 2000;
      const finalPts = Math.round(pts * (1 + (bubCombo - 1) * 0.1));
      bubScore += finalPts;
      if (bubScore > bubHi) bubHi = saveHi("bubbles", bubScore);
      SFX.play('bubPop'); if (bubCombo >= 3) SFX.play('bubCombo');
      bubUpdateScore(); hit = true;
    }
    if (!hit && bubRunning) {
      // Miss click on empty area reduces combo
      bubCombo = 0;
    }
  };
  canvas.ontouchstart = e => {
    e.preventDefault();
    e.stopPropagation();
    const t = e.touches[0];
    handleTap(t.clientX, t.clientY);
  };
  canvas.onclick = e => {
    e.stopPropagation();
    handleTap(e.clientX, e.clientY);
  };

  // Update audio upload UI
  osuUpdateAudioUI();
  bubRestart();
}

function osuDragOver(active) {
  const zone = document.getElementById('osu-audio-zone');
  if (!zone) return;
  zone.style.borderColor  = active ? '#ff66aa' : 'rgba(255,102,170,0.45)';
  zone.style.background   = active ? 'rgba(255,102,170,0.12)' : 'rgba(255,102,170,0.04)';
  zone.style.transform    = active ? 'scale(1.01)' : '';
}

function osuUpdateAudioUI() {
  // legacy — kept for compatibility but no longer drives the new UI
  const info = document.getElementById('bub-audio-info');
  if (info) {
    info.textContent = bubAudioBuf
      ? '🎵 BPM: ' + bubBPM + ' • Ритм-режим включён'
      : '⬆️ Загрузи аудио для синхронизации с ритмом';
    info.style.color = bubAudioBuf ? 'var(--success,#4a9e5c)' : 'var(--muted)';
  }
}

// ── Waveform renderer ─────────────────────────────────────────────
function osuDrawWaveform(canvasId, audioBuffer, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !audioBuffer) return;
  const ctx   = canvas.getContext('2d');
  const w     = canvas.width, h = canvas.height;
  const data  = audioBuffer.getChannelData(0);
  const step  = Math.ceil(data.length / w);
  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 0, w, h);

  // Gradient
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0,   color + '88');
  grad.addColorStop(0.5, color + 'ee');
  grad.addColorStop(1,   color + '88');
  ctx.fillStyle = grad;

  for (let i = 0; i < w; i++) {
    let min = 1, max = -1;
    for (let j = 0; j < step; j++) {
      const v = data[i * step + j] || 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const yMin = Math.round((0.5 + min * 0.45) * h);
    const yMax = Math.round((0.5 + max * 0.45) * h);
    ctx.fillRect(i, yMin, 1, Math.max(1, yMax - yMin));
  }

  // Center line
  ctx.strokeStyle = color + '33';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, h/2); ctx.lineTo(w, h/2); ctx.stroke();
}

// ── Анимированный мини-спектр во время анализа ────────────────────
let _osuWaveAnimId = null;
function osuAnimateMiniWave(canvasId, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  let t = 0;
  cancelAnimationFrame(_osuWaveAnimId);
  function frame() {
    t += 0.06;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0,   color + '44');
    grad.addColorStop(0.5, color + 'cc');
    grad.addColorStop(1,   color + '44');
    ctx.fillStyle = grad;
    const bars = 40;
    const bw = w / bars;
    for (let i = 0; i < bars; i++) {
      const phase = i / bars * Math.PI * 4 - t;
      const amp   = Math.abs(Math.sin(phase)) * 0.6 + Math.abs(Math.sin(phase * 1.7 + t)) * 0.4;
      const bh    = Math.max(2, amp * (h - 4));
      ctx.fillRect(i * bw + 1, (h - bh) / 2, Math.max(1, bw - 2), bh);
    }
    _osuWaveAnimId = requestAnimationFrame(frame);
  }
  frame();
}
function osuStopMiniAnim() {
  cancelAnimationFrame(_osuWaveAnimId);
  _osuWaveAnimId = null;
}

// ── BPM dot pulse ─────────────────────────────────────────────────
let _osuBpmDotTimer = null;
function osuStartBpmDot(bpmMs) {
  clearInterval(_osuBpmDotTimer);
  const dot = document.getElementById('osu-bpm-dot');
  if (!dot) return;
  _osuBpmDotTimer = setInterval(() => {
    dot.style.transform = 'scale(1.6)';
    dot.style.opacity   = '1';
    setTimeout(() => {
      dot.style.transform = 'scale(1)';
      dot.style.opacity   = '0.5';
    }, 120);
  }, bpmMs);
}
function osuStopBpmDot() {
  clearInterval(_osuBpmDotTimer);
  const dot = document.getElementById('osu-bpm-dot');
  if (dot) { dot.style.transform = ''; dot.style.opacity = '0.5'; }
}

// ── Этапы загрузки ────────────────────────────────────────────────
function osuSetLoadStage(icon, text, barPct) {
  const ic  = document.getElementById('osu-load-icon');
  const st  = document.getElementById('osu-load-stage');
  const bar = document.getElementById('osu-load-bar');
  if (ic)  ic.textContent    = icon;
  if (st)  st.textContent    = text;
  if (bar) bar.style.width   = barPct + '%';
}

async function osuLoadAudio(file) {
  if (!file) return;
  const zone    = document.getElementById('osu-audio-zone');
  const idle    = document.getElementById('osu-zone-idle');
  const loading = document.getElementById('osu-zone-loading');
  const done    = document.getElementById('osu-zone-done');

  // Показываем loading
  if (idle)    idle.style.display    = 'none';
  if (done)    done.style.display    = 'none';
  if (loading) loading.style.display = 'flex';

  osuSetLoadStage('📂', 'ЧИТАЮ ФАЙЛ...', 10);
  osuAnimateMiniWave('osu-wave-mini', '#ff66aa');

  try {
    if (!bubAudioCtx) bubAudioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Этап 1: читаем файл
    const arrBuf = await file.arrayBuffer();
    osuSetLoadStage('🔊', 'ДЕКОДИРУЮ АУДИО...', 35);
    await new Promise(r => setTimeout(r, 60)); // пауза чтобы UI обновился

    // Этап 2: декодируем
    bubAudioBuf = await bubAudioCtx.decodeAudioData(arrBuf);
    osuSetLoadStage('📊', 'АНАЛИЗИРУЮ BPM...', 60);
    await new Promise(r => setTimeout(r, 80));

    // Этап 3: BPM
    bubBPM = await osuDetectBPM(bubAudioBuf);
    bubBeatInterval = 60000 / bubBPM;
    bubAutoMode = false;
    osuSetLoadStage('✅', 'ГОТОВО!', 100);
    await new Promise(r => setTimeout(r, 320));

    osuStopMiniAnim();

    // Показываем done
    if (loading) loading.style.display = 'none';
    if (done)    done.style.display    = 'flex';

    // Имя файла
    const nameEl = document.getElementById('osu-done-filename');
    if (nameEl) nameEl.textContent = file.name.replace(/\.[^.]+$/, '');

    // BPM + длительность
    const bpmEl  = document.getElementById('osu-done-bpm');
    const dur    = Math.round(bubAudioBuf.duration);
    const mm     = Math.floor(dur / 60);
    const ss     = String(dur % 60).padStart(2, '0');
    if (bpmEl) bpmEl.textContent = `BPM: ${bubBPM} · ${mm}:${ss} · ритм-режим ✓`;

    // Рисуем waveform
    osuDrawWaveform('osu-wave-full', bubAudioBuf, '#ff66aa');

    // Запускаем BPM dot
    osuStartBpmDot(bubBeatInterval);

    // Граница зоны — solid, зелёная
    if (zone) {
      zone.style.borderStyle = 'solid';
      zone.style.borderColor = '#4aff8a';
      zone.style.background  = 'rgba(74,255,138,0.04)';
    }

    osuUpdateAudioUI();
    bubRestart();

  } catch(e) {
    osuStopMiniAnim();
    if (loading) loading.style.display = 'none';
    if (idle)    idle.style.display    = 'flex';
    if (zone)    zone.style.borderColor = '#ff4455';
    osuSetLoadStage('❌', 'ОШИБКА: ' + (e.message || e), 0);
    const st = document.getElementById('osu-load-stage');
    if (st) st.style.color = '#ff4455';
    if (loading) loading.style.display = 'flex';
    setTimeout(() => {
      if (loading) loading.style.display = 'none';
      if (idle)    idle.style.display    = 'flex';
      if (zone) { zone.style.borderColor = 'rgba(255,102,170,0.45)'; zone.style.borderStyle = 'dashed'; }
    }, 2500);
  }
}

function osuStartAudio() {
  if (!bubAudioBuf || !bubAudioCtx) return;
  if (bubAudioSource) { try { bubAudioSource.stop(); } catch(e) {} }
  bubAudioSource = bubAudioCtx.createBufferSource();
  bubAudioSource.buffer = bubAudioBuf;
  bubAudioSource.connect(bubAudioCtx.destination);
  bubAudioSource.start(0, bubAudioOffset);
  bubAudioStartTime = bubAudioCtx.currentTime - bubAudioOffset;
  bubAudioPlaying = true;
}

function osuStopAudio() {
  if (bubAudioSource) { try { bubAudioSource.stop(); } catch(e) {} bubAudioSource = null; }
  bubAudioPlaying = false; bubAudioOffset = 0;
}

function bubRestart() {
  bubStop();
  bubLastTime = 0; bubCircles = []; bubSpawnQueue = [];
  bubScore = 0; bubLives = 3; bubLevel = 1; bubLevelTimer = 0;
  bubCombo = 0; bubComboTimer = 0; bubNum = 0;
  bubLastBeat = 0;
  bubUpdateScore();
  osuStopAudio();
  if (bubAudioBuf) { bubAudioOffset = 0; osuStartAudio(); }
  bubRunning = true;
  bubRaf = requestAnimationFrame(bubLoop);
}

function bubStop() {
  cancelAnimationFrame(bubRaf); bubRaf = null; bubRunning = false;
  osuStopAudio();
}

function bubLoop(ts) {
  if (!bubRunning) return;
  const dt = bubLastTime ? Math.min(ts - bubLastTime, 50) : 16;
  bubLastTime = ts;
  bubTick(ts, dt); bubDraw(ts);
  bubRaf = requestAnimationFrame(bubLoop);
}

function bubTick(now, dt) {
  const d = OSU_DIFF[bubDifficulty] || OSU_DIFF.normal;
  bubLevelTimer += dt;
  if (bubLevelTimer >= 20000) { bubLevelTimer = 0; bubLevel++; }
  if (bubComboTimer > 0) { bubComboTimer -= dt; if (bubComboTimer <= 0) bubCombo = 0; }

  // Beat timing — spawn circles on beat
  const beatsSinceStart = (now - (bubLastBeat === 0 ? now : 0));
  if (bubLastBeat === 0) bubLastBeat = now;
  const sinceLastBeat = now - bubLastBeat;
  const effectiveBeatMs = Math.max(300, bubBeatInterval - bubLevel * 20);

  const activeCount = bubCircles.filter(c => !c.hit && !c.missed).length;
  if (sinceLastBeat >= effectiveBeatMs && activeCount < d.maxOnScreen) {
    bubLastBeat = now;
    // Spawn new circle
    const margin = d.radius + 10;
    const x = margin + Math.random() * (bubW - margin * 2);
    const y = margin + Math.random() * (bubH - margin * 2 - 30);
    bubCircles.push({
      x, y, r: d.radius,
      num: ++bubNum,
      color: OSU_COLORS[bubNum % OSU_COLORS.length],
      spawnAt: now,
      approachMs: Math.max(400, d.approachMs - bubLevel * 30),
      hit: false, missed: false,
      hitTime: 0, verdict: '',
      popParticles: [],
    });
  }

  // Process circles
  for (let i = bubCircles.length - 1; i >= 0; i--) {
    const c = bubCircles[i];
    const age = now - c.spawnAt;

    // Hit animation cleanup
    if (c.hit) {
      if (now - c.hitTime > 600) bubCircles.splice(i, 1);
      continue;
    }

    // Miss detection
    if (!c.missed && age > c.approachMs + d.hitWindow) {
      c.missed = true; c.hitTime = now;
      bubLives--; bubCombo = 0; bubComboTimer = 0;
      SFX.play('bubMiss');
      bubUpdateScore();
      if (bubLives <= 0) {
        bubStop(); bubRunning = false; bubDraw(now);
        const canvas = document.getElementById('bub-canvas'); if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(0, bubH/2-45, bubW, 90);
        ctx.fillStyle = '#ff6699'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('💔 Игра окончена! Тапни для рестарта', bubW/2, bubH/2 - 6);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '12px sans-serif';
        ctx.fillText('Счёт: ' + bubScore + '  |  Комбо: ' + bubCombo + 'x', bubW/2, bubH/2 + 18);
        ctx.textAlign = 'left';
        toast('🎵 Счёт: ' + bubScore);
        canvas.ontouchstart = e => { e.preventDefault(); canvas.ontouchstart=null; canvas.onclick=null; bubRestart(); };
        canvas.onclick = () => { canvas.ontouchstart=null; canvas.onclick=null; bubRestart(); };
        return;
      }
    }
    if (c.missed && now - c.hitTime > 500) { bubCircles.splice(i, 1); }
  }
}

function bubDraw(now) {
  const canvas = document.getElementById('bub-canvas'); if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const accent = getAccent();
  now = now || performance.now();

  // Background with subtle pulse on beat
  const beatPhase = Math.max(0, 1 - (now - bubLastBeat) / 200);
  const bgPulse = beatPhase * 0.06;
  ctx.fillStyle = `rgba(8,4,18,${1 - bgPulse})`;
  ctx.fillRect(0, 0, bubW, bubH);
  if (bgPulse > 0) {
    const pg = ctx.createRadialGradient(bubW/2, bubH/2, 0, bubW/2, bubH/2, bubW);
    pg.addColorStop(0, `rgba(180,60,255,${bgPulse * 0.4})`);
    pg.addColorStop(1, 'transparent');
    ctx.fillStyle = pg; ctx.fillRect(0, 0, bubW, bubH);
  }

  const d = OSU_DIFF[bubDifficulty] || OSU_DIFF.normal;

  // Draw circles from oldest to newest (so oldest is on top)
  const sortedCircles = [...bubCircles].sort((a,b)=>a.num-b.num);

  for (const c of sortedCircles) {
    const age = now - c.spawnAt;

    // HIT animation
    if (c.hit) {
      const t = Math.min((now - c.hitTime) / 600, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      // Expanding ring
      ctx.globalAlpha = (1-t) * 0.9;
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 3 * (1-t) + 0.5;
      ctx.shadowColor = c.color; ctx.shadowBlur = 20 * (1-t);
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r * (1 + ease * 1.5), 0, Math.PI*2); ctx.stroke();
      ctx.shadowBlur = 0;
      // Burst particles (8)
      for (let p = 0; p < 8; p++) {
        const ang = (p/8)*Math.PI*2;
        const dist = c.r * (0.4 + ease * 2.2);
        const pr = Math.max(0.5, (1-t) * c.r * 0.18);
        ctx.globalAlpha = Math.max(0, (1-t) * 0.85);
        ctx.fillStyle = c.color; ctx.shadowColor = c.color; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(c.x + Math.cos(ang)*dist, c.y + Math.sin(ang)*dist, pr, 0, Math.PI*2); ctx.fill();
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      // Verdict text
      if (c.verdict) {
        const vt = Math.min((now - c.hitTime) / 300, 1);
        ctx.globalAlpha = 1 - vt;
        ctx.font = `bold ${14 + Math.floor(vt * 4)}px 'JetBrains Mono',monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = c.verdict === '300' ? '#ffdd00' : c.verdict === '100' ? '#88ffaa' : '#aaaaaa';
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
        ctx.fillText(c.verdict, c.x, c.y - c.r - 8 - vt * 20);
        ctx.shadowBlur = 0; ctx.textAlign = 'left'; ctx.globalAlpha = 1;
      }
      continue;
    }

    // MISS animation
    if (c.missed) {
      const t = Math.min((now - c.hitTime) / 500, 1);
      ctx.globalAlpha = (1-t) * 0.5;
      ctx.strokeStyle = '#ff2244';
      ctx.lineWidth = 2; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      continue;
    }

    // Approach progress (0 = just spawned, 1 = time to hit)
    const progress = Math.min(age / c.approachMs, 1.2);

    // Approach ring (starts huge, shrinks to circle)
    const ringScale = Math.max(1, 4.5 - progress * 3.5);
    const ringAlpha = Math.min(1, progress * 2) * (1 - Math.max(0, progress - 1) * 5);
    if (ringAlpha > 0 && ringScale > 1.02) {
      ctx.globalAlpha = Math.max(0, ringAlpha);
      ctx.strokeStyle = c.color;
      ctx.lineWidth = Math.max(1, 3 * (ringScale - 1));
      ctx.shadowColor = c.color; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r * ringScale, 0, Math.PI*2); ctx.stroke();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    // Fade in
    const fadeIn = Math.min(1, age / 120);
    ctx.globalAlpha = fadeIn;

    // Main circle body
    ctx.shadowColor = c.color; ctx.shadowBlur = c.r * 0.6;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI*2);
    // Gradient fill
    const grad = ctx.createRadialGradient(c.x - c.r*0.3, c.y - c.r*0.3, c.r*0.05, c.x, c.y, c.r);
    grad.addColorStop(0, c.color + 'cc');
    grad.addColorStop(0.5, c.color + '44');
    grad.addColorStop(1, c.color + '22');
    ctx.fillStyle = grad; ctx.fill();
    ctx.shadowBlur = 0;

    // Border
    ctx.strokeStyle = c.color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI*2); ctx.stroke();

    // Inner white border
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r - 5, 0, Math.PI*2); ctx.stroke();

    // Circle number
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4;
    const fontSize = Math.round(c.r * 0.7);
    ctx.font = `700 ${fontSize}px 'JetBrains Mono',monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(c.num, c.x, c.y);
    ctx.textBaseline = 'alphabetic';
    ctx.shadowBlur = 0;

    // Highlight glint
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(c.x - c.r*0.3, c.y - c.r*0.3, c.r*0.25, c.r*0.12, -Math.PI/4, 0, Math.PI*2); ctx.fill();

    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }

  // HUD bar
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, bubH - 36, bubW, 36);
  ctx.font = `700 11px "JetBrains Mono",monospace`;
  ctx.fillStyle = accent; ctx.textAlign = 'left';
  ctx.fillText('Lv' + bubLevel, 8, bubH - 11);
  // Combo
  if (bubCombo > 1) {
    const comboAlpha = bubComboTimer > 0 ? Math.min(1, bubComboTimer / 300) : 1;
    ctx.globalAlpha = comboAlpha;
    ctx.fillStyle = '#ff66aa'; ctx.textAlign = 'center';
    ctx.font = `700 ${11 + Math.min(4, bubCombo/5)}px "JetBrains Mono",monospace`;
    ctx.fillText(bubCombo + 'x COMBO', bubW/2, bubH - 11);
    ctx.globalAlpha = 1;
  }
  // Lives as osu-style bars
  const barW = 14, barH = 10, barGap = 4;
  const barsX = bubW - (3 * (barW + barGap)) - 4;
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < bubLives ? '#ff66aa' : '#333';
    ctx.shadowColor = i < bubLives ? '#ff66aa' : 'transparent';
    ctx.shadowBlur = i < bubLives ? 6 : 0;
    ctx.fillRect(barsX + i*(barW+barGap), bubH - 8 - barH, barW, barH);
  }
  ctx.shadowBlur = 0; ctx.textAlign = 'left';

  // BPM indicator pulse
  const bpmPulse = Math.max(0, 1 - (now - bubLastBeat) / (bubBeatInterval * 0.6));
  if (bpmPulse > 0) {
    ctx.globalAlpha = bpmPulse * 0.3;
    ctx.strokeStyle = '#ff66aa'; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, bubW - 2, bubH - 38);
    ctx.globalAlpha = 1;
  }
}

function bubUpdateScore() {
  const el = document.getElementById('bub-score-label'); if (!el) return;
  const bars = ['❤️','❤️','❤️'].map((h,i) => i < bubLives ? '❤️' : '🖤').join('');
  el.textContent = 'Счёт: ' + bubScore + ' • Рекорд: ' + bubHi + ' • BPM: ' + bubBPM + ' • ' + bars;
}

// ══ СЕКРЕТНЫЕ ЭФФЕКТЫ ══

// ── 🟩 МАТРИЦА ──
let _matrixRaf=null,_matrixRunning=false;
function matrixStart(){
  const c=document.getElementById('matrix-canvas');
  if(!c)return;
  _matrixRunning=true;
  c.width=window.innerWidth;c.height=window.innerHeight;
  c.classList.add('active');
  const ctx=c.getContext('2d');
  const cols=Math.ceil(c.width/18); // чуть реже столбцов
  const drops=Array(cols).fill(1);
  const chars='アイウエオカキクケコ01アBCabcサシスセソ9EFタチツテトナ';
  const accent=getAccent();
  let _lastMatT=0;
  function draw(t){
    if(!_matrixRunning)return;
    if(t-_lastMatT<38){_matrixRaf=requestAnimationFrame(draw);return;} // ~26fps
    _lastMatT=t;
    ctx.fillStyle='rgba(0,0,0,.1)';ctx.fillRect(0,0,c.width,c.height);
    ctx.font='13px monospace';
    drops.forEach((y,i)=>{
      const ch=chars[Math.floor(Math.random()*chars.length)];
      ctx.fillStyle=i%8===0?'#fff':accent;
      ctx.fillText(ch,i*18,y*16);
      if(y*16>c.height&&Math.random()>.97)drops[i]=0;
      drops[i]++;
    });
    _matrixRaf=requestAnimationFrame(draw);
  }
  cancelAnimationFrame(_matrixRaf);
  requestAnimationFrame(draw);
}
function matrixStop(){
  _matrixRunning=false;cancelAnimationFrame(_matrixRaf);
  const c=document.getElementById('matrix-canvas');
  if(c){c.classList.remove('active');setTimeout(()=>{const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);},500);}
}

// ── ❄️ СНЕГ ──
let _snowRaf=null,_snowRunning=false,_snowFlakes=[];
function snowStart(){
  const c=document.getElementById('snow-canvas');
  if(!c)return;
  _snowRunning=true;c.style.display='';
  // Сохраняем
  const sec=loadSecret();sec.snow=true;saveSecret(sec);
  c.width=window.innerWidth;c.height=window.innerHeight;
  // Оптимизация: 50 снежинок вместо 80, с throttle на 30fps
  const flakeCount=Math.min(50,Math.round(window.innerWidth/8));
  _snowFlakes=Array.from({length:flakeCount},()=>({
    x:Math.random()*c.width,y:Math.random()*c.height,
    r:.8+Math.random()*2.5,vy:.3+Math.random()*.9,vx:(Math.random()-.5)*.4,
    op:.35+Math.random()*.5
  }));
  const ctx=c.getContext('2d');
  let _lastSnowT=0;
  function draw(t){
    if(!_snowRunning)return;
    // Throttle: ~30fps максимум
    if(t-_lastSnowT<28){_snowRaf=requestAnimationFrame(draw);return;}
    _lastSnowT=t;
    ctx.clearRect(0,0,c.width,c.height);
    ctx.fillStyle='rgba(255,255,255,0.7)';
    ctx.beginPath();
    _snowFlakes.forEach(f=>{
      ctx.moveTo(f.x+f.r,f.y);
      ctx.arc(f.x,f.y,f.r,0,Math.PI*2);
      f.y+=f.vy;f.x+=f.vx;
      if(f.y>c.height){f.y=-5;f.x=Math.random()*c.width;}
      if(f.x<0)f.x=c.width;if(f.x>c.width)f.x=0;
    });
    ctx.fill();
    _snowRaf=requestAnimationFrame(draw);
  }
  cancelAnimationFrame(_snowRaf);requestAnimationFrame(draw);
}
function snowStop(){
  _snowRunning=false;cancelAnimationFrame(_snowRaf);
  const c=document.getElementById('snow-canvas');
  if(c)c.style.display='none';
  const sec=loadSecret();delete sec.snow;saveSecret(sec);
}

// ── 🕺 ДИСКО — чистый RGB без смены тем ──
// _discoActive объявлен в начале файла
function discoApplyIntensity(val){
  // val: 0..100, default 100
  const v = Math.max(0, Math.min(100, val||100));
  document.documentElement.style.setProperty('--disco-intensity', (v/100).toFixed(2));
}
function discoStart(){
  _discoActive=true;
  document.body.classList.add('disco-mode');
  const sec=loadSecret();sec.disco=true;saveSecret(sec);
  discoApplyIntensity(sec.discoIntensity!=null?sec.discoIntensity:100);
}
function discoStop(){
  _discoActive=false;
  document.body.classList.remove('disco-mode');
  const sec=loadSecret();delete sec.disco;saveSecret(sec);
}

// ══════════════════════════════════════════════════════════════════
// ── 🐦 ФЛАППИ ПТИЦА (v2.6.0) ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
let flappyRaf=null,flappyRunning=false,flappyStarted=false,flappyLastTime=0;
let flappyW=0,flappyH=0,flappyScore=0,flappyHi=0;
let flappyBird={x:0,y:0,vy:0,r:14};
const FLAPPY_GRAVITY=0.38,FLAPPY_JUMP=-7.2,FLAPPY_PIPE_W=52,FLAPPY_GAP=140,FLAPPY_SPEED=2.4;
let flappyPipes=[];
let flappyFrames=0;

function flappyInit(){
  flappyHi=getHi('flappy');
  const canvas=document.getElementById('flappy-canvas');
  flappyW=Math.min(window.innerWidth-36,360);
  flappyH=Math.round(flappyW*1.45);
  canvas.width=flappyW; canvas.height=flappyH;
  canvas.ontouchstart=e=>{e.preventDefault();flappyFlap();};
  canvas.onclick=flappyFlap;
  document.addEventListener('keydown',flappyKeyDown);
  flappyRestart();
}
function flappyKeyDown(e){if(e.code==='Space'||e.code==='ArrowUp'){e.preventDefault();flappyFlap();}}
function flappyStop(){
  flappyRunning=false;cancelAnimationFrame(flappyRaf);
  document.removeEventListener('keydown',flappyKeyDown);
}
function flappyFlap(){
  if(!flappyStarted){flappyStarted=true;}
  flappyBird.vy=FLAPPY_JUMP;
  SFX.play('pongHit');
}
function flappyRestart(){
  flappyScore=0; flappyStarted=false;
  flappyBird={x:flappyW*0.28,y:flappyH*0.45,vy:0,r:14};
  flappyPipes=[]; flappyFrames=0; flappyLastTime=0;
  flappyRunning=true;
  cancelAnimationFrame(flappyRaf);
  flappyRaf=requestAnimationFrame(flappyLoop);
  flappyUpdateScore();
}
function flappySpawnPipe(){
  const minY=80,maxY=flappyH-FLAPPY_GAP-80;
  const topH=minY+Math.random()*(maxY-minY);
  flappyPipes.push({x:flappyW,topH,passed:false});
}
function flappyLoop(ts){
  if(!flappyRunning)return;
  const dt=flappyLastTime?Math.min((ts-flappyLastTime)/16.667,3):1;
  flappyLastTime=ts;
  const canvas=document.getElementById('flappy-canvas');
  if(!canvas){flappyRunning=false;return;}
  if(flappyStarted){
    flappyBird.vy+=FLAPPY_GRAVITY*dt;
    flappyBird.y+=flappyBird.vy*dt;
    flappyFrames+=dt;
    if(flappyFrames%90<dt) flappySpawnPipe();
    for(let p of flappyPipes){p.x-=FLAPPY_SPEED*dt;}
    flappyPipes=flappyPipes.filter(p=>p.x>-FLAPPY_PIPE_W-10);
    // Score
    for(let p of flappyPipes){
      if(!p.passed&&p.x+FLAPPY_PIPE_W<flappyBird.x){p.passed=true;flappyScore++;flappyUpdateScore();SFX.play('pongScore');}
    }
    // Collision
    const b=flappyBird;
    if(b.y+b.r>flappyH||b.y-b.r<0){flappyDie();return;}
    for(let p of flappyPipes){
      const inX=b.x+b.r>p.x&&b.x-b.r<p.x+FLAPPY_PIPE_W;
      const _fg = window._cheatFlappyGap ? (typeof _FLAPPY_GAP_CHEAT!=='undefined'?_FLAPPY_GAP_CHEAT:FLAPPY_GAP+80) : FLAPPY_GAP;
      if(inX&&(b.y-b.r<p.topH||b.y+b.r>p.topH+_fg)){flappyDie();return;}
    }
  }
  flappyDraw(canvas);
  flappyRaf=requestAnimationFrame(flappyLoop);
}
function flappyDie(){
  flappyRunning=false;
  triggerScreamer();
  if(flappyScore>flappyHi)flappyHi=saveHi('flappy',flappyScore);
  flappyUpdateScore();
  const canvas=document.getElementById('flappy-canvas');
  flappyDraw(canvas);
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,flappyH/2-44,flappyW,88);
  ctx.fillStyle='#f0ede8';ctx.font='bold 16px sans-serif';ctx.textAlign='center';
  ctx.fillText('💥 Игра окончена!',flappyW/2,flappyH/2-12);
  ctx.fillText('Тапни чтобы снова',flappyW/2,flappyH/2+16);
  canvas.onclick=()=>{canvas.onclick=null;canvas.ontouchstart=e=>{e.preventDefault();flappyFlap();};canvas.onclick=flappyFlap;flappyRestart();};
  canvas.ontouchstart=e=>{e.preventDefault();canvas.ontouchstart=null;canvas.onclick=null;canvas.onclick=flappyFlap;canvas.ontouchstart=e2=>{e2.preventDefault();flappyFlap();};flappyRestart();};
}
function flappyDraw(canvas){
  const ctx=canvas.getContext('2d');
  const accent=getAccent();
  // Sky
  const skyGrad=ctx.createLinearGradient(0,0,0,flappyH);
  skyGrad.addColorStop(0,'#0d1b2a');skyGrad.addColorStop(1,'#162032');
  ctx.fillStyle=skyGrad;ctx.fillRect(0,0,flappyW,flappyH);
  // Ground
  ctx.fillStyle='#2a1f0e';ctx.fillRect(0,flappyH-24,flappyW,24);
  ctx.fillStyle='#3d2e14';ctx.fillRect(0,flappyH-24,flappyW,4);
  // Pipes
  for(const p of flappyPipes){
    const grad=ctx.createLinearGradient(p.x,0,p.x+FLAPPY_PIPE_W,0);
    grad.addColorStop(0,'#2d6a2d');grad.addColorStop(0.5,'#3e9e3e');grad.addColorStop(1,'#2d6a2d');
    ctx.fillStyle=grad;
    ctx.fillRect(p.x,0,FLAPPY_PIPE_W,p.topH);
    ctx.fillRect(p.x,p.topH+FLAPPY_GAP,FLAPPY_PIPE_W,flappyH-p.topH-FLAPPY_GAP);
    // Pipe caps
    ctx.fillStyle='#4ab84a';
    ctx.fillRect(p.x-4,p.topH-18,FLAPPY_PIPE_W+8,18);
    ctx.fillRect(p.x-4,p.topH+FLAPPY_GAP,FLAPPY_PIPE_W+8,18);
  }
  // Bird
  const b=flappyBird;
  const angle=Math.min(Math.PI/4,Math.max(-Math.PI/5,b.vy*0.05));
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(angle);
  // Body
  ctx.shadowColor=accent;ctx.shadowBlur=12;
  ctx.fillStyle=accent;ctx.beginPath();ctx.ellipse(0,0,b.r,b.r*0.85,0,0,Math.PI*2);ctx.fill();
  // Eye
  ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(b.r*0.4,-b.r*0.2,b.r*0.32,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#222';ctx.beginPath();ctx.arc(b.r*0.5,-b.r*0.15,b.r*0.15,0,Math.PI*2);ctx.fill();
  // Wing
  ctx.fillStyle=accent+'bb';ctx.beginPath();ctx.ellipse(-b.r*0.2,b.r*0.1,b.r*0.55,b.r*0.3,flappyStarted?Math.sin(flappyFrames*0.3)*0.4:0,0,Math.PI*2);ctx.fill();
  // Beak
  ctx.fillStyle='#f5a623';ctx.beginPath();ctx.moveTo(b.r*0.7,0);ctx.lineTo(b.r*1.3,b.r*0.15);ctx.lineTo(b.r*0.7,b.r*0.3);ctx.closePath();ctx.fill();
  ctx.restore();
  // Score HUD
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(0,0,flappyW,38);
  ctx.fillStyle='#f0ede8';ctx.font='bold 20px sans-serif';ctx.textAlign='center';
  ctx.fillText(flappyScore,flappyW/2,26);
  if(!flappyStarted){
    ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(0,flappyH/2-30,flappyW,60);
    ctx.fillStyle='#f0ede8';ctx.font='bold 15px sans-serif';ctx.textAlign='center';
    ctx.fillText('🐦 Тапни чтобы начать!',flappyW/2,flappyH/2+7);
  }
}
function flappyUpdateScore(){
  const el=document.getElementById('flappy-score-label');if(!el)return;
  el.textContent='Счёт: '+flappyScore+' • Рекорд: '+flappyHi;
}

// ══════════════════════════════════════════════════════════════════
// ── 🔢 2048 (v2.6.0) ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
const G2048_COLORS={0:'#1f1f1f',2:'#3a3a3a',4:'#4a3820',8:'#7c4010',16:'#a04a10',32:'#c45a0a',
  64:'#e07020',128:'#d4a020',256:'#c8b030',512:'#b0c040',1024:'#60b060',2048:'#30a030'};
const G2048_TC={0:'#555',2:'#ccc',4:'#ddb',8:'#fff',16:'#fff',32:'#fff',64:'#fff',
  128:'#fff',256:'#fff',512:'#fff',1024:'#fff',2048:'#fff'};
let g2048Grid=[],g2048Score=0,g2048Hi=0,g2048Over=false;
let g2048SwX=0,g2048SwY=0;

function g2048Init(){
  g2048Hi=getHi('2048');
  g2048Restart();
  const board=document.getElementById('g2048-board');
  board.ontouchstart=e=>{e.preventDefault();g2048SwX=e.touches[0].clientX;g2048SwY=e.touches[0].clientY;};
  board.ontouchend=e=>{
    e.preventDefault();
    const dx=e.changedTouches[0].clientX-g2048SwX,dy=e.changedTouches[0].clientY-g2048SwY;
    if(Math.abs(dx)<20&&Math.abs(dy)<20)return;
    if(Math.abs(dx)>Math.abs(dy))g2048Move(dx>0?'right':'left');
    else g2048Move(dy>0?'down':'up');
  };
  document.addEventListener('keydown',g2048Key);
}
function g2048Key(e){
  const map={'ArrowLeft':'left','ArrowRight':'right','ArrowUp':'up','ArrowDown':'down'};
  if(map[e.key]){e.preventDefault();g2048Move(map[e.key]);}
}
function g2048Stop(){document.removeEventListener('keydown',g2048Key);}
function g2048Restart(){
  g2048Grid=Array(4).fill(null).map(()=>Array(4).fill(0));
  g2048Score=0;g2048Over=false;
  g2048Spawn();g2048Spawn();
  g2048Render();g2048UpdateScore();
}
function g2048Spawn(){
  const empty=[];
  for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(g2048Grid[r][c]===0)empty.push([r,c]);
  if(!empty.length)return;
  const [r,c]=empty[Math.floor(Math.random()*empty.length)];
  g2048Grid[r][c]=Math.random()<0.9?2:4;
}
function g2048Slide(row){
  let a=row.filter(v=>v);
  for(let i=0;i<a.length-1;i++){if(a[i]===a[i+1]){a[i]*=2;g2048Score+=a[i];a.splice(i+1,1);i++;}}
  while(a.length<4)a.push(0);
  return a;
}
function g2048Move(dir){
  if(g2048Over)return;
  let changed=false;
  const prev=g2048Grid.map(r=>[...r]);
  if(dir==='left'){for(let r=0;r<4;r++){const n=g2048Slide(g2048Grid[r]);if(n.join()!==g2048Grid[r].join()){g2048Grid[r]=n;changed=true;}}}
  else if(dir==='right'){for(let r=0;r<4;r++){const n=g2048Slide([...g2048Grid[r]].reverse()).reverse();if(n.join()!==g2048Grid[r].join()){g2048Grid[r]=n;changed=true;}}}
  else if(dir==='up'){for(let c=0;c<4;c++){const col=[0,1,2,3].map(r=>g2048Grid[r][c]);const n=g2048Slide(col);n.forEach((v,r)=>{if(v!==g2048Grid[r][c]){g2048Grid[r][c]=v;changed=true;}});}}
  else if(dir==='down'){for(let c=0;c<4;c++){const col=[0,1,2,3].map(r=>g2048Grid[r][c]);const n=g2048Slide([...col].reverse()).reverse();n.forEach((v,r)=>{if(v!==g2048Grid[r][c]){g2048Grid[r][c]=v;changed=true;}});}}
  if(changed){
    if(g2048Score>g2048Hi)g2048Hi=saveHi('2048',g2048Score);
    g2048Spawn();g2048Render();g2048UpdateScore();SFX.play('pongHit');
    // Check game over
    const hasMoves=g2048Grid.some((row,r)=>row.some((v,c)=>{
      if(v===0)return true;
      if(c<3&&v===g2048Grid[r][c+1])return true;
      if(r<3&&v===g2048Grid[r+1][c])return true;
      return false;
    }));
    if(!hasMoves){g2048Over=true;toast('🔢 Игра окончена! '+g2048Score+' очков');}
  }
}
function g2048Render(){
  const board=document.getElementById('g2048-board');if(!board)return;
  board.innerHTML='';
  const cellSize=Math.floor((Math.min(300,window.innerWidth*0.85)-3*8)/4);
  for(let r=0;r<4;r++)for(let c=0;c<4;c++){
    const v=g2048Grid[r][c];
    const cell=document.createElement('div');
    const bg=G2048_COLORS[Math.min(v,2048)]||'#208020';
    const tc=G2048_TC[Math.min(v,2048)]||'#fff';
    const fs=v<100?22:v<1000?17:13;
    cell.style.cssText=`width:${cellSize}px;height:${cellSize}px;border-radius:8px;background:${bg};
      display:flex;align-items:center;justify-content:center;
      font-family:'JetBrains Mono',monospace;font-size:${fs}px;font-weight:800;color:${tc};
      transition:background .12s;box-shadow:0 2px 8px rgba(0,0,0,.3);`;
    cell.textContent=v||'';
    board.appendChild(cell);
  }
}
function g2048UpdateScore(){
  const el=document.getElementById('g2048-score-label');if(!el)return;
  el.textContent='Счёт: '+g2048Score+' • Рекорд: '+g2048Hi;
}

// ══════════════════════════════════════════════════════════════════
// ── 🪙 МОНЕТКА (v3.0.0) ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
let coinHeads=0, coinTails=0, coinEdge=0, coinFlipping=false, coinStreak=0, coinLastResult='';

function coinInit(){
  coinHeads=0; coinTails=0; coinEdge=0; coinFlipping=false; coinStreak=0; coinLastResult='';
  coinUpdateScore();
  document.getElementById('coin-result').textContent='Нажми, чтобы подбросить!';
  document.getElementById('coin-streak').textContent='';
  const wrapper=document.getElementById('coin-wrapper');
  wrapper.style.animation='none';
  wrapper.style.transform='rotateY(0deg)';
  wrapper.classList.remove('flipping-heads','flipping-tails','edge-flip');
}

function coinFlip(){
  if(coinFlipping) return;
  coinFlipping=true;
  SFX.play('pongHit');
  const r=Math.random();
  const isEdge = r < 0.003;
  const isHeads = !isEdge && r < 0.503;
  const wrapper=document.getElementById('coin-wrapper');
  const result=document.getElementById('coin-result');
  const streak=document.getElementById('coin-streak');
  wrapper.classList.remove('flipping-heads','flipping-tails','edge-flip');
  void wrapper.getBoundingClientRect();
  if(isEdge){
    wrapper.classList.add('edge-flip');
    result.textContent='⏳ Летит...';
    setTimeout(()=>{
      coinEdge++;
      result.textContent='🤩 РЕБРО!! Невероятно!';
      streak.textContent='🔥 Шанс 0.3%! Редчайший результат!';
      coinLastResult='edge';
      coinUpdateScore();
      coinFlipping=false;
    },2100);
  } else {
    wrapper.classList.add(isHeads ? 'flipping-heads' : 'flipping-tails');
    result.textContent='⏳ Летит...';
    setTimeout(()=>{
      if(isHeads){ coinHeads++; result.textContent='✨ ОРЁЛ!'; }
      else        { coinTails++; result.textContent='💫 РЕШКА!'; }
      if(coinLastResult===''||(coinLastResult==='heads')===isHeads){
        if(coinLastResult!=='') coinStreak++;
        else coinStreak=1;
      } else { coinStreak=1; }
      coinLastResult = isHeads?'heads':'tails';
      if(coinStreak>=3) streak.textContent='🔥 Серия '+coinStreak+'×'+(isHeads?'орёл':'решка')+'!';
      else streak.textContent='';
      coinUpdateScore();
      coinFlipping=false;
    },1550);
  }
}

function coinReset(){
  coinInit();
}

function coinUpdateScore(){
  const el=document.getElementById('coin-score-label');if(!el)return;
  el.textContent='Орёл: '+coinHeads+' • Решка: '+coinTails+(coinEdge?' • Ребро: '+coinEdge:'');
}


// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// ── 🎲 КУБИК (v7.0.0) — VP9/WebM с прозрачностью (Telegram-style)
// ══════════════════════════════════════════════════════════════════
// Telegram использует ровно такой же подход для стикера-кубика:
//   <video muted playsinline> с VP9+alpha webm-файлами.
// Каждая грань — отдельный файл dice_1.webm … dice_6.webm (512×512).
// При броске: play() → событие 'ended' → pause() + стоп на последнем кадре.
// Фон прозрачный (VP9 alpha), кодек проверяется автоматически.

let diceRolling = false, diceTotalRolls = 0, diceHistory = [];

// Базовый путь к webm-файлам
function _diceBase() {
  return window.Android ? 'file:///android_asset/dice/' : 'dice/';
}

// Создаёт <video> элемент для нужной грани (без autoplay, без loop)
function _diceCreateVideo(face) {
  const v = document.createElement('video');
  v.src = _diceBase() + 'dice_' + face + '.webm';
  v.muted = true;
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.setAttribute('webkit-playsinline', '');
  v.loop = false;
  v.style.cssText = 'width:180px;height:180px;display:block;background:transparent;';
  // Прозрачный фон для VP9 alpha
  v.style.mixBlendMode = 'normal';
  return v;
}

// Играет анимацию грани в контейнер, вызывает onDone по окончанию
function _dicePlayFace(container, face, onDone) {
  container.innerHTML = '';
  const v = _diceCreateVideo(face);

  v.addEventListener('ended', () => {
    v.pause();
    // Остаёмся на последнем кадре — Telegram делает то же самое
    onDone && onDone();
  }, { once: true });

  // Guard: если 'ended' не пришёл за 4 секунды
  const guard = setTimeout(() => { onDone && onDone(); }, 4000);
  v.addEventListener('ended', () => clearTimeout(guard), { once: true });

  container.appendChild(v);
  v.load();
  const p = v.play();
  if (p && p.catch) p.catch(() => {
    // Автовоспроизведение заблокировано — показываем статику и завершаем
    onDone && onDone();
  });
}

// Инициализация при открытии игры
function diceInit() {
  diceRolling = false; diceTotalRolls = 0; diceHistory = [];
  const wrap = document.getElementById('dice-cubes-wrap');
  if (wrap) {
    wrap.innerHTML = '';
    // Превью: показываем случайную грань статично (первый кадр)
    const face = Math.ceil(Math.random() * 6);
    const v = _diceCreateVideo(face);
    v.load(); // загружаем без play — будет на первом кадре
    wrap.appendChild(v);
  }
  const hist = document.getElementById('dice-history');
  if (hist) hist.textContent = '';
  const score = document.getElementById('dice-score-label');
  if (score) score.textContent = 'Всего бросков: 0';
}

// Бросок одного или двух кубиков
function diceRoll(count) {
  if (diceRolling) return;
  diceRolling = true;
  SFX.play && SFX.play('pongHit');

  const wrap = document.getElementById('dice-cubes-wrap');
  wrap.innerHTML = '';

  const results = Array.from({length: count}, () => Math.ceil(Math.random() * 6));
  let done = 0;

  results.forEach((face, i) => {
    const slot = document.createElement('div');
    slot.style.cssText = 'display:inline-block;';
    wrap.appendChild(slot);

    setTimeout(() => {
      _dicePlayFace(slot, face, () => {
        done++;
        if (done === count) {
          diceTotalRolls++;
          diceHistory.unshift(count === 1 ? results[0] : '(' + results.join('+') + ')');
          if (diceHistory.length > 8) diceHistory.pop();
          const hist = document.getElementById('dice-history');
          if (hist) hist.textContent = 'История: ' + diceHistory.join(' · ');
          const score = document.getElementById('dice-score-label');
          if (score) score.textContent = 'Всего бросков: ' + diceTotalRolls;
          diceRolling = false;
        }
      });
    }, i * 300); // небольшая задержка между двумя кубиками
  });
}

// ── 🏀 БАСКЕТБОЛ (v3.0.0) ────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
let basketRaf=null,basketRunning=false,basketLastTime=0;
let basketScore=0,basketHi=0,basketStreak=0;
let basketBall,basketHoop,basketW,basketH;
let basketDragging=false,basketDragStart={x:0,y:0},basketDragCur={x:0,y:0};
let basketBallInFlight=false,basketVx=0,basketVy=0;
let basketParticles=[];

function basketInit(){
  basketHi=getHi('basket');
  const canvas=document.getElementById('basket-canvas');
  basketW=Math.min(window.innerWidth-36,360);
  basketH=Math.round(basketW*1.35);
  canvas.width=basketW; canvas.height=basketH;
  basketBall={x:basketW/2,y:basketH-60,r:20};
  basketHoop={x:basketW*0.55,y:basketH*0.3,w:56,h:6,rimR:5};
  basketScore=0; basketStreak=0; basketBallInFlight=false; basketParticles=[];
  basketUpdateScore();

  canvas.ontouchstart=e=>{e.preventDefault();const t=e.touches[0];const r=canvas.getBoundingClientRect();basketDragStart={x:t.clientX-r.left,y:t.clientY-r.top};basketDragging=true;basketDragCur={...basketDragStart};};
  canvas.ontouchmove=e=>{e.preventDefault();if(!basketDragging)return;const t=e.touches[0];const r=canvas.getBoundingClientRect();basketDragCur={x:t.clientX-r.left,y:t.clientY-r.top};basketDraw();};
  canvas.ontouchend=e=>{e.preventDefault();if(!basketDragging||basketBallInFlight)return;basketDragging=false;basketShoot();};
  canvas.onmousedown=e=>{const r=canvas.getBoundingClientRect();basketDragStart={x:e.clientX-r.left,y:e.clientY-r.top};basketDragging=true;basketDragCur={...basketDragStart};};
  canvas.onmousemove=e=>{if(!basketDragging)return;const r=canvas.getBoundingClientRect();basketDragCur={x:e.clientX-r.left,y:e.clientY-r.top};basketDraw();};
  canvas.onmouseup=()=>{if(!basketDragging||basketBallInFlight)return;basketDragging=false;basketShoot();};
  basketRunning=true;basketLastTime=0;
  basketLoop();
}

function basketShoot(){
  // Вектор: от позиции мяча до точки начала касания (откуда тянули)
  const bx=basketBall.x, by=basketBall.y;
  const dx=basketDragCur.x-basketDragStart.x;
  const dy=basketDragCur.y-basketDragStart.y;
  if(Math.abs(dy)<10)return;
  const power=Math.min(Math.sqrt(dx*dx+dy*dy)*0.045,14);
  basketVx=-dx*0.055;
  basketVy=Math.min(dy*0.055,-3.5)*power*0.6;
  basketBallInFlight=true;
  // Мяч стартует со своей текущей позиции, а не с точки касания
  basketBall={x:bx,y:by,r:20};
  SFX.play('pongHit');
}

function basketLoop(ts){
  if(!basketRunning)return;
  const dt=basketLastTime?Math.min((ts-basketLastTime)/16.667,3):1;
  basketLastTime=ts;
  basketTick(dt);
  basketDraw();
  basketRaf=requestAnimationFrame(basketLoop);
}

function basketTick(dt){
  dt=dt||1;
  if(!basketBallInFlight){
    // Аnim хупа: медленно двигается
    basketHoop.x+=(basketHoop.vx||0)*dt;
    if(basketHoop.x>basketW-60||basketHoop.x<60) basketHoop.vx=(basketHoop.vx||1)*-1;
    return;
  }
  basketVy+=0.45*dt;
  basketBall.x+=basketVx*dt;
  basketBall.y+=basketVy*dt;

  // Частицы
  if(Math.random()<0.3) basketParticles.push({x:basketBall.x,y:basketBall.y,vx:(Math.random()-.5)*2,vy:(Math.random()-.5)*2,life:1,r:3+Math.random()*3});
  basketParticles=basketParticles.filter(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=0.06*dt;return p.life>0;});

  // Проверка попадания
  const hx=basketHoop.x, hy=basketHoop.y, hw=basketHoop.w;
  const bx=basketBall.x, by=basketBall.y, br=basketBall.r;
  // Мяч проходит через центр кольца сверху вниз
  if(basketBallInFlight && by+br>hy && by-br<hy+basketHoop.h+40 &&
     bx>hx && bx<hx+hw && basketVy>0 && by<hy+basketHoop.h+basketBall.r){
    basketScore++;
    basketStreak++;
    if(basketScore>basketHi) basketHi=saveHi('basket',basketScore);
    basketUpdateScore();
    SFX.play('dinoScore');
    // Взрыв частиц
    for(let i=0;i<20;i++) basketParticles.push({x:bx,y:by,vx:(Math.random()-.5)*8,vy:-(Math.random()*6+1),life:1,r:4+Math.random()*5,score:true});
    basketResetBall();
    // Двигаем кольцо
    basketHoop.x=40+Math.random()*(basketW-100);
    basketHoop.y=50+Math.random()*(basketH*0.4);
    basketHoop.vx=(Math.random()>0.5?1:-1)*(0.5+basketScore*0.15);
  }

  // Промах: мяч улетел за экран
  if(basketBall.y>basketH+50||basketBall.x<-50||basketBall.x>basketW+50){
    basketStreak=0;
    basketResetBall();
  }
  // Стены
  if(basketBall.x-basketBall.r<0){basketBall.x=basketBall.r;basketVx*=-0.7;}
  if(basketBall.x+basketBall.r>basketW){basketBall.x=basketW-basketBall.r;basketVx*=-0.7;}
}

function basketResetBall(){
  basketBallInFlight=false;
  basketBall={x:basketW/2,y:basketH-60,r:20};
  basketVx=0; basketVy=0;
}

function basketDraw(){
  const canvas=document.getElementById('basket-canvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const accent=getAccent();
  ctx.clearRect(0,0,basketW,basketH);
  // Sky gradient
  const grad=ctx.createLinearGradient(0,0,0,basketH);
  grad.addColorStop(0,'#0a1520');grad.addColorStop(1,'#0f2030');
  ctx.fillStyle=grad; ctx.fillRect(0,0,basketW,basketH);
  // Floor
  ctx.fillStyle='#1a3a1a';ctx.fillRect(0,basketH-20,basketW,20);
  ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(0,basketH-20);ctx.lineTo(basketW,basketH-20);ctx.stroke();

  // Particles
  basketParticles.forEach(p=>{
    ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fillStyle=p.score?`rgba(255,180,0,${p.life})`:`rgba(255,120,0,${p.life*0.5})`;
    ctx.fill();
  });

  // Hoop — backboard
  const hx=basketHoop.x, hy=basketHoop.y, hw=basketHoop.w;
  ctx.fillStyle='#cccccc44';
  ctx.fillRect(hx+hw-4,hy-30,3,30);
  ctx.fillStyle='#ffffff22';ctx.fillRect(hx+hw-22,hy-30,22,20);
  ctx.strokeStyle='#ffffff55';ctx.lineWidth=1.5;ctx.strokeRect(hx+hw-22,hy-30,22,20);
  // Hoop rims
  const rimR=basketHoop.rimR;
  ctx.strokeStyle='#e07020';ctx.lineWidth=5;
  ctx.beginPath();ctx.arc(hx+rimR,hy+rimR,rimR,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.arc(hx+hw-rimR,hy+rimR,rimR,0,Math.PI*2);ctx.stroke();
  // Hoop bar
  ctx.beginPath();ctx.moveTo(hx+rimR,hy+rimR);ctx.lineTo(hx+hw-rimR,hy+rimR);
  ctx.strokeStyle='#e07020';ctx.lineWidth=5;ctx.stroke();
  // Net
  const netSegs=6;
  for(let i=0;i<=netSegs;i++){
    const nx=hx+(hw/netSegs)*i;
    ctx.beginPath();ctx.moveTo(nx,hy+rimR*2);ctx.lineTo(hx+hw/2+((nx-hx-hw/2)*0.4),hy+35);
    ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=1;ctx.stroke();
  }

  // Drag arrow
  if(basketDragging && !basketBallInFlight){
    const dx=basketDragCur.x-basketDragStart.x;
    const dy=basketDragCur.y-basketDragStart.y;
    if(Math.abs(dy)>8){
      // Use same physics as basketShoot
      const power=Math.min(Math.sqrt(dx*dx+dy*dy)*0.045,14);
      const tvx=-dx*0.055;
      let tvy=Math.min(dy*0.055,-3.5)*power*0.6;
      let tx=basketBall.x, ty=basketBall.y;
      ctx.setLineDash([5,5]);
      for(let step=0;step<40;step++){
        tvy+=0.45;
        tx+=tvx; ty+=tvy;
        if(ty>basketH||tx<0||tx>basketW) break;
        const alpha=1-step/40;
        ctx.beginPath();ctx.arc(tx,ty,2,0,Math.PI*2);
        ctx.fillStyle=accent+Math.round(alpha*180).toString(16).padStart(2,'0');
        ctx.fill();
      }
      ctx.setLineDash([]);
    }
  }

  // Ball
  const bx=basketBall.x, by=basketBall.y, br=basketBall.r;
  const ballGrad=ctx.createRadialGradient(bx-br*0.3,by-br*0.3,br*0.1,bx,by,br);
  ballGrad.addColorStop(0,'#ff9040');ballGrad.addColorStop(0.6,'#e05010');ballGrad.addColorStop(1,'#803000');
  ctx.beginPath();ctx.arc(bx,by,br,0,Math.PI*2);
  ctx.fillStyle=ballGrad;
  ctx.shadowColor=accent;ctx.shadowBlur=basketBallInFlight?16:8;
  ctx.fill();ctx.shadowBlur=0;
  // Ball seams
  ctx.strokeStyle='#30200880';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(bx,by,br,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.arc(bx,by,br*0.7,0.2,Math.PI-0.2);ctx.stroke();
  ctx.beginPath();ctx.arc(bx,by,br*0.7,Math.PI+0.2,2*Math.PI-0.2);ctx.stroke();

  // Score HUD
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(0,0,basketW,38);
  ctx.fillStyle='#f0ede8';ctx.font='bold 16px sans-serif';ctx.textAlign='left';
  ctx.fillText('Счёт: '+basketScore,12,26);
  ctx.textAlign='right';
  ctx.fillText('Рекорд: '+basketHi,basketW-12,26);
  if(basketStreak>=3){
    ctx.textAlign='center';ctx.fillStyle=accent;
    ctx.fillText('🔥 Серия x'+basketStreak,basketW/2,26);
  }
}

function basketUpdateScore(){
  const el=document.getElementById('basket-score-label');if(!el)return;
  el.textContent='Счёт: '+basketScore+' • Рекорд: '+basketHi;
}
function basketRestart(){basketStop();basketInit();}
function basketStop(){if(basketRaf){cancelAnimationFrame(basketRaf);basketRaf=null;}basketRunning=false;}

// ══════════════════════════════════════════════════════════════════
// ── 🟥 GEOMETRY DASH (v3.0.0) ────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
let geoRaf=null,geoRunning=false;
let geoScore=0,geoHi=0,geoAttempt=1,geoProgress=0;
let geoPlayer,geoSpeed,geoObstacles,geoScrollX,geoW,geoH,geoGround;
let geoDiff='normal',geoLastTime=0,geoJumpHeld=false;
let geoParticles=[];

const GEO_DIFF_CFG={
  easy:{speed:4,spawnRate:0.012,minGap:200},
  normal:{speed:5.5,spawnRate:0.016,minGap:160},
  hard:{speed:7.5,spawnRate:0.022,minGap:120}
};
// Уровни: массив паттернов (obstacle = {type:'spike'|'block'|'double', x, w, h})
function geoGenObstacle(x, diff){
  const r=Math.random();
  // Variety of obstacle types
  let type,h,w=30;
  if(r<0.28){ type='spike'; h=diff==='hard'?46:diff==='easy'?28:38; }
  else if(r<0.48){ type='block'; h=diff==='hard'?50:diff==='easy'?32:40; w=30; }
  else if(r<0.62){ type='dspike'; h=diff==='hard'?44:diff==='easy'?28:36; } // double spike
  else if(r<0.72){ type='tspike'; h=diff==='hard'?44:diff==='easy'?30:38; } // triple spike
  else if(r<0.82){ type='tallblock'; h=diff==='hard'?70:diff==='easy'?45:56; w=28; }
  else if(r<0.90){ type='step'; h=diff==='hard'?40:30; } // block+spike combo next to each other
  else { type='spike'; h=38; }
  return {x,w,h,type};
}

function geoInit(){
  geoHi=getHi('geo');
  const canvas=document.getElementById('geo-canvas');
  geoW=Math.min(window.innerWidth-36,400);
  geoH=Math.round(geoW*0.55);
  canvas.width=geoW; canvas.height=geoH;
  geoGround=geoH-30;
  geoSpeed=GEO_DIFF_CFG[geoDiff].speed;
  geoPlayer={x:60,y:geoGround-36,w:32,h:32,vy:0,onGround:true,rotation:0};
  geoObstacles=[];geoScrollX=0;geoParticles=[];
  geoLastTime=0;geoProgress=0;geoScore=0;

  canvas.onclick=()=>geoJump();
  canvas.ontouchstart=e=>{e.preventDefault();geoJump();};
  document.addEventListener('keydown',geoKeyDown);
  geoRunning=true;
  geoUpdateScore();
  geoLoop();
}

function geoKeyDown(e){if(e.code==='Space'||e.code==='ArrowUp'){e.preventDefault();geoJump();}}

function geoJump(){
  if(!geoRunning){geoRestart();return;}
  if(geoPlayer.onGround){
    geoPlayer.vy=-10.5;
    geoPlayer.onGround=false;
    SFX.play('dinoJump');
  }
}

function geoLoop(ts){
  if(!geoRunning)return;
  const dt=geoLastTime?Math.min((ts-geoLastTime)/16.667,3):1;
  geoLastTime=ts;
  geoTick(dt);
  geoDraw();
  geoRaf=requestAnimationFrame(geoLoop);
}

function geoTick(dt){
  const cfg=GEO_DIFF_CFG[geoDiff];
  // Fixed speed - no acceleration (like real GD levels have consistent BPM)
  geoSpeed=cfg.speed;
  const _gdt = window._cheatGeoSlow ? dt * 0.5 : dt;
  geoScrollX+=geoSpeed*_gdt;
  geoProgress+=geoSpeed*_gdt;
  geoScore=Math.floor(geoProgress/10); // distance score, no 100% cap
  if(geoScore>geoHi) geoHi=saveHi('geo',geoScore);
  geoUpdateScore();

  // Физика игрока
  geoPlayer.vy+=0.6*dt;
  geoPlayer.y+=geoPlayer.vy*dt;
  geoPlayer.rotation+=6*dt;
  if(geoPlayer.onGround) for(let i=0;i<2;i++) geoParticles.push({x:geoPlayer.x,y:geoPlayer.y+geoPlayer.h,vx:-(1+Math.random()*2),vy:(Math.random()-.5)*1,life:0.7,r:2+Math.random()*2,color:getAccent()});
  if(geoPlayer.y+geoPlayer.h>=geoGround){
    geoPlayer.y=geoGround-geoPlayer.h;
    geoPlayer.vy=0;geoPlayer.onGround=true;geoPlayer.rotation=0;
  }
  // Частицы
  geoParticles=geoParticles.filter(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=0.08*dt;p.life-=0.035*dt;return p.life>0;});

  // Спавн препятствий
  const lastX=geoObstacles.length?geoObstacles[geoObstacles.length-1].x:-Infinity;
  const minGap=cfg.minGap+Math.random()*90;
  if(geoScrollX+geoW-lastX>minGap){
    if(Math.random()<cfg.spawnRate*dt||geoObstacles.length===0){
      geoObstacles.push(geoGenObstacle(geoScrollX+geoW+10,geoDiff));
    }
  }
  while(geoObstacles.length&&geoObstacles[0].x<geoScrollX-50) geoObstacles.shift();

  // Коллизия
  const px=geoPlayer.x+4,py=geoPlayer.y+4,pw=geoPlayer.w-8,ph=geoPlayer.h-8;
  for(const obs of geoObstacles){
    const ox=obs.x-geoScrollX;
    const obsTop=geoGround-obs.h;
    if(px+pw>ox&&px<ox+obs.w&&py+ph>obsTop&&py<geoGround){
      const isBlock=(obs.type==='block'||obs.type==='tallblock');
      // Если блок (без шипа) и игрок падает сверху — приземляемся на него
      if(isBlock&&geoPlayer.vy>=0&&py+ph-obsTop<=geoPlayer.vy*2+8){
        geoPlayer.y=obsTop-geoPlayer.h;
        geoPlayer.vy=0;geoPlayer.onGround=true;geoPlayer.rotation=0;
      } else {
        geoDie(); return;
      }
    }
  }
  // Бесконечный уровень — победы нет, играем вечно
}

function geoDie(){
  geoRunning=false;
  triggerScreamer();
  SFX.play('dinoCactus');
  // Взрыв
  for(let i=0;i<24;i++) geoParticles.push({x:geoPlayer.x+16,y:geoPlayer.y+16,
    vx:(Math.random()-.5)*10,vy:-(Math.random()*8+1),life:1,r:4+Math.random()*6,color:getAccent()});
  geoDraw();
  const canvas=document.getElementById('geo-canvas');
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,geoH/2-40,geoW,80);
  ctx.fillStyle='#f0ede8';ctx.font='bold 15px sans-serif';ctx.textAlign='center';
  ctx.fillText('💥 '+geoScore+'м — Попробуй снова!',geoW/2,geoH/2-10);
  ctx.fillText('Тап чтобы повторить',geoW/2,geoH/2+18);
  document.getElementById('geo-canvas').onclick=()=>{geoAttempt++;geoRestart();};
}

function geoWin(){
  geoRunning=false;
  SFX.play('dinoScore');
  geoDraw();
  const canvas=document.getElementById('geo-canvas');
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,geoH/2-40,geoW,80);
  ctx.fillStyle=getAccent();ctx.font='bold 18px sans-serif';ctx.textAlign='center';
  ctx.fillText('🎉 УРОВЕНЬ ПРОЙДЕН! 100%',geoW/2,geoH/2-10);
  ctx.fillStyle='#f0ede8';ctx.font='14px sans-serif';
  ctx.fillText('Тап для нового уровня',geoW/2,geoH/2+18);
  document.getElementById('geo-canvas').onclick=()=>{geoAttempt++;geoRestart();};
}

function geoDraw(){
  const canvas=document.getElementById('geo-canvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const accent=getAccent();
  ctx.clearRect(0,0,geoW,geoH);

  // BG — dark purple/blue gradient like Stereo Madness
  const bgGrad=ctx.createLinearGradient(0,0,0,geoH);
  bgGrad.addColorStop(0,'#050014');bgGrad.addColorStop(0.6,'#0d0028');bgGrad.addColorStop(1,'#0a001f');
  ctx.fillStyle=bgGrad;ctx.fillRect(0,0,geoW,geoH);

  // BG vertical columns/pillars (Stereo Madness style background lines)
  for(let i=0;i<8;i++){
    const cx=((i*geoW/7+geoScrollX*0.12)%(geoW*1.2)-geoW*0.1);
    const ph2=geoH-30;
    const cw=6+Math.sin(i*1.3)*4;
    const alpha=0.06+Math.sin(geoScrollX*0.005+i)*0.03;
    ctx.fillStyle=`rgba(120,60,255,${alpha})`;
    ctx.fillRect(cx,0,cw,ph2);
  }

  // Moving BG triangles (GD background spikes)
  for(let i=0;i<5;i++){
    const bx=((i*geoW/4+geoScrollX*0.3)%(geoW+80)-40);
    const bh=geoH*0.35+Math.sin(i*2.1)*geoH*0.08;
    ctx.beginPath();ctx.moveTo(bx,geoGround);ctx.lineTo(bx+30,geoGround-bh);ctx.lineTo(bx+60,geoGround);ctx.closePath();
    ctx.fillStyle=`rgba(80,20,160,0.18)`;ctx.fill();
  }

  // Stars (fast + slow layers)
  for(let i=0;i<28;i++){
    const sx=((i*137+geoScrollX*(0.04+i%3*0.03))%(geoW)+geoW)%geoW;
    const sy=(i*97)%((geoH-50));
    const r=i%4===0?1.5:0.8;
    ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);
    ctx.fillStyle=`rgba(255,255,255,${0.15+Math.sin(geoScrollX*0.008+i)*0.25})`;ctx.fill();
  }

  // Ground (dark purple slab)
  const gGrad=ctx.createLinearGradient(0,geoGround,0,geoH);
  gGrad.addColorStop(0,'#1a0040');gGrad.addColorStop(1,'#080015');
  ctx.fillStyle=gGrad;ctx.fillRect(0,geoGround,geoW,geoH-geoGround);
  // Ground top glow line
  ctx.strokeStyle=accent+'88';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,geoGround);ctx.lineTo(geoW,geoGround);ctx.stroke();
  // Ground grid
  ctx.strokeStyle=accent+'28';ctx.lineWidth=1;
  for(let gx=-(geoScrollX%40);gx<geoW;gx+=40){
    ctx.beginPath();ctx.moveTo(gx,geoGround);ctx.lineTo(gx,geoH);ctx.stroke();
  }

  // Progress bar
  ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(0,0,geoW,4);
  // Infinite — show distance as pulsing glow bar  
  const loopProg=(geoScrollX%2000)/2000;
  ctx.fillStyle=accent;ctx.fillRect(0,0,geoW*loopProg,4);

  // Particles
  geoParticles.forEach(p=>{
    ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fillStyle=p.color+Math.round(p.life*255).toString(16).padStart(2,'0');
    ctx.fill();
  });

  // Obstacles
  geoObstacles.forEach(obs=>{
    const ox=obs.x-geoScrollX;
    if(ox>geoW+10||ox+obs.w<-10)return;
    const oy=geoGround-obs.h;
    if(obs.type==='spike'||obs.type==='dspike'||obs.type==='tspike'){
      const count=obs.type==='tspike'?3:obs.type==='dspike'?2:1;
      const sw=obs.type==='spike'?obs.w:obs.w/count;
      for(let si=0;si<count;si++){
        const sx=ox+si*sw;
        ctx.beginPath();ctx.moveTo(sx,geoGround);ctx.lineTo(sx+sw/2,oy);ctx.lineTo(sx+sw,geoGround);ctx.closePath();
        const spGrad=ctx.createLinearGradient(sx,geoGround,sx,oy);
        spGrad.addColorStop(0,'#990000');spGrad.addColorStop(1,'#ff3333');
        ctx.fillStyle=spGrad;ctx.shadowColor='#ff0000';ctx.shadowBlur=10;ctx.fill();ctx.shadowBlur=0;
        ctx.strokeStyle='#ff666655';ctx.lineWidth=1;ctx.stroke();
      }
    } else if(obs.type==='block'||obs.type==='tallblock'){
      const bGrad=ctx.createLinearGradient(ox,oy,ox+obs.w,geoGround);
      bGrad.addColorStop(0,'#2244bb');bGrad.addColorStop(0.5,'#1133aa');bGrad.addColorStop(1,'#0d2277');
      ctx.fillStyle=bGrad;ctx.fillRect(ox,oy,obs.w,obs.h);
      // inner highlight
      ctx.strokeStyle='#5588ff55';ctx.lineWidth=1.5;ctx.strokeRect(ox+1,oy+1,obs.w-2,obs.h-2);
      ctx.fillStyle='rgba(100,150,255,0.12)';ctx.fillRect(ox+3,oy+3,obs.w-6,8);
      // "orb" decoration on top
      ctx.beginPath();ctx.arc(ox+obs.w/2,oy+6,4,0,Math.PI*2);
      ctx.fillStyle='rgba(200,220,255,0.6)';ctx.fill();
    } else if(obs.type==='step'){
      // Step block: low block + spike pair
      const bh=obs.h*0.6;
      const bGrad=ctx.createLinearGradient(ox,geoGround-bh,ox+obs.w,geoGround);
      bGrad.addColorStop(0,'#224499');bGrad.addColorStop(1,'#0d2266');
      ctx.fillStyle=bGrad;ctx.fillRect(ox,geoGround-bh,obs.w,bh);
      ctx.strokeStyle='#5577dd55';ctx.lineWidth=1;ctx.strokeRect(ox,geoGround-bh,obs.w,bh);
      // spike on top
      const sh=obs.h-bh;
      ctx.beginPath();ctx.moveTo(ox,geoGround-bh);ctx.lineTo(ox+obs.w/2,geoGround-bh-sh);ctx.lineTo(ox+obs.w,geoGround-bh);ctx.closePath();
      const spGrad=ctx.createLinearGradient(ox,geoGround-bh,ox,geoGround-bh-sh);
      spGrad.addColorStop(0,'#bb0000');spGrad.addColorStop(1,'#ff5555');
      ctx.fillStyle=spGrad;ctx.shadowColor='#ff2222';ctx.shadowBlur=8;ctx.fill();ctx.shadowBlur=0;
    }
  });

  // Player cube
  ctx.save();
  ctx.translate(geoPlayer.x+geoPlayer.w/2, geoPlayer.y+geoPlayer.h/2);
  if(!geoPlayer.onGround) ctx.rotate(geoPlayer.rotation*Math.PI/180);
  const pGrad=ctx.createLinearGradient(-geoPlayer.w/2,-geoPlayer.h/2,geoPlayer.w/2,geoPlayer.h/2);
  pGrad.addColorStop(0,accent);pGrad.addColorStop(1,accent+'88');
  ctx.fillStyle=pGrad;
  ctx.shadowColor=accent;ctx.shadowBlur=18;
  ctx.fillRect(-geoPlayer.w/2,-geoPlayer.h/2,geoPlayer.w,geoPlayer.h);
  ctx.shadowBlur=0;
  // Inner design (like GD cube icon)
  ctx.strokeStyle='rgba(255,255,255,0.35)';ctx.lineWidth=1.5;
  ctx.strokeRect(-geoPlayer.w/2+3,-geoPlayer.h/2+3,geoPlayer.w-6,geoPlayer.h-6);
  // cross mark
  ctx.strokeStyle='rgba(255,255,255,0.2)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(8,0);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(0,8);ctx.stroke();
  ctx.restore();

  // HUD
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(0,4,geoW,34);
  ctx.fillStyle='#f0ede8';ctx.font='bold 13px sans-serif';ctx.textAlign='left';
  ctx.fillText('Попытка '+geoAttempt,8,24);
  ctx.textAlign='right';ctx.fillStyle=accent;
  ctx.fillText(geoScore+'м',geoW-8,24);
  ctx.textAlign='center';ctx.fillStyle='rgba(255,255,255,.4)';
  ctx.fillText('Рекорд: '+geoHi+'м',geoW/2,24);
}

function geoUpdateScore(){
  const el=document.getElementById('geo-score-label');if(!el)return;
  el.textContent='Попытка: '+geoAttempt+' • Рекорд: '+geoHi+'м';
}
function geoRestart(){geoStop();geoInit();}
function geoStop(){
  if(geoRaf){cancelAnimationFrame(geoRaf);geoRaf=null;}
  geoRunning=false;
  document.removeEventListener('keydown',geoKeyDown);
}

// ══════════════════════════════════════════════════════════════════
// ── 🪖 ТАНЧИКИ (v3.0.0) ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
let tanksRaf=null,tanksRunning=false,tanksLastTime=0;
let tanksScore=0,tanksDiff='normal';
let tanksPlayer,tanksEnemies,tanksBullets,tanksWalls,tanksW,tanksH;
let tanksPlayerDir=0,tanksKeys={},tanksKeysHeld={};

function tanksKeyDown(e){
  const map={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',KeyW:'up',KeyS:'down',KeyA:'left',KeyD:'right'};
  if(map[e.code]){e.preventDefault();tanksKeysHeld[e.code]=map[e.code];}
  if(e.code==='Space'||e.code==='KeyF'){e.preventDefault();tanksShoot();}
}
function tanksKeyUp(e){delete tanksKeysHeld[e.code];}

function tanksGetHeldDir(){
  // Priority: up/down over left/right, first pressed wins
  for(const code of Object.keys(tanksKeysHeld)){
    return tanksKeysHeld[code];
  }
  return null;
}
const TANKS_TILE=32, TANKS_COLS=12, TANKS_ROWS=13;

function tanksInit(){
  const canvas=document.getElementById('tanks-canvas');
  tanksW=TANKS_TILE*TANKS_COLS; tanksH=TANKS_TILE*TANKS_ROWS;
  canvas.width=tanksW; canvas.height=tanksH;
  tanksScore=0;
  tanksPlayer={x:TANKS_TILE*1.5,y:TANKS_TILE*(TANKS_ROWS-2.5),w:TANKS_TILE*0.8,h:TANKS_TILE*0.8,dir:0,hp:3,shootCd:0};
  tanksBullets=[];
  // Стены
  tanksWalls=[];
  // Периметр
  for(let c=0;c<TANKS_COLS;c++){tanksWalls.push({x:c*TANKS_TILE,y:0,solid:true});tanksWalls.push({x:c*TANKS_TILE,y:(TANKS_ROWS-1)*TANKS_TILE,solid:true});}
  for(let r=1;r<TANKS_ROWS-1;r++){tanksWalls.push({x:0,y:r*TANKS_TILE,solid:true});tanksWalls.push({x:(TANKS_COLS-1)*TANKS_TILE,y:r*TANKS_TILE,solid:true});}
  // Внутренние стены (паттерн)
  const pattern=[[2,2],[2,3],[5,2],[5,3],[8,2],[8,3],[2,6],[2,7],[5,5],[5,6],[8,6],[8,7],[3,10],[6,10],[9,10],[4,4],[7,4]];
  pattern.forEach(([c,r])=>tanksWalls.push({x:c*TANKS_TILE,y:r*TANKS_TILE,solid:true}));
  // Враги
  const numEnemies=tanksDiff==='easy'?2:tanksDiff==='hard'?5:3;
  tanksEnemies=[];
  const spawnPoints=[[TANKS_TILE*5,TANKS_TILE*1.5],[TANKS_TILE*8,TANKS_TILE*1.5],[TANKS_TILE*2,TANKS_TILE*4],[TANKS_TILE*9,TANKS_TILE*4],[TANKS_TILE*5,TANKS_TILE*6]];
  for(let i=0;i<numEnemies;i++){
    const sp=spawnPoints[i%spawnPoints.length];
    tanksEnemies.push({x:sp[0],y:sp[1],w:TANKS_TILE*0.8,h:TANKS_TILE*0.8,dir:2,hp:1,shootCd:60+i*40,moveCd:20,moveDir:Math.floor(Math.random()*4)});
  }
  tanksUpdateScore();
  tanksRunning=true;tanksLastTime=0;
  tanksKeysHeld={};
  document.addEventListener('keydown',tanksKeyDown);
  document.addEventListener('keyup',tanksKeyUp);
  tanksLoop();
}

function tanksDir(dir){
  const dirs={up:0,right:1,down:2,left:3};
  tanksKeys.lastDir=dirs[dir];
}
function tanksShoot(){
  tanksDoShoot(tanksPlayer);
}
function tanksDoShoot(tank){
  if(tank.shootCd>0)return;
  tank.shootCd=tanksDiff==='hard'?20:30;
  const speed=7;
  const angle=tank.dir*Math.PI/2;
  const cx=tank.x+tank.w/2, cy=tank.y+tank.h/2;
  tanksBullets.push({x:cx,y:cy,vx:Math.sin(angle)*speed,vy:-Math.cos(angle)*speed,owner:tank===tanksPlayer?'player':'enemy',life:60});
  SFX.play('pongHit');
}

function tanksLoop(ts){
  if(!tanksRunning)return;
  const dt=tanksLastTime?Math.min((ts-tanksLastTime)/16.667,3):1;
  tanksLastTime=ts;
  tanksTick(dt);
  tanksDraw();
  tanksRaf=requestAnimationFrame(tanksLoop);
}

function tanksTick(dt){
  dt=dt||1;
  // Игрок
  const p=tanksPlayer;
  if(p.shootCd>0)p.shootCd-=dt;
  const speed=(tanksDiff==='hard'?7.5:tanksDiff==='easy'?4.5:5.5)*dt;
  // Apply held keyboard direction
  const heldDir=tanksGetHeldDir();
  if(heldDir) tanksDir(heldDir);
  if(tanksKeys.lastDir!==undefined){
    const dir=tanksKeys.lastDir;
    p.dir=dir;
    const dx=[0,1,0,-1][dir]*speed;
    const dy=[-1,0,1,0][dir]*speed;
    if(!tanksCollideWalls(p.x+dx,p.y,p.w,p.h)) p.x+=dx;
    if(!tanksCollideWalls(p.x,p.y+dy,p.w,p.h)) p.y+=dy;
    p.x=Math.max(TANKS_TILE,Math.min(tanksW-TANKS_TILE-p.w,p.x));
    p.y=Math.max(TANKS_TILE,Math.min(tanksH-TANKS_TILE-p.h,p.y));
    delete tanksKeys.lastDir;
  }

  // Враги (AI)
  tanksEnemies.forEach(e=>{
    if(e.shootCd>0)e.shootCd-=dt;else{
      // Стрелять в сторону игрока
      const dx=p.x-e.x, dy=p.y-e.y;
      const angToPlayer=Math.atan2(dy,dx);
      let bestDir=1, minDiff=999;
      for(let d=0;d<4;d++){
        const angle=d===0?-Math.PI/2:d===1?0:d===2?Math.PI/2:Math.PI;
        const diff=Math.abs(angToPlayer-angle);
        if(diff<minDiff){minDiff=diff;bestDir=d;}
      }
      e.dir=bestDir;
      tanksDoShoot(e);
    }
    e.moveCd-=dt;
    if(e.moveCd<=0){
      e.moveCd=20+Math.floor(Math.random()*30);
      if(Math.random()<0.4) e.moveDir=Math.floor(Math.random()*4);
      const espeed=2.5*dt;
      const edx=[0,1,0,-1][e.moveDir]*espeed;
      const edy=[-1,0,1,0][e.moveDir]*espeed;
      if(!tanksCollideWalls(e.x+edx,e.y,e.w,e.h)) e.x+=edx;
      else e.moveDir=Math.floor(Math.random()*4);
      if(!tanksCollideWalls(e.x,e.y+edy,e.w,e.h)) e.y+=edy;
      else e.moveDir=Math.floor(Math.random()*4);
      e.x=Math.max(TANKS_TILE,Math.min(tanksW-TANKS_TILE-e.w,e.x));
      e.y=Math.max(TANKS_TILE,Math.min(tanksH-TANKS_TILE-e.h,e.y));
    }
  });

  // Пули
  tanksBullets=tanksBullets.filter(b=>{
    b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
    if(b.life<=0) return false;
    if(tanksCollideWalls(b.x-3,b.y-3,6,6)) return false;
    if(b.owner==='enemy'){
      const hp=tanksPlayer;
      if(b.x>hp.x&&b.x<hp.x+hp.w&&b.y>hp.y&&b.y<hp.y+hp.h){
        tanksPlayer.hp--;SFX.play('dinoCactus');
        if(tanksPlayer.hp<=0){tanksGameOver();return false;}
        tanksUpdateScore(); return false;
      }
    } else {
      for(let i=tanksEnemies.length-1;i>=0;i--){
        const e=tanksEnemies[i];
        if(b.x>e.x&&b.x<e.x+e.w&&b.y>e.y&&b.y<e.y+e.h){
          tanksEnemies.splice(i,1);tanksScore++;
          SFX.play('dinoScore');
          tanksUpdateScore();
          if(tanksEnemies.length===0) tanksWin();
          return false;
        }
      }
    }
    return true;
  });
}

function tanksCollideWalls(x,y,w,h){
  return tanksWalls.some(wall=>x<wall.x+TANKS_TILE&&x+w>wall.x&&y<wall.y+TANKS_TILE&&y+h>wall.y);
}

function tanksDraw(){
  const canvas=document.getElementById('tanks-canvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const accent=getAccent();
  ctx.clearRect(0,0,tanksW,tanksH);
  // BG
  ctx.fillStyle='#0a1205';ctx.fillRect(0,0,tanksW,tanksH);
  // Grid
  ctx.strokeStyle='rgba(255,255,255,.04)';ctx.lineWidth=0.5;
  for(let x=0;x<tanksW;x+=TANKS_TILE){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,tanksH);ctx.stroke();}
  for(let y=0;y<tanksH;y+=TANKS_TILE){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(tanksW,y);ctx.stroke();}
  // Walls
  tanksWalls.forEach(w=>{
    const wg=ctx.createLinearGradient(w.x,w.y,w.x+TANKS_TILE,w.y+TANKS_TILE);
    wg.addColorStop(0,'#3a4a2a');wg.addColorStop(1,'#253020');
    ctx.fillStyle=wg;
    ctx.fillRect(w.x+1,w.y+1,TANKS_TILE-2,TANKS_TILE-2);
    ctx.strokeStyle='#5a7040';ctx.lineWidth=1;
    ctx.strokeRect(w.x+1,w.y+1,TANKS_TILE-2,TANKS_TILE-2);
  });
  // Enemies
  tanksEnemies.forEach(e=>tanksDrawTank(ctx,e,'#cc3333',e.dir));
  // Player
  tanksDrawTank(ctx,tanksPlayer,accent,tanksPlayer.dir);
  // Bullets
  tanksBullets.forEach(b=>{
    ctx.beginPath();ctx.arc(b.x,b.y,4,0,Math.PI*2);
    ctx.fillStyle=b.owner==='player'?accent:'#ff4444';
    ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=8;ctx.fill();ctx.shadowBlur=0;
  });
  // HUD
  ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(0,tanksH-24,tanksW,24);
  ctx.fillStyle='#f0ede8';ctx.font='bold 13px sans-serif';ctx.textAlign='left';
  ctx.fillText('Уничтожено: '+tanksScore,8,tanksH-7);
  ctx.textAlign='right';
  ctx.fillText('❤️'.repeat(Math.max(0,tanksPlayer.hp)),tanksW-8,tanksH-7);
}

function tanksDrawTank(ctx,tank,color,dir){
  ctx.save();
  ctx.translate(tank.x+tank.w/2,tank.y+tank.h/2);
  ctx.rotate(dir*Math.PI/2);
  // Body
  const bg=ctx.createLinearGradient(-tank.w/2,-tank.h/2,tank.w/2,tank.h/2);
  bg.addColorStop(0,color+'cc');bg.addColorStop(1,color+'66');
  ctx.fillStyle=bg;
  ctx.shadowColor=color;ctx.shadowBlur=8;
  // Round body
  const hw=tank.w/2-2,hh=tank.h/2-2;
  ctx.beginPath();
  ctx.roundRect(-hw,-hh,hw*2,hh*2,4);
  ctx.fill();ctx.shadowBlur=0;
  // Tracks
  ctx.fillStyle='rgba(0,0,0,.4)';
  ctx.fillRect(-hw,-hh,hw*0.28,hh*2);
  ctx.fillRect(hw-hw*0.28,-hh,hw*0.28,hh*2);
  // Turret
  ctx.fillStyle=color;ctx.beginPath();ctx.arc(0,0,tank.w*0.22,0,Math.PI*2);ctx.fill();
  // Barrel
  ctx.fillStyle=color;
  ctx.fillRect(-3,-tank.h/2-8,6,14);
  ctx.restore();
}

function tanksGameOver(){
  tanksRunning=false;
  const canvas=document.getElementById('tanks-canvas');
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(0,tanksH/2-40,tanksW,80);
  ctx.fillStyle='#ff4444';ctx.font='bold 16px sans-serif';ctx.textAlign='center';
  ctx.fillText('💀 Ты уничтожен! Уничтожено: '+tanksScore,tanksW/2,tanksH/2-10);
  ctx.fillStyle='#f0ede8';ctx.font='14px sans-serif';
  ctx.fillText('Тап для повтора',tanksW/2,tanksH/2+18);
  canvas.onclick=()=>{canvas.onclick=null;tanksRestart();};
}
function tanksWin(){
  tanksRunning=false;
  const canvas=document.getElementById('tanks-canvas');
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(0,tanksH/2-40,tanksW,80);
  ctx.fillStyle=getAccent();ctx.font='bold 16px sans-serif';ctx.textAlign='center';
  ctx.fillText('🎉 Победа! Все враги уничтожены!',tanksW/2,tanksH/2-10);
  ctx.fillStyle='#f0ede8';ctx.font='14px sans-serif';
  ctx.fillText('Тап для повтора',tanksW/2,tanksH/2+18);
  canvas.onclick=()=>{canvas.onclick=null;tanksRestart();};
}
function tanksUpdateScore(){
  const el=document.getElementById('tanks-score-label');if(!el)return;
  el.textContent='Уничтожено: '+tanksScore+' • Жизни: '+'❤️'.repeat(Math.max(0,tanksPlayer.hp));
}
function tanksRestart(){tanksStop();tanksInit();}
function tanksStop(){
  if(tanksRaf){cancelAnimationFrame(tanksRaf);tanksRaf=null;}
  tanksRunning=false;
  tanksKeysHeld={};
  document.removeEventListener('keydown',tanksKeyDown);
  document.removeEventListener('keyup',tanksKeyUp);
}


// ── Game iframe helpers ─────────────────────────────────────────
function _openGame(overlayId, src) {
  const el = document.getElementById(overlayId);
  if (!el) return;
  if (!el.querySelector('iframe')) {
    const fr = document.createElement('iframe');
    fr.src = src;
    fr.allow = 'autoplay';
    fr.setAttribute('allowfullscreen','');
    el.appendChild(fr);
  }
  el.classList.add('active');
}
function _closeGame(overlayId) {
  const el = document.getElementById(overlayId);
  if (!el) return;
  el.classList.remove('active');
  const fr = el.querySelector('iframe');
  if (fr) { fr.src='about:blank'; setTimeout(()=>{ if(fr.parentNode) fr.parentNode.removeChild(fr); }, 100); }
}
window.addEventListener('message', function(e) {
  if (!e.data || e.data.type !== 'gameClose') return;
  const map = { quake:'overlay-quake', ascii_player:'overlay-ascii' };
  const id = map[e.data.game];
  if (id) _closeGame(id);
  if (window.Android && window.Android.setOrientation) Android.setOrientation('portrait');
  eggOpen();
});





// ══════════════════════════════════════════════
// 🔐 СЕКРЕТНЫЙ ASCII-ВИДЕОПЛЕЕР (33%/33%/33%)
// Триггер: 7 тапов по заголовку "колледж расписание" на главном экране
// ══════════════════════════════════════════════
let _secretTapCount = 0, _secretTapTimer = null, _secretLastTs = 0;
function secretVersionTap() {
  // Защита от двойного срабатывания touchstart+click на одном тапе
  const now = Date.now();
  if (now - _secretLastTs < 350) return;
  _secretLastTs = now;

  _secretTapCount++;
  clearTimeout(_secretTapTimer);
  _secretTapTimer = setTimeout(() => { _secretTapCount = 0; }, 1500);

  // Лёгкий визуальный фидбек каждые 3 тапа
  if (_secretTapCount === 3 || _secretTapCount === 5) {
    const el = document.getElementById('hero-title-text');
    if (el) { el.style.opacity = '0.6'; setTimeout(()=>{ el.style.opacity=''; }, 120); }
  }

  if (_secretTapCount >= 7) {
    _secretTapCount = 0;
    clearTimeout(_secretTapTimer);
    openSecretVideo();
  }
}
function openSecretVideo() {
  SFX.play('themeSelect');
  const roll = Math.random();
  let videoMode;
  if      (roll < 0.333) videoMode = 'bad_apple';
  else if (roll < 0.666) videoMode = 'rickroll';
  else                   videoMode = 'kiss_me_again';
  setTimeout(() => _openGame('overlay-ascii', 'ascii_player.html?v=' + videoMode), 100);
}
function asciiPlayerStop() { _closeGame('overlay-ascii'); }


// ══════════════════════════════════════════════════════════════════
// ── 🔴 ШАШКИ (Checkers) v1.0.0 ───────────────────────────────────
// ══════════════════════════════════════════════════════════════════
let chkBoard, chkTurn, chkMode, chkSelected, chkMustCapture, chkGameOver;
let chkWins = 0, chkLosses = 0, chkDraws_c = 0;
let chkAiThinking = false;

function chkInit() { chkMode = chkMode || 'ai'; chkRestart(); }

function chkSetMode(m) {
  chkMode = m;
  ['ai','local'].forEach(id => {
    const b = document.getElementById('chk-mode-' + id);
    if (b) b.classList.toggle('active', id === m);
  });
  const lbl1 = document.getElementById('chk-label-1');
  const lbl2 = document.getElementById('chk-label-2');
  if (lbl1) lbl1.textContent = m === 'ai' ? 'Ты (🔴)' : 'Игрок 1 (🔴)';
  if (lbl2) lbl2.textContent = m === 'ai' ? 'ИИ (⚫)'  : 'Игрок 2 (⚫)';
  chkRestart();
}

function chkRestart() {
  // 8x8, ряды 0-2 = чёрные (2), ряды 5-7 = красные (1), 0=пусто, 3=чёрный король, 4=красный король
  chkBoard = [];
  for (let r = 0; r < 8; r++) {
    chkBoard[r] = [];
    for (let c = 0; c < 8; c++) {
      const dark = (r + c) % 2 === 1;
      if (!dark) { chkBoard[r][c] = 0; continue; }
      if (r < 3)  chkBoard[r][c] = 2; // чёрные
      else if (r > 4) chkBoard[r][c] = 1; // красные
      else chkBoard[r][c] = 0;
    }
  }
  chkTurn = 1; // красные (игрок) ходят первыми
  chkSelected = null;
  chkGameOver = false;
  chkAiThinking = false;
  chkRender();
  chkSetStatus('Твой ход — красные 🔴');
}

function chkRender() {
  const el = document.getElementById('chk-board');
  if (!el) return;
  el.innerHTML = '';
  const moves = chkGetAllMoves(chkBoard, chkTurn);
  const captures = moves.filter(m => m.captured.length > 0);
  const validMoves = captures.length ? captures : moves;
  const selectedMoves = chkSelected
    ? validMoves.filter(m => m.from[0] === chkSelected[0] && m.from[1] === chkSelected[1])
    : [];
  const targetCells = new Set(selectedMoves.map(m => m.to[0] + ',' + m.to[1]));

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = document.createElement('div');
      const dark = (r + c) % 2 === 1;
      cell.className = 'chk-cell ' + (dark ? 'chk-dark' : 'chk-light');
      const isSelected = chkSelected && chkSelected[0] === r && chkSelected[1] === c;
      const isTarget   = targetCells.has(r + ',' + c);
      if (isSelected) cell.classList.add('chk-selected');
      if (isTarget)   cell.classList.add('chk-target');

      const v = chkBoard[r][c];
      if (v) {
        const piece = document.createElement('div');
        piece.className = 'chk-piece chk-p' + v;
        if (v === 3 || v === 4) piece.textContent = '♛';
        cell.appendChild(piece);
      }

      cell.onclick = () => chkClick(r, c);
      el.appendChild(cell);
    }
  }
  chkUpdateScores();
}

function chkClick(r, c) {
  if (chkGameOver || chkAiThinking) return;
  const canMove = chkMode === 'local' || chkTurn === 1;
  if (!canMove) return;

  const v = chkBoard[r][c];
  const myPieces = chkTurn === 1 ? [1, 4] : [2, 3];
  const moves = chkGetAllMoves(chkBoard, chkTurn);
  const captures = moves.filter(m => m.captured.length > 0);
  const validMoves = captures.length ? captures : moves;

  if (myPieces.includes(v)) {
    chkSelected = [r, c];
    chkRender();
    return;
  }

  if (chkSelected) {
    const move = validMoves.find(m =>
      m.from[0] === chkSelected[0] && m.from[1] === chkSelected[1] &&
      m.to[0] === r && m.to[1] === c
    );
    if (move) {
      chkApplyMove(chkBoard, move);
      chkSelected = null;
      chkCheckWin();
      if (!chkGameOver) {
        chkTurn = chkTurn === 1 ? 2 : 1;
        chkRender();
        if (chkMode === 'ai' && chkTurn === 2) {
          chkSetStatus('🤔 ИИ думает...');
          chkAiThinking = true;
          setTimeout(chkAiMove, 350);
        } else {
          const label = chkMode === 'ai' ? 'Твой ход — красные 🔴' :
                        (chkTurn === 1 ? 'Ход игрока 1 🔴' : 'Ход игрока 2 ⚫');
          chkSetStatus(label);
        }
      }
      return;
    }
  }
  chkSelected = null;
  chkRender();
}

function chkApplyMove(board, move) {
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  board[tr][tc] = board[fr][fc];
  board[fr][fc] = 0;
  move.captured.forEach(([cr, cc]) => { board[cr][cc] = 0; });
  // Promotion
  if (board[tr][tc] === 1 && tr === 0) board[tr][tc] = 4;
  if (board[tr][tc] === 2 && tr === 7) board[tr][tc] = 3;
}

function chkGetAllMoves(board, player) {
  const pieces = player === 1 ? [1, 4] : [2, 3];
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (!pieces.includes(board[r][c])) continue;
      const isKing = board[r][c] === 3 || board[r][c] === 4;
      moves.push(...chkPieceMoves(board, r, c, player, isKing));
    }
  }
  return moves;
}

function chkPieceMoves(board, r, c, player, isKing) {
  const enemy = player === 1 ? [2, 3] : [1, 4];
  const fwd   = player === 1 ? -1 : 1;
  const dirs  = isKing ? [[-1,-1],[-1,1],[1,-1],[1,1]] : [[fwd,-1],[fwd,1]];
  const moves = [];

  // Обычные ходы
  for (const [dr, dc] of dirs) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === 0) {
      moves.push({ from:[r,c], to:[nr,nc], captured:[] });
    }
  }

  // Взятия (рекурсивные цепочки)
  const captDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
  function findCaptures(br, bc, boardState, path, capped) {
    let found = false;
    for (const [dr, dc] of captDirs) {
      const mr = br + dr, mc = bc + dc; // враг
      const lr = br + 2*dr, lc = bc + 2*dc; // приземление
      if (mr < 0 || mr >= 8 || mc < 0 || mc >= 8) continue;
      if (lr < 0 || lr >= 8 || lc < 0 || lc >= 8) continue;
      if (!enemy.includes(boardState[mr][mc])) continue;
      if (boardState[lr][lc] !== 0) continue;
      const key = mr + ',' + mc;
      if (capped.has(key)) continue;
      found = true;
      const newBoard = boardState.map(row => [...row]);
      newBoard[lr][lc] = newBoard[br][bc];
      newBoard[br][bc] = 0;
      newBoard[mr][mc] = 0;
      const newCapped = new Set(capped); newCapped.add(key);
      // Promotion check mid-chain
      if (newBoard[lr][lc] === 1 && lr === 0) newBoard[lr][lc] = 4;
      if (newBoard[lr][lc] === 2 && lr === 7) newBoard[lr][lc] = 3;
      const sub = findCaptures(lr, lc, newBoard, [...path, [lr,lc]], newCapped);
      if (!sub.length) {
        moves.push({ from:[r,c], to:[lr,lc], captured:[...capped].map(k=>k.split(',').map(Number)).concat([[mr,mc]]) });
      } else {
        sub.forEach(m => moves.push(m));
      }
    }
    return found ? moves.filter(m => m.captured.length > 0) : [];
  }
  findCaptures(r, c, board, [], new Set());
  return moves;
}

function chkCheckWin() {
  const red   = chkBoard.flat().filter(v => v === 1 || v === 4).length;
  const black = chkBoard.flat().filter(v => v === 2 || v === 3).length;
  const redMoves   = chkGetAllMoves(chkBoard, 1).length;
  const blackMoves = chkGetAllMoves(chkBoard, 2).length;

  if (red === 0 || redMoves === 0) {
    chkGameOver = true;
    if (chkMode === 'ai') { chkLosses++; chkSetStatus('🤖 ИИ победил! Попробуй ещё.'); }
    else chkSetStatus('🏆 Игрок 2 (⚫) победил!');
    chkUpdateScores(); chkRender(); return;
  }
  if (black === 0 || blackMoves === 0) {
    chkGameOver = true;
    if (chkMode === 'ai') { chkWins++; chkSetStatus('🎉 Ты победил!'); }
    else chkSetStatus('🏆 Игрок 1 (🔴) победил!');
    chkUpdateScores(); chkRender(); return;
  }
}

function chkAiMove() {
  const result = chkMinimax(chkBoard.map(r=>[...r]), 5, -Infinity, Infinity, true);
  if (result.move) {
    chkApplyMove(chkBoard, result.move);
  }
  chkAiThinking = false;
  chkCheckWin();
  if (!chkGameOver) {
    chkTurn = 1;
    chkRender();
    chkSetStatus('Твой ход — красные 🔴');
  }
}

function chkMinimax(board, depth, alpha, beta, maximizing) {
  const moves = chkGetAllMoves(board, maximizing ? 2 : 1);
  const caps  = moves.filter(m => m.captured.length > 0);
  const valid = caps.length ? caps : moves;

  if (depth === 0 || valid.length === 0) {
    return { score: chkEval(board) };
  }

  let best = { score: maximizing ? -Infinity : Infinity, move: null };
  for (const move of valid) {
    const nb = board.map(r => [...r]);
    chkApplyMove(nb, move);
    const res = chkMinimax(nb, depth - 1, alpha, beta, !maximizing);
    if (maximizing ? res.score > best.score : res.score < best.score) {
      best = { score: res.score, move };
    }
    if (maximizing) alpha = Math.max(alpha, best.score);
    else            beta  = Math.min(beta,  best.score);
    if (beta <= alpha) break;
  }
  return best;
}

function chkEval(board) {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const v = board[r][c];
      if (v === 2) score += 10 + r;         // чёрная (AI)
      else if (v === 3) score += 20;         // чёрный король
      else if (v === 1) score -= 10 + (7-r); // красная (игрок)
      else if (v === 4) score -= 20;         // красный король
    }
  }
  return score;
}

function chkSetStatus(msg) {
  const el = document.getElementById('chk-status');
  if (el) el.textContent = msg;
}

function chkUpdateScores() {
  const w = document.getElementById('chk-score-w'); if (w) w.textContent = chkWins;
  const l = document.getElementById('chk-score-l'); if (l) l.textContent = chkLosses;
  const d = document.getElementById('chk-score-d'); if (d) d.textContent = chkDraws_c;
}

function chkStop() { chkAiThinking = false; }


// ══════════════════════════════════════════════════════════════════
// ── ♟ ШАХМАТЫ (Chess) v1.0.0 ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
// Нотация фигур: заглавные = белые, строчные = чёрные
// P=пешка Q=ферзь K=король R=ладья B=слон N=конь
let chessBoard, chessTurn, chessMode, chessSelected, chessGameOver;
let chessWins = 0, chessLosses = 0, chessDraws = 0;
let chessAiThinking = false;
let chessEnPassant = null; // [row, col] клетка взятия на проходе
let chessCastling = { wK: true, wQR: true, wKR: true, bK: true, bQR: true, bKR: true };
let chessPromoPending = null; // { r, c, color }

const CHESS_INIT = [
  ['r','n','b','q','k','b','n','r'],
  ['p','p','p','p','p','p','p','p'],
  [0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0],
  ['P','P','P','P','P','P','P','P'],
  ['R','N','B','Q','K','B','N','R'],
];

const CHESS_UNICODE = {
  K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙',
  k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟',
};

function chessInit() { chessMode = chessMode || 'ai'; chessRestart(); }

function chessSetMode(m) {
  chessMode = m;
  ['ai','local'].forEach(id => {
    const b = document.getElementById('chess-mode-' + id);
    if (b) b.classList.toggle('active', id === m);
  });
  const lbl1 = document.getElementById('chess-label-1');
  const lbl2 = document.getElementById('chess-label-2');
  if (lbl1) lbl1.textContent = m === 'ai' ? 'Ты (♔ белые)' : 'Игрок 1 (♔)';
  if (lbl2) lbl2.textContent = m === 'ai' ? 'ИИ (♚ чёрные)' : 'Игрок 2 (♚)';
  chessRestart();
}

function chessRestart() {
  chessBoard = CHESS_INIT.map(r => [...r]);
  chessTurn = 'w';
  chessSelected = null;
  chessGameOver = false;
  chessAiThinking = false;
  chessEnPassant = null;
  chessCastling = { wK: true, wQR: true, wKR: true, bK: true, bQR: true, bKR: true };
  chessPromoPending = null;
  chessHidePromo();
  chessRender();
  chessSetStatus('Ваш ход — белые ♔');
}

function chessRender() {
  const el = document.getElementById('chess-board');
  if (!el) return;
  el.innerHTML = '';

  const validMoves = chessSelected
    ? chessGetMoves(chessBoard, chessSelected[0], chessSelected[1], chessTurn, true)
    : [];
  const targetSet = new Set(validMoves.map(m => m[0] + ',' + m[1]));

  // Найдём короля под шахом
  const kingPos = chessFindKing(chessBoard, chessTurn);
  const inCheck = kingPos && chessIsAttacked(chessBoard, kingPos[0], kingPos[1], chessTurn === 'w' ? 'b' : 'w');

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = document.createElement('div');
      const light = (r + c) % 2 === 0;
      cell.className = 'chess-cell ' + (light ? 'chess-light' : 'chess-dark');

      const isSelected = chessSelected && chessSelected[0] === r && chessSelected[1] === c;
      const isTarget   = targetSet.has(r + ',' + c);
      const isKingCheck = inCheck && kingPos && kingPos[0] === r && kingPos[1] === c;

      if (isSelected)  cell.classList.add('chess-selected');
      if (isTarget)    cell.classList.add('chess-target');
      if (isKingCheck) cell.classList.add('chess-check');

      const piece = chessBoard[r][c];
      if (piece) {
        const span = document.createElement('span');
        span.textContent = CHESS_UNICODE[piece] || piece;
        span.className = piece === piece.toUpperCase() ? 'chess-white-piece' : 'chess-black-piece';
        cell.appendChild(span);
      }

      cell.onclick = () => chessClick(r, c);
      el.appendChild(cell);
    }
  }
  chessUpdateScores();
}

function chessClick(r, c) {
  if (chessGameOver || chessAiThinking || chessPromoPending) return;
  const canAct = chessMode === 'local' || chessTurn === 'w';
  if (!canAct) return;

  const piece = chessBoard[r][c];
  const myPiece = piece && (chessTurn === 'w' ? piece === piece.toUpperCase() : piece === piece.toLowerCase());

  if (myPiece) {
    chessSelected = [r, c];
    chessRender();
    return;
  }

  if (chessSelected) {
    const moves = chessGetMoves(chessBoard, chessSelected[0], chessSelected[1], chessTurn, true);
    const move  = moves.find(m => m[0] === r && m[1] === c);
    if (move) {
      chessDoMove(chessBoard, chessSelected, [r, c], chessTurn);
      chessSelected = null;

      // Проверяем промоушн
      if ((chessBoard[r][c] === 'P' && r === 0) || (chessBoard[r][c] === 'p' && r === 7)) {
        chessPromoPending = { r, c, color: chessTurn };
        chessShowPromo(chessTurn);
        return;
      }

      chessAfterMove();
      return;
    }
  }
  chessSelected = null;
  chessRender();
}

function chessDoMove(board, from, to, color) {
  const [fr, fc] = from, [tr, tc] = to;
  const piece = board[fr][fc];

  // Рокировка
  if ((piece === 'K' || piece === 'k') && Math.abs(fc - tc) === 2) {
    const row = fr;
    if (tc === 6) { board[row][5] = board[row][7]; board[row][7] = 0; }
    else          { board[row][3] = board[row][0]; board[row][0] = 0; }
    if (color === 'w') { chessCastling.wK = false; chessCastling.wQR = false; chessCastling.wKR = false; }
    else               { chessCastling.bK = false; chessCastling.bQR = false; chessCastling.bKR = false; }
  }

  // Взятие на проходе
  if ((piece === 'P' || piece === 'p') && tc !== fc && board[tr][tc] === 0) {
    board[fr][tc] = 0; // убираем пешку
  }

  // Обновляем en passant
  chessEnPassant = null;
  if ((piece === 'P' && fr === 6 && tr === 4) || (piece === 'p' && fr === 1 && tr === 3)) {
    chessEnPassant = [fr === 6 ? 5 : 2, fc];
  }

  // Флаги рокировки
  if (piece === 'K') { chessCastling.wK = false; chessCastling.wKR = false; chessCastling.wQR = false; }
  if (piece === 'k') { chessCastling.bK = false; chessCastling.bKR = false; chessCastling.bQR = false; }
  if (fc === 0 && fr === 7) chessCastling.wQR = false;
  if (fc === 7 && fr === 7) chessCastling.wKR = false;
  if (fc === 0 && fr === 0) chessCastling.bQR = false;
  if (fc === 7 && fr === 0) chessCastling.bKR = false;

  board[tr][tc] = piece;
  board[fr][fc] = 0;
}

function chessAfterMove() {
  chessTurn = chessTurn === 'w' ? 'b' : 'w';
  chessRender();

  const moves = chessAllLegalMoves(chessBoard, chessTurn);
  const kingPos = chessFindKing(chessBoard, chessTurn);
  const inCheck = kingPos && chessIsAttacked(chessBoard, kingPos[0], kingPos[1], chessTurn === 'w' ? 'b' : 'w');

  if (!moves.length) {
    chessGameOver = true;
    if (inCheck) {
      if (chessMode === 'ai') {
        if (chessTurn === 'b') { chessWins++; chessSetStatus('♔ Мат! Ты победил! 🎉'); }
        else { chessLosses++; chessSetStatus('♚ Мат! ИИ победил.'); }
      } else {
        chessSetStatus('♟ Мат! Победили ' + (chessTurn === 'w' ? '⚫ чёрные' : '♔ белые') + '!');
      }
    } else {
      chessDraws++;
      chessSetStatus('🤝 Пат — ничья!');
    }
    chessUpdateScores();
    return;
  }

  if (inCheck) chessSetStatus(chessTurn === 'w' ? '⚠️ Шах белому королю!' : '⚠️ Шах чёрному королю!');
  else if (chessMode === 'ai' && chessTurn === 'w') chessSetStatus('Ваш ход — белые ♔');
  else if (chessMode === 'local') chessSetStatus(chessTurn === 'w' ? 'Ход белых ♔' : 'Ход чёрных ♚');

  if (chessMode === 'ai' && chessTurn === 'b') {
    chessSetStatus('🤔 ИИ думает...');
    chessAiThinking = true;
    setTimeout(chessAiMove, 400);
  }
}

function chessShowPromo(color) {
  const el = document.getElementById('chess-promo');
  if (!el) return;
  el.innerHTML = '';
  el.style.display = 'flex';
  const pieces = color === 'w' ? ['Q','R','B','N'] : ['q','r','b','n'];
  pieces.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'chess-promo-btn';
    btn.textContent = CHESS_UNICODE[p];
    btn.onclick = () => chessPromote(p);
    el.appendChild(btn);
  });
}
function chessHidePromo() {
  const el = document.getElementById('chess-promo');
  if (el) el.style.display = 'none';
}
function chessPromote(piece) {
  if (!chessPromoPending) return;
  chessBoard[chessPromoPending.r][chessPromoPending.c] = piece;
  chessPromoPending = null;
  chessHidePromo();
  chessAfterMove();
}

function chessFindKing(board, color) {
  const king = color === 'w' ? 'K' : 'k';
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c] === king) return [r, c];
  return null;
}

function chessIsAttacked(board, r, c, byColor) {
  // Check if (r,c) is attacked by byColor
  const opp = byColor;
  // Pawns
  const pd = opp === 'w' ? 1 : -1;
  for (const dc of [-1, 1]) {
    const pr = r + pd, pc = c + dc;
    if (pr >= 0 && pr < 8 && pc >= 0 && pc < 8) {
      const p = board[pr][pc];
      if (opp === 'w' && p === 'P') return true;
      if (opp === 'b' && p === 'p') return true;
    }
  }
  // Knights
  for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
    const nr = r+dr, nc = c+dc;
    if (nr<0||nr>7||nc<0||nc>7) continue;
    const p = board[nr][nc];
    if (opp === 'w' && p === 'N') return true;
    if (opp === 'b' && p === 'n') return true;
  }
  // Sliding pieces (R, B, Q)
  const dirs = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
  for (const [dr,dc] of dirs) {
    const diag = Math.abs(dr) === Math.abs(dc);
    let nr = r+dr, nc = c+dc;
    while (nr>=0&&nr<8&&nc>=0&&nc<8) {
      const p = board[nr][nc];
      if (p) {
        const isOpp = opp === 'w' ? p === p.toUpperCase() : p === p.toLowerCase();
        if (isOpp) {
          const upper = p.toUpperCase();
          if (upper === 'Q') return true;
          if (upper === 'R' && !diag) return true;
          if (upper === 'B' && diag) return true;
        }
        break;
      }
      nr += dr; nc += dc;
    }
  }
  // King
  for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
    const nr=r+dr,nc=c+dc;
    if (nr<0||nr>7||nc<0||nc>7) continue;
    const p = board[nr][nc];
    if (opp === 'w' && p === 'K') return true;
    if (opp === 'b' && p === 'k') return true;
  }
  return false;
}

function chessGetMoves(board, r, c, color, filterCheck = false) {
  const piece = board[r][c];
  if (!piece) return [];
  const upper = piece.toUpperCase();
  const isWhite = piece === piece.toUpperCase();
  const moves = [];

  const push = (tr, tc) => {
    if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) moves.push([tr, tc]);
  };
  const slide = (dr, dc) => {
    let nr = r+dr, nc = c+dc;
    while (nr>=0&&nr<8&&nc>=0&&nc<8) {
      const t = board[nr][nc];
      if (!t) { moves.push([nr,nc]); }
      else {
        const tWhite = t === t.toUpperCase();
        if (tWhite !== isWhite) moves.push([nr,nc]);
        break;
      }
      nr += dr; nc += dc;
    }
  };
  const addIfEmpty = (tr, tc) => { if (tr>=0&&tr<8&&tc>=0&&tc<8&&!board[tr][tc]) moves.push([tr,tc]); };
  const addIfEnemy = (tr, tc) => {
    if (tr<0||tr>7||tc<0||tc>7) return;
    const t = board[tr][tc];
    if (t && t === t.toUpperCase() !== isWhite) moves.push([tr,tc]);
  };

  if (upper === 'P') {
    const dir = isWhite ? -1 : 1;
    const startRow = isWhite ? 6 : 1;
    addIfEmpty(r+dir, c);
    if (r === startRow && !board[r+dir][c]) addIfEmpty(r+2*dir, c);
    addIfEnemy(r+dir, c-1);
    addIfEnemy(r+dir, c+1);
    // En passant
    if (chessEnPassant) {
      const [er,ec] = chessEnPassant;
      if (r+dir === er && (c-1 === ec || c+1 === ec)) {
        if (!board[er][ec]) moves.push([er,ec]);
      }
    }
  }
  if (upper === 'N') {
    for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const nr=r+dr, nc=c+dc;
      if (nr<0||nr>7||nc<0||nc>7) continue;
      const t = board[nr][nc];
      if (!t || (t===t.toUpperCase()) !== isWhite) moves.push([nr,nc]);
    }
  }
  if (upper === 'B') { [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([a,b])=>slide(a,b)); }
  if (upper === 'R') { [[-1,0],[1,0],[0,-1],[0,1]].forEach(([a,b])=>slide(a,b)); }
  if (upper === 'Q') { [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]].forEach(([a,b])=>slide(a,b)); }
  if (upper === 'K') {
    for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
      const nr=r+dr,nc=c+dc;
      if (nr<0||nr>7||nc<0||nc>7) continue;
      const t=board[nr][nc];
      if (!t||(t===t.toUpperCase())!==isWhite) moves.push([nr,nc]);
    }
    // Рокировка
    const oppColor = color === 'w' ? 'b' : 'w';
    const row = isWhite ? 7 : 0;
    const cKey = isWhite ? 'wK' : 'bK';
    const qKey = isWhite ? 'wQR' : 'bQR';
    const kKey = isWhite ? 'wKR' : 'bKR';
    if (chessCastling[cKey] && r === row && c === 4) {
      if (chessCastling[kKey] && !board[row][5] && !board[row][6] &&
          !chessIsAttacked(board,row,4,oppColor) && !chessIsAttacked(board,row,5,oppColor) && !chessIsAttacked(board,row,6,oppColor))
        moves.push([row, 6]);
      if (chessCastling[qKey] && !board[row][1] && !board[row][2] && !board[row][3] &&
          !chessIsAttacked(board,row,4,oppColor) && !chessIsAttacked(board,row,3,oppColor) && !chessIsAttacked(board,row,2,oppColor))
        moves.push([row, 2]);
    }
  }

  if (!filterCheck) return moves;
  // Фильтруем ходы, которые оставляют своего короля под шахом
  return moves.filter(([tr,tc]) => {
    const nb = board.map(row=>[...row]);
    // Симулируем ход
    if (upper === 'P' && tc !== c && !board[tr][tc] && chessEnPassant) {
      nb[r][tc] = 0; // взятие на проходе
    }
    nb[tr][tc] = nb[r][c];
    nb[r][c] = 0;
    const kp = chessFindKing(nb, color);
    return kp && !chessIsAttacked(nb, kp[0], kp[1], color === 'w' ? 'b' : 'w');
  });
}

function chessAllLegalMoves(board, color) {
  const moves = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const isW = p === p.toUpperCase();
      if ((color === 'w') !== isW) continue;
      chessGetMoves(board, r, c, color, true).forEach(to => moves.push({ from:[r,c], to }));
    }
  return moves;
}

// AI — minimax с alpha-beta, глубина 3
const CHESS_PIECE_VAL = { P:100, N:320, B:330, R:500, Q:900, K:20000, p:100, n:320, b:330, r:500, q:900, k:20000 };

// Бонусные таблицы позиций (белые, для чёрных инвертируем)
const CHESS_PST = {
  P: [0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0],
  N: [-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
  B: [-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20],
};

function chessPstScore(piece, r, c, color) {
  const upper = piece.toUpperCase();
  const tbl = CHESS_PST[upper];
  if (!tbl) return 0;
  const idx = color === 'w' ? r * 8 + c : (7 - r) * 8 + c;
  return tbl[idx] || 0;
}

function chessEval(board) {
  let score = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const isW = p === p.toUpperCase();
      const val = (CHESS_PIECE_VAL[p] || 0) + chessPstScore(p, r, c, isW ? 'w' : 'b');
      score += isW ? -val : val; // AI = чёрные = maximizing
    }
  return score;
}

function chessMinimaxRoot(board, depth) {
  const moves = chessAllLegalMoves(board, 'b');
  let best = { score: -Infinity, move: null };
  for (const mv of moves) {
    const nb = board.map(r => [...r]);
    const savedEP = chessEnPassant, savedCast = { ...chessCastling };
    chessDoMove(nb, mv.from, mv.to, 'b');
    const score = chessAlphaBeta(nb, depth - 1, -Infinity, Infinity, false);
    chessEnPassant = savedEP; Object.assign(chessCastling, savedCast);
    if (score > best.score) best = { score, move: mv };
  }
  return best.move;
}

function chessAlphaBeta(board, depth, alpha, beta, maximizing) {
  if (depth === 0) return chessEval(board);
  const color = maximizing ? 'b' : 'w';
  const moves = chessAllLegalMoves(board, color);
  if (!moves.length) {
    const kp = chessFindKing(board, color);
    const inCheck = kp && chessIsAttacked(board, kp[0], kp[1], color === 'w' ? 'b' : 'w');
    return inCheck ? (maximizing ? -50000 : 50000) : 0;
  }
  let val = maximizing ? -Infinity : Infinity;
  for (const mv of moves) {
    const nb = board.map(r => [...r]);
    const savedEP = chessEnPassant, savedCast = { ...chessCastling };
    chessDoMove(nb, mv.from, mv.to, color);
    const res = chessAlphaBeta(nb, depth - 1, alpha, beta, !maximizing);
    chessEnPassant = savedEP; Object.assign(chessCastling, savedCast);
    if (maximizing) { val = Math.max(val, res); alpha = Math.max(alpha, val); }
    else            { val = Math.min(val, res); beta  = Math.min(beta, val); }
    if (beta <= alpha) break;
  }
  return val;
}

function chessAiMove() {
  const savedEP   = chessEnPassant;
  const savedCast = { ...chessCastling };
  const move = chessMinimaxRoot(chessBoard, 3);
  chessEnPassant = savedEP; Object.assign(chessCastling, savedCast);
  if (move) {
    chessDoMove(chessBoard, move.from, move.to, 'b');
    // Авто-промоушн ИИ — всегда в ферзя
    if (chessBoard[move.to[0]][move.to[1]] === 'p' && move.to[0] === 7) {
      chessBoard[move.to[0]][move.to[1]] = 'q';
    }
  }
  chessAiThinking = false;
  chessAfterMove();
}

function chessSetStatus(msg) {
  const el = document.getElementById('chess-status');
  if (el) el.textContent = msg;
}

function chessUpdateScores() {
  const w = document.getElementById('chess-score-w'); if (w) w.textContent = chessWins;
  const l = document.getElementById('chess-score-l'); if (l) l.textContent = chessLosses;
  const d = document.getElementById('chess-score-d'); if (d) d.textContent = chessDraws;
}

function chessStop() { chessAiThinking = false; }
