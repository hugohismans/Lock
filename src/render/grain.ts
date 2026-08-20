import { RENDER } from '../lib/tuning'

/**
 * Grain de pellicule. Pré-cuit en quelques tuiles qu'on fait tourner : un
 * bruit recalculé par pixel à chaque image coûterait la moitié du budget
 * d'un téléphone milieu de gamme pour un résultat identique.
 *
 * Le grain est additif, pas en 'overlay' : sur une image aussi sombre, un
 * mélange multiplicatif ne produit rigoureusement rien. Les tuiles sont donc
 * presque noires, avec quelques grains clairs — ce qu'on ajoute au noir.
 */
export function makeGrainTiles(size = 128, count = RENDER.GRAIN_TILES): HTMLCanvasElement[] {
  const tiles: HTMLCanvasElement[] = []
  for (let t = 0; t < count; t++) {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    const image = ctx.createImageData(size, size)
    const data = image.data
    for (let i = 0; i < data.length; i += 4) {
      // Distribution asymétrique : beaucoup de rien, quelques grains.
      const u = Math.random() ** 4
      const n = Math.round(u * 255)
      // Le grain d'une pellicule tirée en chaud n'est pas gris neutre.
      data[i] = n
      data[i + 1] = Math.round(n * 0.94)
      data[i + 2] = Math.round(n * 0.78)
      data[i + 3] = 255
    }
    ctx.putImageData(image, 0, 0)
    tiles.push(canvas)
  }
  return tiles
}
