<script lang="ts">
  interface Props {
    onEnter: () => void
    busy: boolean
  }
  const { onEnter, busy }: Props = $props()
</script>

<div class="piece">
  <div class="contenu contenu--entree">
    <div class="haut">
      <h1 class="titre entre entre--2">Le Casse</h1>
      <hr class="filet entre entre--3" />
    </div>

    <div class="bas">
      <button class="action entre entre--4" onclick={onEnter} disabled={busy}>
        {busy ? 'j’ouvre' : 'entrer'}
      </button>
      <p class="note note--faible entre entre--4">
        Mets le son, ou un casque. Tiens le téléphone devant toi, écran vers toi.
      </p>
    </div>
  </div>
</div>

<style>
  .contenu--entree {
    align-content: space-between;
    padding-top: 20vh;
    padding-bottom: 12vh;
  }

  .haut {
    display: flex;
    flex-direction: column;
    gap: var(--e4);
  }

  .bas {
    display: flex;
    flex-direction: column;
    gap: var(--e4);
  }

  .action:disabled {
    color: var(--encre-tres-faible);
    cursor: default;
  }
</style>
