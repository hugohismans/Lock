<script lang="ts">
  import { qrPath } from '../lib/qr'

  const url = window.location.href
  const code = qrPath(url)
</script>

<div class="piece">
  <div class="contenu contenu--desktop">
    <div class="texte">
      <h1 class="titre entre entre--1">Le Casse</h1>
      <hr class="filet entre entre--1" />
      <div class="note entre entre--2">
        <p>Ça se joue à la main, sur un téléphone. Il faut le gyroscope, et du silence.</p>
        <p>Le mien est resté sur le bureau.</p>
      </div>
      <p class="note note--faible url entre entre--3">{url}</p>
    </div>

    <figure class="code entre entre--3">
      <svg viewBox="0 0 {code.size} {code.size}" role="img" aria-label="QR code vers {url}">
        <rect width={code.size} height={code.size} fill="var(--poussiere)" />
        <path d={code.d} fill="var(--torche)" />
      </svg>
    </figure>
  </div>
</div>

<style>
  .contenu--desktop {
    max-width: 46rem;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: var(--e6);
  }

  .texte {
    display: flex;
    flex-direction: column;
    gap: var(--e4);
    flex: 1;
  }

  .url {
    font-size: 0.82rem;
    letter-spacing: 0.06em;
    word-break: break-all;
  }

  .code {
    width: min(38vw, 15rem);
    flex: none;
    padding: var(--e3);
    border: 1px solid var(--trait);
    /* Le seul objet clair de l'écran : il est sale, comme le reste. */
    filter: sepia(0.35) brightness(0.92);
  }

  .code svg {
    display: block;
    width: 100%;
    height: auto;
    shape-rendering: crispEdges;
  }

  @media (max-width: 44rem) {
    .contenu--desktop {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
