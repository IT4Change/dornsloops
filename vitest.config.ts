import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Projects rather than one environment for everything: the ingest scripts are plain
    // Node and have no business booting a Nuxt app, and the `.vue` files cannot be tested
    // without one. Splitting them keeps the script suite at startup cost near zero.
    projects: [
      {
        test: {
          name: 'scripts',
          include: ['scripts/**/*.spec.mjs'],
          environment: 'node',
        },
      },
      {
        test: {
          // Its own project, not a file under `scripts`: what it checks is the committed
          // data, and it has no module under test at all. It is also the one suite that
          // reads the real `content/loops.json` instead of a fixture — `vitest --project
          // content` is then the run that answers "is the wall's input sound", separately
          // from "does the code work".
          name: 'content',
          include: ['content/**/*.spec.mjs'],
          environment: 'node',
        },
      },
      await defineVitestProject({
        test: {
          name: 'app',
          include: ['app/**/*.spec.ts'],
          environment: 'nuxt',
        },
      }),
    ],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // SFCs are measured too: most of this app's logic sits in a `<script setup>`, and a
      // number that stops at the `.ts` files would describe a fraction of the code.
      include: ['app/**/*.{ts,vue}', 'scripts/**/*.mjs'],
      exclude: [
        // Types only — there is nothing to execute.
        'app/types/**',
        // The shell around the pages: a title template and an error page whose whole
        // content is the message Nuxt hands it.
        'app/app.vue',
      ],
      // The floor measured on 2026-09-28, rounded down — no headroom, because slack is a
      // licence to decline. Raising one of these is a commit of its own, so the ratchet is
      // visible.
      //
      // Per area, and the globs are the bar that means anything: `scripts/ingest.mjs` is
      // half ffmpeg-and-network orchestration that only a real download exercises, and it
      // pulls the project number down to the seventies on its own. A single global floor
      // low enough to admit that would let the app decay from 97 % to nothing without
      // anyone noticing. The global numbers still count every file — vitest does not take
      // the glob-matched ones out of them — so they are the whole project's floor and
      // nothing more.
      thresholds: {
        lines: 77,
        functions: 86,
        branches: 81,
        statements: 78,
        'app/**': { lines: 97, functions: 97, branches: 88, statements: 97 },
        'scripts/pr0gramm.mjs': { lines: 100, functions: 100, branches: 100, statements: 100 },
        'scripts/ingest.mjs': { lines: 39, functions: 33, branches: 54, statements: 40 },
      },
    },
  },
})
