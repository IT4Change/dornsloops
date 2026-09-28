/**
 * Serves `.output/public` the way the deployment's nginx does.
 *
 *   node e2e/static-server.mjs [port]
 *
 * The site ships as a directory of files behind nginx (`.github/webhooks/nginx.conf.template`),
 * so that is what the e2e suite has to drive. A dev server would answer requests nobody in
 * production ever asks, and `npx serve` gets the two rules that matter here wrong: it has its
 * own idea of a missing page, while the deployment answers `404.html` *with* status 404, and
 * the player needs range requests to seek.
 *
 * Deliberately not a dependency — the whole thing is the four nginx directives that decide
 * what a URL resolves to, and a package would still have to be configured into agreeing with
 * them.
 */

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('../.output/public', import.meta.url)))
const PORT = Number(process.argv[2] ?? 3030)

const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
}

function contentType(path) {
  const dot = path.lastIndexOf('.')
  return TYPES[path.slice(dot)] ?? 'application/octet-stream'
}

/** `try_files $uri $uri/ $uri/index.html` — /loop/7077671 is published as .../index.html. */
async function resolveFile(pathname) {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    // A malformed escape is not a path; nginx answers 400, and here 404 is close enough.
    return null
  }

  const target = resolve(ROOT, `.${normalize(decoded)}`)
  // Everything outside the published directory is not ours to hand out.
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    return null
  }

  for (const candidate of [target, join(target, 'index.html')]) {
    const info = await stat(candidate).catch(() => null)
    if (info?.isFile()) {
      return { path: candidate, size: info.size }
    }
  }
  return null
}

/** `bytes=start-end`, with either end open. What makes seeking in the player work. */
function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header ?? '')
  if (!match) {
    return null
  }

  const [, from, to] = match
  const start = from === '' ? size - Number(to) : Number(from)
  const end = from === '' || to === '' ? size - 1 : Number(to)
  if (!Number.isFinite(start) || start < 0 || end < start || end >= size) {
    return null
  }
  return { start, end }
}

function send(res, status, file, range) {
  const headers = { 'Content-Type': contentType(file.path), 'Accept-Ranges': 'bytes' }
  if (range) {
    headers['Content-Range'] = `bytes ${range.start}-${range.end}/${file.size}`
    headers['Content-Length'] = range.end - range.start + 1
  } else {
    headers['Content-Length'] = file.size
  }

  res.writeHead(status, headers)
  createReadStream(file.path, range ?? undefined).pipe(res)
}

async function handle(req, res) {
  try {
    const pathname = new URL(req.url ?? '/', `http://localhost:${PORT}`).pathname
    const file = await resolveFile(pathname)

    if (!file) {
      // `error_page 404 /404.html` — the page Nuxt prerendered, under the right status.
      const fallback = await resolveFile('/404.html')
      if (!fallback) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found')
        return
      }
      send(res, 404, fallback)
      return
    }

    const range = parseRange(req.headers.range, file.size)
    send(res, range ? 206 : 200, file, range)
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain' }).end(String(error))
  }
}

const server = createServer((req, res) => {
  void handle(req, res)
})

server.listen(PORT, () => {
  console.log(`Serving ${ROOT} on http://localhost:${PORT}`)
})
