import { defineConfig } from '@playwright/test'

/**
 * Not 3000: `npm run dev` lives there, and `reuseExistingServer` cannot tell *whose*
 * server answers — the suite would quietly run against a dev server it never built, which
 * is precisely the artefact this is not supposed to test. Overridable for a machine where
 * 3030 is taken.
 */
const PORT = process.env.E2E_PORT ?? '3030'
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Retries stay, for the trace they record — but a test that only passes on the second go
  // must not leave a green run behind. The first CI run of this suite reported "25 passed"
  // next to a failure and went through, and a flake nobody is shown is a flake nobody fixes.
  failOnFlakyTests: Boolean(process.env.CI),
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // The wall is full of moving pictures; a screenshot on failure is worth having.
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: {
          // Chrome's autoplay policy depends on how often the profile has visited the site
          // before, which is not something a suite can depend on. Pinned to "allowed" so the
          // player starts the same way every run; the refused-autoplay path is a unit test,
          // where the refusal can be stated rather than provoked.
          args: ['--autoplay-policy=no-user-gesture-required'],
        },
      },
    },
  ],

  webServer: {
    // The deployment is `nuxt generate` plus nginx, so the suite drives exactly that: the
    // prerendered directory, served by the rules from `nginx.conf.template`. Building here
    // rather than depending on a build that happened earlier — a stale `.output` would test
    // the previous commit.
    command: `NUXT_PUBLIC_SITE_URL=${BASE_URL} npx nuxt generate && node e2e/static-server.mjs ${PORT}`,
    url: BASE_URL,
    // Prerendering every loop page takes a while on a cold cache.
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
  },
})
