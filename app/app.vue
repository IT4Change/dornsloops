<script setup lang="ts">
  // Pages set a bare title (which also feeds og:title); the site name is appended
  // here for the browser tab only.
  useHead({
    titleTemplate: (title) =>
      title && title !== 'dornsloops' ? `${title} · dornsloops` : 'dornsloops',
  })

  // Shows which release is live, so a deploy can be checked from the page itself.
  const { version, releaseUrl } = useRuntimeConfig().public
</script>

<template>
  <div class="app">
    <NuxtPage />

    <footer class="footer">
      <p>
        Alle Loops stammen von ihren jeweiligen Urhebern; die Quelle ist an jedem Loop verlinkt.
      </p>
      <p class="footer__version">
        <a v-if="releaseUrl" :href="releaseUrl" target="_blank" rel="noopener noreferrer">
          {{ version }}
        </a>
        <span v-else>{{ version }}</span>
      </p>
    </footer>
  </div>
</template>

<style scoped>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }

  .footer {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem 1.25rem 3rem;
    color: var(--fg-muted);
    font-size: 0.8rem;
    text-align: center;
  }

  .footer p {
    max-width: 46rem;
    margin: 0 auto;
  }

  .footer__version {
    margin-top: 0.5rem;
    font-variant-numeric: tabular-nums;
  }
</style>
