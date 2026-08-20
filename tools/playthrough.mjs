// Partie complète, jouée par un robot : c'est le test de bout en bout du
// niveau 1. Il traverse le vrai capteur, la vraie serrure et le vrai rendu.
import { chromium } from 'playwright'

const NOTCH = 9 // degrés de cadran
const RATIO = 2 // GEAR_RATIO

const URL = process.env.CASSE_URL ?? 'http://localhost:5173/Lock/'
const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
)
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(URL, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /entrer/i }).click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: /y aller/i }).click()

await page.evaluate(() => {
  window.__wrist = 0
  const send = () => {
    const r = (window.__wrist * Math.PI) / 180
    window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
      accelerationIncludingGravity: { x: Math.sin(r) * 9.81, y: Math.cos(r) * 9.81, z: 0.3 },
      interval: 16
    }))
    requestAnimationFrame(send)
  }
  send()
})
await page.waitForTimeout(400)

const state = () => page.evaluate(() => ({ ...window.casse.etat, combo: window.casse.combinaison }))
const setWrist = (w) => page.evaluate((v) => { window.__wrist = v }, w)

const combo = (await state()).combo
console.log('combinaison à trouver :', combo.join(' – '))

/** Tourne doucement jusqu'à un angle de poignet, sous la vitesse seuil. */
async function turnTo(targetWrist) {
  const start = (await state()).dialDeg / RATIO
  const stepDeg = 0.5 // 30 °/s de poignet = 60 °/s de cadran, sous GATE_MAX_SPEED
  const steps = Math.ceil(Math.abs(targetWrist - start) / stepDeg)
  const dir = Math.sign(targetWrist - start)
  for (let i = 1; i <= steps; i++) {
    await setWrist(start + dir * stepDeg * i)
    await page.waitForTimeout(16)
  }
  await page.waitForTimeout(260) // on s'arrête : la vitesse retombe, le sens passe à 0
}

/** Angle de poignet du prochain centre de cran `notch` dans le sens `dir`. */
function wristForNotch(currentDial, notch, dir) {
  const centre = notch * NOTCH + NOTCH / 2
  let d = currentDial
  for (let turn = 0; turn < 3; turn++) {
    const candidate = Math.floor(d / 360) * 360 + centre + (dir > 0 ? turn : -turn) * 360
    if (dir > 0 && candidate > d + 6) return candidate / RATIO
    if (dir < 0 && candidate < d - 6) return candidate / RATIO
  }
  return (d + dir * 360) / RATIO
}

let dir = 1
for (let i = 0; i < combo.length; i++) {
  const before = await state()
  const target = wristForNotch(before.dialDeg, combo[i], dir)
  await turnTo(target)
  const onGate = await state()
  // On repart dans l'autre sens : c'est ce geste qui valide le chiffre.
  dir = -dir
  await turnTo(onGate.dialDeg / RATIO + dir * 14)
  const after = await state()
  console.log(`chiffre ${i + 1} (${combo[i]}) → témoins : ${after.marks}/${after.markTotal}`)
  if (after.marks !== i + 1) {
    console.log('ÉCHEC : le chiffre n’a pas été pris')
    break
  }
}

const final = await state()
console.log('ouvert :', final.opened, '| ronde consommée :', Math.round(final.threat * 100) + '%')
await page.waitForTimeout(2000)
const card = await page.textContent('.note').catch(() => null)
console.log('écran suivant :', card?.trim().slice(0, 60))
console.log(errors.length ? 'ERREURS: ' + errors.join(' | ') : 'aucune erreur')
await browser.close()
