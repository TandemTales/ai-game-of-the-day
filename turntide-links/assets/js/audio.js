(() => {
  'use strict';
  const TL = window.TL = window.TL || {};
  let context;
  let enabled = false;
  const voices = {
    swing: [[310, 95, 0.07, 'triangle']],
    land: [[160, 75, 0.08, 'sine']],
    sand: [[220, 55, 0.06, 'triangle']],
    quay: [[420, 230, 0.1, 'triangle']],
    deck: [[202, 147, 0.13, 'triangle'], [320, 170, 0.07, 'sine']],
    rail: [[341, 196, 0.09, 'triangle']],
    bank: [[880, 670, 0.28, 'sine'], [1320, 1190, 0.22, 'sine']],
    lip: [[140, 78, 0.1, 'triangle']],
    paddle: [[270, 190, 0.12, 'triangle'], [480, 370, 0.16, 'triangle', 0.1]],
    ride: [[170, 280, 0.35, 'sine']],
    splash: [[560, 95, 0.22, 'triangle'], [250, 100, 0.18, 'sine', 0.09]],
    stamp: [[580, 580, 0.14, 'sine'], [870, 870, 0.19, 'sine', 0.09]],
    cup: [[523, 523, 0.36, 'sine'], [784, 784, 0.44, 'sine', 0.1], [1046, 1046, 0.48, 'sine', 0.2]]
  };
  function unlock() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!enabled || !AudioContext) return;
    try {
      context = context || new AudioContext();
      if (context.state === 'suspended') context.resume().catch(() => {});
    } catch { /* The silent chart supports the same controls. */ }
  }
  function play(cue) {
    if (!enabled || !context || !voices[cue]) return;
    for (const [startHz, endHz, duration, type, delay = 0] of voices[cue]) {
      const start = context.currentTime + delay;
      const voice = context.createOscillator();
      const gain = context.createGain();
      voice.type = type;
      voice.frequency.setValueAtTime(startHz, start);
      voice.frequency.exponentialRampToValueAtTime(endHz, start + duration);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.009);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      voice.connect(gain).connect(context.destination);
      voice.start(start);
      voice.stop(start + duration);
    }
  }
  TL.Audio = { setEnabled(value) { enabled = value; }, unlock, play };
})();
