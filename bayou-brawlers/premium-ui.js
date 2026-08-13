(() => {
  const byId = (id) => document.getElementById(id);
  const overlayIds = [
    'startOverlay',
    'messageOverlay',
    'companionOverlay',
    'levelUpOverlay',
    'characterSheetOverlay'
  ];
  let initialized = false;
  let lastWaveSignature = '';

  function syncVisualViewportHeight() {
    const height = Math.round(window.visualViewport?.height || window.innerHeight || 0);
    if (height > 0) {
      document.documentElement.style.setProperty('--app-viewport-height', `${height}px`);
    }
  }

  function releaseInputs() {
    Object.keys(input).forEach((key) => {
      input[key] = false;
    });
  }

  function syncDefeatActions() {
    const isDefeat = Boolean(state.gameOver && !state.victory);
    const retry = byId('retryDefeatBtn');
    const roster = byId('defeatRosterBtn');
    if (retry) retry.hidden = !isDefeat;
    if (roster) roster.hidden = !isDefeat;
  }

  function hasModalOpen() {
    return overlayIds.some((id) => byId(id)?.classList.contains('show'));
  }

  function setPaused(shouldPause) {
    const overlay = byId('pauseOverlay');
    const button = byId('pauseBtn');
    if (!overlay || !state.player || !state.running || state.gameOver || state.victory) return false;

    if (shouldPause) {
      if (hasModalOpen()) return false;
      state.paused = true;
      releaseInputs();
      overlay.classList.add('show');
      button?.setAttribute('aria-pressed', 'true');
      button?.setAttribute('aria-label', 'Resume game');
      if (button) button.textContent = 'Resume';
      window.setTimeout(() => byId('resumeBtn')?.focus(), 0);
      return true;
    }

    overlay.classList.remove('show');
    state.paused = false;
    state.lastTime = performance.now();
    state.frameAccumulator = 0;
    button?.setAttribute('aria-pressed', 'false');
    button?.setAttribute('aria-label', 'Pause game');
    if (button) button.textContent = 'Pause';
    canvas.focus?.();
    return true;
  }

  function togglePause() {
    return setPaused(!byId('pauseOverlay')?.classList.contains('show'));
  }

  function restartStage() {
    if (!state.player) return;
    const overlay = byId('pauseOverlay');
    releaseInputs();
    state.player.hp = state.player.maxHp;
    state.player.power = 0;
    state.player.superPellets = 0;
    state.player.stun = 0;
    state.player.block = false;
    state.player.comboHits = 0;
    state.player.comboTimer = 0;
    state.score = Math.max(0, state.score - 250);
    byId('score').textContent = String(getDisplayedScore());
    updateHpBar();
    updatePowerHud(state.player);
    setupLevel();
    overlay?.classList.remove('show');
    state.paused = false;
    state.lastTime = performance.now();
    state.frameAccumulator = 0;
    byId('pauseBtn')?.setAttribute('aria-pressed', 'false');
    if (byId('pauseBtn')) byId('pauseBtn').textContent = 'Pause';
    showNotification('Stage reset. The expedition continues.', 2200);
  }

  function retryAfterDefeat() {
    if (!state.player) return;
    byId('messageOverlay')?.classList.remove('show');
    state.gameOver = false;
    state.victory = false;
    state.player.hp = state.player.maxHp;
    state.player.power = 0;
    state.player.stun = 0;
    state.player.block = false;
    releaseInputs();
    setupLevel();
    startGame();
  }

  function returnToRoster() {
    releaseInputs();
    state.running = false;
    state.paused = false;
    state.player = null;
    state.enemies = [];
    state.projectiles = [];
    state.pickups = [];
    state.effects = [];
    state.hazards = [];
    state.companions = [];
    state.scarlettBrambleDrone = null;
    state.levelIndex = 0;
    state.score = 0;
    byId('score').textContent = '0';
    byId('pauseOverlay')?.classList.remove('show');
    byId('messageOverlay')?.classList.remove('show');
    byId('startOverlay')?.classList.add('show');
    byId('pauseBtn')?.setAttribute('aria-pressed', 'false');
    if (byId('pauseBtn')) byId('pauseBtn').textContent = 'Pause';
  }

  function comboRank(hits) {
    if (hits >= 40) return 'Bayou legend';
    if (hits >= 25) return 'Relentless';
    if (hits >= 15) return 'Gearstorm';
    if (hits >= 8) return 'Overdrive';
    return 'Hit chain';
  }

  function updateEncounterHud() {
    const hud = byId('encounterHud');
    const active = Boolean(state.player && state.running && !byId('startOverlay')?.classList.contains('show'));
    document.body.classList.toggle('gameplay-active', active);
    if (hud) hud.hidden = !active;
    if (!active) return;

    const level = levels[state.levelIndex] || levels[0];
    const bosses = state.enemies.filter((enemy) => enemy?.isBoss && enemy.hp > 0);
    const activeBoss = bosses[0] || null;
    const livingEnemies = state.enemies.filter((enemy) => enemy?.hp > 0).length;
    const expedition = String(state.levelIndex + 1).padStart(2, '0');
    byId('encounterKicker').textContent = `Expedition ${expedition} // ${level.name}`;

    let objective = 'Advance deeper into the bayou';
    if (activeBoss) {
      objective = `Break ${activeBoss.name || level.boss?.name || 'the boss'}`;
    } else if (state.waveActive) {
      const waveNumber = Math.min(TOTAL_WAVE_COUNT, state.waveIndex + 1);
      objective = `Clear conflict ${waveNumber} of ${TOTAL_WAVE_COUNT} // ${livingEnemies} hostile${livingEnemies === 1 ? '' : 's'} remain`;
    } else if (state.nextWaveToSpawn >= TOTAL_WAVE_COUNT) {
      objective = 'Route secure // Find the passage onward';
    } else {
      objective = 'Advance to the next conflict';
    }
    byId('encounterObjective').textContent = objective;

    const signature = `${state.levelIndex}:${state.waveIndex}:${state.nextWaveToSpawn}:${state.waveActive}:${Boolean(activeBoss)}`;
    if (signature !== lastWaveSignature) {
      lastWaveSignature = signature;
      const progress = byId('waveProgress');
      if (progress) {
        progress.replaceChildren();
        for (let index = 0; index < TOTAL_WAVE_COUNT; index += 1) {
          const pip = document.createElement('span');
          pip.className = 'wave-pip';
          if (index < state.nextWaveToSpawn || (index < state.waveIndex && state.waveActive)) pip.classList.add('complete');
          if (state.waveActive && index === state.waveIndex) pip.classList.add('active');
          pip.setAttribute('aria-hidden', 'true');
          progress.appendChild(pip);
        }
        progress.setAttribute('aria-label', `${Math.min(state.nextWaveToSpawn, TOTAL_WAVE_COUNT)} of ${TOTAL_WAVE_COUNT} conflicts cleared`);
      }
    }

    const comboHits = Math.floor(state.player.comboHits || 0);
    const combo = byId('comboReadout');
    combo?.classList.toggle('show', comboHits >= 3 && (state.player.comboTimer || 0) > 0);
    byId('comboCount').textContent = String(comboHits);
    byId('comboLabel').textContent = comboRank(comboHits);

    const bossRail = byId('bossRail');
    bossRail?.classList.toggle('show', Boolean(activeBoss));
    if (activeBoss) {
      const hpPercent = clamp(activeBoss.hp / Math.max(1, activeBoss.maxHp), 0, 1);
      byId('bossRailName').textContent = activeBoss.name || level.boss?.name || 'Boss';
      byId('bossRailValue').textContent = `${Math.ceil(hpPercent * 100)}%`;
      byId('bossRailFill').style.width = `${hpPercent * 100}%`;
    }
  }

  function premiumUiLoop() {
    syncDefeatActions();
    updateEncounterHud();
    window.requestAnimationFrame(premiumUiLoop);
  }

  function onGlobalKeydown(event) {
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    if (key !== 'escape' && key !== 'p') return;

    if (byId('characterSheetOverlay')?.classList.contains('show')) {
      if (key === 'escape') return;
    }

    if (byId('pauseOverlay')?.classList.contains('show')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setPaused(false);
      return;
    }

    if (!state.player || !state.running || hasModalOpen()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setPaused(true);
  }

  function setup() {
    if (initialized) return;
    initialized = true;
    byId('pauseBtn')?.addEventListener('click', togglePause);
    byId('resumeBtn')?.addEventListener('click', () => setPaused(false));
    byId('restartBtn')?.addEventListener('click', restartStage);
    byId('rosterBtn')?.addEventListener('click', returnToRoster);
    byId('retryDefeatBtn')?.addEventListener('click', retryAfterDefeat);
    byId('defeatRosterBtn')?.addEventListener('click', returnToRoster);
    window.addEventListener('keydown', onGlobalKeydown, true);
    window.addEventListener('blur', releaseInputs);
    window.addEventListener('resize', syncVisualViewportHeight, { passive: true });
    window.addEventListener('orientationchange', syncVisualViewportHeight, { passive: true });
    window.visualViewport?.addEventListener('resize', syncVisualViewportHeight, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) releaseInputs();
    });
    syncVisualViewportHeight();
    window.BayouPremiumUI = {
      setPaused,
      togglePause,
      restartStage,
      returnToRoster,
      updateEncounterHud
    };
    premiumUiLoop();
  }

  setup();
})();
