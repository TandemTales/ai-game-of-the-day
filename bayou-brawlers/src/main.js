import { AudioEngine } from './audio.js';
import { DEFAULT_SETTINGS, TEST_ROOMS } from './config.js';
import { Game } from './game.js';
import { InputManager } from './input.js';

const STORAGE_KEY = 'bayou-brawlers-settings-v1';
const canvas = document.querySelector('#game');
const shell = document.querySelector('#game-shell');
const loading = document.querySelector('#loading');
const titleScreen = document.querySelector('#title-screen');
const difficultyScreen = document.querySelector('#difficulty-screen');
const settingsFields = document.querySelector('#settings-fields');
const announcement = document.querySelector('#announcement');
const debugPanel = document.querySelector('#debug-panel');
const resultsTitle = document.querySelector('#results-title');
const resultsStats = document.querySelector('#results-stats');

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...structuredClone(DEFAULT_SETTINGS), ...saved };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

const settings = loadSettings();
const input = new InputManager(window, 150);
if (settings.bindings) {
  for (const [action, code] of Object.entries(settings.bindings)) input.setBinding(action, code);
}
const audio = new AudioEngine(settings);
let announcementTimer = 0;
let panelReturn = 'title-screen';

function clearScreens() {
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
}

function showScreen(id) {
  clearScreens();
  document.getElementById(id)?.classList.add('active');
  if (id === 'title-screen') {
    clearTimeout(announcementTimer);
    announcement.classList.remove('show');
    announcement.textContent = '';
  }
}

function announce(text, duration = 1) {
  announcement.textContent = text;
  announcement.classList.add('show');
  clearTimeout(announcementTimer);
  announcementTimer = setTimeout(() => announcement.classList.remove('show'), duration * 1000);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function showResults(result, victory) {
  resultsTitle.textContent = victory ? 'Bayou Secured' : 'Run Ended';
  resultsStats.innerHTML = `
    <div><strong>${result.score.toLocaleString()}</strong><span>Score</span></div>
    <div><strong>${formatTime(result.time)}</strong><span>Time</span></div>
    <div><strong>${result.maxCombo}×</strong><span>Best Combo</span></div>
    <div><strong>${result.enemies}</strong><span>Enemies</span></div>
    <div><strong>${result.damage}</strong><span>Damage Dealt</span></div>
    <div><strong>${result.damageTaken}</strong><span>Damage Taken</span></div>`;
  showScreen('results-screen');
}

const game = new Game(canvas, {
  input,
  audio,
  settings,
  onAnnounce: announce,
  onPause: (paused) => paused ? showScreen('pause-screen') : clearScreens(),
  onComplete: (result) => showResults(result, true),
  onDefeat: (result) => showResults(result, false)
});

function persistSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  audio.setVolumes(settings);
  document.body.classList.toggle('high-contrast', settings.highContrast);
  document.body.classList.toggle('reduced-motion', settings.reducedMotion);
}

const settingSchema = [
  { key: 'masterVolume', label: 'Master volume', type: 'range', min: 0, max: 1, step: .05 },
  { key: 'musicVolume', label: 'Music volume', type: 'range', min: 0, max: 1, step: .05 },
  { key: 'sfxVolume', label: 'Effects volume', type: 'range', min: 0, max: 1, step: .05 },
  { key: 'screenShake', label: 'Screen shake', type: 'range', min: 0, max: 1, step: .1 },
  { key: 'hitFlash', label: 'Hit flashes', type: 'checkbox' },
  { key: 'reducedMotion', label: 'Reduced motion', type: 'checkbox' },
  { key: 'highContrast', label: 'High-contrast outlines', type: 'checkbox' },
  { key: 'holdToSprint', label: 'Hold Shift to sprint (off: auto)', type: 'checkbox' },
  { key: 'enemyDamage', label: 'Incoming damage', type: 'select', options: [
    { value: .65, label: '65% · Gentle' }, { value: .8, label: '80% · Reduced' },
    { value: 1, label: '100% · Standard' }, { value: 1.2, label: '120% · Fierce' }
  ] },
  { key: 'damageAssist', label: 'Player damage', type: 'select', options: [
    { value: 1, label: '100% · Standard' }, { value: 1.2, label: '120% · Boosted' },
    { value: 1.4, label: '140% · Strong boost' }
  ] }
];

function renderSettings() {
  const rows = settingSchema.map((entry) => {
    let control = '';
    if (entry.type === 'range') {
      control = `<input id="setting-${entry.key}" data-setting="${entry.key}" type="range" min="${entry.min}" max="${entry.max}" step="${entry.step}" value="${settings[entry.key]}">`;
    } else if (entry.type === 'checkbox') {
      control = `<input id="setting-${entry.key}" data-setting="${entry.key}" type="checkbox" ${settings[entry.key] ? 'checked' : ''}>`;
    } else {
      control = `<select id="setting-${entry.key}" data-setting="${entry.key}">${entry.options.map((option) => `<option value="${option.value}" ${Number(settings[entry.key]) === Number(option.value) ? 'selected' : ''}>${option.label}</option>`).join('')}</select>`;
    }
    return `<div class="setting-row"><label for="setting-${entry.key}">${entry.label}</label>${control}</div>`;
  });
  const bindingRows = [
    ['light', 'Light attack'], ['heavy', 'Heavy attack'], ['special', 'Special'],
    ['jump', 'Jump'], ['dodge', 'Dodge / sprint'], ['grab', 'Grab']
  ].map(([action, label]) => {
    const code = input.bindings[action][0].replace(/^Key/, '').replace('ShiftLeft', 'Left Shift');
    return `<div class="setting-row"><span>${label}</span><button class="bind-button" data-bind="${action}">${code}</button></div>`;
  });
  settingsFields.innerHTML = `${rows.join('')}<p class="eyebrow" style="margin-top:1.4rem">KEYBOARD REMAP</p>${bindingRows.join('')}`;
}

settingsFields.addEventListener('input', (event) => {
  const control = event.target.closest('[data-setting]');
  if (!control) return;
  settings[control.dataset.setting] = control.type === 'checkbox' ? control.checked : Number(control.value);
  persistSettings();
});

settingsFields.addEventListener('click', (event) => {
  const button = event.target.closest('[data-bind]');
  if (!button) return;
  const action = button.dataset.bind;
  button.textContent = 'PRESS A KEY…';
  const capture = (keyEvent) => {
    keyEvent.preventDefault();
    keyEvent.stopImmediatePropagation();
    input.setBinding(action, keyEvent.code);
    settings.bindings = { ...(settings.bindings || {}), [action]: keyEvent.code };
    persistSettings();
    renderSettings();
  };
  window.addEventListener('keydown', capture, { once: true, capture: true });
});

document.querySelector('#reset-settings').addEventListener('click', () => {
  Object.assign(settings, structuredClone(DEFAULT_SETTINGS));
  delete settings.bindings;
  input.resetBindings();
  persistSettings();
  renderSettings();
  audio.play('ui');
});

document.addEventListener('pointerdown', () => audio.unlock(), { passive: true });

document.querySelector('#start-button').addEventListener('click', async () => {
  await audio.unlock();
  showScreen('difficulty-screen');
  audio.play('ui');
});

document.querySelectorAll('.difficulty').forEach((button) => {
  button.addEventListener('click', async () => {
    await audio.unlock();
    settings.difficulty = button.dataset.difficulty;
    persistSettings();
    document.querySelectorAll('.difficulty').forEach((item) => item.classList.toggle('selected', item === button));
    clearScreens();
    game.start(settings.difficulty);
  });
});

document.querySelector('.back-button').addEventListener('click', () => showScreen('title-screen'));

document.querySelectorAll('[data-panel]').forEach((button) => {
  button.addEventListener('click', () => {
    panelReturn = game.mode === 'paused' ? 'pause-screen' : 'title-screen';
    showScreen(button.dataset.panel);
    audio.play('ui');
  });
});

document.querySelectorAll('.close-panel').forEach((button) => {
  button.addEventListener('click', () => showScreen(panelReturn));
});

document.querySelector('#resume-button').addEventListener('click', () => game.resume());
document.querySelector('#restart-button').addEventListener('click', () => { clearScreens(); game.restartCurrentEncounter(); });
document.querySelector('#quit-button').addEventListener('click', () => { game.quit(); showScreen('title-screen'); });
document.querySelector('#replay-button').addEventListener('click', async () => { await audio.unlock(); clearScreens(); game.start(settings.difficulty || 'normal'); });
document.querySelector('#results-title-button').addEventListener('click', () => { game.quit(); showScreen('title-screen'); });

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.mode === 'playing') game.pause();
});

persistSettings();
renderSettings();

let previous = performance.now();
let accumulator = 0;
let lastDebugUpdate = 0;
const step = 1 / 60;

function loop(now) {
  const rawDelta = Math.min(.1, (now - previous) / 1000);
  previous = now;
  accumulator += rawDelta;
  const start = performance.now();
  while (accumulator >= step) {
    game.update(step);
    accumulator -= step;
  }
  game.render(accumulator / step);
  game.recordFrameTime(performance.now() - start);
  debugPanel.hidden = !game.debug;
  if (game.debug && now - lastDebugUpdate >= 100) {
    debugPanel.textContent = game.getDebugText();
    lastDebugUpdate = now;
  }
  requestAnimationFrame(loop);
}

await game.load();
loading.classList.remove('active');
const params = new URLSearchParams(location.search);
const requestedRoom = params.get('room');
const validRoom = TEST_ROOMS.some((room) => room.id === requestedRoom) ? requestedRoom : null;
if (validRoom || params.get('debug') === '1') {
  clearScreens();
  const script = params.get('script');
  const validScript = ['combo', 'launcher', 'grab', 'aerial', 'special'].includes(script) ? script : null;
  game.start(settings.difficulty || 'normal', {
    debug: true,
    testRoom: validRoom || 'stationary',
    script: validScript
  });
} else {
  titleScreen.classList.add('active');
}
requestAnimationFrame(loop);

globalThis.bayouGame = game;
