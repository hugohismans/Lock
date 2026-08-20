import { RENDER } from '../lib/tuning'

export interface BeamPose {
  cx: number
  cy: number
  rx: number
  ry: number
  /** 0 = éteint (téléphone à plat), 1 = plein. */
  intensity: number
}

interface Dust {
  /** Coordonnées relatives au faisceau, en fraction de son rayon. */
  x: number
  y: number
  z: number
  r: number
  drift: number
}

/**
 * Le faisceau. La quasi-totalité de l'écran est dans le noir absolu ; la
 * seule zone éclairée est cette ellipse, et elle est mécaniquement liée au
 * geste de crochetage. Le même mouvement sert à crocheter et à voir.
 */
export class Beam {
  private scratch = document.createElement('canvas')
  private dust: Dust[] = []
  private flicker = 0

  constructor() {
    for (let i = 0; i < RENDER.DUST_COUNT; i++) {
      this.dust.push({
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1,
        z: 0.3 + Math.random() * 0.7,
        r: 0.6 + Math.random() * 1.4,
        drift: 0.04 + Math.random() * 0.1
      })
    }
  }

  resize(w: number, h: number): void {
    this.scratch.width = w
    this.scratch.height = h
  }

  /**
   * @param paint dessine la pièce dans le contexte fourni (le Scene sait le faire)
   */
  draw(
    ctx: CanvasRenderingContext2D,
    paint: (target: CanvasRenderingContext2D) => void,
    pose: BeamPose,
    dt: number
  ): void {
    if (pose.intensity <= 0.001) return
    const sc = this.scratch.getContext('2d')
    if (!sc) return

    // Une lampe torche de 1974 n'est pas une LED : elle bat très légèrement.
    this.flicker += dt * 3.1
    const flick = 1 + Math.sin(this.flicker) * 0.018 + Math.sin(this.flicker * 2.7) * 0.012
    const alpha = pose.intensity * flick

    sc.setTransform(1, 0, 0, 1, 0, 0)
    sc.clearRect(0, 0, this.scratch.width, this.scratch.height)
    paint(sc)

    // Le masque : c'est lui qui fait la lumière.
    sc.globalCompositeOperation = 'destination-in'
    const mask = sc.createRadialGradient(pose.cx, pose.cy, 0, pose.cx, pose.cy, pose.rx)
    // Un cœur chaud, puis une chute rapide : c'est ce qui fait lire un
    // faisceau plutôt qu'un vignettage.
    mask.addColorStop(0, 'rgba(255,255,255,1)')
    mask.addColorStop(0.44, 'rgba(255,255,255,0.98)')
    mask.addColorStop(0.7, 'rgba(255,255,255,0.66)')
    mask.addColorStop(0.88, 'rgba(255,255,255,0.22)')
    mask.addColorStop(1, 'rgba(255,255,255,0)')
    sc.fillStyle = mask
    sc.save()
    sc.translate(pose.cx, pose.cy)
    sc.scale(1, pose.ry / pose.rx)
    sc.translate(-pose.cx, -pose.cy)
    sc.beginPath()
    sc.arc(pose.cx, pose.cy, pose.rx, 0, Math.PI * 2)
    sc.fill()
    sc.restore()
    sc.globalCompositeOperation = 'source-over'

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.drawImage(this.scratch, 0, 0)
    ctx.restore()

    // La lumière elle-même, par-dessus ce qu'elle éclaire : jaune pâle et sale.
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = alpha * 0.3
    const glow = ctx.createRadialGradient(pose.cx, pose.cy, 0, pose.cx, pose.cy, pose.rx)
    glow.addColorStop(0, 'rgba(232,212,168,0.62)')
    glow.addColorStop(0.26, 'rgba(216,186,132,0.3)')
    glow.addColorStop(0.6, 'rgba(180,146,96,0.1)')
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.translate(pose.cx, pose.cy)
    ctx.scale(1, pose.ry / pose.rx)
    ctx.translate(-pose.cx, -pose.cy)
    ctx.beginPath()
    ctx.arc(pose.cx, pose.cy, pose.rx, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    this.drawDust(ctx, pose, alpha, dt)
  }

  /** La poussière dans le rai. C'est ce détail qui fait que la lumière a un volume. */
  private drawDust(ctx: CanvasRenderingContext2D, pose: BeamPose, alpha: number, dt: number): void {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const d of this.dust) {
      d.y += d.drift * dt
      d.x += Math.sin((d.y + d.z) * 3.4) * 0.012 * dt
      if (d.y > 1.1) {
        d.y = -1.1
        d.x = Math.random() * 2 - 1
      }
      const dist = Math.hypot(d.x, d.y)
      if (dist > 1) continue
      const px = pose.cx + d.x * pose.rx
      const py = pose.cy + d.y * pose.ry
      ctx.globalAlpha = alpha * (1 - dist) * 0.5 * d.z
      ctx.fillStyle = 'rgba(232,212,168,0.9)'
      ctx.beginPath()
      ctx.arc(px, py, d.r * d.z, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
}
