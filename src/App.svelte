<script lang="ts">
  import Card from './ui/Card.svelte'
  import Desktop from './ui/Desktop.svelte'
  import Entry from './ui/Entry.svelte'
  import Play from './ui/Play.svelte'
  import { LEVELS, RULE, type Level } from './lib/levels'
  import { requestMotionPermission } from './lib/motion/permission'
  import { unlockAudio } from './lib/audio/context'
  import { capabilities } from './lib/platform'
  import { acquireWakeLock, lockPortrait, releaseWakeLock, watchWakeLock } from './lib/wakelock'
  import type { Outcome } from './game/session'

  type Screen = 'entry' | 'blocked' | 'brief' | 'play' | 'success' | 'failure' | 'end'
  type Blocked = 'denied' | 'no-motion' | 'unsupported'

  const caps = capabilities()

  let screen = $state<Screen>('entry')
  let blocked = $state<Blocked>('denied')
  let index = $state(0)
  let busy = $state(false)
  /** Change à chaque partie : force Svelte à remonter la scène et à retirer une combinaison. */
  let attempt = $state(0)

  const level = $derived<Level | undefined>(LEVELS[index])
  const first = $derived(index === 0)

  async function enter(): Promise<void> {
    if (busy) return
    busy = true
    // iOS 13+ : les deux demandes doivent partir du geste, sans await entre elles.
    const audio = unlockAudio()
    const motion = requestMotionPermission()
    const [, permission] = await Promise.all([audio, motion])
    busy = false

    if (permission === 'unsupported') {
      blocked = 'unsupported'
      screen = 'blocked'
      return
    }
    if (permission === 'denied') {
      blocked = 'denied'
      screen = 'blocked'
      return
    }
    lockPortrait()
    void acquireWakeLock()
    screen = 'brief'
  }

  function play(): void {
    attempt++
    screen = 'play'
  }

  function finish(outcome: Outcome): void {
    screen = outcome === 'opened' ? 'success' : 'failure'
  }

  function next(): void {
    if (index + 1 < LEVELS.length) {
      index++
      screen = 'brief'
    } else {
      screen = 'end'
    }
  }

  function noMotion(): void {
    blocked = 'no-motion'
    screen = 'blocked'
  }

  const blockedText: Record<Blocked, readonly string[]> = {
    denied: [
      'Sans le mouvement, il n’y a pas de cadran.',
      'Sur iPhone : Réglages, Safari, Mouvement et orientation. Puis on recommence.'
    ],
    'no-motion': [
      'Le téléphone ne dit rien.',
      'Il faut un appareil avec un gyroscope, et une page servie en HTTPS.'
    ],
    unsupported: [
      'Ce navigateur ne lit pas le mouvement.',
      'Il me faut un téléphone, et Safari ou Chrome à jour.'
    ]
  }

  $effect(() => {
    const stop = watchWakeLock()
    return () => {
      stop()
      releaseWakeLock()
    }
  })
</script>

{#if !caps.touch}
  <Desktop />
{:else if screen === 'entry'}
  <Entry onEnter={enter} {busy} />
{:else if screen === 'blocked'}
  <Card
    title="La porte est restée fermée"
    lines={blockedText[blocked]}
    action="réessayer"
    onAction={() => {
      screen = 'entry'
    }}
  />
{:else if screen === 'brief' && level}
  <Card
    numeral={level.numeral}
    title={level.title}
    lines={level.brief}
    aside={first ? RULE : undefined}
    action="y aller"
    onAction={play}
  />
{:else if screen === 'play' && level}
  {#key attempt}
    <Play {level} onEnd={finish} onNoMotion={noMotion} />
  {/key}
{:else if screen === 'success' && level}
  <Card lines={level.success} action="continuer" onAction={next} />
{:else if screen === 'failure' && level}
  <Card
    lines={level.failure}
    action="recommencer"
    onAction={() => {
      screen = 'brief'
    }}
  />
{:else}
  <Card
    lines={['Le reste est en repérage.', 'Le notaire, puis la chambre forte. À suivre.']}
    action="recommencer"
    onAction={() => {
      index = 0
      screen = 'brief'
    }}
  />
{/if}
