import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Le déploiement GitHub Pages sert le jeu depuis /<repo>/.
// Surchargeable : BASE_PATH=/ npm run build  (racine de domaine, Netlify, etc.)
const base = process.env.BASE_PATH ?? '/Lock/'

// HTTPS local : obligatoire pour devicemotion sur téléphone.
// HTTPS=1 npm run dev:host  → certificat auto-signé via mkcert.
const https = process.env.HTTPS === '1'

export default defineConfig(async () => ({
  base,
  plugins: [svelte(), ...(https ? [(await import('vite-plugin-mkcert')).default()] : [])],
  server: { port: 5173 },
  build: { target: 'es2020', assetsInlineLimit: 0 }
}))
