'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
function load() {
  const context = { window: {}, Math, Number }; vm.createContext(context);
  for (const file of ['regions', 'logic', 'save']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../prism-warden/assets/js/' + file + '.js'), 'utf8'), context);
  return context.window.PW;
}
function completed(PW) {
  // Declared region-complete fixture isolates save semantics from route proof.
  const s = PW.create(); s.status = 'cleared'; s.next = { room: 'spillway' };
  s.score = 2345; s.flags.chart = true; s.flags['beacon:tidal-abbey'] = true; s.cleared.A5 = true;
  return s;
}
test('reload preserves a completed beacon before the equipment decision', () => {
  const PW = load(), s = completed(PW), restored = PW.Save.decode(PW.Save.encode(s));
  expect(restored.status).toBe('cleared'); expect(restored.score).toBe(2345);
  expect(restored.flags.chart).toBe(true); expect(restored.next.room).toBe('spillway');
  expect(restored.equipment).toEqual({});
});
test('region reload rolls back unfinished score, discoveries and health, retains secured equipment', () => {
  const PW = load(), s = completed(PW);
  expect(PW.chooseEquipment(s, 'mobile-reflection')).toBe(true); PW.continueRegion(s);
  const entryScore = s.score; s.score += 700; s.flags['temporary-find'] = true; s.player.hp--;
  PW.enterRoom(s, 'rootbridge');
  const restored = PW.Save.decode(PW.Save.encode(s));
  expect(restored.roomId).toBe('spillway'); expect(restored.status).toBe('playing');
  expect(restored.score).toBe(entryScore); expect(restored.flags['temporary-find']).toBeUndefined();
  expect(restored.flags.chart).toBe(true); expect(restored.player.hp).toBe(restored.player.maxHp);
  expect(restored.equipment['tidal-abbey']).toBe('mobile-reflection');
  const once = PW.Save.encode(restored); const twice = PW.Save.encode(PW.Save.decode(once));
  expect(twice).toBe(once);
});
test('a chosen completed-debrief mod survives reload and cannot be chosen twice', () => {
  const PW = load(), s = completed(PW); PW.chooseEquipment(s, 'wide-guard');
  const restored = PW.Save.decode(PW.Save.encode(s));
  expect(restored.equipment['tidal-abbey']).toBe('wide-guard');
  expect(PW.chooseEquipment(restored, 'mobile-reflection')).toBe(false);
  PW.continueRegion(restored); PW.restartRegion(restored);
  expect(restored.equipment['tidal-abbey']).toBe('wide-guard'); expect(restored.score).toBe(2345);
});
test('won state, rescue flags and terminal score survive reload without awarding twice', () => {
  const PW = load(), s = PW.create({room:'crown'}); s.status = 'playing';
  s._regionEntry = JSON.stringify({...s,_entry:null,_regionEntry:null});
  s.status = 'won'; s.score = 32000; s.flags['nacre-freed'] = true; s.flags['ilex-evacuated'] = true;
  const restored = PW.Save.decode(PW.Save.encode(s));
  expect(restored.status).toBe('won'); expect(restored.flags['nacre-freed']).toBe(true);
  PW.step(restored, {}, 1/60); expect(restored.score).toBe(32000);
});
test('missing, malformed, unsupported and structurally broken saves fail closed', () => {
  const PW = load(), good = PW.Save.encode(completed(PW));
  for (const raw of [null, '', '{broken', '{"version":2}', 'x'.repeat(2000001)]) expect(PW.Save.decode(raw)).toBeNull();
  for (const edit of [d=>d.current.roomId='missing',d=>d.current.player.hp=-2,d=>d.current.enemies=null,
    d=>d.current.next=null,d=>d.current.player=null,d=>d.current.emitters=[null],d=>d.current.score=1e400,
    d=>d.entry.regionId='glass-kiln',d=>d.current.roomStates.sluice={},d=>d.current.equipment={'tidal-abbey':'missing'}]) {
    const data=JSON.parse(good);edit(data);expect(PW.Save.decode(JSON.stringify(data))).toBeNull();
  }
});
test('denied or full storage does not throw or alter the running game', () => {
  const PW = load(), s = completed(PW), before = JSON.stringify(s);
  const denied={getItem(){throw Error('Denied');},setItem(){throw Error('Quota');}};
  expect(PW.Save.read(denied)).toBeNull(); expect(PW.Save.write(s,denied)).toBe(false);
  expect(JSON.stringify(s)).toBe(before);
});
