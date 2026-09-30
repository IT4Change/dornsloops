export interface LoopSource {
  platform: string
  url: string
  uploader: string
  postedAt: string
  /** Credit the uploader gave to an earlier source, if any. */
  original: string | null
}

/**
 * Records a loop whose own audio was unusable and got replaced by the same track from a
 * cleaner post — a second source that has to be credited like the first.
 *
 * Only ever written by hand. The ingest script treats it as curated and, because a
 * re-download would throw the mix away, refuses to touch the media of a loop that
 * carries one.
 */
export interface LoopAudioFix {
  /** Where the replacement audio comes from. */
  source: LoopSource
  /** Seconds into that post's audio at which this loop starts. */
  offset: number
  /**
   * Factor the video was retimed by so its cut rhythm matches the replacement audio;
   * 1 means the video was left alone.
   */
  videoRate: number
  /** What was wrong with the original audio, in one line. */
  reason: string
}

/**
 * Records a hand edit to the media file itself — a trim to where the music actually ends, a
 * crossfade that closes the wrap — done so the loop repeats without a seam.
 *
 * Carries the same consequence as [LoopAudioFix]: the ingest cannot reproduce the edit, so
 * the file is off limits to a re-download.
 */
export interface LoopEdit {
  /** What was done and why, in one line. Shown on the detail page. */
  reason: string
  /** Seconds the edit removed, measured against the file the ingest wrote. */
  shortenedBy: number
}

export interface Loop {
  id: number
  title: string
  tags: string[]
  featured: boolean
  source: LoopSource
  /** Set only on the handful of loops that play a different post's audio. */
  audioFix?: LoopAudioFix
  /** Set only on loops whose media file was edited by hand after the ingest. */
  edit?: LoopEdit
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
