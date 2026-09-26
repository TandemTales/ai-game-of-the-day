/* Region-boundary saves. Unfinished rooms never become secured campaign progress. */
(function (root) {
  'use strict';
  const PW = root.PW, KEY = 'prism-warden.campaign.v1', LIMIT = 2000000;
  const clone = value => JSON.parse(JSON.stringify(value));
  function clean(s) {
    const value = { ...s, _entry: null, _regionEntry: null };
    // Test-pilot logs are not part of the campaign format.
    for (const key of Object.keys(value)) if (key.endsWith('Log')) delete value[key];
    return clone(value);
  }
  function valid(s) {
    if (!s || typeof s !== 'object' || !PW.ROOMS[s.roomId] ||
        PW.ROOMS[s.roomId].region !== s.regionId || !['playing', 'ready', 'cleared', 'won'].includes(s.status)) return false;
    const sample = PW.create({ room: s.roomId });
    for (const [key, value] of Object.entries(sample)) {
      if (key === '_entry' || key === '_regionEntry') continue;
      if (Array.isArray(value) && !Array.isArray(s[key])) return false;
      if (value !== null && !Array.isArray(value) && typeof s[key] !== typeof value) return false;
      if (typeof value === 'number' && !Number.isFinite(s[key])) return false;
    }
    for (const [key, value] of Object.entries(sample.player)) {
      if (typeof value === 'number' && !Number.isFinite(s.player[key])) return false;
    }
    if (s.score < 0 || s.time < 0 || s.player.hp <= 0 || s.player.hp > s.player.maxHp ||
        s.player.maxHp > 100 || s.player.maxHp < 1 || !s.flags || !s.cleared || !s.rewards || !s.roomStates) return false;
    if (s.status === 'cleared' && (!s.next || !PW.ROOMS[s.next.room])) return false;
    if (s.status === 'won' && s.regionId !== 'drowned-crown') return false;
    if (s.room.id !== sample.room.id || s.room.region !== sample.room.region) return false;
    const catalog = PW.equipmentCatalog ? PW.equipmentCatalog() : {};
    for (const [region, id] of Object.entries(s.equipment || {})) {
      if (!catalog[region] || !catalog[region].some(choice => choice.id === id)) return false;
    }
    for (const id of Object.keys(s.roomStates)) {
      if (!PW.ROOMS[id]) return false;
      const roomProbe = clone(s); roomProbe.status = 'playing';
      roomProbe._entry = null; roomProbe._regionEntry = null;
      if (!PW.enterRoom(roomProbe, id)) return false;
      PW.step(roomProbe, {}, 1 / 60);
      if (!Number.isFinite(roomProbe.player.x) || !Number.isFinite(roomProbe.player.y)) return false;
    }
    // A corrupt nested entity must not reach the browser loop. Probe a disposable
    // copy with the real deterministic simulator, never the restored state itself.
    const probe = clone(s); probe.status = 'playing'; probe._entry = null; probe._regionEntry = null;
    for (let frame = 0; frame < 3; frame++) PW.step(probe, {}, 1 / 60);
    return Number.isFinite(probe.player.x) && Number.isFinite(probe.player.y);
  }
  function encode(s) {
    const completed = s.status === 'cleared' || s.status === 'won';
    const entry = s._regionEntry ? JSON.parse(s._regionEntry) : PW.create();
    entry.status = 'playing';
    const current = completed ? clean(s) : clean(entry);
    return JSON.stringify({ version: 1, current, entry: clean(entry) });
  }
  function decode(raw) {
    try {
      if (typeof raw !== 'string' || raw.length > LIMIT) return null;
      const data = JSON.parse(raw, (key, value) => {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) throw Error('Invalid save key');
        return value;
      });
      if (!data || data.version !== 1 || !valid(data.current) || !valid(data.entry)) return null;
      const s = data.current;
      if (s.regionId !== data.entry.regionId) return null;
      s._regionEntry = JSON.stringify(data.entry);
      s._entry = JSON.stringify(clean(s));
      s.emitter = s.emitters[0] || null;
      return s;
    } catch { return null; }
  }
  function write(s, storage) {
    try { const raw = encode(s); if (raw.length > LIMIT) return false; storage.setItem(KEY, raw); return true; }
    catch { return false; }
  }
  function read(storage) {
    try { return decode(storage.getItem(KEY)); } catch { return null; }
  }
  PW.Save = { key: KEY, encode, decode, write, read };
})(window);
