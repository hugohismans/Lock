import { DIAL, NOTCH_DEG } from '../tuning'
import type { Dir } from '../types'

const TAU = Math.PI * 2
const DEG = 180 / Math.PI

/** Ramène un écart d'angle dans ]-180, 180]. */
function wrap180(d: number): number {
  return d - 360 * Math.floor((d + 180) / 360)
}

/** Modulo positif. */
export function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

/** Coefficient d'un passe-bas du premier ordre pour une coupure donnée. */
function emaAlpha(cutoffHz: number, dt: number): number {
  return 1 - Math.exp(-TAU * cutoffHz * dt)
}

export interface DialReading {
  /** Rotation physique du téléphone, déroulée (pas de saut à ±180°). */
  wristDeg: number
  /** Rotation du cadran, déroulée. wristDeg × GEAR_RATIO. */
  dialDeg: number
  /** Cran courant, 0..39. */
  notch: number
  /** Crans franchis depuis la lecture précédente, dans l'ordre de passage. */
  crossings: number[]
  /** Vitesse signée, en degrés de cadran par seconde. */
  speed: number
  /** Sens confirmé. */
  dir: Dir
  /** Inclinaison avant/arrière, -1..1. Sert au rendu, jamais à la serrure. */
  pitch: number
  /** false quand le téléphone est trop à plat pour que l'angle ait un sens. */
  usable: boolean
}

/**
 * Traduit le vecteur gravité en position de cadran.
 *
 * On dérive l'angle de la gravité, pas de la boussole : `alpha` dérive et n'est
 * pas cohérent d'un appareil à l'autre, alors que atan2(gx, gy) est stable et
 * ne demande aucune calibration.
 *
 * Note sur iOS : Safari renvoie accelerationIncludingGravity avec le signe
 * opposé à la spec. Or atan2(-x, -y) = atan2(x, y) ± 180° : c'est un décalage
 * constant, pas une inversion du sens de rotation. Comme on ne lit que des
 * rotations relatives, il n'y a rien à corriger.
 */
export class Dial {
  private gx = 0
  private gy = 0
  private gz = 0
  private primed = false

  private lastAngle = 0
  private wrist = 0
  private speedRaw = 0

  /** Cran courant en valeur déroulée (peut sortir de [0,40[ ; on module à la lecture). */
  private notchUnwrapped = 0
  private notchPrimed = false

  private dirState: Dir = 0
  private dirCandidate: Dir = 0
  private dirCandidateMs = 0

  /**
   * @param gx composante x de accelerationIncludingGravity
   * @param gy composante y
   * @param gz composante z
   * @param dt secondes écoulées depuis l'échantillon précédent
   */
  update(gx: number, gy: number, gz: number, dt: number): DialReading {
    if (!this.primed) {
      this.gx = gx
      this.gy = gy
      this.gz = gz
      this.primed = true
    } else {
      const a = emaAlpha(DIAL.GRAVITY_CUTOFF_HZ, dt)
      this.gx += (gx - this.gx) * a
      this.gy += (gy - this.gy) * a
      this.gz += (gz - this.gz) * a
    }

    const norm = Math.hypot(this.gx, this.gy, this.gz) || 1
    const flatness = Math.abs(this.gz) / norm
    const usable = flatness < DIAL.FLAT_LIMIT
    const pitch = Math.max(-1, Math.min(1, this.gz / norm))

    const angle = Math.atan2(this.gx, this.gy) * DEG

    if (!this.notchPrimed) {
      this.lastAngle = angle
      this.notchUnwrapped = Math.floor((this.wrist * DIAL.GEAR_RATIO) / NOTCH_DEG)
      this.notchPrimed = true
    }

    // Le poignet ne bouge pas tant que la lecture n'a pas de sens : sinon
    // reposer le téléphone à plat ferait défiler le cadran n'importe comment.
    const delta = usable ? wrap180(angle - this.lastAngle) : 0
    this.lastAngle = angle
    this.wrist += delta

    const dialDeg = this.wrist * DIAL.GEAR_RATIO
    const instantSpeed = dt > 0 ? (delta * DIAL.GEAR_RATIO) / dt : 0
    this.speedRaw += (instantSpeed - this.speedRaw) * emaAlpha(DIAL.SPEED_CUTOFF_HZ, dt)

    const crossings = this.advanceNotches(dialDeg)
    const dir = this.resolveDir(dt)

    return {
      wristDeg: this.wrist,
      dialDeg,
      notch: mod(this.notchUnwrapped, DIAL.NOTCH_COUNT),
      crossings,
      speed: this.speedRaw,
      dir,
      pitch,
      usable
    }
  }

  /**
   * Fait avancer le cran courant jusqu'à rattraper l'angle, avec hystérésis.
   * La boucle gère les mouvements rapides qui franchissent plusieurs crans
   * entre deux échantillons.
   */
  private advanceNotches(dialDeg: number): number[] {
    const h = DIAL.NOTCH_HYSTERESIS_DEG
    const crossings: number[] = []
    // Garde-fou : un saut absurde (capteur qui repart, onglet réveillé) ne doit
    // pas produire mille tics d'un coup.
    let guard = 64
    for (;;) {
      if (dialDeg > (this.notchUnwrapped + 1) * NOTCH_DEG + h) this.notchUnwrapped++
      else if (dialDeg < this.notchUnwrapped * NOTCH_DEG - h) this.notchUnwrapped--
      else break
      crossings.push(mod(this.notchUnwrapped, DIAL.NOTCH_COUNT))
      if (--guard <= 0) break
    }
    return crossings
  }

  /** Sens confirmé : il faut tenir DIR_CONFIRM_MS au-delà de la zone morte. */
  private resolveDir(dt: number): Dir {
    const s = this.speedRaw
    const candidate: Dir = s > DIAL.DIR_DEADZONE_DPS ? 1 : s < -DIAL.DIR_DEADZONE_DPS ? -1 : 0

    if (candidate === this.dirState) {
      this.dirCandidate = candidate
      this.dirCandidateMs = 0
      return this.dirState
    }
    if (candidate !== this.dirCandidate) {
      this.dirCandidate = candidate
      this.dirCandidateMs = 0
    }
    this.dirCandidateMs += dt * 1000
    // Retomber à l'arrêt est immédiat ; s'engager dans un sens demande confirmation.
    if (candidate === 0 || this.dirCandidateMs >= DIAL.DIR_CONFIRM_MS) {
      this.dirState = candidate
      this.dirCandidateMs = 0
    }
    return this.dirState
  }
}
