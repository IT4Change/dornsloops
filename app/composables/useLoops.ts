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

/** A tag and how many loops carry it. */
export interface TagCount {
  tag: string
  count: number
}

/** Where a loop sits in the queue, and what steps away from it. */
export interface Neighbours {
  previous: Loop | null
  next: Loop | null
  position: number
  total: number
}

export interface Loops {
  allLoops: readonly Loop[]
  loops: ComputedRef<readonly Loop[]>
  tags: ComputedRef<readonly TagCount[]>
  activeTag: Ref<string | null>
  prefs: Ref<Preferences>
  byId: (id: number) => Loop | null
  neighbours: (id: number) => Neighbours
  setTag: (tag: string | null) => void
  loadPrefs: () => void
  persistPrefs: () => void
}

export function useLoops(): Loops {
  const activeTag = useState<string | null>('loops:tag', () => null)
  const prefs = useState<Preferences>('loops:prefs', () => ({ ...DEFAULT_PREFS }))

  const tags = computed(() => {
    const counts = new Map<string, number>()
    for (const loop of allLoops) {
      for (const tag of loop.tags) {
        if (HIDDEN_TAGS.has(tag.toLowerCase())) {
          continue
        }
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }))
  })

  /** The loops on screen — also the queue the detail page steps through. */
  const loops = computed(() => {
    const tag = activeTag.value
    return tag === null ? allLoops : allLoops.filter((loop) => loop.tags.includes(tag))
  })

  function byId(id: number): Loop | null {
    return allLoops.find((loop) => loop.id === id) ?? null
  }

  /**
   * Stepping stays inside the active filter, but a loop reached directly by URL
   * may sit outside it — then the full list is the queue.
   */
  function neighbours(id: number): Neighbours {
    const queue = loops.value.some((loop) => loop.id === id) ? loops.value : allLoops
    const index = queue.findIndex((loop) => loop.id === id)
    if (index < 0) {
      return { previous: null, next: null, position: 0, total: queue.length }
    }

    // Both indices are taken modulo the length, so they always land on an element — but
    // saying so with `??` costs nothing and keeps the shape identical to the miss above.
    return {
      previous: queue[(index - 1 + queue.length) % queue.length] ?? null,
      next: queue[(index + 1) % queue.length] ?? null,
      position: index + 1,
      total: queue.length,
    }
  }

  function setTag(tag: string | null): void {
    activeTag.value = activeTag.value === tag ? null : tag
  }

  function loadPrefs(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw === null) {
        return
      }
      // Whatever a previous version wrote here is unknown, so each field is taken only
      // when it still has the type it is used with.
      const stored = JSON.parse(raw) as Partial<Preferences>
      prefs.value = {
        volume: typeof stored.volume === 'number' ? stored.volume : DEFAULT_PREFS.volume,
        muted: typeof stored.muted === 'boolean' ? stored.muted : DEFAULT_PREFS.muted,
      }
    } catch {
      // Corrupt or blocked storage is not worth failing over.
    }
  }

  function persistPrefs(): void {
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

export function formatDuration(seconds: number): string {
  const total = Math.round(seconds)
  return `${String(Math.floor(total / 60))}:${String(total % 60).padStart(2, '0')}`
}
