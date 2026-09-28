import config, { defaultFiles, vitest, vue3 } from 'eslint-config-it4c'

export default [
  {
    // `public/` holds the mirrored media and nothing hand-written; the last three are what
    // a test run leaves behind.
    ignores: [
      '.nuxt/**',
      '.output/**',
      'dist/**',
      'releases/**',
      'public/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  ...config,
  ...vue3,
  // The vitest rules match `**/*.spec.*`, which is also what the Playwright specs are
  // called. They are the same kind of file under a different runner, and the handful of
  // rules that actually differ are switched off for `e2e/**` further down.
  ...vitest,
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
    files: ['**/*.spec.ts', '**/*.spec.mjs'],
    rules: {
      // A spec is allowed an assumption the production code is not: every one of these is an
      // index into a list the test itself set up. `?.` would turn a missing element into a
      // trigger that quietly does nothing and a failure three lines further on.
      '@typescript-eslint/no-non-null-assertion': 'off',
      // A `beforeEach` that resets state shared across the whole file belongs to the file.
      // Pushed into each describe block, it is one copy per block and one of them forgotten.
      'vitest/require-top-level-describe': 'off',
    },
  },
  {
    // The import form of `vi.mock` types the factory against the mocked module, and for a
    // JSON file that type is the literal shape of the committed data — a `Loop[]` fixture
    // is then not assignable to it. The path form is the only one that admits a stand-in,
    // which is the entire point of mocking `content/loops.json`.
    files: ['app/**/*.spec.ts'],
    rules: { 'vitest/prefer-import-in-mock': 'off' },
  },
  {
    // The zone is what the detail page pins down, so its spec has to move it — and
    // `process.env.TZ` is the only handle V8 offers for that. Written as a directory glob
    // because `[id]` in a filename is a character class to the matcher, not two brackets.
    files: ['app/pages/loop/**/*.spec.ts'],
    rules: { 'n/no-process-env': 'off' },
  },
  {
    // Playwright's specs are `*.spec.ts` like the rest, so the vitest rules reach them too.
    // These are the ones that mean something different under Playwright: its `test` takes a
    // fixture object rather than vitest globals, and a describe block is a group, not a
    // suite that must hold a hook. The suite also reads the real `content/loops.json` off
    // the disk at load — the point is to run against the file the build prerenders from,
    // and a path from `import.meta.url` is not input.
    files: ['e2e/**'],
    rules: {
      'vitest/prefer-importing-vitest-globals': 'off',
      'vitest/require-hook': 'off',
      'vitest/expect-expect': 'off',
      'vitest/consistent-test-it': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'n/no-sync': 'off',
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
  {
    // The e2e server is the deployment's nginx in sixty lines: its one console line is how
    // Playwright knows it came up, and a malformed URL is not an error to rethrow but a 404.
    files: ['e2e/static-server.mjs'],
    rules: {
      'no-console': 'off',
      'no-catch-all/no-catch-all': 'off',
    },
  },
  {
    // The port and the CI flag come from the environment by design — that is how one run
    // differs from the next. Same reason the deploy script reads them.
    files: ['playwright.config.ts'],
    rules: { 'n/no-process-env': 'off' },
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
