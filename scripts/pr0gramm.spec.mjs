import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  fetchItem,
  fetchTags,
  guessTitle,
  itemUrl,
  parseItemId,
  pickVariant,
  thumbUrl,
  videoUrl,
} from './pr0gramm.mjs'

/** A budget wide enough that only the property under test decides the ranking. */
const ROOMY = { maxHeight: 720, maxBytes: 25 * 1024 * 1024 }

function variant(name, extra) {
  return { name, path: `${name}.mp4`, codec: 'h264', width: 1280, height: 720, ...extra }
}

/** Answers one `fetch` with a JSON body, as the pr0gramm API would. */
function respondWith(body, { ok = true, status = 200 } = {}) {
  return vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(body) })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe(parseItemId, () => {
  it('takes a bare item id', () => {
    expect(parseItemId('7077671')).toBe(7077671)
  })

  it('takes an id with surrounding whitespace, as a line from --file carries it', () => {
    expect(parseItemId('  7077671\t')).toBe(7077671)
  })

  it('takes the id out of a full post URL whatever feed it came from', () => {
    expect(parseItemId('https://pr0gramm.com/top/7077671')).toBe(7077671)
    expect(parseItemId('https://pr0gramm.com/new/7077671')).toBe(7077671)
    expect(parseItemId('https://pr0gramm.com/top/schwarzwald/7077671')).toBe(7077671)
  })

  it('ignores query and fragment rather than reading the id out of them', () => {
    expect(parseItemId('https://pr0gramm.com/top/7077671?x=1#comment-42')).toBe(7077671)
  })

  it('refuses a URL from somewhere else even when it ends in digits', () => {
    expect(() => parseItemId('https://example.com/top/7077671')).toThrow(
      'Cannot extract a pr0gramm item id',
    )
  })

  it('refuses a pr0gramm URL whose last segment is not an id', () => {
    expect(() => parseItemId('https://pr0gramm.com/top/schwarzwald')).toThrow(
      'Cannot extract a pr0gramm item id',
    )
  })

  it('refuses a number too short to be an item id', () => {
    expect(() => parseItemId('https://pr0gramm.com/top/123')).toThrow(
      'Cannot extract a pr0gramm item id',
    )
  })
})

describe(itemUrl, () => {
  it('points at the permanent /new/ path, which every feed redirects to', () => {
    expect(itemUrl(7077671)).toBe('https://pr0gramm.com/new/7077671')
  })
})

describe('media URLs', () => {
  it('puts the variant path on the video CDN', () => {
    expect(videoUrl('2026/09/26/abc.mp4')).toBe('https://vid.pr0gramm.com/2026/09/26/abc.mp4')
  })

  it('puts the thumb path on the thumb CDN', () => {
    expect(thumbUrl('2026/09/26/abc.jpg')).toBe('https://thumb.pr0gramm.com/2026/09/26/abc.jpg')
  })

  it('collapses the leading slash some items carry and some do not', () => {
    expect(videoUrl('/2026/09/26/abc.mp4')).toBe('https://vid.pr0gramm.com/2026/09/26/abc.mp4')
    expect(thumbUrl('///abc.jpg')).toBe('https://thumb.pr0gramm.com/abc.jpg')
  })
})

describe(guessTitle, () => {
  it('takes the first tag that names the content', () => {
    expect(guessTitle(['Sandstorm', 'Darude'], 7077671)).toBe('Sandstorm')
  })

  it('skips tags that describe the medium, whatever their casing', () => {
    expect(guessTitle(['Video', 'MIT TON', 'webm', 'Sandstorm'], 7077671)).toBe('Sandstorm')
  })

  it('skips tags too short to read as a title', () => {
    expect(guessTitle(['wtf', 'Sandstorm'], 7077671)).toBe('Sandstorm')
  })

  it('falls back to the id when every tag is generic', () => {
    expect(guessTitle(['video', 'sound', 'loop'], 7077671)).toBe('Loop 7077671')
  })

  it('falls back to the id when there are no tags at all', () => {
    expect(guessTitle([], 7077671)).toBe('Loop 7077671')
  })
})

describe(pickVariant, () => {
  it('prefers h264 over a codec that would need transcoding', () => {
    const item = {
      variants: [variant('av1', { codec: 'av1' }), variant('h264-low_res')],
    }

    expect(pickVariant(item, ROOMY).name).toBe('h264-low_res')
  })

  it('prefers the variant inside the size budget over a larger h264 one', () => {
    const item = {
      variants: [
        variant('h264-fat', { fileSize: 40 * 1024 * 1024 }),
        variant('vp9-slim', { codec: 'vp9', fileSize: 1024 }),
      ],
    }

    expect(pickVariant(item, ROOMY).name).toBe('vp9-slim')
  })

  it('prefers the variant inside the height budget once codec and size are equal', () => {
    const item = {
      variants: [variant('h264-4k', { height: 2160 }), variant('h264-720', { height: 720 })],
    }

    expect(pickVariant(item, ROOMY).name).toBe('h264-720')
  })

  it('takes the tallest of the variants that are otherwise equal', () => {
    const item = {
      variants: [variant('h264-360', { height: 360 }), variant('h264-720', { height: 720 })],
    }

    expect(pickVariant(item, ROOMY).name).toBe('h264-720')
  })

  it('falls back to the item image for older items that list no variants', () => {
    const item = { image: '2015/01/01/old.mp4', width: 640, height: 480 }

    expect(pickVariant(item, ROOMY)).toStrictEqual({
      name: 'original',
      path: '2015/01/01/old.mp4',
      codec: 'h264',
      width: 640,
      height: 480,
      bytes: 0,
    })
  })

  it('takes the item dimensions for a variant that states none', () => {
    const item = {
      width: 1920,
      height: 1080,
      variants: [{ name: 'h264', path: 'a.mp4' }],
    }

    expect(pickVariant(item, ROOMY)).toMatchObject({
      codec: 'unknown',
      width: 1920,
      height: 1080,
      bytes: 0,
    })
  })

  it('keeps the first of two variants that are equal in every respect', () => {
    const item = { variants: [variant('first'), variant('second')] }

    expect(pickVariant(item, ROOMY).name).toBe('first')
  })

  // How a variant whose size the API does not state ranks is deliberately not asserted
  // here. `bytes: variant.fileSize ?? 0` makes an unknown size read as "inside the budget",
  // which is the strongest criterion and therefore beats a known-good file — an open defect,
  // not the intent. A test stating the current answer would cement it, and its fix would
  // then look like a regression to whoever reads the failure.
})

describe(fetchItem, () => {
  it('picks the requested item out of the window the API answers with', async () => {
    vi.stubGlobal('fetch', respondWith({ items: [{ id: 1 }, { id: 7077671, user: 'someone' }] }))

    await expect(fetchItem(7077671)).resolves.toMatchObject({ id: 7077671, user: 'someone' })
  })

  it('asks only for the SFW feed, which is all a session-less client may see', async () => {
    const fetchMock = respondWith({ items: [{ id: 7077671 }] })
    vi.stubGlobal('fetch', fetchMock)

    await fetchItem(7077671)

    const [url] = fetchMock.mock.calls[0]
    expect(url.toString()).toBe('https://pr0gramm.com/api/items/get?id=7077671&flags=1')
  })

  it('names login or deletion as the reason when the item is not in the window', async () => {
    vi.stubGlobal('fetch', respondWith({ items: [{ id: 1 }] }))

    await expect(fetchItem(7077671)).rejects.toThrow('is not in the SFW feed')
  })

  it('reports an HTTP error with its status', async () => {
    vi.stubGlobal('fetch', respondWith({}, { ok: false, status: 503 }))

    await expect(fetchItem(7077671)).rejects.toThrow('items/get responded 503')
  })

  it('reports an error the API puts in an otherwise fine response', async () => {
    vi.stubGlobal('fetch', respondWith({ error: 'notFound', msg: 'gone' }))

    await expect(fetchItem(7077671)).rejects.toThrow('items/get: notFound (gone)')
  })

  it('reports an API error that carries no message', async () => {
    vi.stubGlobal('fetch', respondWith({ error: 'notFound' }))

    await expect(fetchItem(7077671)).rejects.toThrow('items/get: notFound ()')
  })
})

describe(fetchTags, () => {
  it('orders the tags by confidence, most agreed-upon first', async () => {
    vi.stubGlobal(
      'fetch',
      respondWith({
        tags: [
          { tag: 'maybe', confidence: 0.2 },
          { tag: 'Sandstorm', confidence: 0.9 },
          { tag: 'middling', confidence: 0.5 },
        ],
      }),
    )

    await expect(fetchTags(7077671)).resolves.toStrictEqual(['Sandstorm', 'middling', 'maybe'])
  })

  it('reads a post without tags as an empty list', async () => {
    vi.stubGlobal('fetch', respondWith({}))

    await expect(fetchTags(7077671)).resolves.toStrictEqual([])
  })
})
