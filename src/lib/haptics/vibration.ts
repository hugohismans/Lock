import { FEEDBACK } from '../tuning'
import type { Channel, GateKind } from '../types'
import { vibrationPattern } from './envelope'
import type { Haptics, MechanismEvent } from './index'

/**
 * Vibration native. L'API est binaire — aucun contrôle d'amplitude — donc
 * l'égalité d'énergie entre vraie et fausse gorge n'y est qu'approchée :
 * la fausse dure autant et vibre presque autant, mais on ne peut pas
 * compenser ses trous en montant le niveau. Le canal audio, lui, le fait
 * exactement (voir envelope.ts).
 */
export class VibrationHaptics implements Haptics {
  readonly channel: Channel = 'vibration'

  private buzz(pattern: number | number[]): void {
    try {
      navigator.vibrate(pattern)
    } catch {
      // Certains navigateurs refusent hors interaction : on ne casse pas la partie.
    }
  }

  tick(): void {
    this.buzz(FEEDBACK.TICK_MS)
  }

  gate(kind: GateKind): void {
    this.buzz(vibrationPattern(kind))
  }

  mechanism(e: MechanismEvent): void {
    if (e === 'locked') this.buzz([FEEDBACK.LOCKED_MS])
    else if (e === 'lost') this.buzz([26, 40, 26, 40, FEEDBACK.LOST_MS])
    else this.buzz([320, 90, 520])
  }

  dispose(): void {
    this.buzz(0)
  }
}
