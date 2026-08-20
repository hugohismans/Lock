import { RENDER } from '../lib/tuning'
import type { RoomId } from '../lib/levels'
import { Beam } from './beam'
import { makeGrainTiles } from './grain'
import { ROOM_LAYOUT, ROOM_SIZE, paintRoom, roomScale } from './room'
import { drawThreat } from './threat'

/**
 * Ce que la scène lit. Objet mutable ordinaire : la boucle de rendu vit hors
 * du cycle réactif de Svelte, sinon on paierait une invalidation par image.
 */
export interface SceneState {
  /** Rotation du cadran, déroulée. Un tour de cadran = un tour de pièce. */
  dialDeg: number
  /** Inclinaison avant/arrière, -1..1. */
  pitch: number
  /** false quand le téléphone est à plat : la torche meurt, le joueur redresse. */
  usable: boolean
  /** Avancée de la ronde, 0..1. */
  threat: number
  /** Chiffres verrouillés, et combien il en faut. */
  marks: number
  markTotal: number
  /** Le coffre est ouvert : le noir se lève. */
  opened: boolean
}

export function makeSceneState(markTotal: number): SceneState {
  return { dialDeg: 0, pitch: 0, usable: true, threat: 0, marks: 0, markTotal, opened: false }
}

export class Scene {
  private ctx: CanvasRenderingContext2D | null
  private room: HTMLCanvasElement | null = null
  private roomRaster = 1
  private beam = new Beam()
  private grain: HTMLCanvasElement[] = []
  private grainPatterns: (CanvasPattern | null)[] = []
  private vignette: HTMLCanvasElement | null = null
  /** Géométrie du panorama à l'écran. Ne dépend que de la taille du canevas. */
  private geom = { scale: 1, roomW: 1, roomH: 1, slack: 0 }

  private raf = 0
  private last = 0
  private frame = 0

  private w = 0
  private h = 0
  private dpr = 1

  /** Valeurs lissées : l'image ne suit jamais le capteur brutalement. */
  private intensity = 0
  private lagX = 0
  private lagY = 0
  private prevPan = 0
  private markGlow: number[] = []
  private openGlow = 0

  /** prefers-reduced-motion : la pièce avance par fragments, en fondu. */
  private fragPan = 0
  private fragFrom = 0
  private fragT = 1

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly roomId: RoomId,
    private readonly state: SceneState,
    private readonly reducedMotion: boolean
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })
    this.grain = makeGrainTiles()
  }

  async start(): Promise<void> {
    // Les plaques gravées sont dessinées en Bodoni : il faut que la fonte soit
    // là avant de cuire le panorama, sinon la pièce se peint en Times.
    try {
      await document.fonts.ready
    } catch {
      // Pas de Font Loading API : on peint quand même.
    }
    this.resize()
    this.last = performance.now()
    this.loop(this.last)
  }

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, RENDER.MAX_DPR)
    const w = Math.round(this.canvas.clientWidth * dpr)
    const h = Math.round(this.canvas.clientHeight * dpr)
    if (w === this.w && h === this.h && this.room) return
    this.grainPatterns = []
    this.w = w
    this.h = h
    this.dpr = dpr
    this.canvas.width = w
    this.canvas.height = h
    this.beam.resize(w, h)

    const raster = roomScale(h)
    if (!this.room || Math.abs(raster - this.roomRaster) > 0.05) {
      this.roomRaster = raster
      this.room = paintRoom(this.roomId, raster)
    }
    this.vignette = this.makeVignette(w, h)
    this.geom = this.measure()
  }

  /** Vignettage extrême, cuit une fois : c'est un dégradé, pas une animation. */
  private makeVignette(w: number, h: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return canvas
    const g = ctx.createRadialGradient(w / 2, h * 0.46, 0, w / 2, h * 0.46, Math.max(w, h) * 0.72)
    g.addColorStop(0, 'rgba(12,10,8,0)')
    g.addColorStop(0.45, 'rgba(12,10,8,0.10)')
    g.addColorStop(0.72, 'rgba(12,10,8,0.62)')
    g.addColorStop(1, 'rgba(12,10,8,0.98)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    return canvas
  }

  /** Échelle du panorama à l'écran, et débattement vertical disponible. */
  private measure(): { scale: number; roomW: number; roomH: number; slack: number } {
    const raster = this.roomRaster
    const roomPxH = ROOM_SIZE.height * raster
    const scale = (this.h * 1.06) / roomPxH
    return {
      scale,
      roomW: ROOM_SIZE.width * raster * scale,
      roomH: roomPxH * scale,
      slack: (roomPxH * scale - this.h) / 2
    }
  }

  private panFor(dialDeg: number): number {
    const { roomW } = this.geom
    return (((dialDeg / 360) * roomW) % roomW + roomW) % roomW
  }

  /** Dessine la pièce, en boucle sur elle-même : le panorama est un cylindre. */
  private paintRoomAt(target: CanvasRenderingContext2D, pan: number, alpha: number): void {
    if (!this.room || alpha <= 0.002) return
    const { roomW, roomH, slack } = this.geom
    const y = -slack + this.state.pitch * slack * 0.9
    target.save()
    target.globalAlpha = alpha
    let x = -((pan % roomW) + roomW) % roomW
    while (x < this.w) {
      target.drawImage(this.room, x, y, roomW, roomH)
      x += roomW
    }
    target.restore()
  }

  private loop = (now: number): void => {
    this.raf = requestAnimationFrame(this.loop)
    const ctx = this.ctx
    if (!ctx) return
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.frame++
    this.resize()

    const view = this.geom
    const roomW = view.roomW
    const target = this.panFor(this.state.dialDeg)

    // Le pan, et l'inertie du poignet qui fait traîner le faisceau.
    let pan = target
    let velocity = 0
    if (this.reducedMotion) {
      const step = roomW / RENDER.REDUCED_FRAGMENTS
      const snapped = Math.round(target / step) * step
      if (Math.abs(snapped - this.fragPan) > 1) {
        this.fragFrom = this.fragPan
        this.fragPan = snapped
        this.fragT = 0
      }
      this.fragT = Math.min(1, this.fragT + (dt * 1000) / RENDER.REDUCED_FADE_MS)
      pan = this.fragPan
    } else {
      let d = target - this.prevPan
      if (d > roomW / 2) d -= roomW
      if (d < -roomW / 2) d += roomW
      velocity = dt > 0 ? d / dt : 0
    }
    this.prevPan = target

    // Intensité : la torche meurt quand le téléphone se met à plat.
    const wanted = this.state.usable ? 1 : 0
    this.intensity += (wanted - this.intensity) * Math.min(1, dt * 4)

    const minSide = Math.min(this.w, this.h)
    const driftTarget = this.reducedMotion
      ? 0
      : Math.max(-1, Math.min(1, (-velocity / (roomW * 0.9)) * 2)) * RENDER.BEAM_DRIFT * minSide
    this.lagX += (driftTarget - this.lagX) * Math.min(1, dt * (1 / Math.max(0.02, RENDER.BEAM_LAG)))
    this.lagY += (this.state.pitch * minSide * 0.05 - this.lagY) * Math.min(1, dt * 3)

    const pose = {
      cx: this.w / 2 + this.lagX,
      cy: this.h * 0.46 + this.lagY,
      rx: minSide * RENDER.BEAM_RADIUS,
      ry: minSide * RENDER.BEAM_RADIUS * RENDER.BEAM_SQUASH,
      intensity: this.intensity
    }

    // 1. Le noir chaud de la pièce.
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = ROOM_SIZE.nuit
    ctx.fillRect(0, 0, this.w, this.h)

    // 2. Un souffle d'ambiante : aucun aplat pur, même dans le noir.
    const paint = (surface: CanvasRenderingContext2D, alpha: number) => {
      if (this.reducedMotion && this.fragT < 1) {
        this.paintRoomAt(surface, this.fragFrom, alpha * (1 - this.fragT))
        this.paintRoomAt(surface, pan, alpha * this.fragT)
      } else {
        this.paintRoomAt(surface, pan, alpha)
      }
    }
    paint(ctx, 0.05 + this.openGlow * 0.25)

    // 3. Le faisceau.
    this.beam.draw(ctx, (surface) => paint(surface, 1), pose, dt)

    // 4. La ronde.
    const layout = ROOM_LAYOUT[this.roomId]
    const unit = this.roomRaster * view.scale
    const doorCentre = (layout.doorX + layout.doorWidth / 2) * unit
    let doorX = doorCentre - pan
    doorX = ((doorX % roomW) + roomW) % roomW
    if (doorX > roomW / 2) doorX -= roomW
    drawThreat(ctx, {
      x: doorX,
      y: -view.slack + layout.doorFootY * unit + this.state.pitch * view.slack * 0.9,
      width: layout.doorWidth * unit,
      progress: this.state.threat,
      viewW: this.w,
      viewH: this.h
    })

    // 5. Les témoins : un point de laiton par chiffre pris.
    this.drawMarks(ctx, dt)

    // 6. Le grain, puis le vignettage.
    this.drawGrain(ctx)
    if (this.vignette) ctx.drawImage(this.vignette, 0, 0)

    if (this.state.opened) this.openGlow = Math.min(1, this.openGlow + dt * 0.5)
  }

  /**
   * Les témoins. Ils ne disent ni quel chiffre, ni la distance au bon : juste
   * ce qui est acquis. Ils s'allument lentement — c'est un reflet, pas une
   * animation d'interface.
   */
  private drawMarks(ctx: CanvasRenderingContext2D, dt: number): void {
    const total = this.state.markTotal
    if (total <= 0) return
    while (this.markGlow.length < total) this.markGlow.push(0)
    const gap = Math.min(this.w * 0.055, 26 * this.dpr)
    const r = Math.max(2, 2.2 * this.dpr)
    const y = this.h - Math.max(26, 30 * this.dpr)
    const x0 = this.w / 2 - ((total - 1) * gap) / 2

    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < total; i++) {
      const wanted = i < this.state.marks ? 1 : 0
      const g = this.markGlow[i] ?? 0
      const next = g + (wanted - g) * Math.min(1, dt * 1.4)
      this.markGlow[i] = next
      if (next < 0.01) continue
      const x = x0 + i * gap
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 6)
      halo.addColorStop(0, `rgba(176,138,74,${0.5 * next})`)
      halo.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(x, y, r * 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = `rgba(232,212,168,${0.85 * next})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  private drawGrain(ctx: CanvasRenderingContext2D): void {
    if (this.grain.length === 0) return
    // Le grain d'une pellicule bat à ~12 images/s, pas à 60.
    const index = this.reducedMotion
      ? 0
      : Math.floor(this.frame / 5) % this.grain.length
    const tile = this.grain[index]
    if (!tile) return
    let pattern = this.grainPatterns[index]
    if (pattern === undefined) {
      pattern = ctx.createPattern(tile, 'repeat')
      this.grainPatterns[index] = pattern
    }
    if (!pattern) return
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = RENDER.GRAIN_ALPHA
    if (!this.reducedMotion) {
      ctx.translate(Math.floor(Math.random() * 64), Math.floor(Math.random() * 64))
    }
    ctx.fillStyle = pattern
    ctx.fillRect(-64, -64, this.w + 128, this.h + 128)
    ctx.restore()
  }
}
