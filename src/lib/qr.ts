import qrcode from 'qrcode-generator'

export interface QrPath {
  /** Nombre de modules par côté, marge comprise. */
  size: number
  /** Chemin SVG des modules sombres. */
  d: string
}

/**
 * Encode une URL en chemin SVG. Sur desktop il n'y a pas de repli souris :
 * il y a un QR code, dans la même direction artistique que le reste.
 */
export function qrPath(text: string, margin = 2): QrPath {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const count = qr.getModuleCount()
  const size = count + margin * 2
  let d = ''
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) d += `M${col + margin} ${row + margin}h1v1h-1z`
    }
  }
  return { size, d }
}
