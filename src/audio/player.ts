// player.ts — plays voicings. A sampled piano loads in the background on first use;
// a small Web Audio synth covers the gap and any failure to load.

import { SplendidGrandPiano } from 'smplr';
import type { Voicing } from '../theory/voicing';

export type Sound = 'synth' | 'loading' | 'piano';
export type PlayEvent = { voicing: Voicing; duration: number; velocity?: number };

type Listener = (s: Sound) => void;

class Player {
  private ctx: AudioContext | null = null;
  private piano: ReturnType<typeof SplendidGrandPiano> | null = null;
  private master: GainNode | null = null;
  private sound: Sound = 'synth';
  private listeners = new Set<Listener>();
  private stops: Array<(t?: number) => void> = [];
  private generation = 0;

  subscribe(fn: Listener) { this.listeners.add(fn); fn(this.sound); return () => { this.listeners.delete(fn); }; }

  private setSound(s: Sound) { this.sound = s; this.listeners.forEach(l => l(s)); }

  private ensure(): AudioContext {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    this.master = master;
    this.setSound('loading');
    const piano = SplendidGrandPiano(ctx, { destination: master, volume: 100 });
    piano.load.then(() => { this.piano = piano; this.setSound('piano'); }).catch(() => this.setSound('synth'));
    return ctx;
  }

  stopAll() {
    const t = this.ctx?.currentTime ?? 0;
    this.stops.forEach(s => s(t));
    this.stops = [];
    this.generation++;
  }

  // Play a sequence of voicings back to back, starting now.
  play(events: PlayEvent[]) {
    const ctx = this.ensure();
    this.stopAll();
    let t = ctx.currentTime + 0.03;
    for (const ev of events) {
      this.chord(ctx, ev, t);
      t += ev.duration;
    }
  }

  private chord(ctx: AudioContext, ev: PlayEvent, at: number) {
    const dur = ev.duration * 0.97;
    const vel = ev.velocity ?? 68;
    const notes = [[ev.voicing.bass, vel], ...ev.voicing.upper.map((n, i) => [n, i === ev.voicing.upper.length - 1 ? vel + 4 : vel - 8])];
    for (const [midi, v] of notes) {
      if (this.piano) this.stops.push(this.piano.start({ note: midi, velocity: v, time: at, duration: dur }));
      else this.synthNote(ctx, midi, v / 127, at, dur);
    }
  }

  private synthNote(ctx: AudioContext, midi: number, vel: number, at: number, dur: number) {
    const master = this.master!;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(6000, 600 + freq * 3);
    g.connect(lp).connect(master);
    const peak = 0.16 * vel * (midi < 50 ? 1.3 : 1);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.012);
    g.gain.exponentialRampToValueAtTime(peak * 0.45, at + 0.35);
    g.gain.exponentialRampToValueAtTime(peak * 0.25, at + dur);
    g.gain.exponentialRampToValueAtTime(0.0005, at + dur + 0.35);
    const oscs: OscillatorNode[] = [];
    const mk = (type: OscillatorType, mult: number, gain: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq * mult;
      const og = ctx.createGain();
      og.gain.value = gain;
      o.connect(og).connect(g);
      o.start(at);
      o.stop(at + dur + 0.4);
      oscs.push(o);
    };
    mk('triangle', 1, 1);
    mk('sine', 2, 0.18);
    if (midi < 50) mk('sine', 1, 0.6);
    const gen = this.generation;
    this.stops.push((t?: number) => {
      if (this.generation !== gen) return;
      const now = t ?? ctx.currentTime;
      try {
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.exponentialRampToValueAtTime(0.0005, now + 0.12);
        oscs.forEach(o => o.stop(now + 0.15));
      } catch { /* already stopped */ }
    });
  }
}

export const player = new Player();
