import { readFileSync } from 'node:fs'

interface LoopEntry { id: number }

// Every loop gets its own prerendered page, so the deep links are real URLs.
const loops: LoopEntry[] = JSON.parse(
  readFileSync(new URL('./content/loops.json', import.meta.url), 'utf8'),
)

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-07-28',
  devtools: { enabled: false },
  ssr: true,

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'de' },
      titleTemplate: title => (title ? `${title} · dornsloops` : 'dornsloops'),
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Eine Wand aus kurzen Videoloops.' },
        { name: 'theme-color', content: '#0b0b0f' },
        // The loops are other people's work; keep the mirror out of search results.
        { name: 'robots', content: 'noindex, nofollow' },
      ],
      link: [{ rel: 'icon', href: '/favicon.svg' }],
    },
  },

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/', '/404.html', ...loops.map(loop => `/loop/${loop.id}`)],
    },
  },
})
