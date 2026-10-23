const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load() {
  const window = {};
  const context = vm.createContext({ window, Math, JSON, Object, Array });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../gearwell/assets/js/logic.js'), 'utf8'), context);
  return window.GW.Logic;
}

test('seeded seven-piece bags are deterministic and complete', () => {
  const L = load(), a = L.newGame(42), b = L.newGame(42);
  const one = [], two = [];
  for (let i = 0; i < 21; i++) {
    one.push(a.piece.kind); two.push(b.piece.kind);
    a.board = Array.from({ length: 20 }, () => Array(10).fill(null));
    b.board = Array.from({ length: 20 }, () => Array(10).fill(null));
    L.hardDrop(a); L.hardDrop(b);
  }
  expect(one).toEqual(two);
  for (let i = 0; i < 21; i += 7) expect(new Set(one.slice(i, i + 7)).size).toBe(7);
});

test('movement, rotation, wall collision, and hard drop stay legal', () => {
  const L = load(), s = L.newGame(8);
  for (let i = 0; i < 20; i++) L.move(s, -1, 0);
  expect(L.valid(s, s.piece)).toBe(true);
  expect(L.move(s, -1, 0)).toBe(false);
  L.rotate(s);
  expect(L.valid(s, s.piece)).toBe(true);
  const serial = s.serial, distance = L.hardDrop(s);
  expect(distance).toBeGreaterThan(0);
  expect(s.serial).toBe(serial + 1);
  expect(s.board.flat().filter(Boolean)).toHaveLength(4);
});

test('line clear earns a cog from a gear cell and rewind restores the prior lock', () => {
  const L = load(), s = L.newGame(7);
  for (let y of [18, 19]) for (let x = 0; x < 10; x++) {
    if (x !== 4 && x !== 5) s.board[y][x] = { kind: 'J', gear: false };
  }
  s.piece = { kind: 'O', x: 3, y: 18, rot: 0, gear: true };
  s.cogs = 3;
  expect(L.valid(s, s.piece)).toBe(true);
  L.lock(s);
  expect(s.lines).toBe(2);
  expect(s.score).toBe(300);
  expect(s.cogs).toBe(4);
  expect(L.rewind(s)).toBe(true);
  expect(s.lines).toBe(0);
  expect(s.score).toBe(0);
  expect(s.cogs).toBe(1);
  expect(s.board[19].filter(Boolean)).toHaveLength(8);
  expect(s.piece.kind).toBe('O');
  expect(L.rewind(s)).toBe(false);
});

test('a blocked spawn ends the run instead of producing an illegal active piece', () => {
  const L = load(), s = L.newGame(9);
  s.board[0] = Array(10).fill({ kind: 'T', gear: false });
  s.piece = { kind: 'O', x: 3, y: -1, rot: 0, gear: false };
  L.lock(s);
  expect(s.over).toBe(true);
  expect(s.piece).toBeNull();
});

test('drop and gravity feedback announce actual locks and line clears', () => {
  const L = load(), sounds = [], elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, { textContent: '', hidden: false,
      classList: { toggle() {} }, setAttribute() {}, addEventListener() {},
      getBoundingClientRect: () => ({ width: 320, height: 670 }) });
    return elements.get(id);
  }
  let nextFrame;
  const window = { GW: { Logic: L, Render: { draw() {} },
    Audio: Object.fromEntries(['move', 'rotate', 'lock', 'clear', 'rewind']
      .map(name => [name, () => sounds.push(name)])) },
    location: { protocol: 'file:' }, addEventListener() {},
    requestAnimationFrame: frame => { nextFrame = frame; } };
  const context = vm.createContext({ window, performance: { now: () => 0 },
    document: { getElementById: element, querySelectorAll: () => [], addEventListener() {} } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../gearwell/assets/js/game.js'), 'utf8'), context);
  const game = window.GW.Game;
  game.start(); game.act('drop');
  // Drop distance awards points; it must not masquerade as a line clear.
  expect(game.getState().score).toBeGreaterThan(10);
  expect(sounds).toEqual(['lock']);
  expect(element('notice').textContent).toBe('Clear gears · earn rewinds');

  function prepareLanding(clear) {
    const s = game.getState();
    s.board = Array.from({ length: 20 }, () => Array(10).fill(null));
    if (clear) for (let x = 0; x < 10; x++) {
      if (x !== 4 && x !== 5) s.board[19][x] = { kind: 'J', gear: false };
    }
    s.piece = { kind: 'O', x: 3, y: 18, rot: 0, gear: false };
    s.elapsed = .79;
  }
  sounds.length = 0; prepareLanding(false); nextFrame(100);
  expect(sounds).toEqual(['lock']);
  sounds.length = 0; prepareLanding(true); nextFrame(200);
  expect(sounds).toEqual(['lock', 'clear']);
  expect(element('notice').textContent).toBe('1 LINE CLEAR');
});
