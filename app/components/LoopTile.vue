<script setup lang="ts">
import type { Loop } from '~/types/loop'

const props = defineProps<{ loop: Loop }>()
defineEmits<{ open: [id: number] }>()

const root = ref<HTMLElement | null>(null)
const video = ref<HTMLVideoElement | null>(null)

/** The file is only attached once the tile approaches the viewport. */
const loaded = ref(false)
const playing = ref(false)

let observer: IntersectionObserver | null = null

function play () {
  video.value?.play().then(() => { playing.value = true }).catch(() => {
    // Autoplay can still be refused (e.g. battery saver); the poster stays up.
  })
}

function pause () {
  video.value?.pause()
  playing.value = false
}

onMounted(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  observer = new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting) {
      loaded.value = true
      if (!reducedMotion) nextTick(play)
    } else {
      pause()
    }
  }, { rootMargin: '300px 0px' })

  if (root.value) observer.observe(root.value)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <article ref="root" class="tile" :style="{ aspectRatio: `${loop.width} / ${loop.height}` }">
    <button class="tile__hit" type="button" @click="$emit('open', loop.id)">
      <span class="visually-hidden">{{ loop.title }} abspielen</span>
    </button>

    <img v-show="!playing" class="tile__poster" :src="loop.poster" :alt="loop.title" loading="lazy">

    <video
      v-if="loaded"
      ref="video"
      class="tile__video"
      :src="loop.video"
      :poster="loop.poster"
      muted
      loop
      playsinline
      preload="metadata"
      disablepictureinpicture
      tabindex="-1"
    />

    <footer class="tile__meta">
      <span class="tile__title">{{ loop.title }}</span>
      <span class="tile__duration">{{ formatDuration(loop.duration) }}</span>
    </footer>
  </article>
</template>

<style scoped>
.tile {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-raised);
  transition: border-color 0.15s, transform 0.15s;
}

.tile:hover,
.tile:focus-within {
  border-color: var(--accent);
  transform: translateY(-2px);
}

.tile__hit {
  position: absolute;
  inset: 0;
  z-index: 2;
}

.tile__poster,
.tile__video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tile__poster {
  position: absolute;
  inset: 0;
}

.tile__meta {
  position: absolute;
  inset: auto 0 0;
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
  justify-content: space-between;
  padding: 1.75rem 0.6rem 0.5rem;
  background: linear-gradient(transparent, rgb(0 0 0 / 85%));
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
}

.tile:hover .tile__meta,
.tile:focus-within .tile__meta {
  opacity: 1;
}

.tile__title {
  overflow: hidden;
  font-size: 0.85rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile__duration {
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
  font-size: 0.8rem;
}
</style>
