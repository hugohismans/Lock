import type { Channel, GateKind } from '../types'
import { capabilities } from '../platform'
import { AudibleHaptics } from './audible'
import { LowAudioHaptics } from './audioLow'
import { VibrationHaptics } from './vibration'

export type MechanismEvent = 'locked' | 'lost' | 'opened'

/**
 * Le moteur de feedback. Le reste du jeu appelle tick() et gate() sans
 * jamais savoir quel canal est branché derrière.
 */
export interface Haptics {
  readonly channel: Channel
  tick(): void
  gate(kind: GateKind): void
  /** Le mécanisme lui-même : il prend, il glisse, il s'ouvre. */
  mechanism(e: MechanismEvent): void
  dispose(): void
}

/** Ce qu'un niveau demande comme canal, avant de savoir ce que la machine sait faire. */
export type FeedbackRequest = 'audible' | 'silent'

export function resolveChannel(request: FeedbackRequest): Channel {
  if (request === 'audible') return 'audible'
  // Le niveau veut du silence côté serrure. Sur iOS Safari, navigator.vibrate
  // n'existe pas : on bascule sur une impulsion très grave, qu'on ressent
  // dans un casque plus qu'on ne l'entend.
  return capabilities().vibration ? 'vibration' : 'audio-low'
}

export function makeHaptics(channel: Channel): Haptics {
  switch (channel) {
    case 'audible':
      return new AudibleHaptics()
    case 'vibration':
      return new VibrationHaptics()
    case 'audio-low':
      return new LowAudioHaptics()
  }
}
