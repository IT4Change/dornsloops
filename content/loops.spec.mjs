/**
 * `content/loops.json` is input, not code — and it is the only input this project has.
 * `npm run add` writes it, a human edits titles in it, and a takedown removes entries from
 * it by hand. Nothing between that edit and the deploy reads it critically: `nuxt.config.ts`
 * builds the prerender list from the ids, `useLoops` hands the records straight to the
 * template, and `deploy.sh` publishes whatever came out as long as an `index.html` exists.
 *
 * So an entry whose video was deleted is a tile that plays nothing, on a page that answers
 * 200 — and the first to notice is a visitor. This spec is the check that would have
 * noticed: it runs against the committed file rather than a fixture, which is the opposite
 * of what every other suite here does, and deliberately so. The `new loop` commits go
 * straight to `master`, and this is the suite their push has to get past.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA_FILE = join(HERE, 'loops.json')
// The paths in the file are absolute URLs on the site (`/loops/…`), so they resolve against
// `public/` — the directory `nuxt generate` copies verbatim into the release.
const PUBLIC_DIR = join(HERE, '..', 'public')
const MEDIA_DIR = join(PUBLIC_DIR, 'loops')

const raw = await readFile(DATA_FILE, 'utf8')
/** @type {import('../app/types/loop').Loop[]} */
const loops = JSON.parse(raw)

/** The file's size, or `null` when it is not there at all — which is a finding, not an error. */
async function sizeOf(path) {
  try {
    return (await stat(path)).size
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
    return null
  }
}

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== ''
const isPositiveInt = (value) => Number.isInteger(value) && value > 0
const isPositiveNumber = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0

/**
 * `Date.parse` takes almost anything, including `"2026"` and a browser's local-time
 * reading of a date without a zone. Round-tripping through `toISOString` is the assertion
 * that actually holds: the stored string is UTC, unambiguous, and the same one `new Date`
 * gives back — which matters because the detail page formats it for a fixed zone.
 */
const isUtcTimestamp = (value) =>
  isNonEmptyString(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString() === value

const isHttpsUrl = (value) => {
  if (!isNonEmptyString(value)) {
    return false
  }
  return URL.canParse(value) && new URL(value).protocol === 'https:'
}

/**
 * The shape from `app/types/loop.ts`, as something that runs. The two are kept in step by
 * the unknown-field half of the first test: a field added to the interface and written by
 * the ingest fails here until it is described, so the type cannot quietly grow a field the
 * data is never checked against.
 */
const FIELDS = {
  id: isPositiveInt,
  title: isNonEmptyString,
  // A duplicate tag inside one entry would count twice in the filter bar, so the wall
  // would claim more loops behind a tag than a click then shows.
  tags: (value) =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isNonEmptyString) &&
    new Set(value).size === value.length,
  featured: (value) => typeof value === 'boolean',
  source: (value) => typeof value === 'object' && value !== null,
  // Only the hand-mixed and the hand-cut loops carry these, so absent is the normal case.
  audioFix: (value) => value === undefined || (typeof value === 'object' && value !== null),
  edit: (value) => value === undefined || (typeof value === 'object' && value !== null),
  width: isPositiveInt,
  height: isPositiveInt,
  duration: isPositiveNumber,
  // The `/loops/<id>.<ext>` shape is a test of its own, below.
  video: isNonEmptyString,
  poster: isNonEmptyString,
  bytes: isPositiveInt,
  variant: isNonEmptyString,
  addedAt: isUtcTimestamp,
}

const SOURCE_FIELDS = {
  platform: isNonEmptyString,
  url: isHttpsUrl,
  uploader: isNonEmptyString,
  postedAt: isUtcTimestamp,
  // Whatever credit the uploader gave, if any — a URL in the one case there is today, but
  // free text is just as valid a credit.
  original: (value) => value === null || isNonEmptyString(value),
}

const AUDIO_FIX_FIELDS = {
  source: (value) => typeof value === 'object' && value !== null,
  // Where in the other post's audio this loop starts. 0 is a legitimate answer, so this
  // is the one number here that may not be positive.
  offset: (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0,
  // A rate far from 1 is a typo, not an edit: past roughly ±25 % the video no longer looks
  // like the clip somebody wanted to keep.
  videoRate: (value) => isPositiveNumber(value) && value >= 0.75 && value <= 1.25,
  // Shown on the detail page, so it is prose a reader sees rather than an internal note.
  reason: isNonEmptyString,
}

const EDIT_FIELDS = {
  // Shown on the detail page, so it is prose a reader sees rather than an internal note.
  reason: isNonEmptyString,
  // An edit that removed nothing did not happen, and one that removed the whole loop is a
  // slipped decimal point — the check below pins the upper end against the real duration.
  shortenedBy: isPositiveNumber,
}

/** Applies a field map to one nested object and reports what is wrong or unknown. */
function checkShape(value, fields, prefix, report) {
  for (const [field, isValid] of Object.entries(fields)) {
    if (!isValid(value[field])) {
      report(`${prefix}.${field}`)
    }
  }
  for (const field of Object.keys(value)) {
    if (!(field in fields)) {
      report(`${prefix}.${field} (unknown)`)
    }
  }
}

/**
 * Every rule below collects its offenders and expects an empty list, rather than failing
 * on the first one. A wrong data file is usually wrong in more than one place — after a
 * hand edit or an interrupted `npm run add` — and one run should name all of it.
 */
function offendersOf(check) {
  const offenders = []
  for (const loop of loops) {
    // `loop.id` may itself be the broken field; it is still the only handle a reader has.
    check(loop, (field) => offenders.push(`${String(loop.id)}.${field}`))
  }
  return offenders
}

describe('content/loops.json', () => {
  it('holds at least one loop', () => {
    // Everything else passes vacuously on an empty list, including the media checks.
    expect(Array.isArray(loops)).toBe(true)
    expect(loops.length).toBeGreaterThan(0)
  })

  it('carries exactly the fields the app types promise, and no others', () => {
    const offenders = offendersOf((loop, report) => {
      for (const [field, isValid] of Object.entries(FIELDS)) {
        if (!isValid(loop[field])) {
          report(field)
        }
      }
      for (const field of Object.keys(loop)) {
        if (!(field in FIELDS)) {
          report(`${field} (unknown)`)
        }
      }

      if (typeof loop.source === 'object' && loop.source !== null) {
        checkShape(loop.source, SOURCE_FIELDS, 'source', report)
      }

      if (typeof loop.edit === 'object' && loop.edit !== null) {
        checkShape(loop.edit, EDIT_FIELDS, 'edit', report)
      }

      if (typeof loop.audioFix === 'object' && loop.audioFix !== null) {
        checkShape(loop.audioFix, AUDIO_FIX_FIELDS, 'audioFix', report)
        // The replacement audio is a second credit, held to the same standard as the first.
        if (typeof loop.audioFix.source === 'object' && loop.audioFix.source !== null) {
          checkShape(loop.audioFix.source, SOURCE_FIELDS, 'audioFix.source', report)
        }
      }
    })

    expect(offenders).toEqual([])
  })

  it('gives every loop its own id', () => {
    // `byId` takes the first match and `neighbours` the first index, so a duplicate id
    // makes one of the two loops unreachable — from the wall as well as from a deep link.
    const seen = new Map()
    for (const loop of loops) {
      seen.set(loop.id, (seen.get(loop.id) ?? 0) + 1)
    }
    const duplicates = [...seen].filter(([, count]) => count > 1).map(([id]) => id)

    expect(duplicates).toEqual([])
  })

  it('names its media files after the id', () => {
    // The ingest derives both paths from the id, and the orphan check below pairs the
    // directory against the ids. A hand-written path that points somewhere else would pass
    // the exists-check and still leave an unreferenced file behind.
    const offenders = offendersOf((loop, report) => {
      if (loop.video !== `/loops/${String(loop.id)}.mp4`) {
        report('video')
      }
      if (loop.poster !== `/loops/${String(loop.id)}.jpg`) {
        report('poster')
      }
    })

    expect(offenders).toEqual([])
  })

  it('credits a different post for every replaced audio track', () => {
    // An `audioFix` pointing back at the loop's own post says nothing, and the detail page
    // would print the same credit twice — the shape a copy-paste while mixing leaves.
    const offenders = offendersOf((loop, report) => {
      if (loop.audioFix && loop.audioFix.source?.url === loop.source?.url) {
        report('audioFix.source.url')
      }
    })

    expect(offenders).toEqual([])
  })

  it('cut less from every edited loop than the loop is long', () => {
    // `shortenedBy` is the only field that can be checked against another one: an edit that
    // took more than what is left is a decimal point in the wrong place, and the number is
    // nowhere near obvious enough for a reader to catch it by eye.
    const offenders = offendersOf((loop, report) => {
      if (loop.edit && !(loop.edit.shortenedBy < loop.duration)) {
        report('edit.shortenedBy')
      }
    })

    expect(offenders).toEqual([])
  })

  it('stays sorted by upload date, newest first', () => {
    // The file order *is* the order of the wall and of the queue the arrow keys step
    // through — `useLoops` never sorts. `writeLoops` sorts on every run, so a file out of
    // order is a hand edit, and the next `npm run add` would silently move the tile back.
    const sorted = [...loops].sort((a, b) => b.source.postedAt.localeCompare(a.source.postedAt))

    expect(loops.map((loop) => loop.id)).toEqual(sorted.map((loop) => loop.id))
  })

  it('is formatted the way `npm run add` writes it', () => {
    // Two spaces and a trailing newline, from `writeLoops`. Not a matter of taste: a file
    // reformatted by hand comes back in the next ingest diff in full, and a 34-entry diff
    // is one nobody reads — which is where a wrong edit hides.
    expect(raw).toBe(`${JSON.stringify(loops, null, 2)}\n`)
  })
})

describe('public/loops', () => {
  it('has a video and a poster for every entry', async () => {
    // The dead loop this whole spec is about: the entry survives a takedown that removed
    // the files, the wall links it, the prerendered page answers 200, and the player has
    // nothing to play.
    const offenders = []
    for (const loop of loops) {
      for (const field of ['video', 'poster']) {
        const size = await sizeOf(join(PUBLIC_DIR, loop[field]))
        if (size === null) {
          offenders.push(`${String(loop.id)}.${field} (missing)`)
        } else if (size === 0) {
          // An interrupted download leaves the file in place, just empty.
          offenders.push(`${String(loop.id)}.${field} (empty)`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('records the real byte size of every video', async () => {
    // `bytes` is `stat().size` of the local file, taken after any transcode — so it is the
    // one field that says whether the committed video is still the one that was measured.
    const offenders = []
    for (const loop of loops) {
      const size = await sizeOf(join(MEDIA_DIR, `${String(loop.id)}.mp4`))
      // A missing file is the test above; not this one's finding to repeat.
      if (size !== null && size !== loop.bytes) {
        offenders.push(`${String(loop.id)}.bytes`)
      }
    }

    expect(offenders).toEqual([])
  })

  it('holds no file that no entry points at', async () => {
    // The other half of a takedown: the entry is gone, the video is still there and still
    // served under the URL it always had. Also the half that costs disk in every release.
    const referenced = new Set(loops.flatMap((loop) => [loop.video, loop.poster]))
    const orphans = (await readdir(MEDIA_DIR))
      .map((name) => `/loops/${name}`)
      .filter((path) => !referenced.has(path))

    expect(orphans).toEqual([])
  })
})
