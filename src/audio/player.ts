import { midiToFreq } from '../theory/pitch'
import type { Voicing } from '../theory/voicing'

/**
 * A small sine-wave player on top of the Web Audio API.
 * The context is created lazily on the first play, which keeps browsers'
 * autoplay rules happy because that first play comes from a click.
 *
 * Only one chord sounds at a time: starting a new one releases the old one.
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null

function ensureContext(): { ctx: AudioContext; master: GainNode } {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = 0.6
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return { ctx, master: master! }
}

interface NoteOptions {
  gain: number
  attack: number
}

interface Voice {
  osc: OscillatorNode
  env: GainNode
  gain: number
}

function startNote(midi: number, when: number, opts: NoteOptions): Voice {
  const { ctx, master } = ensureContext()
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = midiToFreq(midi)

  const env = ctx.createGain()
  env.gain.setValueAtTime(0, when)
  env.gain.linearRampToValueAtTime(opts.gain, when + opts.attack)

  osc.connect(env).connect(master)
  osc.start(when)
  return { osc, env, gain: opts.gain }
}

function releaseVoice(v: Voice, when: number, release: number) {
  const g = v.env.gain
  g.cancelScheduledValues(when)
  g.setValueAtTime(g.value, when)
  g.exponentialRampToValueAtTime(0.0001, when + release)
  v.osc.stop(when + release + 0.05)
}

/** A chord that is currently sounding. */
export interface SoundingChord {
  release(release?: number): void
}

let current: SoundingChord | null = null

export interface PlayOptions {
  /** Seconds the previous chord takes to fade when this one starts. */
  crossfade?: number
  /** Seconds the chord takes to fade when released. */
  release?: number
  /** Seconds before the chord releases itself if nothing else cuts it. */
  maxHold?: number
}

export function playVoicing(
  v: Voicing,
  { crossfade = 0.12, release = 0.6, maxHold = 2 }: PlayOptions = {},
): SoundingChord {
  const { ctx } = ensureContext()
  const now = ctx.currentTime + 0.01

  current?.release(crossfade)

  const voices: Voice[] = [
    // Bass: a touch louder, since a sine has no harmonics to carry it.
    startNote(v.bass, now, { gain: 0.35, attack: 0.02 }),
    // Upper shape: a very slight strum so the voices separate.
    ...v.upper.map((m, i) => startNote(m, now + i * 0.012, { gain: 0.16, attack: 0.03 })),
  ]

  let released = false
  const sounding: SoundingChord = {
    release(r = release) {
      if (released) return
      released = true
      const t = ctx.currentTime
      for (const voice of voices) releaseVoice(voice, t, r)
      if (current === sounding) current = null
    },
  }

  const timer = window.setTimeout(() => sounding.release(), maxHold * 1000)
  const originalRelease = sounding.release
  sounding.release = (r) => {
    window.clearTimeout(timer)
    originalRelease(r)
  }

  current = sounding
  return sounding
}

/** Release whatever is sounding now. */
export function stopAll(release = 0.4) {
  current?.release(release)
}
