(() => {
  'use strict';
  const TL = window.TL;
  const levelOf = value => value === 1 ? 1 : 0;
  const newJournal = () => ({
    version: 1, holeId: 1, lie: TL.Links.start(TL.holes[0], 0),
    cards: {}, entries: { 1: 0 }, posted: 0, sound: false
  });
  function unlocked(journal) {
    return TL.holes.find(hole => !journal.cards[hole.id])?.id || TL.holes[TL.holes.length - 1].id;
  }
  function total(journal) {
    return Object.values(journal.cards).reduce((sum, card) => sum + card.points, 0);
  }
  function enter(journal, id) {
    const hole = TL.holes.find(item => item.id === id);
    if (!hole || id > unlocked(journal)) return false;
    journal.holeId = id;
    journal.lie = TL.Links.start(hole, levelOf(journal.entries[id]));
    return true;
  }
  function settle(journal, hole, lie) {
    journal.lie = lie;
    if (!lie.holed) return;
    const points = TL.Links.points(hole, lie);
    const old = journal.cards[hole.id];
    journal.cards[hole.id] = {
      points: Math.max(old?.points || 0, points),
      leastStrokes: Math.min(old?.leastStrokes || Infinity, lie.strokes),
      stamp: !!(old?.stamp || lie.marked)
    };
    const next = TL.holes.find(item => item.id === hole.id + 1);
    if (next) journal.entries[next.id] = next.id % 4 === 1 ? 0 : lie.level;
  }
  function restore(raw) {
    const journal = newJournal();
    if (!raw || raw.version !== 1) return journal;
    journal.sound = raw.sound === true;
    for (const hole of TL.holes) {
      journal.entries[hole.id] = levelOf(raw.entries?.[hole.id]);
      const card = raw.cards?.[hole.id];
      if (!card || !Number.isSafeInteger(card.points) || card.points <= 0 ||
          !Number.isSafeInteger(card.leastStrokes) || card.leastStrokes < 1) break;
      journal.cards[hole.id] = { points: card.points, leastStrokes: card.leastStrokes, stamp: card.stamp === true };
    }
    journal.posted = Number.isSafeInteger(raw.posted) && raw.posted >= 0 && raw.posted <= total(journal) ? raw.posted : 0;
    if (!enter(journal, raw.holeId)) return journal;
    const lie = raw.lie;
    if (lie && Number.isFinite(lie.x) && lie.x >= 0 && lie.x <= 720 &&
        Number.isFinite(lie.y) && lie.y >= 0 && lie.y <= 450 &&
        Number.isSafeInteger(lie.strokes) && lie.strokes >= 0 && (lie.level === 0 || lie.level === 1)) {
      journal.lie = { x: lie.x, y: lie.y, strokes: lie.strokes, level: lie.level,
        qualified: lie.qualified === true, marked: lie.marked === true, holed: lie.holed === true && !!journal.cards[raw.holeId] };
      if (lie.passage === 'quay' || lie.passage === 'sandbar') journal.lie.passage = lie.passage;
      if (TL.holes[raw.holeId - 1].islet && typeof lie.poolFed === 'boolean') {
        journal.lie.poolFed = lie.poolFed && lie.level === 1;
      }
    }
    return journal;
  }
  TL.Journal = { restore, unlocked, total, enter, settle };
})();
