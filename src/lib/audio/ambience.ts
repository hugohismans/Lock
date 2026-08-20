import { audio, bus, noiseBuffer } from './context'

/**
 * L'ambiance de la pièce, et la ronde qui approche.
 *
 * Le temps n'est jamais un nombre. Il est ici : un lit sonore qui se resserre,
 * des pas qui se rapprochent, un chien, une grille. Le joueur doit sentir
 * qu'il lui reste peu sans jamais rien lire.
 */
export class Ambience {
  private bed: AudioBufferSourceNode | null = null
  private bedGain: GainNode | null = null
  private bedFilter: BiquadFilterNode | null = null
  private out: GainNode | null = null

  private nextStep = 0
  private leftFoot = true
  private dogDone = false
  private gateDone = false

  start(): void {
    const ctx = audio()
    const master = bus()
    const buffer = noiseBuffer()
    if (!ctx || !master || !buffer) return
    this.stop()

    this.out = ctx.createGain()
    this.out.gain.value = 1
    this.out.connect(master)

    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 190
    lp.Q.value = 0.4

    const g = ctx.createGain()
    g.gain.value = 0.03

    src.connect(lp).connect(g).connect(this.out)
    src.start(0, Math.random() * 0.5)

    this.bed = src
    this.bedGain = g
    this.bedFilter = lp
    this.nextStep = ctx.currentTime + 4
    this.leftFoot = true
    this.dogDone = false
    this.gateDone = false
  }

  /** Appelé quelques fois par seconde. `progress` va de 0 à 1 sur la durée de la ronde. */
  update(progress: number): void {
    const ctx = audio()
    if (!ctx || !this.out || !this.bedGain || !this.bedFilter) return
    const t = ctx.currentTime
    const p = Math.max(0, Math.min(1, progress))

    // La pièce se resserre : le lit monte et s'ouvre un peu vers l'aigu.
    this.bedGain.gain.setTargetAtTime(0.03 + p * 0.05, t, 0.6)
    this.bedFilter.frequency.setTargetAtTime(190 + p * 260, t, 0.6)

    // Les pas ne commencent pas tout de suite : le début est calme, c'est ce
    // qui rend la suite lisible.
    if (p > 0.16 && t >= this.nextStep) {
      const closeness = (p - 0.16) / 0.84
      this.step(ctx, closeness)
      const interval = 1.9 - closeness * 1.25
      this.nextStep = t + interval * (this.leftFoot ? 1 : 0.92)
      this.leftFoot = !this.leftFoot
    }

    if (!this.dogDone && p > 0.52) {
      this.dogDone = true
      this.dog(ctx)
    }
    if (!this.gateDone && p > 0.84) {
      this.gateDone = true
      this.metalGate(ctx)
    }
  }

  /** Un pas. Sourd sur la moquette, avec un rien de talon quand il se rapproche. */
  private step(ctx: AudioContext, closeness: number): void {
    const out = this.out
    const buffer = noiseBuffer()
    if (!out || !buffer) return
    const t = ctx.currentTime + Math.random() * 0.02
    const level = 0.05 + closeness * 0.28

    const src = ctx.createBufferSource()
    src.buffer = buffer
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(220 + closeness * 700, t)
    lp.frequency.exponentialRampToValueAtTime(120, t + 0.16)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(level, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    src.connect(lp).connect(g).connect(out)
    src.start(t, Math.random() * 0.5)
    src.stop(t + 0.22)

    const thud = ctx.createOscillator()
    thud.type = 'sine'
    thud.frequency.setValueAtTime(88, t)
    thud.frequency.exponentialRampToValueAtTime(52, t + 0.14)
    const tg = ctx.createGain()
    tg.gain.setValueAtTime(0.0001, t)
    tg.gain.exponentialRampToValueAtTime(level * 0.8, t + 0.01)
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
    thud.connect(tg).connect(out)
    thud.start(t)
    thud.stop(t + 0.24)
  }

  /** Un chien, dehors, deux aboiements. Il n'a rien vu, mais il a entendu. */
  private dog(ctx: AudioContext): void {
    const out = this.out
    const buffer = noiseBuffer()
    if (!out || !buffer) return
    for (let i = 0; i < 2; i++) {
      const t = ctx.currentTime + 0.05 + i * 0.34
      const src = ctx.createBufferSource()
      src.buffer = buffer
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.setValueAtTime(620, t)
      bp.frequency.exponentialRampToValueAtTime(260, t + 0.16)
      bp.Q.value = 2.4
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.015)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
      src.connect(bp).connect(g).connect(out)
      src.start(t, Math.random() * 0.5)
      src.stop(t + 0.24)
    }
  }

  /** Le rideau de fer qu'on secoue. Il est devant la porte. */
  private metalGate(ctx: AudioContext): void {
    const out = this.out
    const buffer = noiseBuffer()
    if (!out || !buffer) return
    const t = ctx.currentTime + 0.05
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2200
    bp.Q.value = 1.1
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
    src.connect(bp).connect(g).connect(out)
    src.start(t, Math.random() * 0.5)
    src.stop(t + 1)
  }

  stop(): void {
    const ctx = audio()
    if (this.bed) {
      try {
        this.bed.stop(ctx ? ctx.currentTime + 0.02 : 0)
      } catch {
        // déjà arrêtée
      }
    }
    this.bed = null
    this.bedGain = null
    this.bedFilter = null
    if (this.out && ctx) {
      this.out.gain.setTargetAtTime(0, ctx.currentTime, 0.1)
      const dying = this.out
      setTimeout(() => dying.disconnect(), 600)
    }
    this.out = null
  }
}
