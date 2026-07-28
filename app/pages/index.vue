<script setup lang="ts">
const { loops, allLoops, tags, activeTag, setTag } = useLoops()

const totalMinutes = computed(() =>
  Math.round(loops.value.reduce((sum, loop) => sum + loop.duration, 0) / 60))

const absolute = useAbsoluteUrl()
const summary = computed(() => `${allLoops.length} Loops · ${totalMinutes.value} min`)

useSeoMeta({
  description: summary,
  ogTitle: 'dornsloops',
  ogDescription: summary,
  ogType: 'website',
  ogUrl: () => absolute('/'),
  // The newest loop's poster stands in for the wall.
  ogImage: () => absolute(allLoops[0]?.poster ?? ''),
  twitterCard: 'summary_large_image',
  twitterTitle: 'dornsloops',
  twitterDescription: summary,
  twitterImage: () => absolute(allLoops[0]?.poster ?? ''),
})
</script>

<template>
  <div class="page">
    <header class="header">
      <h1 class="header__title">dornsloops</h1>
      <p class="header__subtitle">{{ loops.length }} Loops · {{ totalMinutes }} min</p>
    </header>

    <nav v-if="tags.length" class="tags" aria-label="Nach Tag filtern">
      <button
        v-for="entry in tags"
        :key="entry.tag"
        class="tags__item button"
        type="button"
        :aria-pressed="activeTag === entry.tag"
        @click="setTag(entry.tag)"
      >
        {{ entry.tag }} <span class="tags__count">{{ entry.count }}</span>
      </button>
    </nav>

    <main v-if="loops.length" class="grid">
      <LoopTile v-for="loop in loops" :key="loop.id" :loop="loop" />
    </main>

    <p v-else class="empty">
      Noch keine Loops eingepflegt — <code>npm run add -- &lt;pr0gramm-url&gt;</code>
    </p>
  </div>
</template>

<style scoped>
.page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1.25rem;
}

.header {
  margin-bottom: 1rem;
}

.header__title {
  margin: 0;
  font-size: 1.35rem;
  letter-spacing: -0.01em;
}

.header__subtitle {
  margin: 0.1rem 0 0;
  color: var(--fg-muted);
  font-size: 0.85rem;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 1.25rem;
}

.tags__item {
  padding: 0.25rem 0.6rem;
  font-size: 0.8rem;
}

.tags__count {
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
}

.grid {
  columns: 4 260px;
  gap: 0.75rem;
}

.grid > * {
  margin-bottom: 0.75rem;
  break-inside: avoid;
}

.empty {
  padding: 4rem 0;
  color: var(--fg-muted);
  text-align: center;
}

code {
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: var(--bg-raised);
  font-size: 0.9em;
}
</style>
