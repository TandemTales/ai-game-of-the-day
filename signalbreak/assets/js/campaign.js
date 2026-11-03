(function (global) {
  'use strict';
  var SB = global.SB = global.SB || {}, KEY = 'signalbreak-campaign-v1';
  function operations() { return SB.Missions.operations || [SB.Missions.opening]; }
  function fresh() { return { version: 1, selected: operations()[0].id, results: {} }; }
  function unlocked(c, id) {
    var list = operations(), i = list.findIndex(function (m) { return m.id === id; });
    return i >= 0 && (i === 0 || list.slice(0, i).every(function (m) { return !!c.results[m.id]; }));
  }
  function normalize(raw) {
    var c = fresh(), list = operations();
    if (!raw || raw.version !== 1 || !raw.results || typeof raw.results !== 'object') return c;
    // Accept only a contiguous, validated sequence of completed authored operations.
    for (var i = 0; i < list.length; i++) {
      var r = raw.results[list[i].id];
      if (!r || !Number.isSafeInteger(r.score) || r.score < 0 || !Number.isSafeInteger(r.turns) || r.turns < 1 ||
          !Number.isSafeInteger(r.survivors) || r.survivors < 1 || r.survivors > 4) break;
      c.results[list[i].id] = { score: r.score, turns: r.turns, survivors: r.survivors };
    }
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
  function complete(campaign, state) {
    if (!state || state.phase !== 'won' || !unlocked(campaign, state.id) ||
        !Number.isSafeInteger(state.score) || state.score < 0 || !Number.isSafeInteger(state.turn) || state.turn < 1) return false;
    var survivors = state.squad.filter(function (u) { return u.extracted && u.hp > 0; }).length;
    if (!survivors) return false;
    var previous = campaign.results[state.id];
    if (!previous || state.score > previous.score) campaign.results[state.id] = { score: state.score, turns: state.turn, survivors: survivors };
    var list = operations(), index = list.findIndex(function (m) { return m.id === state.id; });
    campaign.selected = (list[index + 1] || list[index]).id;
    return true;
  }
  SB.Campaign = { key: KEY, fresh: fresh, unlocked: unlocked, normalize: normalize, load: load, save: save, complete: complete };
})(window);
