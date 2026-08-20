import { motionPermissionApi } from '../platform'

export type MotionPermission = 'granted' | 'denied' | 'unsupported'

/**
 * iOS 13+ exige que la demande parte d'un vrai geste utilisateur : cette
 * fonction doit donc être appelée directement dans le handler du bouton
 * d'entrée, sans await intercalé avant.
 */
export async function requestMotionPermission(): Promise<MotionPermission> {
  if (typeof DeviceMotionEvent === 'undefined') return 'unsupported'
  const api = motionPermissionApi()
  if (!api?.requestPermission) return 'granted' // Android, desktop : rien à demander
  try {
    const result = await api.requestPermission()
    return result === 'granted' ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}
