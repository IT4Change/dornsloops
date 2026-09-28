import type { Loop } from '~/types/loop'

/**
 * A loop as `content/loops.json` holds one. Shared by the component specs so a change to
 * the record's shape breaks in one place rather than in four.
 */
export function makeLoop(overrides: Partial<Loop> = {}): Loop {
  const id = overrides.id ?? 7077671

  return {
    id,
    title: 'Sandstorm',
    tags: ['Sandstorm', 'Darude', 'video'],
    featured: false,
    source: {
      platform: 'pr0gramm',
      url: `https://pr0gramm.com/new/${String(id)}`,
      uploader: 'someone',
      postedAt: '2026-09-26T19:34:16.000Z',
      original: null,
    },
    width: 1280,
    height: 720,
    duration: 100,
    video: `/loops/${String(id)}.mp4`,
    poster: `/loops/${String(id)}.jpg`,
    bytes: 2912664,
    variant: 'h264-low_res',
    addedAt: '2026-09-27T00:32:06.179Z',
    ...overrides,
  }
}

/**
 * A wall small enough to reason about, standing in for `content/loops.json` wherever a
 * spec mocks it. Built so every rule the composable applies has something to bite on:
 * `Video`/`sound`/`loop` are hidden tags in three spellings, `solo` sits on a single loop,
 * `chill` on two, `techno` and `sandstorm` tie at three so the alphabetical tiebreak has
 * to decide, only loop 4 carries a credit to an earlier source, and loop 5 has no tags at
 * all — pr0gramm hands those out too. Four minutes in total.
 */
export const WALL: readonly Loop[] = [
  makeLoop({ id: 1, title: 'Loop 1', tags: ['techno', 'sandstorm', 'Video'], duration: 30 }),
  makeLoop({ id: 2, title: 'Loop 2', tags: ['techno', 'sandstorm', 'sound'], duration: 90 }),
  makeLoop({ id: 3, title: 'Loop 3', tags: ['techno', 'chill'], duration: 45 }),
  makeLoop({
    id: 4,
    title: 'Loop 4',
    tags: ['sandstorm', 'chill', 'solo', 'loop'],
    duration: 15,
    source: { ...makeLoop({ id: 4 }).source, original: 'https://youtube.com/watch?v=x' },
  }),
  makeLoop({ id: 5, title: 'Loop 5', tags: [], duration: 60 }),
]
