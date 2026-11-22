(() => {
  const byId = id => document.getElementById(id);
  const width = 10;
  const height = 20;
  const shapes = [
    [[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]],
    [[0, 1, 1], [1, 1, 0]], [[1, 1, 0], [0, 1, 1]],
    [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]],
  ];
  const drinkNames = ['ワイン', '樽', '日本酒', 'ウイスキー', '生ビール', '缶ビール', 'サワー'];
  const keys = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rot', ' ': 'rot' };
  const canvas = byId('cv');
  const preview = byId('nextBlock');
  const emptyRow = () => Array(width).fill(0);
  let board = Array.from({ length: height }, emptyRow);
  let current, next;
  let score, lines, level, baseLevel;
  let fallTimer, flashTimer, dropTimer;
  let dropInput;
  let running = false;
  let flash = false;
  let animationFrame;
  let visiblePiece;

  const { drawBoard, drawPreview } = createBoardView(canvas, preview, () => {
    draw();
    if (next) drawPreview(next);
  });
  const scenes = createScenes(startGame);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function draw() {
    cancelAnimationFrame(animationFrame);
    const piece = running ? current : null;
    const from = visiblePiece;
    if (!piece || from?.piece !== piece || reducedMotion.matches
        || (from.x === piece.x && from.y === piece.y)) {
      visiblePiece = piece ? { piece, x: piece.x, y: piece.y } : null;
      drawBoard(board, piece, flash);
      return;
    }
    const started = performance.now();
    const frame = now => {
      const progress = Math.max(0, Math.min(1, (now - started) / 85));
      const ease = 1 - (1 - progress) ** 2;
      const x = from.x + (piece.x - from.x) * ease;
      const y = from.y + (piece.y - from.y) * ease;
      visiblePiece = { piece, x, y };
      drawBoard(board, { ...piece, x, y }, flash);
      if (progress < 1) animationFrame = requestAnimationFrame(frame);
    };
    animationFrame = requestAnimationFrame(frame);
  }

  function blocked(dx, dy, matrix = current.m) {
    return matrix.some((row, y) => row.some((cell, x) => {
      if (!cell) return false;
      const nx = current.x + x + dx;
      const ny = current.y + y + dy;
      return nx < 0 || nx >= width || ny >= height || (ny >= 0 && board[ny][nx]);
    }));
  }

  function randomPiece() {
    const type = Math.floor(Math.random() * shapes.length);
    return { m: shapes[type], x: 3, y: 0, t: type + 1 };
  }

  function spawn() {
    stopDrop();
    current = next;
    next = randomPiece();
    if (blocked(0, 0)) {
      running = false;
      flash = false;
      clearInterval(fallTimer);
      clearTimeout(flashTimer);
      scenes.showGameOver(score, lines);
      return;
    }
    preview.setAttribute('aria-label', '次のブロック ' + drinkNames[next.t - 1]);
    drawPreview(next);
  }

  function scheduleFall() {
    clearInterval(fallTimer);
    fallTimer = setInterval(step, Math.max(120, 800 - (level - 1) * 70));
  }

  function updateHud() {
    const firstOccupied = board.findIndex(row => row.some(Boolean));
    const occupiedHeight = firstOccupied === -1 ? 0 : height - firstOccupied;
    const percent = Math.round(occupiedHeight / height * 100);
    byId('sc').textContent = score;
    byId('ln').textContent = lines;
    byId('lv').textContent = level;
    byId('left').textContent = height - occupiedHeight;
    byId('gaugeMeter').setAttribute('aria-valuenow', percent);
    byId('gaugeFill').style.height = percent + '%';
    byId('gaugePct').textContent = percent + '%';
    byId('gaugeWarn').hidden = percent < 75;
  }

  function land() {
    current.m.forEach((row, y) => row.forEach((cell, x) => {
      if (cell) board[current.y + y][current.x + x] = current.t;
    }));
    board = board.filter(row => !row.every(Boolean));
    const cleared = height - board.length;
    if (cleared) {
      board.unshift(...Array.from({ length: cleared }, emptyRow));
      lines += cleared;
      score += [0, 100, 300, 500, 800][cleared] * level;
      level = baseLevel + Math.floor(lines / 10);
      scheduleFall();
      byId('msg').textContent = '乾杯!! ' + cleared + '列消し！';
      clearTimeout(flashTimer);
      flash = byId('setFlash').checked;
      if (flash) {
        flashTimer = setTimeout(() => {
          flash = false;
          draw();
        }, 700);
      }
    }
    updateHud();
    spawn();
  }

  function step() {
    if (!running) return;
    if (blocked(0, 1)) land();
    else current.y++;
    draw();
  }

  function startGame() {
    board = Array.from({ length: height }, emptyRow);
    score = lines = 0;
    baseLevel = level = Number(byId('setLevel').value);
    flash = false;
    running = true;
    byId('msg').textContent = '積みすぎると、よっけがトイレに…';
    updateHud();
    next = randomPiece();
    spawn();
    draw();
    scheduleFall();
    canvas.focus({ preventScroll: true });
  }

  function stopDrop(source = dropInput) {
    if (dropInput !== source) return;
    clearTimeout(dropTimer);
    dropInput = undefined;
  }

  function beginDrop(source) {
    if (!running || dropInput !== undefined) return;
    const piece = current;
    dropInput = source;
    step();
    if (!running || current !== piece) return;
    dropTimer = setTimeout(() => {
      while (!blocked(0, 1)) current.y++;
      land();
      if (running) scheduleFall();
      draw();
    }, 190);
  }

  function move(action) {
    if (!running) return;
    if (action === 'down') {
      step();
      return;
    }
    if (action === 'rot') {
      const rotated = current.m[0].map((_, x) => current.m.map(row => row[x]).reverse());
      if (!blocked(0, 0, rotated)) current.m = rotated;
    } else {
      const dx = action === 'left' ? -1 : 1;
      if (!blocked(dx, 0)) current.x += dx;
    }
    draw();
  }

  document.querySelectorAll('[data-k]:not([data-k="down"])').forEach(button => {
    button.addEventListener('click', () => move(button.dataset.k));
  });
  document.querySelectorAll('[data-k="down"]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      if (!running || event.button !== 0) return;
      button.setPointerCapture(event.pointerId);
      beginDrop(event.pointerId);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(name, event => stopDrop(event.pointerId));
    }
    button.addEventListener('click', event => {
      if (event.detail === 0) move('down');
    });
    button.addEventListener('contextmenu', event => event.preventDefault());
  });
  document.addEventListener('keydown', event => {
    if (!running) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!event.repeat) beginDrop('keyboard');
      return;
    }
    if (!Object.hasOwn(keys, event.key)) return;
    if (event.key === ' ' && event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    move(keys[event.key]);
  });
  document.addEventListener('keyup', event => {
    if (event.key === 'ArrowDown') stopDrop('keyboard');
  });
  window.addEventListener('blur', () => stopDrop());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopDrop();
  });

  let gesture;
  canvas.addEventListener('pointerdown', event => {
    if (!running || event.pointerType === 'mouse' || gesture) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (gesture?.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    if (Math.abs(dx) >= 24) {
      move(dx > 0 ? 'right' : 'left');
      gesture.x = event.clientX;
      gesture.moved = true;
    }
    if (event.clientY - gesture.y >= 64) {
      move('down');
      gesture.y = event.clientY;
      gesture.moved = true;
    }
  });
  canvas.addEventListener('pointerup', event => {
    if (gesture?.id !== event.pointerId) return;
    const tap = !gesture.moved && Math.abs(event.clientX - gesture.x) < 12
      && Math.abs(event.clientY - gesture.y) < 12;
    gesture = null;
    if (tap) move('rot');
  });
  canvas.addEventListener('lostpointercapture', event => {
    if (gesture?.id === event.pointerId) gesture = null;
  });
})();
