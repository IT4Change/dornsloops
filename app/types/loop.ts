export interface LoopSource {
  platform: string
  url: string
  uploader: string
  postedAt: string
  /** Credit the uploader gave to an earlier source, if any. */
  original: string | null
}

export interface Loop {
  id: number
  title: string
  tags: string[]
  featured: boolean
  source: LoopSource
  width: number
  height: number
  /** Seconds. */
  duration: number
  video: string
  poster: string
  bytes: number
  /** Name of the pr0gramm variant the file was derived from. */
  variant: string
  addedAt: string
}
