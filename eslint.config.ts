import config, { defaultFiles, vue3 } from 'eslint-config-it4c'

export default [
  {
    // `public/` holds the mirrored media and nothing hand-written.
    ignores: ['.nuxt/**', '.output/**', 'dist/**', 'releases/**', 'public/**'],
  },
  ...config,
  ...vue3,
  {
    settings: {
      'import-x/resolver': {
        typescript: {
          // Nuxt writes the aliases (`~`, `~~`, `#imports`) and `resolveJsonModule` into
          // the generated config; the root `tsconfig.json` only references the split ones,
          // so the resolver has to be pointed at the merged config directly.
          project: '.nuxt/tsconfig.json',
        },
      },
    },
    files: defaultFiles,
    languageOptions: {
      parserOptions: {
        // `eslint.config.ts` and `prettier.config.ts` belong to no Nuxt project, so the
        // type-aware rules have no program for them. An inferred one is enough — they are
        // read by tooling only, never shipped. Set for every file rather than only for the
        // two, because the project service is created once for the whole run.
        projectService: {
          allowDefaultProject: ['eslint.config.ts', 'prettier.config.ts'],
        },
      },
    },
    rules: {
      // Too many false positives on ordinary array and record access (as in werft).
      'security/detect-object-injection': 'off',
      // Nuxt's aliases all point at the project root, so every one of them reads as a
      // parent import. `#` is it4c's convention for the same thing, and it is on the
      // rule's ignore list for the same reason.
      'import-x/no-relative-parent-imports': ['error', { ignore: ['^#', '^~', '^@'] }],
    },
  },
  {
    // Nuxt derives these names from the file path: `pages/index.vue` *is* the route, and
    // renaming the file to satisfy the rule would change the URL.
    files: ['app/app.vue', 'app/error.vue', 'app/pages/**/*.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  },
  {
    // The config is read once while Nuxt starts, before there is anything to await, and the
    // path comes from `import.meta.url` rather than from input.
    files: ['nuxt.config.ts'],
    rules: {
      'n/no-sync': 'off',
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
  {
    // `localStorage` throws when storage is blocked and `JSON.parse` throws on whatever an
    // older version left behind. Both mean "no stored preferences", and that is the whole
    // answer — a rethrow here would take the page down over a volume setting.
    files: ['app/composables/useLoops.ts'],
    rules: { 'no-catch-all/no-catch-all': 'off' },
  },
  {
    // `play()` rejects for reasons the spec leaves to the browser — autoplay policy, a
    // pending load, a codec the device refuses. The muted retry answers all of them.
    files: ['app/components/LoopPlayer.vue'],
    rules: { 'no-catch-all/no-catch-all': 'off' },
  },
  {
    files: ['scripts/**/*.mjs'],
    rules: {
      // Node's ESM resolver does not guess extensions, so a relative import has to carry
      // one — `./pr0gramm` threw `ERR_MODULE_NOT_FOUND` for exactly this reason.
      'import-x/extensions': ['error', 'never', { json: 'always', mjs: 'always' }],
      'n/file-extension-in-import': ['error', 'always'],
      // The ingest script is a CLI: its progress on stdout is the output, and the files it
      // writes are named after the ids it was told to fetch.
      'no-console': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      // A batch of downloads has to survive one bad item, and one failed poster frame has
      // a fallback — both are catch-alls on purpose.
      'no-catch-all/no-catch-all': 'off',
      // `spawn` reports through events, and wrapping an event emitter once is what
      // `new Promise` is for.
      'promise/avoid-new': 'off',
    },
  },
]
