import { beforeEach, describe, expect, it } from 'vitest'

import { useAbsoluteUrl } from './useAbsoluteUrl'

/** What `.env` sets at build time; written straight into the real runtime config. */
function siteUrl(value: string): void {
  useRuntimeConfig().public.siteUrl = value
}

beforeEach(() => {
  siteUrl('https://loops.example.org')
})

describe(useAbsoluteUrl, () => {
  it('puts the configured base in front of a root-relative path', () => {
    expect(useAbsoluteUrl()('/loop/7077671')).toBe('https://loops.example.org/loop/7077671')
  })

  it('does not double the slash when the base was configured with a trailing one', () => {
    siteUrl('https://loops.example.org///')

    expect(useAbsoluteUrl()('/loops/7077671.jpg')).toBe(
      'https://loops.example.org/loops/7077671.jpg',
    )
  })

  it('returns the path untouched when no base is configured', () => {
    // The page still works without NUXT_PUBLIC_SITE_URL — only the link preview stays
    // blank, which is what deploy.sh warns about.
    siteUrl('')

    expect(useAbsoluteUrl()('/loop/7077671')).toBe('/loop/7077671')
  })
})
