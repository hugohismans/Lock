/**
 * Empêche l'écran de s'éteindre pendant une partie. Le joueur ne touche pas
 * l'écran pendant plusieurs minutes : sans ça, le téléphone s'endort en plein casse.
 */
let sentinel: WakeLockSentinel | null = null

export async function acquireWakeLock(): Promise<void> {
  if (!('wakeLock' in navigator)) return
  try {
    sentinel = await navigator.wakeLock.request('screen')
    sentinel.addEventListener('release', () => {
      sentinel = null
    })
  } catch {
    // Refusé (batterie faible, onglet caché) : le jeu reste jouable.
    sentinel = null
  }
}

export function releaseWakeLock(): void {
  void sentinel?.release()
  sentinel = null
}

/** Le verrou saute quand l'onglet passe en arrière-plan : on le reprend au retour. */
export function watchWakeLock(): () => void {
  const onVisible = () => {
    if (document.visibilityState === 'visible' && sentinel === null) void acquireWakeLock()
  }
  document.addEventListener('visibilitychange', onVisible)
  return () => document.removeEventListener('visibilitychange', onVisible)
}

/** Portrait verrouillé si le navigateur le permet — il faut souvent le plein écran. */
export function lockPortrait(): void {
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (o: 'portrait') => Promise<void>
  }
  try {
    void orientation.lock?.('portrait').catch(() => undefined)
  } catch {
    // Non supporté : on s'en passe.
  }
}
