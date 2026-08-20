import { Dial, type DialReading } from '../lock/dial'

export type MotionStatus = 'idle' | 'running' | 'no-data'

/**
 * Source de mouvement : écoute devicemotion, filtre, et pousse une lecture de
 * cadran à chaque échantillon. On traite la serrure ici plutôt que dans la
 * boucle de rendu : c'est le chemin le plus court entre le poignet et le
 * feedback, et cette latence-là est tout le jeu.
 */
export class MotionSource {
  private readonly dial = new Dial()
  private last = 0
  private samples = 0
  private handler: ((e: DeviceMotionEvent) => void) | null = null
  private probe: number | null = null

  status: MotionStatus = 'idle'

  constructor(
    private readonly onReading: (r: DialReading) => void,
    /** Appelé si aucun échantillon n'arrive : permission accordée mais capteur muet. */
    private readonly onNoData: () => void
  ) {}

  start(): void {
    if (this.handler) return
    this.status = 'running'
    this.samples = 0
    this.last = 0

    this.handler = (e: DeviceMotionEvent) => {
      const g = e.accelerationIncludingGravity
      if (!g || g.x === null || g.y === null || g.z === null) return
      const now = performance.now()
      const dt = this.last === 0 ? 1 / 60 : Math.min(0.1, (now - this.last) / 1000)
      this.last = now
      this.samples++
      if (dt <= 0) return
      this.onReading(this.dial.update(g.x, g.y, g.z, dt))
    }
    window.addEventListener('devicemotion', this.handler)

    this.probe = window.setTimeout(() => {
      if (this.samples === 0) {
        this.status = 'no-data'
        this.onNoData()
      }
    }, 1800)
  }

  stop(): void {
    if (this.handler) window.removeEventListener('devicemotion', this.handler)
    this.handler = null
    if (this.probe !== null) clearTimeout(this.probe)
    this.probe = null
    this.status = 'idle'
  }
}
