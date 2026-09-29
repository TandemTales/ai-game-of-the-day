'use strict';
// Declared room-entry fixtures with held inputs model browser replanning latency.
// They prove planner reachability, never human play or a full native campaign.
const aq = require('../prism-warden/tools/aqueduct-pilot.cjs');
const abbey = require('../prism-warden/tools/abbey-pilot.cjs');

test('Sluice pilot sustains reflection with eight-frame input observations', () => {
  const PW = aq.loadPW(), s = PW.create({ room: 'sluice' });
  s.status = 'playing';
  const pilot = abbey.createPilot(PW);
  for (let frame = 0; frame < 60 * 20 && !s.receivers[0].active && s.status === 'playing'; frame += 8) {
    const input = pilot(s);
    for (let held = 0; held < 8; held++) PW.step(s, input, 1 / 60);
  }
  expect(s.status).toBe('playing');
  expect(s.receivers[0].active).toBe(true);
  expect(s.player.hp).toBe(6);
});

test('Channels pilot attacks legal flank openings with sixteen-frame observations', () => {
  const PW = aq.loadPW(), s = PW.create({ room: 'channels' });
  s.status = 'playing';
  const pilot = aq.createPilot(PW);
  for (let frame = 0; frame < 60 * 60 && s.roomId === 'channels' && s.status === 'playing'; frame += 16) {
    const input = pilot(s);
    // Native actions are presses, not indefinitely held edges.
    for (let held = 0; held < 16; held++) PW.step(s, held === 0 ? input : { ...input, slash: false, dash: false, place: false }, 1 / 60);
  }
  expect(s.status).toBe('playing');
  expect(s.cleared.B3).toBe(true);
  expect(s.roomId).toBe('quay');
});
