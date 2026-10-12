'use strict';
/* Web Audio playback: plain sine voices with a soft envelope. Only one chord
 * sounds at a time: starting a chord releases whatever is still ringing. */
const Audio = (() => {
  let ctx = null, master = null;
  let voices = [];   // { osc, gain, start }

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // Release every voice that would still be sounding at time t. An immediate
  // play (all = true) also kills voices scheduled for the future.
  function cut(t, all) {
    const keep = [];
    for (const v of voices) {
      if (!all && v.start >= t) { keep.push(v); continue; }
      const g = v.gain.gain;
      const at = Math.max(t, v.start);
      if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(at); else g.cancelScheduledValues(at);
      g.setTargetAtTime(0, at, 0.02);
      try { v.osc.stop(at + 0.12); } catch (_) { /* already stopped */ }
    }
    voices = keep;
  }

  function stopAll() {
    if (ctx) cut(ctx.currentTime, true);
  }

  // notes: [{ midi, gain }]; when: seconds from now; dur: seconds
  function play(notes, { when = 0, dur = 1.6 } = {}) {
    const c = ensure();
    const t0 = c.currentTime + when;
    cut(t0, when === 0);
    for (const { midi, gain } of notes) {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = midiToHz(midi);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
      g.gain.setTargetAtTime(gain * 0.55, t0 + 0.06, 0.35);
      g.gain.setTargetAtTime(0, t0 + dur - 0.3, 0.09);
      osc.connect(g).connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.4);
      voices.push({ osc, gain: g, start: t0 });
      osc.onended = () => { voices = voices.filter((v) => v.osc !== osc); };
    }
  }

  // Voice-led form: root + 5th in the left hand (root louder so the low sine carries), three voices above.
  function playVoicing(voicing, opts) {
    play([
      { midi: voicing.bass, gain: 0.26 },
      { midi: voicing.bass2, gain: 0.17 },
      ...voicing.upper.map((midi) => ({ midi, gain: 0.13 })),
    ], opts);
  }

  // A single tapped note.
  function playNote(midi, opts) {
    play([{ midi, gain: 0.2 }], { dur: 1.1, ...opts });
  }

  return { playVoicing, playNote, stopAll, ensure };
})();
