import { Ambience } from '../lib/audio/ambience'
import { makeHaptics, resolveChannel, type Haptics } from '../lib/haptics'
import type { Level } from '../lib/levels'
import { Lock } from '../lib/lock/lock'
import { makeCombination, makeDecoys } from '../lib/lock/combination'
import { MotionSource } from '../lib/motion/source'
import { capabilities } from '../lib/platform'
import { Scene, makeSceneState, type SceneState } from '../render/Scene'
import type { Channel } from '../lib/types'

export type Outcome = 'opened' | 'busted'

export interface SessionHandlers {
  onEnd: (outcome: Outcome) => void
  /** Le capteur ne dit rien : permission accordée mais rien n'arrive. */
  onNoMotion: () => void
}

/**
 * Une partie : elle branche le capteur sur la serrure, la serrure sur le
 * moteur de feedback, et la ronde sur l'image. C'est le seul endroit du
 * projet où les trois couches se voient.
 */
export class Session {
  readonly sceneState: SceneState
  readonly channel: Channel

  private readonly combo: readonly number[]
  private readonly lock: Lock
  private readonly haptics: Haptics
  private readonly ambience = new Ambience()
  private readonly motion: MotionSource
  private scene: Scene | null = null

  private tick: number | null = null
  private endTimer: number | null = null
  private elapsed = 0
  private lastTickAt = 0
  private started = false
  private finished = false

  constructor(
    private readonly level: Level,
    private readonly canvas: HTMLCanvasElement,
    private readonly handlers: SessionHandlers
  ) {
    const rng = Math.random
    const combo = makeCombination(level.digits, rng)
    const decoys =
      level.decoysPerDigit > 0 ? makeDecoys(combo, level.decoysPerDigit, rng) : []

    this.combo = combo
    this.lock = new Lock(combo, decoys)
    this.channel = resolveChannel(level.feedback)
    this.haptics = makeHaptics(this.channel)
    this.sceneState = makeSceneState(level.digits)
    this.motion = new MotionSource(
      (r) => this.onReading(r),
      () => this.handlers.onNoMotion()
    )
  }

  async start(): Promise<void> {
    this.scene = new Scene(
      this.canvas,
      this.level.room,
      this.sceneState,
      capabilities().reducedMotion
    )
    await this.scene.start()
    this.ambience.start()
    this.motion.start()
    document.addEventListener('visibilitychange', this.onVisibility)
    this.lastTickAt = performance.now()
    this.tick = window.setInterval(this.onTick, 100)
    this.exposeForTuning()
  }

  stop(): void {
    this.finished = true
    if (this.tick !== null) clearInterval(this.tick)
    this.tick = null
    if (this.endTimer !== null) clearTimeout(this.endTimer)
    this.endTimer = null
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.motion.stop()
    this.scene?.stop()
    this.ambience.stop()
    this.haptics.dispose()
  }

  /**
   * En développement seulement : de quoi régler le feel sans jouer une partie
   * entière. `casse.ronde(0.9)` avance la ronde, `casse.combinaison` donne les
   * chiffres à trouver.
   */
  private exposeForTuning(): void {
    if (!import.meta.env.DEV) return
    Object.assign(window, {
      casse: {
        combinaison: this.combo,
        canal: this.channel,
        etat: this.sceneState,
        ronde: (p: number) => {
          this.elapsed = Math.max(0, Math.min(1, p)) * this.level.roundMs
          this.started = true
        }
      }
    })
  }

  private onVisibility = (): void => {
    // Onglet caché : la ronde s'arrête aussi. On ne perd pas une partie dans sa poche.
    this.lastTickAt = performance.now()
  }

  private onReading(r: {
    dialDeg: number
    notch: number
    crossings: number[]
    speed: number
    dir: -1 | 0 | 1
    pitch: number
    usable: boolean
  }): void {
    if (this.finished) return
    this.sceneState.dialDeg = r.dialDeg
    this.sceneState.pitch = r.pitch
    this.sceneState.usable = r.usable
    if (!r.usable) return

    // La ronde ne part qu'au premier geste : on ne punit pas la lecture du brief.
    if (!this.started && r.dir !== 0) {
      this.started = true
      this.lastTickAt = performance.now()
    }

    for (const event of this.lock.step(r)) {
      switch (event.t) {
        case 'tick':
          this.haptics.tick()
          break
        case 'gate':
          this.haptics.gate(event.kind)
          break
        case 'digitLocked':
          this.sceneState.marks = this.lock.snapshot().index
          this.haptics.mechanism('locked')
          break
        case 'digitLost':
          this.haptics.mechanism('lost')
          break
        case 'opened':
          this.sceneState.marks = this.level.digits
          this.sceneState.opened = true
          this.haptics.mechanism('opened')
          this.end('opened')
          break
      }
    }
  }

  private onTick = (): void => {
    const now = performance.now()
    const dt = now - this.lastTickAt
    this.lastTickAt = now
    if (this.finished) return
    if (this.started && document.visibilityState === 'visible') {
      this.elapsed = Math.min(this.level.roundMs, this.elapsed + dt)
    }
    const progress = this.elapsed / this.level.roundMs
    this.sceneState.threat = progress
    this.ambience.update(progress)
    if (progress >= 1) this.end('busted')
  }

  private end(outcome: Outcome): void {
    if (this.finished) return
    this.finished = true
    if (this.tick !== null) clearInterval(this.tick)
    this.tick = null
    this.motion.stop()
    // On laisse le son finir sa phrase avant de couper l'image.
    const hold = outcome === 'opened' ? 1500 : 900
    this.endTimer = window.setTimeout(() => {
      this.endTimer = null
      this.scene?.stop()
      this.ambience.stop()
      document.removeEventListener('visibilitychange', this.onVisibility)
      this.handlers.onEnd(outcome)
    }, hold)
  }
}
