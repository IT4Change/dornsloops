<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { byId, neighbours, setTag } = useLoops()

const loop = computed(() => byId(Number(route.params.id)))

watchEffect(() => {
  if (!loop.value) {
    throw createError({ statusCode: 404, statusMessage: 'Diesen Loop gibt es hier nicht.', fatal: true })
  }
})

const around = computed(() => neighbours(Number(route.params.id)))

const absolute = useAbsoluteUrl()

/** Shown underneath the title in a link preview. */
const summary = computed(() => {
  if (!loop.value) return ''
  const tags = loop.value.tags.slice(0, 4).join(', ')
  const facts = `${formatDuration(loop.value.duration)} · ${loop.value.source.uploader}`
  return tags ? `${facts} · ${tags}` : facts
})

useSeoMeta({
  title: () => loop.value?.title ?? '',
  description: summary,
  ogTitle: () => loop.value?.title ?? '',
  ogDescription: summary,
  ogType: 'video.other',
  ogUrl: () => absolute(`/loop/${loop.value?.id}`),
  ogImage: () => absolute(loop.value?.poster ?? ''),
  ogImageWidth: () => loop.value?.width,
  ogImageHeight: () => loop.value?.height,
  ogImageAlt: () => loop.value?.title ?? '',
  // Lets Discord & co. play the loop right in the preview instead of showing
  // a still image.
  ogVideo: () => absolute(loop.value?.video ?? ''),
  ogVideoType: 'video/mp4',
  ogVideoWidth: () => loop.value?.width,
  ogVideoHeight: () => loop.value?.height,
  twitterCard: 'summary_large_image',
  twitterTitle: () => loop.value?.title ?? '',
  twitterDescription: summary,
  twitterImage: () => absolute(loop.value?.poster ?? ''),
})

/** Filtering from a detail page only makes sense back on the wall. */
function filterByTag (tag: string) {
  setTag(tag)
  router.push('/')
}

function onKeydown (event: KeyboardEvent) {
  if ((event.target as HTMLElement).tagName === 'INPUT') return

  const targets: Record<string, string | undefined> = {
    ArrowRight: around.value.next ? `/loop/${around.value.next.id}` : undefined,
    ArrowLeft: around.value.previous ? `/loop/${around.value.previous.id}` : undefined,
    Escape: '/',
  }
  const target = targets[event.key]
  if (!target) return

  event.preventDefault()
  router.push(target)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <article v-if="loop" class="detail">
    <nav class="detail__nav">
      <NuxtLink class="button" to="/" title="Zurück zur Wand (Esc)">
        ← Alle Loops
      </NuxtLink>
      <span class="detail__position">{{ around.position }} / {{ around.total }}</span>
      <span class="detail__steps">
        <NuxtLink
          v-if="around.previous"
          class="button"
          :to="`/loop/${around.previous.id}`"
          title="Vorheriger Loop (←)"
        >◀</NuxtLink>
        <NuxtLink
          v-if="around.next"
          class="button"
          :to="`/loop/${around.next.id}`"
          title="Nächster Loop (→)"
        >▶</NuxtLink>
      </span>
    </nav>

    <LoopPlayer :loop="loop" />

    <header class="detail__head">
      <h1 class="detail__title">{{ loop.title }}</h1>
      <p class="detail__facts">
        {{ formatDuration(loop.duration) }} · {{ loop.width }}×{{ loop.height }}
      </p>
    </header>

    <ul v-if="loop.tags.length" class="detail__tags">
      <li v-for="tag in loop.tags" :key="tag">
        <button class="button detail__tag" type="button" @click="filterByTag(tag)">
          {{ tag }}
        </button>
      </li>
    </ul>

    <dl class="detail__source">
      <dt>Quelle</dt>
      <dd>
        <a :href="loop.source.url" target="_blank" rel="noopener noreferrer">
          {{ loop.source.platform }}.com/{{ loop.id }} ↗
        </a>
      </dd>

      <dt>Hochgeladen von</dt>
      <dd>{{ loop.source.uploader }}</dd>

      <dt>Hochgeladen am</dt>
      <dd>{{ new Date(loop.source.postedAt).toLocaleDateString('de-DE') }}</dd>

      <template v-if="loop.source.original">
        <dt>Originalquelle</dt>
        <dd>{{ loop.source.original }}</dd>
      </template>
    </dl>
  </article>
</template>

<style scoped>
.detail {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.25rem;
}

.detail__nav {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.detail__nav a {
  text-decoration: none;
}

.detail__position {
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
  font-size: 0.85rem;
}

.detail__steps {
  display: flex;
  gap: 0.4rem;
}

.detail__head {
  margin: 1.25rem 0 0.75rem;
}

.detail__title {
  margin: 0;
  font-size: 1.3rem;
  line-height: 1.3;
}

.detail__facts {
  margin: 0.2rem 0 0;
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
  font-size: 0.85rem;
}

.detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0 0 1.5rem;
  padding: 0;
  list-style: none;
}

.detail__tag {
  padding: 0.25rem 0.6rem;
  font-size: 0.8rem;
}

.detail__source {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.35rem 1rem;
  margin: 0;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
  font-size: 0.85rem;
}

.detail__source dt {
  color: var(--fg-muted);
}

.detail__source dd {
  margin: 0;
}

.detail__source a {
  text-decoration: none;
}

.detail__source a:hover {
  text-decoration: underline;
}
</style>
