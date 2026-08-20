import { DIAL } from '../tuning'
import type { Dir, LockEvent } from '../types'

export interface LockInput {
  /** Crans franchis depuis le pas précédent, dans l'ordre. */
  crossings: readonly number[]
  /** Cran courant. */
  notch: number
  /** Vitesse signée, degrés de cadran par seconde. */
  speed: number
  /** Sens confirmé. */
  dir: Dir
}

export interface LockSnapshot {
  index: number
  digits: number
  status: 'searching' | 'opened'
}

/**
 * La serrure. Modèle pur : aucune référence au DOM, à l'audio ou au temps réel.
 * On lui pousse des lectures de cadran, elle rend des événements.
 *
 * Règle, authentique et valable dès le premier niveau : on cherche un chiffre
 * en tournant dans un sens, puis on inverse le sens pour le valider et partir
 * en chasse du suivant. Inverser ailleurs que sur une gorge fait perdre la
 * progression du chiffre en cours — pas toute la combinaison.
 */
export class Lock {
  private readonly combo: readonly number[]
  private readonly decoys: readonly (readonly number[])[]

  private index = 0
  /** Sens dans lequel il faut chercher le chiffre courant. 0 = pas encore engagé. */
  private requiredDir: Dir = 0
  /**
   * Dernier cran occupé en allant dans le bon sens : c'est là qu'on est
   * « posé » au moment d'inverser. Le comparer au chiffre cherché est
   * exactement la sémantique physique du geste (« je m'arrête dessus, je repars »).
   */
  private restNotch = -1
  /** false après une perte : plus de gorge et plus de pénalité tant qu'on n'a pas repris le bon sens. */
  private armed = true
  private opened = false

  constructor(combo: readonly number[], decoys: readonly (readonly number[])[] = []) {
    this.combo = combo
    this.decoys = decoys
  }

  snapshot(): LockSnapshot {
    return {
      index: this.index,
      digits: this.combo.length,
      status: this.opened ? 'opened' : 'searching'
    }
  }

  step(input: LockInput): LockEvent[] {
    if (this.opened) return []
    const events: LockEvent[] = []
    const target = this.combo[this.index]
    if (target === undefined) return events

    // Un cran franchi alors qu'on ne va pas à contresens compte comme une
    // position « visitée » : c'est celle-là qu'on validera en inversant.
    const goingRight = this.requiredDir === 0 || input.dir !== -this.requiredDir

    for (const notch of input.crossings) {
      if (goingRight) this.restNotch = notch
      events.push(this.crossing(notch, target, input.speed, goingRight))
    }

    events.push(...this.resolveDirection(input, target))
    return events
  }

  /** Tic, ou gorge si toutes les conditions de perception sont réunies. */
  private crossing(notch: number, target: number, speed: number, goingRight: boolean): LockEvent {
    const slow = Math.abs(speed) < DIAL.GATE_MAX_SPEED_DPS
    if (!slow || !this.armed || !goingRight) return { t: 'tick', notch }
    if (notch === target) return { t: 'gate', kind: 'true', notch }
    const decoys = this.decoys[this.index]
    if (decoys && decoys.includes(notch)) return { t: 'gate', kind: 'false', notch }
    return { t: 'tick', notch }
  }

  private resolveDirection(input: LockInput, target: number): LockEvent[] {
    const dir = input.dir
    if (dir === 0) return []

    // Premier engagement : le sens de départ est libre, il fixe l'alternance.
    if (this.requiredDir === 0) {
      this.requiredDir = dir
      this.restNotch = input.notch
      return []
    }

    if (dir === this.requiredDir) {
      // Retour dans le bon sens après une perte : on se réarme, sans récompense.
      if (!this.armed) {
        this.armed = true
        this.restNotch = input.notch
      }
      return []
    }

    // Ici : dir === -requiredDir, une inversion.
    if (!this.armed) return [] // punitif, pas cruel : on ne double pas la peine

    if (this.restNotch === target) {
      const index = this.index
      this.index++
      this.requiredDir = dir // alternance obligatoire
      this.restNotch = input.notch
      const events: LockEvent[] = [{ t: 'digitLocked', index }]
      if (this.index >= this.combo.length) {
        this.opened = true
        events.push({ t: 'opened' })
      }
      return events
    }

    this.armed = false
    return [{ t: 'digitLost', index: this.index }]
  }
}
