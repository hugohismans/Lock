import { COMBINATION, DIAL } from '../tuning'

export type Rng = () => number

/** Distance circulaire entre deux crans, en crans. */
export function notchDistance(a: number, b: number, count = DIAL.NOTCH_COUNT): number {
  const d = Math.abs(a - b) % count
  return Math.min(d, count - d)
}

function pick(rng: Rng, count: number): number {
  return Math.floor(rng() * count) % count
}

/**
 * Tire une combinaison : chiffres tous distincts, et jamais deux gorges
 * adjacentes (distance circulaire ≥ MIN_GAP entre deux chiffres successifs).
 * Le générateur est injecté, donc le modèle reste testable et rejouable.
 */
export function makeCombination(
  digits: number,
  rng: Rng,
  count = DIAL.NOTCH_COUNT
): number[] {
  const combo: number[] = []
  let guard = digits * 200
  while (combo.length < digits && guard-- > 0) {
    const prev = combo[combo.length - 1]
    const n = pick(rng, count)
    if (combo.includes(n)) continue
    if (prev !== undefined && notchDistance(n, prev, count) < COMBINATION.MIN_GAP) continue
    combo.push(n)
  }
  // Repli déterministe : ne peut se produire que si les contraintes sont
  // infaisables pour le nombre de crans demandé.
  let fill = pick(rng, count)
  while (combo.length < digits) {
    if (!combo.includes(fill)) combo.push(fill)
    fill = (fill + COMBINATION.MIN_GAP + 1) % count
  }
  return combo
}

/**
 * Leurres du niveau 3 : de fausses gorges, retirées au sort à chaque chiffre,
 * jamais collées à la vraie ni entre elles.
 */
export function makeDecoys(
  combo: readonly number[],
  perDigit: number,
  rng: Rng,
  count = DIAL.NOTCH_COUNT
): number[][] {
  return combo.map((truth) => {
    const out: number[] = []
    let guard = perDigit * 200
    while (out.length < perDigit && guard-- > 0) {
      const n = pick(rng, count)
      if (notchDistance(n, truth, count) < COMBINATION.MIN_DECOY_GAP) continue
      if (out.some((o) => notchDistance(n, o, count) < COMBINATION.MIN_DECOY_GAP)) continue
      out.push(n)
    }
    return out
  })
}
