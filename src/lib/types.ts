/** Sens de rotation du cadran. 0 = immobile. */
export type Dir = -1 | 0 | 1

export type GateKind = 'true' | 'false'

/** Ce que la serrure a à dire au reste du monde. Aucune référence au DOM. */
export type LockEvent =
  | { t: 'tick'; notch: number }
  | { t: 'gate'; kind: GateKind; notch: number }
  | { t: 'digitLocked'; index: number }
  | { t: 'digitLost'; index: number }
  | { t: 'opened' }

/** Canal de feedback branché sur la serrure. Le jeu ne sait pas lequel tourne. */
export type Channel = 'audible' | 'vibration' | 'audio-low'
