<script lang="ts">
  interface Props {
    numeral?: string | undefined
    title?: string | undefined
    lines: readonly string[]
    /** Second bloc, plus effacé : la règle, une consigne. */
    aside?: readonly string[] | undefined
    action: string
    onAction: () => void
    autofocus?: boolean | undefined
  }

  const { numeral, title, lines, aside, action, onAction, autofocus = true }: Props = $props()

  let button = $state<HTMLButtonElement | null>(null)
  $effect(() => {
    if (autofocus) button?.focus({ preventScroll: true })
  })
</script>

<div class="piece">
  <div class="contenu">
    {#if numeral || title}
      <header class="entete entre entre--1">
        {#if numeral}<p class="numeral">{numeral}</p>{/if}
        {#if title}<h1 class="titre">{title}</h1>{/if}
        <hr class="filet" />
      </header>
    {/if}

    <div class="note entre entre--2">
      {#each lines as line (line)}
        <p>{line}</p>
      {/each}
    </div>

    {#if aside && aside.length > 0}
      <div class="note note--faible entre entre--3">
        {#each aside as line (line)}
          <p>{line}</p>
        {/each}
      </div>
    {/if}

    <button class="action entre entre--4" bind:this={button} onclick={onAction}>{action}</button>
  </div>
</div>

<style>
  .entete {
    display: flex;
    flex-direction: column;
    gap: var(--e3);
  }
</style>
