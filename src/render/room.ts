import { RENDER } from '../lib/tuning'
import type { RoomId } from '../lib/levels'

/**
 * La pièce, dessinée une fois par niveau dans un canevas hors écran, en
 * panorama cylindrique : un tour de cadran = un tour de pièce.
 *
 * Conséquence de design assumée : le décor devient un système de repères.
 * Quand le joueur a senti une gorge « vers la plaque de laiton », il peut y
 * revenir. La combinaison étant tirée à chaque partie, rien ne s'apprend
 * d'une partie sur l'autre — mais tout se retient à l'intérieur d'une partie,
 * et c'est ce qui rend la perte d'un chiffre supportable.
 *
 * Le panorama est peint comme s'il était déjà sous la torche : c'est le
 * masque du faisceau qui décide de ce qu'on en voit, pas son éclairage.
 *
 * Règle de composition : aucune zone de la largeur d'un faisceau ne doit être
 * vide. Quand le joueur ralentit pour sentir une gorge, l'image s'arrête sur
 * quelque chose — c'est ce qu'il fixera pendant les quatre secondes de doute.
 */

const W = RENDER.ROOM_WIDTH
const H = RENDER.ROOM_HEIGHT

/** Bruit déterministe : la pièce doit être identique à chaque redessin. */
function prng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

type Rnd = () => number

const NUIT = '#0C0A08'
const LAITON = '#B08A4A'
const TORCHE = '#E8D4A8'

/** Salissure générale : aucun aplat pur ne survit à cette passe. */
function soil(ctx: CanvasRenderingContext2D, rnd: Rnd, count: number): void {
  ctx.save()
  for (let i = 0; i < count; i++) {
    const x = rnd() * W
    const y = rnd() * H
    const r = 10 + rnd() * 110
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const dark = rnd() > 0.42
    g.addColorStop(0, dark ? 'rgba(8,6,5,0.26)' : 'rgba(150,120,80,0.09)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  ctx.restore()
}

/** Ombre portée sous un objet : c'est ce qui le décolle du mur. */
function contact(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h = 26): void {
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, 'rgba(6,5,4,0.72)')
  g.addColorStop(1, 'rgba(6,5,4,0)')
  ctx.fillStyle = g
  ctx.fillRect(x, y, w, h)
}

function wall(ctx: CanvasRenderingContext2D, rnd: Rnd): void {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#1B140E')
  g.addColorStop(0.3, '#3B2E20')
  g.addColorStop(0.62, '#54422D')
  g.addColorStop(0.76, '#4B3A28')
  g.addColorStop(0.79, '#2A2118')
  g.addColorStop(1, '#191309')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // Papier peint rayé, fané. Presque invisible, mais l'œil le sent.
  ctx.save()
  ctx.globalAlpha = 0.1
  for (let x = 0; x < W; x += 24) {
    ctx.fillStyle = x % 48 === 0 ? '#7a613f' : '#0b0806'
    ctx.fillRect(x, 0, 12, H * 0.77)
  }
  ctx.restore()

  // Plinthe, puis moquette.
  ctx.fillStyle = '#2A2119'
  ctx.fillRect(0, H * 0.755, W, 14)
  ctx.fillStyle = 'rgba(232,212,168,0.10)'
  ctx.fillRect(0, H * 0.755, W, 2)
  contact(ctx, 0, H * 0.769, W, 22)

  ctx.save()
  ctx.globalAlpha = 0.55
  for (let i = 0; i < 7000; i++) {
    const y = H * 0.78 + rnd() * H * 0.22
    const depth = (y - H * 0.78) / (H * 0.22)
    ctx.fillStyle = rnd() > 0.45 ? `rgba(120,96,64,${0.3 - depth * 0.2})` : 'rgba(0,0,0,0.4)'
    ctx.fillRect(rnd() * W, y, 2, 1)
  }
  ctx.restore()
}

/**
 * Ce qui occupe le mur entre deux meubles. Sans ça, un joueur qui s'arrête
 * dans un intervalle vide ne voit rien — et le panorama doit tenir sa promesse :
 * aucune position de repos ne tombe dans le noir.
 */
function wallFurniture(ctx: CanvasRenderingContext2D, rnd: Rnd): void {
  // Cimaise : un trait continu, qui donne au balayage une ligne à suivre.
  const rail = H * 0.19
  ctx.fillStyle = '#4a3a26'
  ctx.fillRect(0, rail, W, 11)
  ctx.fillStyle = 'rgba(232,212,168,0.16)'
  ctx.fillRect(0, rail, W, 2)
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(0, rail + 11, W, 5)

  // Le câble électrique agrafé au mur, qui pend entre ses points de fixation.
  ctx.strokeStyle = 'rgba(14,10,7,0.85)'
  ctx.lineWidth = 5
  ctx.beginPath()
  const span = 168
  for (let x = 0; x <= W; x += span) {
    ctx.moveTo(x, rail + 34)
    ctx.quadraticCurveTo(x + span / 2, rail + 34 + 26, x + span, rail + 34)
  }
  ctx.stroke()
  ctx.strokeStyle = 'rgba(176,138,74,0.18)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Traces d'humidité, et les marques laissées par ce qu'on a décroché.
  for (let i = 0; i < 14; i++) {
    const x = rnd() * W
    const y = H * (0.22 + rnd() * 0.42)
    const w = 60 + rnd() * 190
    const h = 50 + rnd() * 150
    const g = ctx.createRadialGradient(x, y, 4, x, y, Math.max(w, h) / 2)
    g.addColorStop(0, 'rgba(90,68,40,0.16)')
    g.addColorStop(0.7, 'rgba(30,22,14,0.14)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - w / 2, y - h / 2, w, h)
  }
  for (let i = 0; i < 5; i++) {
    const x = 120 + rnd() * (W - 300)
    const y = H * (0.24 + rnd() * 0.24)
    const w = 90 + rnd() * 90
    const h = w * (0.7 + rnd() * 0.5)
    ctx.fillStyle = 'rgba(150,124,84,0.09)'
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = 'rgba(12,9,6,0.35)'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, w, h)
    // Le clou est resté.
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(x + w / 2 - 2, y - 10, 4, 7)
  }

  // Éraflures au ras de la plinthe : on a traîné des choses lourdes ici.
  for (let i = 0; i < 90; i++) {
    const x = rnd() * W
    const y = H * (0.68 + rnd() * 0.07)
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(0,0,0,0.4)' : 'rgba(160,132,90,0.12)'
    ctx.fillRect(x, y, 12 + rnd() * 60, 1 + rnd() * 2)
  }
}

/** Une plaque de laiton gravée. Le seul métal qui accroche la lumière. */
function brassPlate(
  ctx: CanvasRenderingContext2D,
  rnd: Rnd,
  x: number,
  y: number,
  w: number,
  h: number,
  line1: string,
  line2: string
): void {
  const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h)
  g.addColorStop(0, '#8f6f39')
  g.addColorStop(0.32, LAITON)
  g.addColorStop(0.58, '#E6C888')
  g.addColorStop(1, '#7d6032')
  ctx.fillStyle = g
  ctx.fillRect(x, y, w, h)

  ctx.strokeStyle = 'rgba(18,12,8,0.6)'
  ctx.lineWidth = 2
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  ctx.strokeStyle = 'rgba(255,240,210,0.32)'
  ctx.lineWidth = 1
  ctx.strokeRect(x + 5.5, y + 5.5, w - 11, h - 11)

  ctx.save()
  ctx.fillStyle = 'rgba(22,15,9,0.85)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${Math.round(h * 0.3)}px "Bodoni Moda", Didot, serif`
  ctx.fillText(line1, x + w / 2, y + h * 0.4)
  ctx.font = `${Math.round(h * 0.15)}px "Courier Prime", monospace`
  ctx.fillText(line2, x + w / 2, y + h * 0.72)
  ctx.restore()

  // Le laiton est vieux : il est terni par plaques.
  ctx.save()
  ctx.globalAlpha = 0.4
  ctx.fillStyle = '#2a2119'
  for (let i = 0; i < 30; i++) {
    const px = x + rnd() * w
    const py = y + rnd() * h
    ctx.beginPath()
    ctx.ellipse(px, py, 2 + rnd() * 10, 1 + rnd() * 4, rnd() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** Une patère, et le chapeau de quelqu'un qui n'est pas là. */
function coatHook(ctx: CanvasRenderingContext2D, x: number): void {
  const y = H * 0.24
  ctx.fillStyle = '#4a3a26'
  ctx.fillRect(x - 6, y, 100, 9)
  ctx.fillStyle = LAITON
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(x + 12 + i * 34, y + 14, 5, 0, Math.PI * 2)
    ctx.fill()
  }
  // Le chapeau : une forme, une ombre, rien de plus.
  const g = ctx.createLinearGradient(x, y + 20, x + 90, y + 90)
  g.addColorStop(0, '#382b1d')
  g.addColorStop(1, '#120d09')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(x + 46, y + 62, 48, 15, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(x + 46, y + 44, 27, 24, 0, Math.PI, 0)
  ctx.fill()
  ctx.fillStyle = 'rgba(232,212,168,0.10)'
  ctx.fillRect(x + 20, y + 44, 54, 4)
}

function shelves(ctx: CanvasRenderingContext2D, rnd: Rnd, x: number, w: number): void {
  // Les montants.
  ctx.fillStyle = '#241b13'
  ctx.fillRect(x - 10, H * 0.24, 12, H * 0.42)
  ctx.fillRect(x + w - 2, H * 0.24, 12, H * 0.42)

  for (let s = 0; s < 3; s++) {
    const y = H * (0.34 + s * 0.14)
    let bx = x + 8
    while (bx < x + w - 34) {
      const bw = 42 + rnd() * 52
      const bh = 30 + rnd() * 38
      const tone = 0.4 + rnd() * 0.6
      ctx.fillStyle = `rgb(${Math.round(46 + tone * 46)},${Math.round(35 + tone * 34)},${Math.round(22 + tone * 22)})`
      ctx.fillRect(bx, y - bh, bw, bh)
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(bx, y - bh, 3, bh)
      // Une étiquette au trait, illisible : ça suffit à dire « stock ».
      ctx.fillStyle = 'rgba(232,212,168,0.13)'
      ctx.fillRect(bx + 8, y - bh * 0.62, bw - 18, 9)
      bx += bw + 5 + rnd() * 14
    }
    ctx.fillStyle = '#3a2d1f'
    ctx.fillRect(x - 4, y, w + 8, 10)
    ctx.fillStyle = 'rgba(232,212,168,0.14)'
    ctx.fillRect(x - 4, y, w + 8, 2)
    contact(ctx, x - 4, y + 10, w + 8, 18)
  }
}

/** Une pendule d'atelier. Elle a une aiguille, elle ne donne aucune heure lisible. */
function clock(ctx: CanvasRenderingContext2D, x: number): void {
  const y = H * 0.22
  const r = 42
  ctx.fillStyle = '#241c14'
  ctx.beginPath()
  ctx.arc(x, y, r + 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(176,138,74,0.55)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(x, y, r + 4, 0, Math.PI * 2)
  ctx.stroke()
  const face = ctx.createRadialGradient(x - 10, y - 12, 2, x, y, r)
  face.addColorStop(0, '#c9b590')
  face.addColorStop(1, '#6d5f45')
  ctx.fillStyle = face
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(20,14,9,0.75)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + 4, y - 26)
  ctx.moveTo(x, y)
  ctx.lineTo(x + 22, y + 10)
  ctx.stroke()
}

function shutter(ctx: CanvasRenderingContext2D, x: number, w: number): void {
  const top = H * 0.14
  const bottom = H * 0.79
  ctx.fillStyle = '#0f0c09'
  ctx.fillRect(x - 12, top - 10, w + 24, bottom - top + 12)
  for (let y = top; y < bottom; y += 15) {
    const g = ctx.createLinearGradient(0, y, 0, y + 15)
    g.addColorStop(0, '#1b1610')
    g.addColorStop(0.45, '#544433')
    g.addColorStop(0.55, '#5d4c39')
    g.addColorStop(1, '#171209')
    ctx.fillStyle = g
    ctx.fillRect(x, y, w, 14)
  }
  // Le jour de la rue, sous le rideau. C'est la seule lumière naturelle.
  const rue = ctx.createLinearGradient(0, bottom - 40, 0, bottom + 12)
  rue.addColorStop(0, 'rgba(232,212,168,0)')
  rue.addColorStop(1, 'rgba(232,212,168,0.22)')
  ctx.fillStyle = rue
  ctx.fillRect(x, bottom - 40, w, 48)
}

/** L'interrupteur en bakélite. Personne ne le touchera. */
function switchPlate(ctx: CanvasRenderingContext2D, x: number): void {
  const y = H * 0.44
  ctx.fillStyle = '#100c09'
  ctx.beginPath()
  ctx.arc(x, y, 21, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#2f2519'
  ctx.beginPath()
  ctx.arc(x, y, 17, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(232,212,168,0.18)'
  ctx.fillRect(x - 5, y - 9, 10, 16)
}

/** Le coffre. On voit sa masse, jamais son cadran. */
function safeBody(ctx: CanvasRenderingContext2D, rnd: Rnd, x: number, w: number): void {
  const top = H * 0.22
  const h = H * 0.57
  const g = ctx.createLinearGradient(x, top, x + w, top + h)
  g.addColorStop(0, '#121009')
  g.addColorStop(0.4, '#332a1e')
  g.addColorStop(0.72, '#20190F')
  g.addColorStop(1, '#0d0a07')
  ctx.fillStyle = g
  ctx.fillRect(x, top, w, h)

  // Moulures : deux filets, et rien de plus.
  ctx.strokeStyle = 'rgba(176,138,74,0.36)'
  ctx.lineWidth = 4
  ctx.strokeRect(x + 24, top + 24, w - 48, h - 48)
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(176,138,74,0.2)'
  ctx.strokeRect(x + 38, top + 38, w - 76, h - 76)

  ctx.fillStyle = '#43351f'
  ctx.fillRect(x + w - 30, top + 66, 16, 60)
  ctx.fillRect(x + w - 30, top + h - 126, 16, 60)

  brassPlate(ctx, rnd, x + w * 0.22, top + h * 0.14, w * 0.56, 92, 'BRÉHAL & FILS', 'PARIS — 1931')

  // Les pieds, et l'ombre qui les lie au sol.
  ctx.fillStyle = '#0a0806'
  ctx.fillRect(x + 14, top + h, 26, 22)
  ctx.fillRect(x + w - 40, top + h, 26, 22)
  contact(ctx, x - 20, top + h + 18, w + 40, 34)
}

function desk(ctx: CanvasRenderingContext2D, rnd: Rnd, x: number, w: number): void {
  const top = H * 0.56
  const g = ctx.createLinearGradient(x, top, x, H * 0.8)
  g.addColorStop(0, '#5a4227')
  g.addColorStop(0.14, '#3b2b1a')
  g.addColorStop(1, '#181109')
  ctx.fillStyle = g
  ctx.fillRect(x, top, w, H * 0.24)
  ctx.fillStyle = 'rgba(232,212,168,0.18)'
  ctx.fillRect(x, top, w, 4)
  contact(ctx, x, top + H * 0.22, w, 30)

  // Dossiers empilés. Papier kraft, coins cornés.
  let px = x + 26
  for (let i = 0; i < 6; i++) {
    const pw = 86 + rnd() * 62
    const ph = 7 + rnd() * 5
    const py = top - ph * (i % 3) - 3
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate((rnd() - 0.5) * 0.06)
    ctx.fillStyle = i % 2 ? '#7d6a4b' : '#95805d'
    ctx.fillRect(0, -ph, pw, ph)
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.fillRect(0, -1, pw, 1)
    ctx.restore()
    px += pw * 0.5
  }

  // Une lampe de bureau, éteinte. C'est le refus du niveau : personne n'allume.
  const lx = x + w * 0.14
  const ly = top - 4
  ctx.strokeStyle = '#4a3a26'
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.moveTo(lx, ly)
  ctx.lineTo(lx + 10, ly - 76)
  ctx.lineTo(lx + 56, ly - 100)
  ctx.stroke()
  ctx.fillStyle = '#2b2117'
  ctx.beginPath()
  ctx.moveTo(lx + 40, ly - 90)
  ctx.lineTo(lx + 96, ly - 112)
  ctx.lineTo(lx + 104, ly - 78)
  ctx.lineTo(lx + 52, ly - 66)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(232,212,168,0.10)'
  ctx.fillRect(lx - 16, ly - 6, 34, 8)

  // Cendrier plein, et une tasse.
  ctx.fillStyle = '#3a2d20'
  ctx.beginPath()
  ctx.ellipse(x + w * 0.62, top - 8, 36, 12, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(20,14,9,0.9)'
  ctx.beginPath()
  ctx.ellipse(x + w * 0.62, top - 10, 27, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(232,212,168,0.5)'
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x + w * 0.62 - 14 + rnd() * 28, top - 14 + rnd() * 8, 12, 3)
  }
  ctx.fillStyle = '#463522'
  ctx.fillRect(x + w * 0.82, top - 36, 32, 32)
  ctx.fillStyle = 'rgba(232,212,168,0.16)'
  ctx.fillRect(x + w * 0.82, top - 36, 32, 4)
}

function frame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = '#0a0806'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = 'rgba(176,138,74,0.5)'
  ctx.lineWidth = 7
  ctx.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7)
  const g = ctx.createLinearGradient(x, y, x + w, y + h)
  g.addColorStop(0, 'rgba(120,98,66,0.55)')
  g.addColorStop(1, 'rgba(14,11,8,0.95)')
  ctx.fillStyle = g
  ctx.fillRect(x + 11, y + 11, w - 22, h - 22)
  // Deux silhouettes en pied, indistinctes. Une photo de famille de commerçant.
  ctx.fillStyle = 'rgba(8,6,4,0.65)'
  ctx.beginPath()
  ctx.ellipse(x + w * 0.4, y + h * 0.62, w * 0.09, h * 0.24, 0, 0, Math.PI * 2)
  ctx.ellipse(x + w * 0.6, y + h * 0.64, w * 0.08, h * 0.22, 0, 0, Math.PI * 2)
  ctx.fill()
  // Le verre renvoie un éclat, même dans le noir.
  ctx.fillStyle = 'rgba(232,212,168,0.09)'
  ctx.beginPath()
  ctx.moveTo(x + 13, y + h - 13)
  ctx.lineTo(x + w * 0.62, y + 13)
  ctx.lineTo(x + w * 0.78, y + 13)
  ctx.lineTo(x + 28, y + h - 13)
  ctx.closePath()
  ctx.fill()
  contact(ctx, x, y + h, w, 20)
}

function calendar(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#0a0806'
  ctx.fillRect(x - 4, y - 4, 128, 160)
  ctx.fillStyle = '#a8916b'
  ctx.fillRect(x, y, 120, 152)
  ctx.save()
  ctx.fillStyle = '#241a10'
  ctx.textAlign = 'center'
  ctx.font = '38px "Bodoni Moda", Didot, serif'
  ctx.fillText('1974', x + 60, y + 50)
  ctx.font = '12px "Courier Prime", monospace'
  ctx.fillText('QUINCAILLERIE', x + 60, y + 86)
  ctx.fillText('DU CANAL', x + 60, y + 104)
  ctx.fillText('RÉPUBLIQUE 42-17', x + 60, y + 130)
  ctx.restore()
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(x, y + 60, 120, 1)
}

/** La porte. C'est par là que la ronde arrivera. */
function door(ctx: CanvasRenderingContext2D, x: number, w: number): void {
  const top = H * 0.1
  const bottom = H * 0.79
  // Chambranle.
  ctx.fillStyle = '#3d3022'
  ctx.fillRect(x - 16, top - 16, w + 32, bottom - top + 16)
  const g = ctx.createLinearGradient(x, top, x + w, bottom)
  g.addColorStop(0, '#241b12')
  g.addColorStop(0.5, '#17110b')
  g.addColorStop(1, '#0d0a07')
  ctx.fillStyle = g
  ctx.fillRect(x, top, w, bottom - top)
  ctx.strokeStyle = 'rgba(112,90,60,0.55)'
  ctx.lineWidth = 5
  ctx.strokeRect(x + 26, top + 36, w - 52, (bottom - top) * 0.36)
  ctx.strokeRect(x + 26, top + 54 + (bottom - top) * 0.36, w - 52, (bottom - top) * 0.44)
  // Poignée en laiton.
  const knob = ctx.createRadialGradient(x + w - 46, (top + bottom) / 2 - 3, 1, x + w - 44, (top + bottom) / 2, 12)
  knob.addColorStop(0, '#F0D9A4')
  knob.addColorStop(1, '#6d5327')
  ctx.fillStyle = knob
  ctx.beginPath()
  ctx.arc(x + w - 44, (top + bottom) / 2, 11, 0, Math.PI * 2)
  ctx.fill()
}

export interface RoomLayout {
  /** Position horizontale de la porte dans le panorama : la ronde s'y ajoute. */
  doorX: number
  doorWidth: number
  doorFootY: number
}

const DOOR = { doorX: 1830, doorWidth: 200, doorFootY: H * 0.79 }

export const ROOM_LAYOUT: Record<RoomId, RoomLayout> = {
  'arriere-boutique': DOOR,
  notaire: DOOR,
  'chambre-forte': DOOR
}

export function paintRoom(room: RoomId, scale = 1): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(W * scale)
  canvas.height = Math.round(H * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.scale(scale, scale)
  const rnd = prng(room.length * 7919 + 17)

  wall(ctx, rnd)
  wallFurniture(ctx, rnd)
  coatHook(ctx, 60)
  shelves(ctx, rnd, 190, 280)
  clock(ctx, 560)
  shutter(ctx, 640, 280)
  switchPlate(ctx, 975)
  safeBody(ctx, rnd, 1020, 360)
  frame(ctx, 1460, H * 0.2, 170, 140)
  calendar(ctx, 1670, H * 0.22)
  desk(ctx, rnd, 1430, 370)
  door(ctx, DOOR.doorX, DOOR.doorWidth)
  soil(ctx, rnd, 260)

  // Le plafond n'est pas éclairé, et ne le sera jamais.
  const cap = ctx.createLinearGradient(0, 0, 0, H * 0.26)
  cap.addColorStop(0, 'rgba(12,10,8,0.95)')
  cap.addColorStop(1, 'rgba(12,10,8,0)')
  ctx.fillStyle = cap
  ctx.fillRect(0, 0, W, H * 0.26)

  return canvas
}

export const ROOM_SIZE = { width: W, height: H, torche: TORCHE, laiton: LAITON, nuit: NUIT }

/** Échelle de rastérisation du panorama pour une hauteur de canevas donnée. */
export function roomScale(canvasHeight: number): number {
  const wanted = (canvasHeight * 1.06) / H
  const capped = Math.sqrt(RENDER.ROOM_PIXEL_BUDGET / (W * H))
  return Math.max(1, Math.min(wanted, capped))
}
