import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { describeSource, ingestOne, needsTranscode, parseArgs, readIdsFromFile } from './ingest.mjs'
import { fetchItem, fetchTags } from './pr0gramm.mjs'

// Only the two network calls are replaced; `parseItemId` and `itemUrl` are pure and
// belong to the behaviour under test here.
vi.mock('./pr0gramm.mjs', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchItem: vi.fn(),
  fetchTags: vi.fn(),
}))

const BUDGET = { maxHeight: 720, maxBytes: 25 * 1024 * 1024 }

/** An entry as it sits in `content/loops.json`, with the curated fields filled in. */
function storedLoop(overrides) {
  return {
    id: 7077671,
    title: 'Hand-picked title',
    tags: ['old tag'],
    featured: true,
    source: {
      platform: 'pr0gramm',
      url: 'https://pr0gramm.com/new/7077671',
      uploader: 'someone',
      postedAt: '2020-01-01T00:00:00.000Z',
      original: null,
    },
    width: 1280,
    height: 720,
    duration: 12.5,
    video: '/loops/7077671.mp4',
    poster: '/loops/7077671.jpg',
    bytes: 1024,
    variant: 'h264-low_res',
    addedAt: '2020-01-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  // The script's progress is its output; in a test run it is noise.
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe(parseArgs, () => {
  it('reads the documented defaults when nothing is given', () => {
    expect(parseArgs([])).toStrictEqual({
      inputs: [],
      file: null,
      force: false,
      help: false,
      metadataOnly: false,
      maxHeight: 720,
      maxSizeMb: 25,
      reencode: 'auto',
    })
  })

  it('collects every bare argument as an input, url or id alike', () => {
    expect(parseArgs(['7077671', 'https://pr0gramm.com/top/6447228']).inputs).toStrictEqual([
      '7077671',
      'https://pr0gramm.com/top/6447228',
    ])
  })

  it('reads the flags and their values', () => {
    expect(
      parseArgs([
        '--file',
        'sources.txt',
        '--force',
        '--metadata-only',
        '--max-height',
        '1080',
        '--max-size',
        '50',
        '--reencode',
        'always',
      ]),
    ).toMatchObject({
      file: 'sources.txt',
      force: true,
      metadataOnly: true,
      maxHeight: 1080,
      maxSizeMb: 50,
      reencode: 'always',
    })
  })

  it.each(['auto', 'always', 'never'])('accepts --reencode %s', (mode) => {
    expect(parseArgs(['--reencode', mode]).reencode).toBe(mode)
  })

  it('refuses a --reencode mode that does not exist', () => {
    expect(() => parseArgs(['--reencode', 'sometimes'])).toThrow(
      '--reencode must be auto, always or never (got "sometimes")',
    )
  })

  it('refuses an unknown option instead of reading it as an id', () => {
    expect(() => parseArgs(['--turbo'])).toThrow('Unknown option: --turbo')
  })

  it.each(['--help', '-h'])('%s asks for the usage text', (flag) => {
    expect(parseArgs([flag]).help).toBe(true)
  })

  it('prints help rather than tripping over another flag it was asked about', () => {
    // `npm run add -- --reencode --help` is how someone asks what --reencode takes.
    expect(parseArgs(['--reencode', '--help', '--help']).help).toBe(true)
  })
})

describe(readIdsFromFile, () => {
  let dir

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'dornsloops-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('reads one id per line and drops comments, blanks and stray whitespace', async () => {
    const path = join(dir, 'sources.txt')
    await writeFile(
      path,
      ['# the good ones', '7077671', '', '  6447228  # keeper', '   ', '#6276080'].join('\n'),
    )

    await expect(readIdsFromFile(path)).resolves.toStrictEqual(['7077671', '6447228'])
  })
})

describe(describeSource, () => {
  it('records where the loop came from, with the post time as an ISO stamp', () => {
    expect(
      describeSource(7077671, { user: 'someone', created: 1759000000, source: '' }),
    ).toStrictEqual({
      platform: 'pr0gramm',
      url: 'https://pr0gramm.com/new/7077671',
      uploader: 'someone',
      postedAt: '2025-09-27T19:06:40.000Z',
      original: null,
    })
  })

  it('keeps the earlier source when the uploader credited one', () => {
    const source = describeSource(7077671, {
      user: 'someone',
      created: 1759000000,
      source: 'https://youtube.com/watch?v=x',
    })

    expect(source.original).toBe('https://youtube.com/watch?v=x')
  })
})

describe(needsTranscode, () => {
  const fits = { codec: 'h264', height: 720, bytes: 1024 }

  it('leaves a variant that already fits alone', () => {
    expect(needsTranscode(fits, 'auto', BUDGET)).toBe(false)
  })

  it('transcodes a codec that not every browser plays', () => {
    expect(needsTranscode({ ...fits, codec: 'av1' }, 'auto', BUDGET)).toBe(true)
  })

  it('transcodes anything above the height budget', () => {
    expect(needsTranscode({ ...fits, height: 1080 }, 'auto', BUDGET)).toBe(true)
  })

  it('transcodes anything above the size budget', () => {
    expect(needsTranscode({ ...fits, bytes: 40 * 1024 * 1024 }, 'auto', BUDGET)).toBe(true)
  })

  it('reads an unknown size as within budget rather than over it', () => {
    expect(needsTranscode({ ...fits, bytes: 0 }, 'auto', BUDGET)).toBe(false)
  })

  it('transcodes regardless of the variant when asked to always', () => {
    expect(needsTranscode(fits, 'always', BUDGET)).toBe(true)
  })

  it('transcodes nothing when asked never, even a codec that needs it', () => {
    expect(needsTranscode({ ...fits, codec: 'av1', height: 2160 }, 'never', BUDGET)).toBe(false)
  })
})

describe(ingestOne, () => {
  const options = {
    force: false,
    metadataOnly: false,
    maxHeight: 720,
    maxSizeMb: 25,
    reencode: 'auto',
  }

  it('skips an entry that is already there and asks nothing of the API', async () => {
    const loops = [storedLoop()]

    await expect(ingestOne('7077671', { loops, options })).resolves.toStrictEqual({
      status: 'skipped',
    })
    expect(fetchItem).not.toHaveBeenCalled()
    expect(loops[0]).toStrictEqual(storedLoop())
  })

  it('refreshes tags and credits without touching the media files', async () => {
    fetchItem.mockResolvedValue({
      user: 'renamed',
      created: 1759000000,
      source: 'youtube',
      audio: true,
    })
    fetchTags.mockResolvedValue(['fresh tag', 'another'])
    const loops = [storedLoop()]

    await expect(
      ingestOne('7077671', { loops, options: { ...options, force: true, metadataOnly: true } }),
    ).resolves.toStrictEqual({ status: 'refreshed' })

    expect(loops[0]).toStrictEqual(
      storedLoop({
        tags: ['fresh tag', 'another'],
        source: {
          platform: 'pr0gramm',
          url: 'https://pr0gramm.com/new/7077671',
          uploader: 'renamed',
          postedAt: '2025-09-27T19:06:40.000Z',
          original: 'youtube',
        },
      }),
    )
  })

  it('leaves the hand-picked title and the featured flag alone on a refresh', async () => {
    fetchItem.mockResolvedValue({ user: 'someone', created: 1759000000, source: '', audio: true })
    fetchTags.mockResolvedValue(['fresh tag'])
    const loops = [storedLoop()]

    await ingestOne('7077671', {
      loops,
      options: { ...options, force: true, metadataOnly: true },
    })

    expect(loops[0].title).toBe('Hand-picked title')
    expect(loops[0].featured).toBe(true)
  })

  it('cannot add a new entry with --metadata-only, and says so instead of downloading', async () => {
    fetchItem.mockResolvedValue({ user: 'someone', created: 1759000000, source: '', audio: true })
    fetchTags.mockResolvedValue([])
    const loops = []

    await expect(
      ingestOne('7077671', { loops, options: { ...options, metadataOnly: true } }),
    ).resolves.toStrictEqual({ status: 'skipped' })
    expect(loops).toStrictEqual([])
  })

  it('notes a silent loop but imports it anyway', async () => {
    fetchItem.mockResolvedValue({ user: 'someone', created: 1759000000, source: '', audio: false })
    fetchTags.mockResolvedValue(['fresh tag'])
    const loops = [storedLoop()]

    await ingestOne('7077671', {
      loops,
      options: { ...options, force: true, metadataOnly: true },
    })

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('has no audio track'))
    expect(loops[0].tags).toStrictEqual(['fresh tag'])
  })

  it('rejects an input that is not a pr0gramm item at all', async () => {
    await expect(ingestOne('nonsense', { loops: [], options })).rejects.toThrow(
      'Cannot extract a pr0gramm item id',
    )
  })
})
