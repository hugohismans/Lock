/**
 * Un seul AudioContext pour tout le jeu, débloqué par le geste d'entrée
 * (le même bouton qui demande la permission de mouvement).
 */
let ctx: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null

type AudioContextCtor = typeof AudioContext

function ctor(): AudioContextCtor | null {
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

export async function unlockAudio(): Promise<boolean> {
  const C = ctor()
  if (!C) return false
  if (!ctx) {
    ctx = new C()
    master = ctx.createGain()
    master.gain.value = 1
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      return false
    }
  }
  // Certains navigateurs ne considèrent le contexte réellement ouvert
  // qu'après un premier son : on en joue un inaudible.
  const blip = ctx.createOscillator()
  const g = ctx.createGain()
  g.gain.value = 0.0001
  blip.connect(g).connect(ctx.destination)
  blip.start()
  blip.stop(ctx.currentTime + 0.02)
  return ctx.state === 'running'
}

export function audio(): AudioContext | null {
  return ctx
}

export function bus(): GainNode | null {
  return master
}

/** Une seconde de bruit blanc, réutilisée par tous les générateurs. */
export function noiseBuffer(): AudioBuffer | null {
  if (!ctx) return null
  if (noise && noise.sampleRate === ctx.sampleRate) return noise
  const length = Math.floor(ctx.sampleRate)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  noise = buffer
  return noise
}

export function suspendAudio(): void {
  void ctx?.suspend()
}

export function resumeAudio(): void {
  void ctx?.resume()
}
