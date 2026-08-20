import { describe, expect, it } from 'vitest'
import { Lock } from '../lock'
import { makeCombination, notchDistance } from '../combination'
import { Dial } from '../dial'
import { COMBINATION, DIAL, NOTCH_DEG } from '../../tuning'
import type { LockEvent } from '../../types'

const SLOW = 20 // dps, bien sous GATE_MAX_SPEED

/** Fait franchir des crans à la serrure dans un sens donné. */
function turn(lock: Lock, from: number, to: number, dir: 1 | -1, speed = SLOW): LockEvent[] {
  const events: LockEvent[] = []
  let n = from
  while (n !== to) {
    n = (n + dir + DIAL.NOTCH_COUNT) % DIAL.NOTCH_COUNT
    events.push(...lock.step({ crossings: [n], notch: n, speed: speed * dir, dir }))
  }
  return events
}

describe('combinaison', () => {
  it('ne place jamais deux gorges adjacentes', () => {
    let seed = 1
    const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
    for (let i = 0; i < 300; i++) {
      const combo = makeCombination(5, rng)
      expect(new Set(combo).size).toBe(5)
      for (let k = 1; k < combo.length; k++) {
        expect(notchDistance(combo[k]!, combo[k - 1]!)).toBeGreaterThanOrEqual(COMBINATION.MIN_GAP)
      }
    }
  })
})

describe('serrure', () => {
  it('verrouille un chiffre quand on inverse le sens dessus', () => {
    const lock = new Lock([10, 20, 30])
    turn(lock, 0, 10, 1)
    const events = lock.step({ crossings: [], notch: 10, speed: -SLOW, dir: -1 })
    expect(events).toEqual([{ t: 'digitLocked', index: 0 }])
  })

  it('signale la gorge, mais seulement en dessous de la vitesse seuil', () => {
    const slow = new Lock([10])
    expect(turn(slow, 0, 10, 1)).toContainEqual({ t: 'gate', kind: 'true', notch: 10 })

    const fast = new Lock([10])
    const events = turn(fast, 0, 10, 1, DIAL.GATE_MAX_SPEED_DPS + 30)
    expect(events).not.toContainEqual({ t: 'gate', kind: 'true', notch: 10 })
    expect(events).toContainEqual({ t: 'tick', notch: 10 })
  })

  it('perd la progression du chiffre en cours si on inverse ailleurs', () => {
    const lock = new Lock([10, 20, 30])
    turn(lock, 0, 7, 1)
    expect(lock.step({ crossings: [], notch: 7, speed: -SLOW, dir: -1 })).toEqual([
      { t: 'digitLost', index: 0 }
    ])
    expect(lock.snapshot().index).toBe(0)
  })

  it('ne double pas la peine : réinverser après une perte ne coûte rien', () => {
    const lock = new Lock([10, 20, 30])
    turn(lock, 0, 7, 1)
    lock.step({ crossings: [], notch: 7, speed: -SLOW, dir: -1 })
    // on repart dans le bon sens : réarmement silencieux
    expect(lock.step({ crossings: [], notch: 7, speed: SLOW, dir: 1 })).toEqual([])
    // et on peut de nouveau trouver la gorge
    expect(turn(lock, 7, 10, 1)).toContainEqual({ t: 'gate', kind: 'true', notch: 10 })
  })

  it("reste muet tant qu'on est désarmé", () => {
    const lock = new Lock([10, 20, 30])
    turn(lock, 0, 7, 1)
    lock.step({ crossings: [], notch: 7, speed: -SLOW, dir: -1 }) // perte
    const events = turn(lock, 7, 10, -1) // on continue à contresens, on passe sur la gorge
    expect(events.every((e) => e.t === 'tick')).toBe(true)
  })

  it("impose l'alternance et ouvre le coffre", () => {
    const lock = new Lock([10, 20, 30])
    turn(lock, 0, 10, 1)
    lock.step({ crossings: [], notch: 10, speed: -SLOW, dir: -1 })
    turn(lock, 10, 20, -1)
    lock.step({ crossings: [], notch: 20, speed: SLOW, dir: 1 })
    turn(lock, 20, 30, 1)
    const events = lock.step({ crossings: [], notch: 30, speed: -SLOW, dir: -1 })
    expect(events).toContainEqual({ t: 'opened' })
    expect(lock.snapshot().status).toBe('opened')
  })

  it('ne valide pas un chiffre si on inverse sans être passé dessus dans le bon sens', () => {
    const lock = new Lock([10, 20, 30])
    turn(lock, 0, 10, 1)
    lock.step({ crossings: [], notch: 10, speed: -SLOW, dir: -1 }) // chiffre 1 pris
    // on repart à contresens et on inverse sur 10, qui n'est plus la cible
    turn(lock, 10, 14, -1)
    expect(lock.step({ crossings: [], notch: 14, speed: SLOW, dir: 1 })).toEqual([
      { t: 'digitLost', index: 1 }
    ])
  })
})

describe('cadran', () => {
  /** Simule un téléphone tenu droit, tourné dans son plan. */
  function feed(dial: Dial, degrees: number, steps: number, dt = 1 / 60) {
    const out: number[] = []
    for (let i = 1; i <= steps; i++) {
      const a = ((degrees * i) / steps) * (Math.PI / 180)
      const r = dial.update(Math.sin(a) * 9.81, Math.cos(a) * 9.81, 0, dt)
      out.push(...r.crossings)
    }
    return out
  }

  it('franchit GEAR_RATIO crans par cran de poignet', () => {
    const dial = new Dial()
    // 90° de poignet = 180° de cadran = 20 crans à GEAR_RATIO = 2
    const crossings = feed(dial, 90, 240)
    const expected = Math.floor((90 * DIAL.GEAR_RATIO) / NOTCH_DEG)
    expect(Math.abs(crossings.length - expected)).toBeLessThanOrEqual(1)
  })

  it('ne produit aucun tic quand le téléphone ne bouge pas', () => {
    const dial = new Dial()
    feed(dial, 0, 120)
    const crossings = feed(dial, 0, 120)
    expect(crossings).toHaveLength(0)
  })

  it('coupe la lecture quand le téléphone est à plat', () => {
    const dial = new Dial()
    let r = dial.update(0, 9.81, 0, 1 / 60)
    for (let i = 0; i < 60; i++) r = dial.update(0, 0.5, 9.7, 1 / 60)
    expect(r.usable).toBe(false)
  })
})
