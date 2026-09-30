import { readFileSync } from 'node:fs'

/**
 * The data the suite runs against is the real `content/loops.json` — the same file the
 * build prerenders from. A fixture would prove that the page renders *a* wall; this proves
 * it renders *the* wall, which is what a deploy puts online.
 */
export interface Loop {
  id: number
  title: string
  tags: string[]
  duration: number
  video: string
  poster: string
  width: number
  height: number
  source: { uploader: string; url: string; postedAt: string }
  audioFix?: { source: { uploader: string; url: string }; reason: string }
}

export const LOOPS = JSON.parse(
  readFileSync(new URL('../content/loops.json', import.meta.url), 'utf8'),
) as Loop[]

/** The loop the wall shows first, and the one `→` steps to from it. */
export const FIRST = LOOPS[0]!
export const SECOND = LOOPS[1]!
export const LAST = LOOPS[LOOPS.length - 1]!

/**
 * The loops that play a different post's audio. Empty is a legitimate state of the wall —
 * the suite skips rather than fails when the last mix is taken out again.
 */
export const MIXED = LOOPS.filter((loop) => loop.audioFix)

/**
 * A page step is a tenth of the loop, so the shortest ones move by barely a second — less
 * than the whole seconds the bar reports. Seeking is measured on the longest loop there is,
 * whichever that happens to be after the next ingest.
 */
export const LONGEST = LOOPS.reduce((longest, loop) =>
  loop.duration > longest.duration ? loop : longest,
)
