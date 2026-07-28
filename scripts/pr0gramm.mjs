/**
 * Minimal read-only client for the public pr0gramm API.
 *
 * Only SFW items (flags=1) are reachable without a session cookie, which is
 * all this project needs. Media lives on dedicated CDN hosts.
 */

const API = 'https://pr0gramm.com/api'
const VID_CDN = 'https://vid.pr0gramm.com'
const THUMB_CDN = 'https://thumb.pr0gramm.com'

/** Tags that describe the medium rather than the content — useless as a title. */
const GENERIC_TAGS = new Set([
  'video', 'sound', 'loop', 'loops', 'ton', 'mit ton', 'webm', 'gif', 'musik',
  'music', 'audio', 'repost', 'oc', 'wallpaper',
])

/** Accepts a full pr0gramm URL or a bare item id. */
export function parseItemId (input) {
  const str = String(input).trim()
  if (/^\d+$/.test(str)) return Number(str)

  const match = str.match(/pr0gramm\.com\/(?:[^/]+\/)*?(\d{4,})(?:[?#].*)?$/)
  if (!match) throw new Error(`Cannot extract a pr0gramm item id from "${input}"`)
  return Number(match[1])
}

export function itemUrl (id) {
  return `https://pr0gramm.com/new/${id}`
}

async function apiGet (path, params) {
  const url = new URL(`${API}/${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)

  const res = await fetch(url, { headers: { 'User-Agent': 'dornsloops-ingest/1.0' } })
  if (!res.ok) throw new Error(`${path} responded ${res.status}`)

  const body = await res.json()
  if (body.error) throw new Error(`${path}: ${body.error} (${body.msg ?? ''})`)
  return body
}

/**
 * `items/get` returns a window of items around the given id rather than the
 * item itself, so the match has to be picked out explicitly.
 */
export async function fetchItem (id) {
  const body = await apiGet('items/get', { id, flags: 1 })
  const item = body.items?.find(candidate => candidate.id === id)
  if (!item) {
    throw new Error(
      `Item ${id} is not in the SFW feed — it is either NSFW/NSFP (needs a login) or deleted`,
    )
  }
  return item
}

export async function fetchTags (id, minConfidence = 0.3) {
  const body = await apiGet('items/info', { itemId: id })
  return (body.tags ?? [])
    .filter(tag => tag.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence)
    .map(tag => tag.tag)
}

/**
 * Uploaders often tag a loop with the track it uses, and that tag tends to win
 * on confidence — a far better title than the bare item id.
 */
export function guessTitle (tags, id) {
  const named = tags.find(tag => !GENERIC_TAGS.has(tag.toLowerCase()) && tag.length > 3)
  return named ?? `Loop ${id}`
}

/** Variant paths are inconsistently prefixed with a slash across items. */
function mediaUrl (host, path) {
  return `${host}/${String(path).replace(/^\/+/, '')}`
}

export function videoUrl (path) {
  return mediaUrl(VID_CDN, path)
}

export function thumbUrl (path) {
  return mediaUrl(THUMB_CDN, path)
}

/**
 * Picks the variant that needs the least post-processing, preferring, in order:
 * fits the size budget, h264 (universally playable), fits the height budget,
 * then the highest remaining resolution.
 */
export function pickVariant (item, { maxHeight, maxBytes }) {
  const candidates = (item.variants ?? []).map(variant => ({
    name: variant.name,
    path: variant.path,
    codec: variant.codec ?? 'unknown',
    width: variant.width ?? item.width,
    height: variant.height ?? item.height,
    bytes: variant.fileSize ?? 0,
  }))

  // Older items carry no variant list at all; `image` is always a playable mp4.
  if (!candidates.length) {
    candidates.push({
      name: 'original',
      path: item.image,
      codec: 'h264',
      width: item.width,
      height: item.height,
      bytes: 0,
    })
  }

  const rank = candidate => [
    candidate.bytes > maxBytes ? 1 : 0,
    candidate.codec === 'h264' ? 0 : 1,
    candidate.height > maxHeight ? 1 : 0,
    -candidate.height,
  ]

  return candidates.sort((a, b) => {
    const [left, right] = [rank(a), rank(b)]
    for (let i = 0; i < left.length; i++) {
      if (left[i] !== right[i]) return left[i] - right[i]
    }
    return 0
  })[0]
}
