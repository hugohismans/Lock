import { audio, bus } from '../audio/context'
import { FEEDBACK } from '../tuning'
import type { Channel, GateKind } from '../types'
import { applySegments, noiseSource } from './audible'
import { energyCompensation, gateSegments } from './envelope'
import type { Haptics, MechanismEvent } from './index'

/**
 * Le mode casque. navigator.vibrate n'existe pas sur iOS Safari : plutôt que
 * de rendre les niveaux silencieux injouables sur iPhone, on remplace la
 * vibration par une impulsion sinusoïdale très grave (~45 Hz), qu'on ressent
 * dans un casque plus qu'on ne l'entend. Les textures — lisse contre hachée —
 * se transposent exactement.
 */
export class LowAudioHaptics implements Haptics {
  readonly channel: Channel = 'audio-low'

  private pulse(freq: number, durationMs: number, level: number, kind: GateKind | null): void {
    const ctx = audio()
    const out = bus()
    if (!ctx || !out) return
    const t = ctx.currentTime
    const segments = kind
      ? gateSegments(kind, durationMs)
      : [{ start: 0, end: durationMs / 1000 }]
    const comp = kind ? energyCompensation(segments, durationMs) : 1

    const shape = ctx.createGain()
    // Un passe-bas dur : ce qui reste doit se ressentir, pas s'écouter.
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 120
    shape.connect(lp).connect(out)
    const end = applySegments(shape, segments, level * comp, t, 0.004)

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    osc.connect(shape)
    osc.start(t)
    osc.stop(end + 0.05)
  }

  tick(): void {
    // Un tic de 12 ms ne tient pas une demi-période à 45 Hz : on monte
    // légèrement la fréquence pour que l'impulsion ait une forme.
    this.pulse(FEEDBACK.HAPTIC_HZ * 1.6, FEEDBACK.TICK_MS + 4, 0.5, null)
  }

  gate(kind: GateKind): void {
    this.pulse(FEEDBACK.HAPTIC_HZ, FEEDBACK.GATE_MS, 0.85, kind)
  }

  mechanism(e: MechanismEvent): void {
    if (e === 'locked') {
      this.pulse(FEEDBACK.HAPTIC_HZ * 1.3, FEEDBACK.LOCKED_MS, 0.9, null)
      return
    }
    if (e === 'opened') {
      this.pulse(FEEDBACK.HAPTIC_HZ * 0.75, 700, 0.95, null)
      return
    }
    // La perte : un raclement grave, plus long et plus mou qu'une gorge.
    const ctx = audio()
    const out = bus()
    if (!ctx || !out) return
    const t = ctx.currentTime
    const d = FEEDBACK.LOST_MS / 1000
    const src = noiseSource(ctx)
    if (!src) return
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(150, t)
    lp.frequency.exponentialRampToValueAtTime(60, t + d)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + d)
    src.connect(lp).connect(g).connect(out)
    src.start(t, Math.random() * 0.5)
    src.stop(t + d + 0.05)
  }

  dispose(): void {}
}
