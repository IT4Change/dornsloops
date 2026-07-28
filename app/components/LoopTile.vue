<script setup lang="ts">
import type { Loop } from '~/types/loop'

// The wall shows posters only — playing 19 muted videos at once pulled the
// whole library over the wire on every visit. The video starts on the detail
// page.
defineProps<{ loop: Loop }>()
</script>

<template>
  <article class="tile" :style="{ aspectRatio: `${loop.width} / ${loop.height}` }">
    <NuxtLink class="tile__hit" :to="`/loop/${loop.id}`">
      <span class="visually-hidden">{{ loop.title }} abspielen</span>
    </NuxtLink>

    <img
      class="tile__poster"
      :src="loop.poster"
      :alt="loop.title"
      :width="loop.width"
      :height="loop.height"
      loading="lazy"
      decoding="async"
    >

    <span class="tile__duration">{{ formatDuration(loop.duration) }}</span>

    <footer class="tile__meta">
      <span class="tile__title">{{ loop.title }}</span>
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
  z-index: 2;
  inset: 0;
}

.tile__poster {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Stands in for the missing motion: marks the tile as a video at a glance. */
.tile__duration {
  position: absolute;
  right: 0.4rem;
  bottom: 0.4rem;
  padding: 0.05rem 0.35rem;
  border-radius: 4px;
  background: rgb(0 0 0 / 70%);
  color: #fff;
  font-variant-numeric: tabular-nums;
  font-size: 0.75rem;
  line-height: 1.5;
}

.tile__meta {
  position: absolute;
  inset: auto 0 0;
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
  display: block;
  /* Keep clear of the duration badge. */
  padding-right: 3rem;
  overflow: hidden;
  font-size: 0.85rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
