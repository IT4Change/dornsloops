#!/usr/bin/env node
/**
 * Imports pr0gramm loops into the project: downloads the video, normalises it
 * for the web, extracts a poster frame and records the metadata in
 * `content/loops.json`.
 *
 *   npm run add -- https://pr0gramm.com/top/7077671 6447228
 *   npm run add -- --file sources.txt
 *   npm run add -- --force 7077671          # re-download, keep manual edits
 *
 * Options:
 *   --file <path>      read ids/urls from a file (one per line, # = comment)
 *   --force            re-process items that are already present
 *   --max-height <n>   downscale above this height (default 720)
 *   --max-size <mb>    size budget used when choosing a variant (default 25)
 *   --reencode <mode>  auto (default) | always | never
 */

import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_FILE = join(ROOT, 'content', 'loops.json')
const MEDIA_DIR = join(ROOT, 'public', 'loops')
const TMP_DIR = join(ROOT, 'node_modules', '.cache', 'dornsloops')

/** Fields the ingest owns; everything else in a record survives a re-import. */
const DERIVED_FIELDS = [
  'source', 'width', 'height', 'duration', 'video', 'poster', 'bytes', 'variant',
]

function parseArgs (argv) {
  const options = {
    inputs: [],
    file: null,
    force: false,
    maxHeight: 720,
    maxSizeMb: 25,
    reencode: 'auto',
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--file': options.file = argv[++i]; break
      case '--force': options.force = true; break
      case '--max-height': options.maxHeight = Number(argv[++i]); break
      case '--max-size': options.maxSizeMb = Number(argv[++i]); break
      case '--reencode': options.reencode = argv[++i]; break
      default:
        if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`)
        options.inputs.push(arg)
    }
  }

  if (!['auto', 'always', 'never'].includes(options.reencode)) {
    throw new Error(`--reencode must be auto, always or never (got "${options.reencode}")`)
  }
  return options
}

async function readIdsFromFile (path) {
  const text = await readFile(path, 'utf8')
  return text
    .split('\n')
    .map(line => line.replace(/#.*$/, '').trim())
    .filter(Boolean)
}

async function readLoops () {
  try {
    return JSON.parse(await readFile(DATA_FILE, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

async function writeLoops (loops) {
  loops.sort((a, b) => b.source.postedAt.localeCompare(a.source.postedAt))
  await mkdir(dirname(DATA_FILE), { recursive: true })
  await writeFile(DATA_FILE, `${JSON.stringify(loops, null, 2)}\n`)
}

async function download (url, target) {
  const res = await fetch(url, { headers: { 'User-Agent': 'dornsloops-ingest/1.0' } })
  if (!res.ok) throw new Error(`GET ${url} responded ${res.status}`)

  await mkdir(dirname(target), { recursive: true })
  await pipeline(Readable.fromWeb(res.body), createWriteStream(target))
}

function run (command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', code => code === 0
      ? resolve(stdout.trim())
      : reject(new Error(`${command} exited ${code}\n${stderr.slice(-2000)}`)))
  })
}

async function probe (path) {
  const raw = await run('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=duration',
    '-of', 'json',
    path,
  ])
  const data = JSON.parse(raw)
  const stream = data.streams?.[0] ?? {}
  return {
    width: stream.width ?? 0,
    height: stream.height ?? 0,
    duration: Math.round(Number(data.format?.duration ?? 0) * 100) / 100,
  }
}

/**
 * Normalises to h264/aac so every browser can play it, and caps the height.
 * `-movflags +faststart` matters here: the grid starts playback before the
 * whole file has arrived.
 */
async function transcode (input, output, maxHeight) {
  await run('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-i', input,
    '-vf', `scale=-2:'min(${maxHeight},ih)':flags=lanczos`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k',
    '-movflags', '+faststart',
    output,
  ])
}

async function extractPoster (video, output, duration) {
  // A frame from a quarter in is more representative than a fade-in at 0s.
  const offset = duration > 2 ? Math.min(duration * 0.25, 5) : 0
  await run('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-ss', String(offset),
    '-i', video,
    '-frames:v', '1',
    '-q:v', '4',
    output,
  ])
}

function needsTranscode (variant, mode, { maxHeight, maxBytes }) {
  if (mode === 'always') return true
  if (mode === 'never') return false
  return variant.codec !== 'h264'
    || variant.height > maxHeight
    || (variant.bytes > 0 && variant.bytes > maxBytes)
}

async function ingestOne (input, { loops, options }) {
  const id = parseItemId(input)
  const existing = loops.find(loop => loop.id === id)

  if (existing && !options.force) {
    console.log(`  ${id}  already present, skipping (use --force to refresh)`)
    return { status: 'skipped' }
  }

  const [item, tags] = await Promise.all([fetchItem(id), fetchTags(id)])
  if (!item.audio) {
    console.log(`  ${id}  has no audio track — importing anyway`)
  }

  const maxBytes = options.maxSizeMb * 1024 * 1024
  const variant = pickVariant(item, { maxHeight: options.maxHeight, maxBytes })

  const tmpSource = join(TMP_DIR, `${id}-source`)
  const videoPath = join(MEDIA_DIR, `${id}.mp4`)
  const posterPath = join(MEDIA_DIR, `${id}.jpg`)

  await mkdir(TMP_DIR, { recursive: true })
  await mkdir(MEDIA_DIR, { recursive: true })

  console.log(`  ${id}  fetching variant "${variant.name}" (${variant.codec}, ${variant.width}x${variant.height})`)
  await download(videoUrl(variant.path), tmpSource)

  if (needsTranscode(variant, options.reencode, { maxHeight: options.maxHeight, maxBytes })) {
    console.log(`  ${id}  transcoding to h264 ≤${options.maxHeight}p`)
    await transcode(tmpSource, videoPath, options.maxHeight)
  } else {
    await rename(tmpSource, videoPath)
  }
  await rm(tmpSource, { force: true })

  const probed = await probe(videoPath)
  try {
    await extractPoster(videoPath, posterPath, probed.duration)
  } catch (error) {
    console.log(`  ${id}  poster extraction failed, falling back to the pr0gramm thumb`)
    await download(thumbUrl(item.thumb), posterPath)
  }

  const { size } = await import('node:fs/promises').then(fs => fs.stat(videoPath))

  const derived = {
    source: {
      platform: 'pr0gramm',
      url: itemUrl(id),
      uploader: item.user,
      postedAt: new Date(item.created * 1000).toISOString(),
      // Uploaders sometimes credit an original source; keep it if present.
      original: item.source || null,
    },
    width: probed.width,
    height: probed.height,
    duration: probed.duration,
    video: `/loops/${id}.mp4`,
    poster: `/loops/${id}.jpg`,
    bytes: size,
    variant: variant.name,
  }

  if (existing) {
    // Preserve hand-curated fields (title, tags, featured, …) on refresh.
    Object.assign(existing, derived)
    console.log(`  ${id}  refreshed (${(size / 1048576).toFixed(1)} MB)`)
    return { status: 'refreshed' }
  }

  loops.push({
    id,
    title: guessTitle(tags, id),
    tags,
    featured: false,
    ...derived,
    addedAt: new Date().toISOString(),
  })
  console.log(`  ${id}  added (${(size / 1048576).toFixed(1)} MB)`)
  return { status: 'added' }
}

async function main () {
  const options = parseArgs(process.argv.slice(2))
  const inputs = [
    ...options.inputs,
    ...(options.file ? await readIdsFromFile(options.file) : []),
  ]

  if (!inputs.length) {
    console.error('Usage: npm run add -- <url|id>... [--file sources.txt] [--force]')
    process.exit(1)
  }

  const loops = await readLoops()
  const counts = { added: 0, refreshed: 0, skipped: 0, failed: 0 }

  console.log(`Ingesting ${inputs.length} item(s)…`)
  for (const input of inputs) {
    try {
      const { status } = await ingestOne(input, { loops, options })
      counts[status]++
      if (status !== 'skipped') await writeLoops(loops)
    } catch (error) {
      counts.failed++
      console.error(`  ${input}  FAILED: ${error.message}`)
    }
  }

  await writeLoops(loops)
  console.log(
    `Done: ${counts.added} added, ${counts.refreshed} refreshed, ` +
    `${counts.skipped} skipped, ${counts.failed} failed — ${loops.length} loops total.`,
  )
  if (counts.failed) process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
