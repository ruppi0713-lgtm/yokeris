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
  const menuVideo = byId('menuVideo');
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
  const overActions = byId('overActions');
  const overPlay = byId('overPlay');
  const overSkip = byId('overSkip');
  const result = byId('overResult');
  const again = byId('again');
  const portraitQuery = matchMedia('(orientation: portrait) and (max-width: 820px), (orientation: portrait) and (pointer: coarse)');
  const backdrops = ['yokke-title-bg.mp4', 'yokke-title-bg2.mp4', 'yokke-title-bg3.mp4', 'yokke-title-bg4.mp4'];
  let backdrop = 0;
  let backdropErrors = 0;
  let openingAttempt = 0;
  let resultAttempt = 0;
  let playbackAttempt = 0;
  let stallTimer;
  let finishMovie;
  let beginOverMovie;
  let offerOverMovie;
  let volume = .70;

  function applyVolume() {
    const percent = Number(byId('setVol').value);
    volume = percent / 100;
    sound.setVolume(volume);
    stageVideo.volume = .9 * volume;
    byId('volVal').textContent = percent + '%';
  }

  function chooseOpening() {
    if (opening.dataset.stage !== 'gate') return;
    opening.dataset.portrait = portraitQuery.matches;
    stageVideo.src = portraitQuery.matches ? 'yokke-opening-sp.mp4?v=2' : 'yokke-opening.mp4?v=2';
  }

  function prepareBackdrop() {
    menuVideo.preload = 'auto';
    if (menuVideo.getAttribute('src') !== backdrops[backdrop]) menuVideo.src = backdrops[backdrop];
  }

  function playBackdrop() {
    prepareBackdrop();
    menuVideo.play().catch(() => {});
  }

  function showMenu() {
    if (opening.dataset.stage === 'menu') return;
    openingAttempt++;
    opening.dataset.stage = 'menu';
    gate.hidden = skip.hidden = true;
    menu.hidden = false;
    stageVideo.pause();
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
    prepareBackdrop();
    sound.prepare();
  });
  skip.addEventListener('click', showMenu);
  stageVideo.addEventListener('timeupdate', () => {
    if (opening.dataset.stage === 'movie') {
      movieLogo.hidden = opening.dataset.portrait !== 'true' || stageVideo.currentTime < 3.65;
    }
  });
  stageVideo.addEventListener('ended', () => {
    if (opening.dataset.stage === 'movie') showMenu();
  });
  stageVideo.addEventListener('error', () => {
    if (opening.dataset.stage === 'movie') showOpeningRetry();
  });
  menuVideo.addEventListener('playing', () => {
    opening.dataset.menuVideo = 'playing';
  });
  menuVideo.addEventListener('ended', () => {
    if (opening.dataset.stage === 'menu' && !opening.hidden) {
      backdropErrors = 0;
      backdrop = (backdrop + 1) % backdrops.length;
      playBackdrop();
    }
  });
  menuVideo.addEventListener('error', () => {
    if (opening.dataset.stage === 'menu' && !opening.hidden && ++backdropErrors < backdrops.length) {
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
    finishMovie = beginOverMovie = offerOverMovie = null;
    overVideo.pause();
    if (byId('setVideo').checked) overVideo.preload = 'auto';
    for (const name of ['title', 'tension', 'sad', 'movie']) sound.stop(name);
    stageVideo.pause();
    menuVideo.pause();
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
    overActions.hidden = false;
    overPlay.hidden = true;
    sound.stop('game');
    if (bgm.checked) sound.play('tension');

    const stillOnMovie = () => resultAttempt === attempt && over.dataset.stage === 'movie';
    finishMovie = (keepFrame = false) => {
      if (!stillOnMovie()) return;
      clearTimeout(stallTimer);
      over.dataset.stage = 'result';
      overVideo.pause();
      overVideo.hidden = !keepFrame;
      overActions.hidden = true;
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
    offerOverMovie = () => {
      if (!stillOnMovie()) return;
      playbackAttempt++;
      clearTimeout(stallTimer);
      overVideo.pause();
      sound.stop('movie');
      sound.stop('tension');
      overPlay.hidden = false;
      overPlay.focus({ preventScroll: true });
    };
    beginOverMovie = () => {
      if (!stillOnMovie()) return;
      const playback = ++playbackAttempt;
      if (overVideo.error) overVideo.load();
      overPlay.hidden = true;
      overSkip.focus({ preventScroll: true });
      clearTimeout(stallTimer);
      stallTimer = setTimeout(offerOverMovie, 6500);
      overVideo.play().catch(() => {
        if (playbackAttempt === playback) offerOverMovie?.();
      });
    };

    overVideo.defaultMuted = overVideo.muted = true;
    if (overVideo.readyState > 0) overVideo.currentTime = 0;
    overVideo.hidden = false;
    requestAnimationFrame(beginOverMovie);
  }

  overVideo.addEventListener('playing', () => {
    if (over.hidden || over.dataset.stage !== 'movie') return;
    clearTimeout(stallTimer);
    sound.play('movie', { position: () => overVideo.currentTime });
  });
  overVideo.addEventListener('waiting', () => {
    if (over.hidden || over.dataset.stage !== 'movie') return;
    clearTimeout(stallTimer);
    sound.stop('movie');
    stallTimer = setTimeout(() => offerOverMovie?.(), 6500);
  });
  overVideo.addEventListener('ended', () => finishMovie?.(true));
  overVideo.addEventListener('error', () => offerOverMovie?.());
  overPlay.addEventListener('click', () => beginOverMovie?.());
  overSkip.addEventListener('click', () => finishMovie?.());
  start.addEventListener('click', startRound);
  again.addEventListener('click', startRound);
  document.addEventListener('click', sound.retry, { capture: true });
  portraitQuery.addEventListener('change', chooseOpening);
  applyVolume();
  chooseOpening();
  return { showGameOver };
}
