const fs = require('fs');
const path = require('path');
const vm = require('vm');
const routes = require('../tools/turntide-routes.cjs');
const context = vm.createContext({ window: {} });
for (const moduleName of ['course', 'links', 'journal']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../turntide-links/assets/js', moduleName + '.js'), 'utf8'), context);
}
const { holes, Links, Journal } = context.window.TL;
function play(hole, start, route) {
  let current = start;
  const events = [];
  for (const [club, angle, power] of route) {
    expect(current.holed).toBe(false);
    const shot = Links.shoot(hole, current, { club, angle, power });
    const last = shot.frames[shot.frames.length - 1];
    expect(last).toMatchObject({ x: shot.state.x, y: shot.state.y, level: shot.state.level, z: 0 });
    expect(shot.frames.flatMap(frame => frame.cues || [])).toEqual(shot.events);
    events.push(...shot.events);
    current = shot.state;
  }
  return { current, events };
}
test.each([
  [1, 0, 'bell', 'bank'], [2, 0, 'dune', 'lip'], [3, 0, 'raftLow', 'ride'], [3, 1, 'raftHigh', 'paddle'],
  [4, 0, 'lowQuay', 'quay'], [4, 1, 'highQuay', 'quay'], [4, 0, 'lowSand', 'sandbar'], [4, 1, 'drainSand', 'sandbar']
])('hole %i at level %i can finish via %s', (id, level, route, objective) => {
  const hole = holes[id - 1];
  const attempt = () => play(hole, Links.start(hole, level), routes[route]);
  const first = attempt();
  expect(first).toEqual(attempt());
  expect(first.current).toMatchObject({ holed: true, strokes: routes[route].length, ...hole.cup });
  if (id === 4) expect(first.current.passage).toBe(objective);
  else expect(first.events).toContain(objective);
});
test('a putt cannot clear the dune and flying directly to the fourth cup cannot chart a crossing', () => {
  const lip = holes[1], ferry = holes[3];
  expect(Links.shoot(lip, Links.start(lip), { club: 'putt', angle: 0, power: 95 }).state.qualified).toBe(false);
  for (const [level, angle, power] of [[0, -3, 98], [1, 3, 81]]) {
    const shot = Links.shoot(ferry, Links.start(ferry, level), { club: 'chip', angle, power });
    expect(shot.state).toMatchObject({ holed: false, qualified: false });
  }
});
test('water costs a penalty and returns to the playable previous lie', () => {
  const start = Links.start(holes[0]);
  const shot = Links.shoot(holes[0], start, { club: 'putt', angle: 180, power: 95 });
  expect(shot.events).toContain('splash');
  expect(shot.state).toMatchObject({ x: start.x, y: start.y, strokes: 2 });
  expect(start.strokes).toBe(0);
});
test('floating tee, stamp and passage survive settled reloads and replay keeps the better card', () => {
  let journal = Journal.restore(null);
  const routeNames = ['bell', 'dune', 'raftLow', 'highQuay'];
  for (const hole of holes) {
    expect(Journal.enter(journal, hole.id)).toBe(true);
    if (hole.id === 4) expect(journal.lie).toMatchObject({ x: 227, y: 203, level: 1 });
    for (const [club,angle,power] of routes[routeNames[hole.id - 1]]) {
      Journal.settle(journal, hole, Links.shoot(hole, journal.lie, { club, angle, power }).state);
      const restored = Journal.restore(JSON.parse(JSON.stringify(journal)));
      expect(restored.lie).toMatchObject(journal.lie);
      journal = restored;
    }
    expect(journal.cards[hole.id].stamp).toBe(true);
  }
  const sum = Journal.total(journal);
  expect(sum).toBe(5600);
  expect(journal.lie.passage).toBe('quay');
  Journal.enter(journal, 4);
  const worse = play(holes[3], journal.lie, routes.drainSand);
  Journal.settle(journal, holes[3], worse.current);
  expect(Journal.total(journal)).toBe(sum);
  expect(journal.cards[4]).toMatchObject({ stamp: true, leastStrokes: 2 });
});
test('score floor applies before the stamp bonus; invalid or locked saves return a playable tee', () => {
  expect(Links.points(holes[0], { strokes: 25, marked: true, holed: true })).toBe(350);
  expect(Links.points(holes[0], { strokes: 1, marked: true, holed: false })).toBe(0);
  const fresh = Journal.restore();
  expect(Journal.enter(fresh, 4)).toBe(false);
  expect(Journal.restore({ version: 88 })).toEqual(fresh);
  expect(Journal.restore({ version: 1, holeId: 4, lie: { x: -50, level: 1 } }).lie).toEqual(fresh.lie);
});
