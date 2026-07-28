<script setup lang="ts">
import type { Loop } from '~/types/loop'

const props = defineProps<{ loop: Loop; position: number; total: number }>()
const emit = defineEmits<{ close: []; next: []; previous: [] }>()

const { prefs, persistPrefs } = useLoops()

const video = ref<HTMLVideoElement | null>(null)
const progress = ref(0)
const repeats = ref(0)
/** Set when the browser refused to start playback with sound. */
const blocked = ref(false)

const repeatLabel = computed(() =>
  prefs.value.repeats === 0 ? 'Endlos' : `${prefs.value.repeats}×`)

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
  repeats.value = 0
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

function onEnded () {
  repeats.value++
  const limit = prefs.value.repeats
  if (limit > 0 && repeats.value >= limit) {
    emit('next')
    return
  }
  const element = video.value
  if (element) {
    element.currentTime = 0
    element.play().catch(() => {})
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

function cycleRepeats () {
  const steps = [1, 2, 3, 5, 0]
  const index = steps.indexOf(prefs.value.repeats)
  prefs.value.repeats = steps[(index + 1) % steps.length]!
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

  const actions: Record<string, () => void> = {
    Escape: () => emit('close'),
    ArrowRight: () => emit('next'),
    ArrowLeft: () => emit('previous'),
    ' ': togglePlay,
    m: toggleMute,
  }
  const action = actions[event.key]
  if (!action) return

  event.preventDefault()
  action()
}

// Switching loops keeps the overlay mounted, so restart explicitly.
watch(() => props.loop.id, () => nextTick(start))

onMounted(() => {
  start()
  window.addEventListener('keydown', onKeydown)
  document.body.style.overflow = 'hidden'
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="player" role="dialog" aria-modal="true" :aria-label="loop.title">
    <div class="player__backdrop" @click="emit('close')" />

    <button class="player__nav player__nav--prev button" type="button" title="Vorheriger Loop (←)" @click="emit('previous')">
      ◀
    </button>

    <div class="player__stage">
      <video
        ref="video"
        class="player__video"
        :src="loop.video"
        :poster="loop.poster"
        autoplay
        playsinline
        @ended="onEnded"
        @timeupdate="onTimeUpdate"
        @click="togglePlay"
      />

      <div class="player__progress" @click="seek">
        <div class="player__progress-fill" :style="{ transform: `scaleX(${progress})` }" />
      </div>

      <div class="player__bar">
        <div class="player__info">
          <h2 class="player__title">{{ loop.title }}</h2>
          <p class="player__source">
            <a :href="loop.source.url" target="_blank" rel="noopener noreferrer">
              {{ loop.source.platform }}/{{ loop.id }} ↗
            </a>
            <span>· hochgeladen von {{ loop.source.uploader }}</span>
            <span class="player__count">· {{ position }} / {{ total }}</span>
          </p>
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
          <button class="button" type="button" title="Wiederholungen bis zum nächsten Loop" @click="cycleRepeats">
            ⟳ {{ repeatLabel }}
          </button>
          <button class="button" type="button" title="Schließen (Esc)" @click="emit('close')">
            ✕
          </button>
        </div>
      </div>

      <p v-if="blocked" class="player__blocked">
        Der Browser hat den Ton blockiert — auf 🔊 tippen.
      </p>
    </div>

    <button class="player__nav player__nav--next button" type="button" title="Nächster Loop (→)" @click="emit('next')">
      ▶
    </button>
  </div>
</template>

<style scoped>
.player {
  position: fixed;
  z-index: 20;
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  inset: 0;
}

.player__backdrop {
  position: absolute;
  background: rgb(4 4 8 / 92%);
  inset: 0;
}

.player__stage {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  /* Shrink to the video's own width so the meta bar stays flush with it,
     even for portrait loops. */
  width: fit-content;
  min-width: min(100%, 26rem);
  max-width: min(100%, 1100px);
}

.player__video {
  width: auto;
  max-width: 100%;
  max-height: calc(100vh - 9rem);
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

.player__bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
}

.player__title {
  margin: 0;
  font-size: 1rem;
}

.player__source {
  margin: 0.15rem 0 0;
  color: var(--fg-muted);
  font-size: 0.85rem;
}

.player__source a {
  text-decoration: none;
}

.player__source a:hover {
  text-decoration: underline;
}

.player__count {
  font-variant-numeric: tabular-nums;
}

.player__controls {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.player__volume {
  width: 5rem;
  accent-color: var(--accent);
}

.player__nav {
  position: relative;
  z-index: 1;
  flex: none;
  padding: 1rem 0.7rem;
}

.player__blocked {
  margin: 0;
  color: var(--fg-muted);
  font-size: 0.85rem;
  text-align: center;
}

@media (width < 720px) {
  .player__nav {
    position: absolute;
    top: 50%;
    translate: 0 -50%;
  }

  .player__nav--prev {
    left: 0.5rem;
  }

  .player__nav--next {
    right: 0.5rem;
  }
}
</style>
