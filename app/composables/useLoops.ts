import loopsData from '~~/content/loops.json'
import type { Loop } from '~/types/loop'

const STORAGE_KEY = 'dornsloops:prefs'

/** Tags that are true of nearly every loop and therefore useless as a filter. */
const HIDDEN_TAGS = new Set(['video', 'sound', 'loop', 'ton', 'mit ton', 'webm'])

const allLoops = (loopsData as Loop[]).slice()

export interface Preferences {
  volume: number
  muted: boolean
  shuffle: boolean
  /** Advance to the next loop after this many repeats; 0 keeps looping forever. */
  repeats: number
}

const DEFAULT_PREFS: Preferences = {
  volume: 0.8,
  muted: false,
  shuffle: false,
  repeats: 3,
}

/**
 * Deterministic shuffle so server and client agree until the user asks for a
 * new order — `Math.random()` during SSR would cause a hydration mismatch.
 */
function shuffleWithSeed<T> (items: T[], seed: number): T[] {
  const result = items.slice()
  let state = seed || 1

  for (let i = result.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) % 4294967296
    const j = state % (i + 1)
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

export function useLoops () {
  const activeTag = useState<string | null>('loops:tag', () => null)
  const currentId = useState<number | null>('loops:current', () => null)
  const shuffleSeed = useState<number>('loops:seed', () => 0)
  const prefs = useState<Preferences>('loops:prefs', () => ({ ...DEFAULT_PREFS }))

  const tags = computed(() => {
    const counts = new Map<string, number>()
    for (const loop of allLoops) {
      for (const tag of loop.tags) {
        if (HIDDEN_TAGS.has(tag.toLowerCase())) continue
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }))
  })

  /** The loops on screen — also the queue the player walks through. */
  const loops = computed(() => {
    const filtered = activeTag.value
      ? allLoops.filter(loop => loop.tags.includes(activeTag.value!))
      : allLoops
    return prefs.value.shuffle ? shuffleWithSeed(filtered, shuffleSeed.value) : filtered
  })

  const current = computed(() => loops.value.find(loop => loop.id === currentId.value) ?? null)
  const currentIndex = computed(() => loops.value.findIndex(loop => loop.id === currentId.value))

  function open (id: number) {
    currentId.value = id
  }

  function close () {
    currentId.value = null
  }

  function step (delta: number) {
    if (!loops.value.length) return
    const index = currentIndex.value
    // Wrap around so the jukebox never dead-ends.
    const next = index < 0 ? 0 : (index + delta + loops.value.length) % loops.value.length
    currentId.value = loops.value[next]!.id
  }

  function reshuffle () {
    shuffleSeed.value = Math.floor(Math.random() * 4294967296)
  }

  function toggleShuffle () {
    prefs.value.shuffle = !prefs.value.shuffle
    if (prefs.value.shuffle) reshuffle()
  }

  function setTag (tag: string | null) {
    activeTag.value = activeTag.value === tag ? null : tag
  }

  function loadPrefs () {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) prefs.value = { ...DEFAULT_PREFS, ...JSON.parse(stored) }
    } catch {
      // Corrupt or blocked storage is not worth failing over.
    }
    if (prefs.value.shuffle && !shuffleSeed.value) reshuffle()
  }

  function persistPrefs () {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs.value))
    } catch {
      // Ignore — private mode, quota, etc.
    }
  }

  return {
    allLoops,
    loops,
    tags,
    activeTag,
    current,
    currentId,
    currentIndex,
    prefs,
    open,
    close,
    next: () => step(1),
    previous: () => step(-1),
    toggleShuffle,
    reshuffle,
    setTag,
    loadPrefs,
    persistPrefs,
  }
}

export function formatDuration (seconds: number): string {
  const total = Math.round(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
