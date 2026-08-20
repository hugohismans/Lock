export interface ThreatView {
  /** Position à l'écran du pied de la porte (peut être hors champ). */
  x: number
  y: number
  /** Largeur de la porte à l'écran. */
  width: number
  /** 0 → 1 sur la durée de la ronde. */
  progress: number
  viewW: number
  viewH: number
}

const RONDE = '110, 127, 134'

/**
 * La ronde. Elle n'est jamais un nombre : c'est une lumière froide qui grandit
 * sous la porte, au fond du noir. Comme c'est une source et non un objet
 * éclairé, elle reste visible en dehors du faisceau — et quand le joueur
 * regarde ailleurs, elle continue de mordre par le bord de l'écran.
 */
export function drawThreat(ctx: CanvasRenderingContext2D, v: ThreatView): void {
  const p = Math.max(0, Math.min(1, v.progress))
  if (p <= 0.02) return
  // Montée non linéaire : longtemps rien, puis tout d'un coup trop.
  const glow = Math.pow(p, 1.8)

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  // La flaque sous la porte.
  const h = 14 + glow * 90
  const w = v.width * (0.7 + glow * 0.6)
  const pool = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, w)
  pool.addColorStop(0, `rgba(${RONDE},${0.30 * glow + 0.05})`)
  pool.addColorStop(0.45, `rgba(${RONDE},${0.12 * glow})`)
  pool.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = pool
  ctx.save()
  ctx.translate(v.x, v.y)
  ctx.scale(1, h / w)
  ctx.translate(-v.x, -v.y)
  ctx.beginPath()
  ctx.arc(v.x, v.y, w, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Le trait net du jour sous la porte.
  ctx.globalAlpha = 0.5 + glow * 0.5
  const slit = ctx.createLinearGradient(v.x - v.width / 2, 0, v.x + v.width / 2, 0)
  slit.addColorStop(0, 'rgba(0,0,0,0)')
  slit.addColorStop(0.5, `rgba(${RONDE},${0.22 + 0.5 * glow})`)
  slit.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = slit
  ctx.fillRect(v.x - v.width / 2, v.y - 2 - glow * 3, v.width, 3 + glow * 5)
  ctx.globalAlpha = 1

  // Le débord : même en regardant ailleurs, on la sent arriver par le bord.
  const off = v.x < 0 ? -1 : v.x > v.viewW ? 1 : 0
  if (off !== 0) {
    const edgeX = off < 0 ? 0 : v.viewW
    const spill = ctx.createLinearGradient(edgeX, 0, edgeX - off * v.viewW * 0.34, 0)
    spill.addColorStop(0, `rgba(${RONDE},${0.13 + 0.4 * glow})`)
    spill.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = spill
    ctx.fillRect(0, 0, v.viewW, v.viewH)
  }

  ctx.restore()

  // Tout à la fin, la pièce entière se refroidit.
  if (p > 0.8) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = (p - 0.8) * 0.4
    ctx.fillStyle = `rgb(${RONDE})`
    ctx.fillRect(0, 0, v.viewW, v.viewH)
    ctx.restore()
  }
}
