import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { formatDuration, useLoops } from './useLoops'

import type { Loop } from '~/types/loop'

// The composable reads the data file at import time, so the wall under test has to be in
// place before it loads.
vi.mock('~~/content/loops.json', async () => ({ default: (await import('~/test/fixtures')).WALL }))

/** The ids of a list, which is all any of these assertions is about. */
function ids(loops: readonly Loop[]): number[] {
  return loops.map((loop) => loop.id)
}

beforeEach(() => {
  clearNuxtState()
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the wall', () => {
  it('starts unfiltered, in the order the data file has', () => {
    const { loops, activeTag } = useLoops()

    expect(activeTag.value).toBeNull()
    expect(ids(loops.value)).toStrictEqual([1, 2, 3, 4, 5])
  })

  it('narrows to the loops carrying the active tag', () => {
    const { loops, setTag } = useLoops()

    setTag('sandstorm')

    expect(ids(loops.value)).toStrictEqual([1, 2, 4])
  })

  it('shows nothing rather than everything for a tag no loop carries', () => {
    const { loops, setTag } = useLoops()

    setTag('nothing here')

    expect(loops.value).toStrictEqual([])
  })

  it('keeps the full list reachable while a filter is on', () => {
    const { loops, allLoops, setTag } = useLoops()

    setTag('chill')

    expect(ids(loops.value)).toStrictEqual([3, 4])
    expect(ids(allLoops)).toStrictEqual([1, 2, 3, 4, 5])
  })
})

describe('the tag bar', () => {
  it('ranks tags by how many loops carry them, then alphabetically', () => {
    const { tags } = useLoops()

    // `sandstorm` and `techno` tie at three, so the second criterion decides.
    expect(tags.value).toStrictEqual([
      { tag: 'sandstorm', count: 3 },
      { tag: 'techno', count: 3 },
      { tag: 'chill', count: 2 },
    ])
  })

  it('drops tags that describe the medium, whatever their casing', () => {
    const { tags } = useLoops()
    const listed = tags.value.map((entry) => entry.tag)

    expect(listed).not.toContain('Video')
    expect(listed).not.toContain('sound')
    expect(listed).not.toContain('loop')
  })

  it('drops a tag that only one loop carries — it filters to itself', () => {
    const { tags } = useLoops()
    const listed = tags.value.map((entry) => entry.tag)

    expect(listed).not.toContain('solo')
  })
})

describe('setTag', () => {
  it('sets the tag that was asked for', () => {
    const { activeTag, setTag } = useLoops()

    setTag('techno')

    expect(activeTag.value).toBe('techno')
  })

  it('clears the filter when the tag that is already active is pressed again', () => {
    const { activeTag, setTag } = useLoops()

    setTag('techno')
    setTag('techno')

    expect(activeTag.value).toBeNull()
  })

  it('replaces one filter with the next rather than combining them', () => {
    const { activeTag, setTag } = useLoops()

    setTag('techno')
    setTag('sandstorm')

    expect(activeTag.value).toBe('sandstorm')
  })

  it('takes null as the way back to the whole wall', () => {
    const { activeTag, setTag } = useLoops()

    setTag('techno')
    setTag(null)

    expect(activeTag.value).toBeNull()
  })
})

describe('byId', () => {
  it('finds the loop with that id', () => {
    expect(useLoops().byId(3)?.title).toBe('Loop 3')
  })

  it('answers null for an id that is not on the wall', () => {
    expect(useLoops().byId(99)).toBeNull()
  })
})

describe('neighbours', () => {
  /** The step before and after reduced to their ids, which is all these assertions are about. */
  function around(id: number) {
    const { previous, next, position, total } = useLoops().neighbours(id)
    return { previous: previous?.id ?? null, next: next?.id ?? null, position, total }
  }

  it('names the loop before and after, and the position in the queue', () => {
    expect(around(2)).toStrictEqual({ previous: 1, next: 3, position: 2, total: 5 })
  })

  it('wraps at the front of the list', () => {
    expect(around(1)).toStrictEqual({ previous: 5, next: 2, position: 1, total: 5 })
  })

  it('wraps at the end of the list', () => {
    expect(around(5)).toStrictEqual({ previous: 4, next: 1, position: 5, total: 5 })
  })

  it('steps inside the active filter, skipping what it hides', () => {
    useLoops().setTag('sandstorm') // loops 1, 2 and 4

    expect(around(2)).toStrictEqual({ previous: 1, next: 4, position: 2, total: 3 })
  })

  it('points back at the single loop of a queue of one', () => {
    useLoops().setTag('solo')

    expect(around(4)).toStrictEqual({ previous: 4, next: 4, position: 1, total: 1 })
  })

  it('falls back to the whole wall for a loop reached by URL from outside the filter', () => {
    useLoops().setTag('solo') // only loop 4

    expect(around(1)).toStrictEqual({ previous: 5, next: 2, position: 1, total: 5 })
  })

  it('has no neighbours at all for an id that is nowhere', () => {
    expect(around(99)).toStrictEqual({ previous: null, next: null, position: 0, total: 5 })
  })
})

describe('preferences', () => {
  const STORAGE_KEY = 'dornsloops:prefs'

  it('starts at four fifths volume, unmuted', () => {
    expect(useLoops().prefs.value).toStrictEqual({ volume: 0.8, muted: false })
  })

  it('writes the current preferences to storage', () => {
    const { prefs, persistPrefs } = useLoops()

    prefs.value = { volume: 0.25, muted: true }
    persistPrefs()

    expect(localStorage.getItem(STORAGE_KEY)).toBe('{"volume":0.25,"muted":true}')
  })

  it('reads back what it wrote', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ volume: 0.25, muted: true }))
    const { prefs, loadPrefs } = useLoops()

    loadPrefs()

    expect(prefs.value).toStrictEqual({ volume: 0.25, muted: true })
  })

  it('leaves the defaults alone when nothing was ever stored', () => {
    const { prefs, loadPrefs } = useLoops()

    loadPrefs()

    expect(prefs.value).toStrictEqual({ volume: 0.8, muted: false })
  })

  it('fills in the default for a field an older version did not store', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ volume: 0.25 }))
    const { prefs, loadPrefs } = useLoops()

    loadPrefs()

    expect(prefs.value).toStrictEqual({ volume: 0.25, muted: false })
  })

  it('ignores a stored field whose type it cannot use', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ volume: 'loud', muted: 'yes' }))
    const { prefs, loadPrefs } = useLoops()

    loadPrefs()

    expect(prefs.value).toStrictEqual({ volume: 0.8, muted: false })
  })

  it('survives a corrupt entry instead of taking the page down', () => {
    localStorage.setItem(STORAGE_KEY, '{ not json')
    const { prefs, loadPrefs } = useLoops()

    expect(() => {
      loadPrefs()
    }).not.toThrow()
    expect(prefs.value).toStrictEqual({ volume: 0.8, muted: false })
  })

  it('survives storage that refuses to be read — private mode, blocked cookies', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('access denied')
    })
    const { prefs, loadPrefs } = useLoops()

    expect(() => {
      loadPrefs()
    }).not.toThrow()
    expect(prefs.value).toStrictEqual({ volume: 0.8, muted: false })
  })

  it('survives storage that refuses to be written — quota, private mode', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    const { persistPrefs } = useLoops()

    expect(() => {
      persistPrefs()
    }).not.toThrow()
  })
})

describe(formatDuration, () => {
  it.each([
    [0, '0:00'],
    [9.4, '0:09'],
    [59.6, '1:00'],
    [65, '1:05'],
    [90, '1:30'],
    [125.6, '2:06'],
    [3600, '60:00'],
  ])('renders %d seconds as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected)
  })
})
