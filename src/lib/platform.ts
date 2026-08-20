/** Ce que la machine sait faire. Interrogé une fois, au lancement. */
export interface Capabilities {
  /** Un vrai écran tactile : sinon on renvoie le joueur sur son téléphone. */
  touch: boolean
  /** L'API de mouvement existe. */
  motion: boolean
  /** iOS 13+ : il faut demander la permission depuis un geste utilisateur. */
  motionNeedsPermission: boolean
  /** navigator.vibrate. Absent sur iOS Safari : c'est une contrainte de design, pas un bug. */
  vibration: boolean
  wakeLock: boolean
  reducedMotion: boolean
}

interface MotionPermissionCtor {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>
}

export function motionPermissionApi(): MotionPermissionCtor | null {
  if (typeof DeviceMotionEvent === 'undefined') return null
  const ctor = DeviceMotionEvent as unknown as MotionPermissionCtor
  return typeof ctor.requestPermission === 'function' ? ctor : null
}

export function capabilities(): Capabilities {
  const touch =
    typeof window !== 'undefined' &&
    (matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0)
  return {
    touch,
    motion: typeof DeviceMotionEvent !== 'undefined',
    motionNeedsPermission: motionPermissionApi() !== null,
    vibration: typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function',
    wakeLock: typeof navigator !== 'undefined' && 'wakeLock' in navigator,
    reducedMotion:
      typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  }
}
