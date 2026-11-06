(function (global) {
  'use strict';
  var SB = global.SB = global.SB || {}, KEY = 'signalbreak-campaign-v1';
  var IDS = ['nia', 'sol', 'rook', 'ivo'];
  var equipment = [
    { id: 'standard', label: 'Standard kit', description: 'Balanced field equipment.', minXp: 0 },
    { id: 'armor', label: 'Trauma armor', description: '+2 maximum HP; -1 movement stride.', minXp: 1 },
    { id: 'boots', label: 'Traverse boots', description: '+1 movement stride; -1 firing range.', minXp: 1 },
    { id: 'optics', label: 'Long optics', description: '+1 firing range; -2 maximum HP.', minXp: 2 }
  ];
  function operations() { return SB.Missions.operations || [SB.Missions.opening]; }
  function own(obj, key) { return !!obj && Object.prototype.hasOwnProperty.call(obj, key); }
  function bounded(value, low, high, fallback) {
    return Number.isSafeInteger(value) ? Math.max(low, Math.min(high, value)) : fallback;
  }
  function gearById(id) { return equipment.find(function (item) { return item.id === id; }); }
  function fresh() {
    var c = { version: 1, selected: operations()[0].id, results: {}, roster: {}, supplies: 2 };
    IDS.forEach(function (id) { c.roster[id] = { xp: 0, injury: 0, gear: 'standard' }; });
    return c;
  }
  function unlocked(c, id) {
    var list = operations(), i = list.findIndex(function (m) { return m.id === id; });
    return i >= 0 && (i === 0 || list.slice(0, i).every(function (m) { return own(c.results, m.id) && !!c.results[m.id]; }));
  }
  function normalize(raw) {
    var c = fresh(), list = operations(), completed = 0;
    if (!raw || raw.version !== 1 || !raw.results || typeof raw.results !== 'object' || Array.isArray(raw.results)) return c;
    // Only contiguous authored completions can support unlocks or progression.
    for (var i = 0; i < list.length; i++) {
      var r = own(raw.results, list[i].id) && raw.results[list[i].id];
      if (!r || !Number.isSafeInteger(r.score) || r.score < 0 || !Number.isSafeInteger(r.turns) || r.turns < 1 ||
          !Number.isSafeInteger(r.survivors) || r.survivors < 1 || r.survivors > 4) break;
      c.results[list[i].id] = { score: r.score, turns: r.turns, survivors: r.survivors }; completed++;
    }
    var legacy = !own(raw, 'roster');
    IDS.forEach(function (id) {
      var record = !legacy && own(raw.roster, id) && raw.roster[id];
      var xp = legacy ? completed : bounded(record && record.xp, 0, completed, 0);
      var injury = legacy ? 0 : bounded(record && record.injury, 0, 2, 0);
      var gear = record && gearById(record.gear);
      c.roster[id] = { xp: xp, injury: injury, gear: gear && xp >= gear.minXp ? gear.id : 'standard' };
    });
    // Earlier v1 releases required a rescue on every operation. Grant those
    // returning squads their earned growth once, then persist the new roster.
    c.supplies = legacy ? 2 + completed * 2 : bounded(raw.supplies, 0, 2 + completed * 2, 0);
    if (unlocked(c, raw.selected)) c.selected = raw.selected;
    else { var next = list.find(function (m) { return !c.results[m.id]; }); c.selected = (next || list[list.length - 1]).id; }
    return c;
  }
  function load(storage) {
    try { return { campaign: normalize(JSON.parse(storage.getItem(KEY))), available: true }; }
    catch (e) { return { campaign: fresh(), available: false }; }
  }
  function save(storage, campaign) {
    try { storage.setItem(KEY, JSON.stringify(normalize(campaign))); return true; }
    catch (e) { return false; }
  }
  function replace(c, clean) {
    c.version = clean.version; c.selected = clean.selected; c.results = clean.results;
    c.roster = clean.roster; c.supplies = clean.supplies;
  }
  function equip(c, id, gearId) {
    if (IDS.indexOf(id) === -1) return false;
    var clean = normalize(c), gear = gearById(gearId);
    if (!gear || clean.roster[id].xp < gear.minXp) return false;
    clean.roster[id].gear = gear.id; replace(c, clean); return true;
  }
  function treat(c, id) {
    if (IDS.indexOf(id) === -1) return false;
    var clean = normalize(c);
    if (clean.supplies < 1 || clean.roster[id].injury === 0) return false;
    clean.supplies--; clean.roster[id].injury = 0; replace(c, clean); return true;
  }
  function prepare(c, state) {
    if (!state || state.campaignPrepared || !Array.isArray(state.squad) || state.turn !== 1 || state.phase !== 'player' || state.score !== 0) return state;
    var clean = normalize(c);
    state.squad.forEach(function (u) {
      if (IDS.indexOf(u.id) === -1) return;
      var r = clean.roster[u.id], rank = (r.xp >= 2 ? 1 : 0) + (r.xp >= 4 ? 1 : 0);
      u.maxHp += rank - r.injury * 2;
      if (r.gear === 'armor') { u.maxHp += 2; u.stride--; }
      if (r.gear === 'boots') { u.stride++; u.range--; }
      if (r.gear === 'optics') { u.range++; u.maxHp -= 2; }
      if (u.role === 'MEDIC') u.kits = 2 + (r.xp >= 2 ? 1 : 0);
      if (u.role === 'SCOUT' && r.xp >= 2) u.stride++;
      if (u.role === 'ENGINEER') u.hackRange = r.xp >= 4 ? 3 : 2;
      if (u.role === 'HEAVY' && r.xp >= 4) u.damage++;
      u.maxHp = Math.max(4, u.maxHp); u.hp = u.maxHp;
      u.stride = Math.max(1, u.stride); u.range = Math.max(1, u.range);
      u.xp = r.xp; u.injury = r.injury; u.gear = r.gear;
    });
    state.campaignPrepared = true; return state;
  }
  function describe(c, id) {
    if (IDS.indexOf(id) === -1) return '';
    var r = normalize(c).roster[id], rank = r.xp >= 4 ? 'Veteran' : r.xp >= 2 ? 'Field specialist' : 'Recruit';
    var text = rank + ' / ' + r.xp + ' XP / ' + gearById(r.gear).label + ' / ' +
      (r.injury ? 'Injury ' + r.injury + ': -' + r.injury * 2 + ' maximum HP' : 'Fit for duty');
    if (r.xp >= 2) text += ' / +' + (r.xp >= 4 ? 2 : 1) + ' rank HP';
    if (id === 'sol' && r.xp >= 2) text += ' / 3 aid kits';
    if (id === 'rook' && r.xp >= 2) text += ' / +1 scout stride';
    if (id === 'nia' && r.xp >= 4) text += ' / 3-tile hack range';
    if (id === 'ivo' && r.xp >= 4) text += ' / +1 heavy damage';
    return text;
  }
  function complete(campaign, state) {
    var clean = normalize(campaign);
    if (!state || state.phase !== 'won' || !unlocked(clean, state.id) ||
        !Number.isSafeInteger(state.score) || state.score < 0 || !Number.isSafeInteger(state.turn) || state.turn < 1 ||
        !Array.isArray(state.squad) || state.squad.length !== IDS.length ||
        !IDS.every(function (id) { return state.squad.filter(function (u) { return u && u.id === id && Number.isFinite(u.hp) && Number.isFinite(u.maxHp) && u.maxHp > 0; }).length === 1; })) return false;
    var survivors = state.squad.filter(function (u) { return u.extracted && u.hp > 0; }).length;
    if (!survivors) return false;
    var previous = clean.results[state.id];
    if (!previous) {
      state.squad.forEach(function (u) {
        var r = clean.roster[u.id];
        if (u.extracted && u.hp > 0) r.xp++;
        if (u.hp <= 0) r.injury = 2;
        else if (u.hp < u.maxHp / 2) r.injury = Math.max(1, r.injury);
        else r.injury = Math.max(0, r.injury - 1);
      });
      if (state.rescued) clean.supplies += 2;
    }
    if (!previous || state.score > previous.score) clean.results[state.id] = { score: state.score, turns: state.turn, survivors: survivors };
    var list = operations(), index = list.findIndex(function (m) { return m.id === state.id; });
    clean.selected = (list[index + 1] || list[index]).id;
    replace(campaign, clean); return true;
  }
  SB.Campaign = { key: KEY, equipment: equipment, fresh: fresh, unlocked: unlocked, normalize: normalize,
    load: load, save: save, complete: complete, prepare: prepare, equip: equip, treat: treat, describe: describe };
})(window);
