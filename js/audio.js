// audio.js — a small Web Audio synth. Bass sine below, a soft triangle/sine pad for the shape.

let ctx = null, master = null;

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(comp);
    comp.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

const freq = n => 440 * Math.pow(2, (n - 69) / 12);

function voice(midi, t, dur, { gain, bass }) {
  const o1 = ctx.createOscillator();
  o1.type = bass ? 'sine' : 'triangle';
  o1.frequency.value = freq(midi);
  const o2 = ctx.createOscillator();
  o2.type = bass ? 'triangle' : 'sine';
  o2.frequency.value = freq(midi) * (bass ? 1 : 2);
  const g2 = ctx.createGain();
  g2.gain.value = bass ? 0.3 : 0.1;
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.Q.value = 0.5;
  filt.frequency.setValueAtTime(bass ? 700 : 3200, t);
  filt.frequency.exponentialRampToValueAtTime(bass ? 250 : 700, t + dur);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  env.gain.exponentialRampToValueAtTime(gain * 0.45, t + 0.6);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o1.connect(filt); o2.connect(g2); g2.connect(filt); filt.connect(env); env.connect(master);
  o1.start(t); o2.start(t);
  o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}

export function playVoicing(v, when = 0, dur = 1.9) {
  const c = ensure();
  const t = c.currentTime + when + 0.01;
  voice(v.bass, t, dur, { gain: 0.32, bass: true });
  v.upper.forEach((n, i) => voice(n, t + i * 0.006, dur, { gain: 0.15 }));
}

export function playVoicings(vs, gap = 0.6) {
  vs.forEach((v, i) => playVoicing(v, i * gap, i === vs.length - 1 ? 1.9 : gap + 0.35));
}
