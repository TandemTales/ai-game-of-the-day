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
    function add(beat, base) {
      notes.push({ beat: beat, time: beat * L.BEAT, base: base,
        lane: L.laneFor(base, beat), status: 0 });
    }
    for (var beat = 4; beat < L.TOTAL_BEATS; beat++) {
      var section = Math.floor(beat / 32), p = patterns[section];
      if (beat % 2 === 0 || beat >= 64 && beat % 4 === 3 || beat >= 96 && beat % 4 === 1) {
        add(beat, p[beat % 8]);
      }
      // Eighth-note answers deepen the later movements.
      if (section === 2 && beat % 4 === 3 || section === 3 && beat % 2 === 1 && beat % 8 !== 7) {
        add(beat + 0.5, p[(beat + 3) % 8]);
      }
    }
    notes.sort(function (x, y) { return x.time - y.time; });
    return notes;
  };
  L.newRun = function () { return { notes: L.chart(), score: 0, combo: 0,
    bestCombo: 0, hits: 0, perfects: 0, misses: 0, stray: 0, last: '', ended: false }; };
  L.tap = function (run, lane, time) {
    if (run.ended || lane < 0 || lane > 3) return null;
    var chosen = null, distance = Infinity;
    run.notes.forEach(function (note) {
      var gap = Math.abs(note.time - time);
      if (!note.status && note.lane === lane && gap <= L.WINDOW && gap < distance) {
        chosen = note; distance = gap;
      }
    });
    if (!chosen) { run.stray++; return null; }
    chosen.status = 1;
    run.combo++; run.hits++;
    run.bestCombo = Math.max(run.bestCombo, run.combo);
    var perfect = distance <= 0.075;
    if (perfect) run.perfects++;
    run.lastError = time - chosen.time;
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
  L.maxScore = function () {
    var n = L.chart().length, total = 0;
    for (var i = 1; i <= n; i++) total += 100 * Math.min(4, 1 + Math.floor((i - 1) / 10));
    return total;
  };
  L.accuracy = function (run) {
    var judged = run.hits + run.misses;
    return judged ? (run.perfects * 1 + (run.hits - run.perfects) * 0.6) / judged : 0;
  };
  L.grade = function (run) {
    var ratio = run.score / L.maxScore();
    return ratio >= .92 ? 'S' : ratio >= .8 ? 'A' : ratio >= .6 ? 'B' : ratio >= .4 ? 'C' : 'D';
  };
  L.section = function (time) { return Math.min(3, Math.floor(time / (32 * L.BEAT))); };
})(typeof window !== 'undefined' ? window : this);
