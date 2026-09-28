<script setup lang="ts">
  import type { Loop } from '~/types/loop'

  const props = defineProps<{ loop: Loop }>()

  const { prefs, persistPrefs, loadPrefs } = useLoops()

  const video = ref<HTMLVideoElement | null>(null)
  const currentTime = ref(0)
  const duration = ref(0)
  const paused = ref(false)
  /**
   * Whether the element is actually silent. `prefs.muted` is what the human wants,
   * this is what the browser allows — an autoplay policy pulls them apart, and the
   * controls have to show the second one.
   */
  const muted = ref(false)
  /** Set when the browser refused to start playback with sound. */
  const refused = ref(false)

  /**
   * The browser's silence contradicts what the human asked for. Saying it that way
   * instead of setting and clearing a flag means every path back to sound — the button,
   * `M`, the volume slider — takes the hint down by making the two agree again, and a
   * deliberate mute afterwards does not bring the browser's excuse back.
   */
  const blocked = computed(() => refused.value && muted.value && !prefs.value.muted)

  const progress = computed(() => (duration.value ? currentTime.value / duration.value : 0))

  /** Whole seconds are all assistive tech needs, and they keep the attribute from churning. */
  const positionSeconds = computed(() => Math.round(currentTime.value))
  const durationSeconds = computed(() => Math.round(duration.value))
  const positionLabel = computed(
    () => `${formatDuration(currentTime.value)} von ${formatDuration(duration.value)}`,
  )

  /**
   * How far one page step seeks — a share of the loop rather than a fixed number of
   * seconds, because the loops run from eight seconds to four minutes.
   */
  const PAGE_STEP = 0.1
  /** Seeking exactly to the end would wrap a looping video straight back to the start. */
  const END_EPSILON = 0.05

  function applyPrefs() {
    const element = video.value
    if (!element) {
      return
    }
    element.volume = prefs.value.volume
    element.muted = prefs.value.muted
    // `volumechange` arrives a task later, and the icon must not lag a frame behind the
    // click that caused it.
    onVolumeChange()
  }

  async function start() {
    const element = video.value
    if (!element) {
      return
    }

    applyPrefs()
    // The new source starts over, so the slider has to follow before the first timeupdate.
    onTimeUpdate()
    try {
      await element.play()
      refused.value = false
    } catch {
      // Fall back to a muted start so something plays; the user can unmute. `prefs` stays
      // untouched — a browser policy is no reason to write `muted: true` into storage.
      element.muted = true
      onVolumeChange()
      refused.value = true
      await element.play().catch(() => {})
    }
  }

  function onTimeUpdate() {
    const element = video.value
    if (!element) {
      return
    }
    currentTime.value = element.currentTime
    // `duration` is NaN until the metadata has arrived.
    duration.value = Number.isFinite(element.duration) ? element.duration : 0
  }

  function onPlayState() {
    paused.value = video.value?.paused ?? true
  }

  /** The element's own report — it also fires when the browser mutes on its own. */
  function onVolumeChange() {
    muted.value = video.value?.muted ?? false
  }

  function seekTo(seconds: number) {
    const element = video.value
    if (!element?.duration) {
      return
    }

    element.currentTime = Math.min(Math.max(seconds, 0), element.duration)
    currentTime.value = element.currentTime
  }

  function seek(event: MouseEvent) {
    const element = video.value
    const bar = event.currentTarget as HTMLElement
    if (!element?.duration) {
      return
    }

    const ratio = (event.clientX - bar.getBoundingClientRect().left) / bar.offsetWidth
    seekTo(ratio * element.duration)
  }

  /**
   * The bar is a slider, but ← and → stay with the loop navigation of the page around it
   * — so paging and Home/End are what is left to seek with.
   */
  function onBarKeydown(event: KeyboardEvent) {
    const element = video.value
    if (!element?.duration) {
      return
    }

    const step = element.duration * PAGE_STEP
    const targets: Record<string, number | undefined> = {
      PageUp: element.currentTime + step,
      PageDown: element.currentTime - step,
      Home: 0,
      End: element.duration - END_EPSILON,
    }
    const target = targets[event.key]
    if (target === undefined) {
      return
    }

    event.preventDefault()
    seekTo(target)
  }

  function toggleMute() {
    // Inverting what is audible, not what is stored: after a refused autoplay the two
    // differ, and the button owes its answer to the icon the user pressed.
    prefs.value.muted = !muted.value
    applyPrefs()
    persistPrefs()
  }

  function setVolume(event: Event) {
    prefs.value.volume = Number((event.target as HTMLInputElement).value)
    prefs.value.muted = false
    applyPrefs()
    persistPrefs()
  }

  function togglePlay() {
    const element = video.value
    if (!element) {
      return
    }
    if (element.paused) {
      void element.play().catch(() => {})
    } else {
      element.pause()
    }
  }

  function onKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement
    // A shortcut of the page must not eat a keystroke meant for a field, and a modifier
    // turns it into a browser or system shortcut (⌘M minimises, Ctrl+M is the reader's).
    if (target.tagName === 'INPUT' || event.ctrlKey || event.metaKey || event.altKey) {
      return
    }

    if (event.key === ' ') {
      // Space activates whatever button has the focus; taking it away would leave the
      // controls unusable from the keyboard.
      if (target.tagName === 'BUTTON' || target.tagName === 'A') {
        return
      }
      event.preventDefault()
      togglePlay()
    } else if (event.key.toLowerCase() === 'm') {
      // `event.key` is 'M' with Shift or CapsLock, and the README spells the key that way.
      event.preventDefault()
      toggleMute()
    }
  }

  // Navigating between loops keeps this component mounted, so restart explicitly.
  watch(
    () => props.loop.id,
    () => nextTick(start),
  )

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
      @loadedmetadata="onTimeUpdate"
      @play="onPlayState"
      @pause="onPlayState"
      @volumechange="onVolumeChange"
      @click="togglePlay"
    />

    <div
      class="player__progress"
      role="slider"
      tabindex="0"
      aria-label="Position im Loop"
      aria-valuemin="0"
      :aria-valuemax="durationSeconds"
      :aria-valuenow="positionSeconds"
      :aria-valuetext="positionLabel"
      @click="seek"
      @keydown="onBarKeydown"
    >
      <div class="player__progress-fill" :style="{ transform: `scaleX(${progress})` }" />
    </div>

    <div class="player__controls">
      <button
        class="button"
        type="button"
        :title="paused ? 'Weiter (Leertaste)' : 'Pause (Leertaste)'"
        :aria-label="paused ? 'Weiter' : 'Pause'"
        @click="togglePlay"
      >
        {{ paused ? '▶️' : '⏸️' }}
      </button>
      <button
        class="button"
        type="button"
        :title="muted ? 'Ton an (M)' : 'Stumm (M)'"
        :aria-label="muted ? 'Ton an' : 'Stumm'"
        @click="toggleMute"
      >
        {{ muted ? '🔇' : '🔊' }}
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
      />
      <p v-if="blocked" class="player__blocked">
        Der Browser hat den Ton blockiert — auf den Knopf tippen oder M drücken.
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
