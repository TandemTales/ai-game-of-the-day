'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
function renderer() {
  const context = { window: {}, Math, Number }; vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '../prism-warden/assets/js/render.js'), 'utf8');
  vm.runInContext(source.replace('})(typeof window', 'PW.walkFrameForTest = seraWalkFrame;\n})(typeof window'), context);
  return context.window.PW.walkFrameForTest;
}
const player = () => ({ x: 0, y: 0, aimX: 1, aimY: 0, dashTime: 0 });
test('all eight movement directions traverse all six walk frames without mutating the player', () => {
  const frame = renderer();
  for (let direction = 0; direction < 8; direction++) {
    const a = direction * Math.PI / 4, p = player(), seen = new Set();
    p.aimX = Math.cos(a); p.aimY = Math.sin(a);
    expect(frame(p, 0)).toBe(-1);
    for (let i = 1; i <= 24; i++) {
      p.x += p.aimX * 8; p.y += p.aimY * 8;
      const before = JSON.stringify(p); seen.add(frame(p, i / 24));
      expect(JSON.stringify(p)).toBe(before);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  }
});
test('gait depends on traveled distance, not render frequency or movement speed', () => {
  function walk(hz, speed) {
    const frame = renderer(), p = player(); frame(p, 0);
    const steps = hz, distance = 91;
    let pose;
    for (let i = 1; i <= steps; i++) { p.x = distance * i / steps; pose = frame(p, distance / speed * i / steps); }
    return pose;
  }
  expect(walk(30, 190)).toBe(walk(144, 190));
  expect(walk(60, 108)).toBe(walk(60, 190));
});
test('stopping or pressing into a wall returns to idle; duplicate paused draws hold their pose', () => {
  const frame = renderer(), p = player(); frame(p, 0);
  p.x = 20; const moving = frame(p, .1); expect(moving).toBeGreaterThanOrEqual(0);
  expect(frame(p, .1)).toBe(moving);
  expect(frame(p, .12)).toBe(-1);
  expect(frame(p, .14)).toBe(-1);
  p.x += 3; expect(frame(p, .16)).toBeGreaterThanOrEqual(0);
});
test('dashes, teleports, time resets and long pauses do not count as footsteps', () => {
  const frame = renderer(), p = player(); frame(p, 0);
  p.x += 12; p.dashTime = .1; expect(frame(p, .02)).toBe(-1);
  p.dashTime = 0; p.x += 400; expect(frame(p, .04)).toBe(-1);
  p.x += 4; expect(frame(p, 2)).toBe(-1);
  p.x += 4; expect(frame(p, 0)).toBe(-1);
  p.x += 4; expect(frame(p, .02)).toBe(0);
});
test('backpedaling reverses the stride while strafing and aiming remain independent', () => {
  const forward = renderer(), backward = renderer(), p = player(), q = player();
  forward(p, 0); backward(q, 0); p.x = 20; q.x = -20;
  expect(forward(p, .1)).toBe(1); expect(backward(q, .1)).toBe(4);
  p.aimX = 0; p.aimY = 1; p.x += 17;
  expect(forward(p, .2)).toBe(2); expect(p.aimY).toBe(1);
});
