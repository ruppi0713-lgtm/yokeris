function createSound() {
  const tracks = {
    title: ['title_bgm.mp3', .45],
    game: ['bgm.mp3', .30],
    tension: ['gameover_bgm.mp3', .50],
    sad: ['sad_se.mp3', .60],
    movie: ['gameover-video-audio.m4a', .90],
  };
  const loaded = new Map();
  const active = new Map();
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  let context;
  let master;
  let volume = .70;

  function unlock() {
    if (!AudioEngine || location.protocol === 'file:') return;
    if (!context) {
      try {
        context = new AudioEngine();
        master = context.createGain();
        master.gain.value = volume;
        master.connect(context.destination);
      } catch {
        context = undefined;
        return;
      }
    }
    if (context.state !== 'running') context.resume().catch(() => {});
  }

  function load(name) {
    if (!loaded.has(name)) {
      const request = fetch(tracks[name][0]).then(response => {
        if (!response.ok) throw new Error('Audio unavailable');
        return response.arrayBuffer();
      }).then(data => context.decodeAudioData(data)).catch(() => null);
      loaded.set(name, request);
    }
    return loaded.get(name);
  }

  function stop(name) {
    const track = active.get(name);
    active.delete(name);
    if (track?.source) {
      track.source.stop();
      track.source.disconnect();
      track.gain.disconnect();
    }
    track?.element?.pause();
  }

  function play(name, { loop = false, position = () => 0 } = {}) {
    stop(name);
    const track = {};
    active.set(name, track);
    const [url, gain] = tracks[name];

    function playElement() {
      const element = new Audio(url);
      track.element = element;
      element.loop = loop;
      element.volume = gain * volume;
      element.currentTime = position();
      element.play().catch(() => {});
    }

    if (!context) {
      playElement();
      return;
    }
    load(name).then(buffer => {
      if (active.get(name) !== track) return;
      if (!buffer) {
        playElement();
        return;
      }
      const offset = position();
      if (!loop && offset >= buffer.duration) return;
      const source = context.createBufferSource();
      const level = context.createGain();
      source.buffer = buffer;
      source.loop = loop;
      level.gain.value = gain;
      source.connect(level).connect(master);
      track.source = source;
      track.gain = level;
      source.start(0, offset % buffer.duration);
    });
  }

  function retry() {
    unlock();
    for (const { element } of active.values()) {
      if (element?.paused && !element.ended) element.play().catch(() => {});
    }
  }

  return {
    play, stop, retry,
    usesContext: () => Boolean(context),
    prepare: () => {
      if (context) for (const name of Object.keys(tracks)) load(name);
    },
    setVolume(value) {
      volume = value;
      if (master) master.gain.value = value;
      for (const [name, { element }] of active) {
        if (element) element.volume = tracks[name][1] * value;
      }
    },
  };
}

function createScenes(startGame) {
  const byId = id => document.getElementById(id);
  const sound = createSound();
  const game = byId('game');
  const opening = byId('opening');
  const stageVideo = byId('stageVideo');
  const gate = byId('opGate');
  const skip = byId('opSkip');
  const movieLogo = byId('movieLogo');
  const menu = byId('menuScroll');
  const start = byId('opStart');
  const how = byId('opHow');
  const settings = byId('opSet');
  const bgm = byId('setBgm');
  const over = byId('over');
  const overVideo = byId('overVideo');
  const overSkip = byId('overSkip');
  const result = byId('overResult');
  const again = byId('again');
  const portraitQuery = matchMedia('(orientation: portrait) and (max-width: 820px), (orientation: portrait) and (pointer: coarse)');
  const backdrops = ['yokke-title-bg.mp4', 'yokke-title-bg2.mp4', 'yokke-title-bg3.mp4', 'yokke-title-bg4.mp4'];
  let backdrop = 0;
  let backdropErrors = 0;
  let openingAttempt = 0;
  let resultAttempt = 0;
  let stallTimer;
  let movieTimer;
  let finishMovie;
  let volume = .70;

  function applyVolume() {
    const percent = Number(byId('setVol').value);
    volume = percent / 100;
    sound.setVolume(volume);
    stageVideo.volume = overVideo.volume = .9 * volume;
    byId('volVal').textContent = percent + '%';
  }

  function chooseOpening() {
    if (opening.dataset.stage !== 'gate') return;
    opening.dataset.portrait = portraitQuery.matches;
    stageVideo.src = portraitQuery.matches ? 'yokke-opening-sp.mp4' : 'yokke-opening.mp4';
  }

  function playBackdrop() {
    stageVideo.src = backdrops[backdrop];
    stageVideo.play().catch(() => {});
  }

  function showMenu() {
    if (opening.dataset.stage === 'menu') return;
    openingAttempt++;
    opening.dataset.stage = 'menu';
    gate.hidden = skip.hidden = movieLogo.hidden = true;
    menu.hidden = false;
    stageVideo.muted = true;
    playBackdrop();
    if (bgm.checked) sound.play('title', { loop: true });
    start.focus({ preventScroll: true });
  }

  function showOpeningRetry() {
    gate.textContent = '▶ 音ありで再生する';
    gate.hidden = false;
  }

  gate.addEventListener('click', () => {
    const attempt = ++openingAttempt;
    sound.retry();
    opening.dataset.stage = 'movie';
    gate.hidden = true;
    skip.hidden = false;
    stageVideo.muted = volume === 0;
    if (stageVideo.error) stageVideo.load();
    stageVideo.play().catch(() => {
      if (openingAttempt === attempt) showOpeningRetry();
    });
    skip.focus({ preventScroll: true });
    sound.prepare();
  });
  skip.addEventListener('click', showMenu);
  stageVideo.addEventListener('timeupdate', () => {
    movieLogo.hidden = opening.dataset.stage !== 'movie' || opening.dataset.portrait !== 'true'
      || stageVideo.currentTime < 3.65;
  });
  stageVideo.addEventListener('ended', () => {
    if (opening.dataset.stage === 'movie') {
      showMenu();
    } else if (opening.dataset.stage === 'menu') {
      backdropErrors = 0;
      backdrop = (backdrop + 1) % backdrops.length;
      playBackdrop();
    }
  });
  stageVideo.addEventListener('error', () => {
    if (opening.dataset.stage === 'movie') {
      showOpeningRetry();
    } else if (opening.dataset.stage === 'menu' && ++backdropErrors < backdrops.length) {
      backdrop = (backdrop + 1) % backdrops.length;
      playBackdrop();
    }
  });

  function showPanel(panel) {
    byId('howPanel').hidden = panel !== 'how';
    byId('setPanel').hidden = panel !== 'settings';
    how.setAttribute('aria-expanded', panel === 'how');
    settings.setAttribute('aria-expanded', panel === 'settings');
    if (panel) byId(panel === 'how' ? 'howPanel' : 'setPanel').scrollIntoView({ block: 'nearest' });
  }
  how.addEventListener('click', () => showPanel(byId('howPanel').hidden ? 'how' : null));
  settings.addEventListener('click', () => showPanel(byId('setPanel').hidden ? 'settings' : null));
  byId('setBack').addEventListener('click', () => {
    showPanel(null);
    settings.focus({ preventScroll: true });
  });
  byId('setVol').addEventListener('input', applyVolume);
  bgm.addEventListener('change', () => {
    if (bgm.checked) sound.play('title', { loop: true });
    else sound.stop('title');
  });

  function startRound() {
    resultAttempt++;
    clearTimeout(stallTimer);
    clearTimeout(movieTimer);
    finishMovie = null;
    overVideo.pause();
    for (const name of ['title', 'tension', 'sad', 'movie']) sound.stop(name);
    stageVideo.pause();
    opening.hidden = over.hidden = true;
    game.hidden = false;
    sound.retry();
    if (bgm.checked) sound.play('game', { loop: true });
    startGame();
  }

  function showGameOver(score, lines) {
    const attempt = ++resultAttempt;
    game.hidden = true;
    over.hidden = false;
    result.hidden = true;
    overVideo.hidden = true;
    over.dataset.stage = 'movie';
    overSkip.hidden = false;
    sound.stop('game');
    if (bgm.checked) sound.play('tension');

    finishMovie = (keepFrame = false) => {
      if (resultAttempt !== attempt || over.dataset.stage !== 'movie') return;
      clearTimeout(stallTimer);
      clearTimeout(movieTimer);
      over.dataset.stage = 'result';
      overVideo.pause();
      overVideo.hidden = !keepFrame;
      overSkip.hidden = true;
      byId('overScore').textContent = 'SCORE ' + score + ' / LINE ' + lines + '｜飲みすぎ注意！';
      result.hidden = false;
      sound.stop('tension');
      sound.stop('movie');
      sound.play('sad');
      again.focus({ preventScroll: true });
    };

    if (!byId('setVideo').checked) {
      finishMovie();
      return;
    }
    overVideo.muted = sound.usesContext() || volume === 0;
    overVideo.currentTime = 0;
    overVideo.hidden = false;
    overSkip.focus({ preventScroll: true });
    stallTimer = setTimeout(() => finishMovie?.(), 6500);
    movieTimer = setTimeout(() => finishMovie?.(), 18000);
    overVideo.play().catch(() => {
      if (resultAttempt !== attempt || over.dataset.stage !== 'movie') return;
      if (overVideo.muted) finishMovie();
      else {
        overVideo.muted = true;
        overVideo.play().catch(() => {
          if (resultAttempt === attempt) finishMovie?.();
        });
      }
    });
  }

  overVideo.addEventListener('playing', () => {
    if (over.hidden || over.dataset.stage !== 'movie') return;
    clearTimeout(stallTimer);
    if (sound.usesContext()) sound.play('movie', { position: () => overVideo.currentTime });
  });
  overVideo.addEventListener('waiting', () => {
    if (over.hidden || over.dataset.stage !== 'movie') return;
    clearTimeout(stallTimer);
    sound.stop('movie');
    stallTimer = setTimeout(() => finishMovie?.(), 6500);
  });
  overVideo.addEventListener('ended', () => finishMovie?.(true));
  overVideo.addEventListener('error', () => finishMovie?.());
  overSkip.addEventListener('click', () => finishMovie?.());
  start.addEventListener('click', startRound);
  again.addEventListener('click', startRound);
  document.addEventListener('click', sound.retry, { capture: true });
  portraitQuery.addEventListener('change', chooseOpening);
  applyVolume();
  chooseOpening();
  return { showGameOver };
}
