import loopsData from '~~/content/loops.json'
import type { Loop } from '~/types/loop'

const STORAGE_KEY = 'dornsloops:prefs'

/** Tags that are true of nearly every loop and therefore useless as a filter. */
const HIDDEN_TAGS = new Set(['video', 'sound', 'loop', 'ton', 'mit ton', 'webm'])

const allLoops = (loopsData as Loop[]).slice()

export interface Preferences {
  volume: number
  muted: boolean
}

const DEFAULT_PREFS: Preferences = {
  volume: 0.8,
  muted: false,
}

export function useLoops () {
  const activeTag = useState<string | null>('loops:tag', () => null)
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

  /** The loops on screen — also the queue the detail page steps through. */
  const loops = computed(() => activeTag.value
    ? allLoops.filter(loop => loop.tags.includes(activeTag.value!))
    : allLoops)

  function byId (id: number): Loop | null {
    return allLoops.find(loop => loop.id === id) ?? null
  }

  /**
   * Stepping stays inside the active filter, but a loop reached directly by URL
   * may sit outside it — then the full list is the queue.
   */
  function neighbours (id: number) {
    const queue = loops.value.some(loop => loop.id === id) ? loops.value : allLoops
    const index = queue.findIndex(loop => loop.id === id)
    if (index < 0) return { previous: null, next: null, position: 0, total: queue.length }

    return {
      previous: queue[(index - 1 + queue.length) % queue.length]!,
      next: queue[(index + 1) % queue.length]!,
      position: index + 1,
      total: queue.length,
    }
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
    prefs,
    byId,
    neighbours,
    setTag,
    loadPrefs,
    persistPrefs,
  }
}

export function formatDuration (seconds: number): string {
  const total = Math.round(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
