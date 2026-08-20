<script lang="ts">
  import type { Level } from '../lib/levels'
  import { Session, type Outcome } from '../game/session'

  interface Props {
    level: Level
    onEnd: (outcome: Outcome) => void
    onNoMotion: () => void
  }
  const { level, onEnd, onNoMotion }: Props = $props()

  let canvas = $state<HTMLCanvasElement | null>(null)

  $effect(() => {
    const surface = canvas
    if (!surface) return
    const session = new Session(level, surface, { onEnd, onNoMotion })
    void session.start()
    return () => session.stop()
  })
</script>

<!--
  Rien d'autre que le canevas. Pas de chrono, pas de cadran, pas de chiffre :
  l'écran ne montre pas la serrure, il montre la pièce et le temps qui passe.
-->
<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--nuit);
  }
</style>
