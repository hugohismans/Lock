import { audio, bus, noiseBuffer } from '../audio/context'
import { FEEDBACK } from '../tuning'
import type { Channel, GateKind } from '../types'
import { energyCompensation, gateSegments, type Segment } from './envelope'
import type { Haptics, MechanismEvent } from './index'

/** Applique un découpage d'enveloppe à un gain, avec des bords adoucis. */
export function applySegments(
  gain: GainNode,
  segments: readonly Segment[],
  level: number,
  t0: number,
  edge = 0.005
): number {
  gain.gain.setValueAtTime(0, t0)
  let end = t0
  for (const s of segments) {
    const a = t0 + s.start
    const b = t0 + s.end
    const e = Math.min(edge, (b - a) / 2.5)
    gain.gain.setValueAtTime(0, a)
    gain.gain.linearRampToValueAtTime(level, a + e)
    gain.gain.setValueAtTime(level, b - e)
    gain.gain.linearRampToValueAtTime(0, b)
    end = b
  }
  return end
}

export function noiseSource(ctx: AudioContext): AudioBufferSourceNode | null {
  const buffer = noiseBuffer()
  if (!buffer) return null
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.loop = true
  return src
}

/**
 * Niveau 1 : le mécanisme est usé, il parle fort. Les tics sont audibles et
 * secs ; la gorge est un son grave, plus long, plus plein. C'est ici que le
 * joueur apprend à quoi ressemble une gorge.
 */
export class AudibleHaptics implements Haptics {
  readonly channel: Channel = 'audible'

  tick(): void {
    const ctx = audio()
    const out = bus()
    if (!ctx || !out) return
    const t = ctx.currentTime
    const d = FEEDBACK.TICK_MS / 1000

    const src = noiseSource(ctx)
    if (!src) return
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = FEEDBACK.TICK_HZ
    band.Q.value = 1.3
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.0015)
    g.gain.exponentialRampToValueAtTime(0.0001, t + d)
    src.connect(band).connect(g).connect(out)
    src.start(t, Math.random() * 0.5)
    src.stop(t + d + 0.02)

    // Un peu de corps : la pièce métallique qui retombe.
    const body = ctx.createOscillator()
    body.type = 'triangle'
    body.frequency.setValueAtTime(340, t)
    body.frequency.exponentialRampToValueAtTime(190, t + d)
    const bg = ctx.createGain()
    bg.gain.setValueAtTime(0.0001, t)
    bg.gain.exponentialRampToValueAtTime(0.10, t + 0.002)
    bg.gain.exponentialRampToValueAtTime(0.0001, t + d * 1.4)
    body.connect(bg).connect(out)
    body.start(t)
    body.stop(t + d * 1.6)
  }

  gate(kind: GateKind): void {
    const ctx = audio()
    const out = bus()
    if (!ctx || !out) return
    const t = ctx.currentTime
    const segments = gateSegments(kind)
    const comp = energyCompensation(segments)

    const shape = ctx.createGain()
    shape.connect(out)
    const end = applySegments(shape, segments, 0.55 * comp, t)

    const fundamental = ctx.createOscillator()
    fundamental.type = 'sine'
    fundamental.frequency.value = FEEDBACK.GATE_HZ
    const fg = ctx.createGain()
    fg.gain.value = 0.75
    fundamental.connect(fg).connect(shape)

    const harmonic = ctx.createOscillator()
    harmonic.type = 'triangle'
    harmonic.frequency.value = FEEDBACK.GATE_HZ * 2
    const hg = ctx.createGain()
    hg.gain.value = 0.14
    harmonic.connect(hg).connect(shape)

    // Le « plein » : un souffle grave sous la fondamentale.
    const src = noiseSource(ctx)
    if (src) {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 300
      const ng = ctx.createGain()
      ng.gain.value = 0.30
      src.connect(lp).connect(ng).connect(shape)
      src.start(t, Math.random() * 0.5)
      src.stop(end + 0.05)
    }

    fundamental.start(t)
    harmonic.start(t)
    fundamental.stop(end + 0.05)
    harmonic.stop(end + 0.05)
  }

  mechanism(e: MechanismEvent): void {
    const ctx = audio()
    const out = bus()
    if (!ctx || !out) return
    const t = ctx.currentTime

    if (e === 'locked') {
      // Ça prend. Sec, métallique, sans ambiguïté.
      const d = FEEDBACK.LOCKED_MS / 1000
      const src = noiseSource(ctx)
      if (src) {
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.setValueAtTime(2400, t)
        lp.frequency.exponentialRampToValueAtTime(500, t + d)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(0.45, t + 0.003)
        g.gain.exponentialRampToValueAtTime(0.0001, t + d)
        src.connect(lp).connect(g).connect(out)
        src.start(t, Math.random() * 0.5)
        src.stop(t + d + 0.05)
      }
      const thud = ctx.createOscillator()
      thud.type = 'sine'
      thud.frequency.setValueAtTime(180, t)
      thud.frequency.exponentialRampToValueAtTime(110, t + d)
      const tg = ctx.createGain()
      tg.gain.setValueAtTime(0.0001, t)
      tg.gain.exponentialRampToValueAtTime(0.4, t + 0.004)
      tg.gain.exponentialRampToValueAtTime(0.0001, t + d * 1.8)
      thud.connect(tg).connect(out)
      thud.start(t)
      thud.stop(t + d * 2)
      return
    }

    if (e === 'lost') {
      // Ça glisse. Un raclement mou, sans à-coup : on n'a rien cassé, on a perdu du temps.
      const d = FEEDBACK.LOST_MS / 1000
      const src = noiseSource(ctx)
      if (!src) return
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(900, t)
      lp.frequency.exponentialRampToValueAtTime(170, t + d)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + d)
      src.connect(lp).connect(g).connect(out)
      src.start(t, Math.random() * 0.5)
      src.stop(t + d + 0.05)
      return
    }

    // Ouverture : le pêne qui sort, long et lourd.
    const d = 0.9
    const bolt = ctx.createOscillator()
    bolt.type = 'sine'
    bolt.frequency.setValueAtTime(70, t)
    bolt.frequency.exponentialRampToValueAtTime(44, t + d)
    const bg = ctx.createGain()
    bg.gain.setValueAtTime(0.0001, t)
    bg.gain.exponentialRampToValueAtTime(0.5, t + 0.03)
    bg.gain.exponentialRampToValueAtTime(0.0001, t + d)
    bolt.connect(bg).connect(out)
    bolt.start(t)
    bolt.stop(t + d + 0.1)

    const src = noiseSource(ctx)
    if (!src) return
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(1600, t)
    bp.frequency.exponentialRampToValueAtTime(320, t + d * 0.7)
    bp.Q.value = 0.8
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + d * 0.8)
    src.connect(bp).connect(g).connect(out)
    src.start(t, Math.random() * 0.5)
    src.stop(t + d)
  }

  dispose(): void {
    // Rien à retenir : chaque impulsion est un graphe jetable.
  }
}
