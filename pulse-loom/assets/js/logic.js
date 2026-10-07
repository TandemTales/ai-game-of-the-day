(function (global) {
  'use strict';
  var PL = global.PL = global.PL || {};
  var L = PL.Logic = {};
  L.BPM = 112;
  L.BEAT = 60 / L.BPM;
  L.TOTAL_BEATS = 128;
  L.APPROACH = 2;
  L.WINDOW = 0.18;
  L.laneFor = function (base, beat) { return (base + Math.floor(beat / 32)) % 4; };
  L.chart = function () {
    var notes = [];
    var patterns = [[0, 2, 1, 3, 0, 1, 2, 3], [0, 1, 3, 2, 1, 3, 0, 2],
      [2, 0, 3, 1, 2, 3, 1, 0], [3, 1, 0, 2, 3, 0, 1, 2]];
    // Each movement has an authored rhythm. The first leaves room to learn;
    // later movements add offbeats while retaining at least half a beat
    // between inputs so direct touch never needs a simultaneous chord.
    var bars = [[0, 2], [0, 1, 2, 3], [0, 1.5, 2, 3],
      [0, 0.5, 1.5, 2, 2.5, 3.5]];
    for (var bar = 1; bar < L.TOTAL_BEATS / 4; bar++) {
      var section = Math.floor(bar / 8), rhythm = bars[section];
      for (var step = 0; step < rhythm.length; step++) {
        var beat = bar * 4 + rhythm[step];
        var base = patterns[section][(bar * 2 + step) % 8];
        notes.push({ beat: beat, time: beat * L.BEAT, base: base,
          lane: L.laneFor(base, beat), status: 0 });
      }
    }
    return notes;
  };
  L.newRun = function () { return { notes: L.chart(), score: 0, combo: 0,
    bestCombo: 0, hits: 0, misses: 0, last: '', ended: false }; };
  L.tap = function (run, lane, time) {
    if (run.ended || lane < 0 || lane > 3) return null;
    var chosen = null, distance = Infinity;
    run.notes.forEach(function (note) {
      var gap = Math.abs(note.time - time);
      if (!note.status && note.lane === lane && gap <= L.WINDOW && gap < distance) {
        chosen = note; distance = gap;
      }
    });
    if (!chosen) return null;
    chosen.status = 1;
    run.combo++; run.hits++;
    run.bestCombo = Math.max(run.bestCombo, run.combo);
    var perfect = distance <= 0.075;
    run.score += (perfect ? 100 : 55) * Math.min(4, 1 + Math.floor((run.combo - 1) / 10));
    run.last = perfect ? 'PERFECT' : 'GOOD';
    return run.last;
  };
  L.advance = function (run, time) {
    if (run.ended) return;
    run.notes.forEach(function (note) {
      if (!note.status && time - note.time > L.WINDOW) {
        note.status = -1; run.misses++; run.combo = 0; run.last = 'MISS';
      }
    });
    if (time > L.TOTAL_BEATS * L.BEAT + 1) run.ended = true;
  };
})(typeof window !== 'undefined' ? window : this);
