import genericTagList from '~~/content/generic-tags.json'
import loopsData from '~~/content/loops.json'

import type { Loop } from '~/types/loop'

const STORAGE_KEY = 'dornsloops:prefs'

/**
 * Tags that describe the medium, the provenance or the post's rating rather than the loop.
 * The list lives in `content/` because the ingest script reads the same one to decide which
 * tag can stand in for a title — two lists answering that question gave two answers, and
 * `Musik` ended up a filter button while the title guesser called it meaningless.
 * Everything in it is lower case; matching folds the tag first.
 */
const GENERIC_TAGS = new Set(genericTagList)

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
  /** Folded to lower case — the identity every comparison runs against. */
  tag: string
  /** The spelling the bar shows, picked from the ones the data actually uses. */
  label: string
  count: number
}

/** Where a loop sits in the queue, and what steps away from it. */
export interface Neighbours {
  previous: Loop | null
  next: Loop | null
  position: number
  total: number
}

/**
 * One tag while it is being counted: how often each spelling of it was seen, and on how many
 * loops it sits at all. The two are different numbers — see the loop that fills it.
 */
interface TagGroup {
  spellings: Map<string, number>
  count: number
}

/**
 * Which spelling the bar shows for a tag. The most used one is the honest answer — it is
 * how the data mostly writes it — and a tie goes to the one seen first, which is the
 * spelling of the newest loop carrying it. `Map` keeps insertion order, so the strict `>`
 * is what leaves the earlier one standing.
 */
function commonestSpelling(spellings: Map<string, number>): string {
  let best = ''
  let seen = 0
  for (const [spelling, count] of spellings) {
    if (count > seen) {
      best = spelling
      seen = count
    }
  }
  return best
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
    const groups = new Map<string, TagGroup>()
    for (const loop of allLoops) {
      // pr0gramm hands out `Feet` and `feet` as two tags, and a loop can carry both. The
      // number on the button counts loops, not mentions, so each tag scores once per loop —
      // while every spelling still gets its vote on how the button is written.
      const counted = new Set<string>()
      for (const spelling of loop.tags) {
        const tag = spelling.toLowerCase()
        if (GENERIC_TAGS.has(tag)) {
          continue
        }
        const group = groups.get(tag) ?? { spellings: new Map<string, number>(), count: 0 }
        group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + 1)
        if (!counted.has(tag)) {
          counted.add(tag)
          group.count += 1
        }
        groups.set(tag, group)
      }
    }
    return [...groups.entries()]
      .filter(([, group]) => group.count > 1)
      .sort(([left, a], [right, b]) => b.count - a.count || left.localeCompare(right))
      .map(([tag, group]) => ({
        tag,
        label: commonestSpelling(group.spellings),
        count: group.count,
      }))
  })

  /** The loops on screen — also the queue the detail page steps through. */
  const loops = computed(() => {
    const tag = activeTag.value
    // Folded, like the count that produced the button: an exact `includes` would leave the
    // loops tagged `Original Content` out of a filter whose button says five.
    return tag === null
      ? allLoops
      : allLoops.filter((loop) => loop.tags.some((entry) => entry.toLowerCase() === tag))
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

  /** Folds what it is handed, so a tag pressed on the detail page hits the same filter. */
  function setTag(tag: string | null): void {
    const next = tag === null ? null : tag.toLowerCase()
    activeTag.value = activeTag.value === next ? null : next
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
