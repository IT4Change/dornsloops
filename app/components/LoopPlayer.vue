<script setup lang="ts">
import type { Loop } from '~/types/loop'

const props = defineProps<{ loop: Loop }>()

const { prefs, persistPrefs, loadPrefs } = useLoops()

const video = ref<HTMLVideoElement | null>(null)
const progress = ref(0)
/** Set when the browser refused to start playback with sound. */
const blocked = ref(false)

function applyPrefs () {
  const element = video.value
  if (!element) return
  element.volume = prefs.value.volume
  element.muted = prefs.value.muted
}

async function start () {
  const element = video.value
  if (!element) return

  applyPrefs()
  try {
    await element.play()
    blocked.value = false
  } catch {
    // Fall back to a muted start so something plays; the user can unmute.
    element.muted = true
    blocked.value = true
    await element.play().catch(() => {})
  }
}

function onTimeUpdate () {
  const element = video.value
  progress.value = element?.duration ? element.currentTime / element.duration : 0
}

function seek (event: MouseEvent) {
  const element = video.value
  const bar = event.currentTarget as HTMLElement
  if (!element?.duration) return

  const ratio = (event.clientX - bar.getBoundingClientRect().left) / bar.offsetWidth
  element.currentTime = Math.min(Math.max(ratio, 0), 1) * element.duration
}

function toggleMute () {
  prefs.value.muted = !prefs.value.muted
  blocked.value = false
  applyPrefs()
  persistPrefs()
}

function setVolume (event: Event) {
  prefs.value.volume = Number((event.target as HTMLInputElement).value)
  prefs.value.muted = false
  applyPrefs()
  persistPrefs()
}

function togglePlay () {
  const element = video.value
  if (!element) return
  element.paused ? element.play().catch(() => {}) : element.pause()
}

function onKeydown (event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT') return

  if (event.key === ' ') {
    event.preventDefault()
    togglePlay()
  } else if (event.key === 'm') {
    event.preventDefault()
    toggleMute()
  }
}

// Navigating between loops keeps this component mounted, so restart explicitly.
watch(() => props.loop.id, () => nextTick(start))

onMounted(() => {
  loadPrefs()
  start()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="player">
    <video
      ref="video"
      class="player__video"
      :src="loop.video"
      :poster="loop.poster"
      autoplay
      loop
      playsinline
      @timeupdate="onTimeUpdate"
      @click="togglePlay"
    />

    <div class="player__progress" @click="seek">
      <div class="player__progress-fill" :style="{ transform: `scaleX(${progress})` }" />
    </div>

    <div class="player__controls">
      <button class="button" type="button" :title="prefs.muted ? 'Ton an (M)' : 'Stumm (M)'" @click="toggleMute">
        {{ prefs.muted ? '🔇' : '🔊' }}
      </button>
      <input
        class="player__volume"
        type="range"
        min="0"
        max="1"
        step="0.01"
        :value="prefs.volume"
        aria-label="Lautstärke"
        @input="setVolume"
      >
      <p v-if="blocked" class="player__blocked">
        Der Browser hat den Ton blockiert — auf 🔊 tippen.
      </p>
    </div>
  </div>
</template>

<style scoped>
.player {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  /* Shrink to the video's own width so the controls stay flush with it,
     even for portrait loops. */
  width: fit-content;
  max-width: 100%;
  margin: 0 auto;
}

.player__video {
  width: auto;
  max-width: 100%;
  max-height: calc(100vh - 12rem);
  border-radius: var(--radius);
  background: #000;
  object-fit: contain;
  cursor: pointer;
}

.player__progress {
  height: 6px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--bg-raised);
  cursor: pointer;
}

.player__progress-fill {
  height: 100%;
  background: var(--accent);
  transform-origin: left;
}

.player__controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.player__volume {
  width: 6rem;
  accent-color: var(--accent);
}

.player__blocked {
  margin: 0;
  color: var(--fg-muted);
  font-size: 0.85rem;
}
</style>
