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

export interface Loop {
  id: number
  title: string
  tags: string[]
  featured: boolean
  source: LoopSource
  /** Set only on the handful of loops that play a different post's audio. */
  audioFix?: LoopAudioFix
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
