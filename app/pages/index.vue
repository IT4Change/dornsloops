<script setup lang="ts">
const {
  loops,
  tags,
  activeTag,
  current,
  currentIndex,
  prefs,
  open,
  close,
  next,
  previous,
  toggleShuffle,
  reshuffle,
  setTag,
  loadPrefs,
  persistPrefs,
} = useLoops()

const totalMinutes = computed(() =>
  Math.round(loops.value.reduce((sum, loop) => sum + loop.duration, 0) / 60))

/**
 * Deep links live in a query parameter rather than in a route or the hash: the
 * grid stays mounted while stepping through the queue, any static host serves
 * it without rewrite rules, and — unlike a hash — the router preserves it on
 * the initial load. Watching the route also covers the back button for free.
 */
const route = useRoute()
const router = useRouter()

watch(() => route.query.loop, value => {
  const id = Number(value)
  if (loops.value.some(loop => loop.id === id)) open(id)
  else close()
}, { immediate: true })

function openLoop (id: number) {
  router.push({ query: { ...route.query, loop: String(id) } })
}

function closeLoop () {
  const { loop, ...rest } = route.query
  router.push({ query: rest })
}

function step (direction: 1 | -1) {
  direction === 1 ? next() : previous()
  // Replace, so skipping through a dozen loops leaves one history entry.
  if (current.value) {
    router.replace({ query: { ...route.query, loop: String(current.value.id) } })
  }
}

function onShuffle () {
  toggleShuffle()
  persistPrefs()
}

onMounted(loadPrefs)
</script>

<template>
  <div class="page">
    <header class="header">
      <div class="header__brand">
        <h1 class="header__title">dornsloops</h1>
        <p class="header__subtitle">
          {{ loops.length }} Loops · {{ totalMinutes }} min · statt Musik
        </p>
      </div>

      <div class="header__actions">
        <button class="button" type="button" :aria-pressed="prefs.shuffle" @click="onShuffle">
          🔀 Shuffle
        </button>
        <button v-if="prefs.shuffle" class="button" type="button" title="Neu mischen" @click="reshuffle">
          ↻
        </button>
        <button
          class="button"
          type="button"
          :disabled="!loops.length"
          @click="openLoop(loops[0]!.id)"
        >
          ▶ Alle abspielen
        </button>
      </div>
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
      <LoopTile v-for="loop in loops" :key="loop.id" :loop="loop" @open="openLoop" />
    </main>

    <p v-else class="empty">
      Noch keine Loops eingepflegt — <code>npm run add -- &lt;pr0gramm-url&gt;</code>
    </p>

    <ClientOnly>
      <LoopPlayer
        v-if="current"
        :loop="current"
        :position="currentIndex + 1"
        :total="loops.length"
        @close="closeLoop"
        @next="step(1)"
        @previous="step(-1)"
      />
    </ClientOnly>
  </div>
</template>

<style scoped>
.page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1.25rem;
}

.header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
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

.header__actions {
  display: flex;
  gap: 0.4rem;
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
