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
}

export const LOOPS = JSON.parse(
  readFileSync(new URL('../content/loops.json', import.meta.url), 'utf8'),
) as Loop[]

/** The loop the wall shows first, and the one `→` steps to from it. */
export const FIRST = LOOPS[0]!
export const SECOND = LOOPS[1]!
export const LAST = LOOPS[LOOPS.length - 1]!
