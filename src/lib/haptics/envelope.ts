import { FEEDBACK } from '../tuning'
import type { GateKind } from '../types'

export interface Segment {
  /** Décalage en secondes depuis le début de l'impulsion. */
  start: number
  end: number
}

/**
 * Découpe l'impulsion d'une gorge.
 *
 * La vraie est une impulsion lisse et continue. La fausse est hachée par
 * FALSE_GAPS micro-coupures — mais elle occupe exactement la même durée
 * totale. C'est la seule différence entre les deux ; rien d'autre ne doit
 * les distinguer.
 */
export function gateSegments(kind: GateKind, durationMs: number = FEEDBACK.GATE_MS): Segment[] {
  const total = durationMs / 1000
  if (kind === 'true') return [{ start: 0, end: total }]

  const gaps = FEEDBACK.FALSE_GAPS
  const gap = FEEDBACK.FALSE_GAP_MS / 1000
  const on = (total - gaps * gap) / (gaps + 1)
  const segments: Segment[] = []
  let t = 0
  for (let i = 0; i <= gaps; i++) {
    segments.push({ start: t, end: t + on })
    t += on + gap
  }
  return segments
}

/**
 * Compensation de gain pour que la fausse gorge délivre la même énergie que
 * la vraie malgré ses trous : l'énergie va comme le carré de l'amplitude,
 * donc on multiplie par 1/√(rapport cyclique). Exact sur les canaux audio.
 */
export function energyCompensation(segments: Segment[], durationMs: number = FEEDBACK.GATE_MS): number {
  const total = durationMs / 1000
  const on = segments.reduce((sum, s) => sum + (s.end - s.start), 0)
  return on > 0 ? Math.sqrt(total / on) : 1
}

/** Motif pour navigator.vibrate : [on, off, on, …] en millisecondes. */
export function vibrationPattern(kind: GateKind, durationMs: number = FEEDBACK.GATE_MS): number | number[] {
  const segments = gateSegments(kind, durationMs)
  if (segments.length === 1) return Math.round(durationMs)
  const pattern: number[] = []
  segments.forEach((s, i) => {
    pattern.push(Math.round((s.end - s.start) * 1000))
    if (i < segments.length - 1) pattern.push(FEEDBACK.FALSE_GAP_MS)
  })
  return pattern
}
