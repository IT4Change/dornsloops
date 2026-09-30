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
 * spec mocks it. Built so every rule the composable applies has something to bite on, with
 * the same shapes the real data has:
 *
 * - `Video`/`sound`/`loop` are generic tags in three spellings, `Musik`/`musik` is one the
 *   ingest script has always known and the filter bar used to miss;
 * - `sandstorm` sits on three loops in three spellings, all tied, so the button has to fall
 *   back to the one seen first;
 * - `techno` is on three loops, twice lower case — a majority the button follows;
 * - `chill` is on two loops but written three times, because loop 3 carries both spellings:
 *   the count is loops, the spelling is a vote, and the two must not be the same number;
 * - `sandstorm` and `techno` tie at three, so the alphabetical tiebreak has to decide;
 * - `solo` sits on a single loop, below the bar's threshold;
 * - only loop 4 credits an earlier source, and loop 5 has no tags at all — pr0gramm hands
 *   those out too;
 * - only loop 2 carries an `audioFix`, so the detail page has one loop with two credits to
 *   print and four with one.
 *
 * Four minutes in total.
 */
export const WALL: readonly Loop[] = [
  makeLoop({
    id: 1,
    title: 'Loop 1',
    tags: ['techno', 'Sandstorm', 'Video', 'Musik'],
    duration: 30,
  }),
  makeLoop({
    id: 2,
    title: 'Loop 2',
    tags: ['Techno', 'sandstorm', 'sound', 'musik'],
    duration: 90,
    audioFix: {
      source: {
        platform: 'pr0gramm',
        url: 'https://pr0gramm.com/new/222',
        uploader: 'somebody else',
        postedAt: '2026-06-25T22:35:18.000Z',
        original: null,
      },
      offset: 14.4837,
      videoRate: 1.052632,
      reason: 'Der eigene Ton dieses Posts ist kaputt.',
    },
  }),
  makeLoop({ id: 3, title: 'Loop 3', tags: ['techno', 'chill', 'Chill'], duration: 45 }),
  makeLoop({
    id: 4,
    title: 'Loop 4',
    tags: ['SANDSTORM', 'Chill', 'solo', 'loop'],
    duration: 15,
    source: { ...makeLoop({ id: 4 }).source, original: 'https://youtube.com/watch?v=x' },
  }),
  makeLoop({ id: 5, title: 'Loop 5', tags: [], duration: 60 }),
]
