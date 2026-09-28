import { expect, test } from '@playwright/test'

import { SECOND } from './loops'

const loopPath = `/loop/${String(SECOND.id)}`

/**
 * Reads a meta tag out of the prerendered HTML, which is all a link preview ever sees — a
 * crawler does not run the page, so whatever the build wrote into the markup is the whole
 * preview. Scanned rather than matched in one pattern because unhead writes the attributes
 * in either order.
 */
function meta(html: string, key: string): string | undefined {
  for (const fragment of html.split('<meta').slice(1)) {
    const tag = fragment.slice(0, fragment.indexOf('>'))
    if (!tag.includes(`="${key}"`)) {
      continue
    }
    return /content="([^"]*)"/.exec(tag)?.[1]
  }
  return undefined
}

test.describe('the link preview', () => {
  test('gives Discord & co. absolute URLs for the poster and the video', async ({
    request,
    baseURL,
  }) => {
    const html = await (await request.get(loopPath)).text()

    expect(meta(html, 'og:title')).toBe(SECOND.title)
    expect(meta(html, 'og:url')).toBe(`${String(baseURL)}${loopPath}`)
    expect(meta(html, 'og:image')).toBe(`${String(baseURL)}${SECOND.poster}`)
    expect(meta(html, 'og:video')).toBe(`${String(baseURL)}${SECOND.video}`)
    expect(meta(html, 'og:video:type')).toBe('video/mp4')
  })

  test('sizes the preview image, so it renders large rather than as a thumbnail', async ({
    request,
  }) => {
    const html = await (await request.get(loopPath)).text()

    expect(meta(html, 'og:image:width')).toBe(String(SECOND.width))
    expect(meta(html, 'og:image:height')).toBe(String(SECOND.height))
    expect(meta(html, 'twitter:card')).toBe('summary_large_image')
  })

  test('describes the loop by its length, uploader and first tags', async ({ request }) => {
    const html = await (await request.get(loopPath)).text()
    const description = meta(html, 'og:description')

    expect(description).toContain(SECOND.source.uploader)

    for (const tag of SECOND.tags.slice(0, 4)) {
      expect(description).toContain(tag)
    }
  })

  test('stands for the wall itself on the front page', async ({ request, baseURL }) => {
    const html = await (await request.get('/')).text()

    expect(meta(html, 'og:title')).toBe('dornsloops')
    expect(meta(html, 'og:url')).toBe(`${String(baseURL)}/`)
    expect(meta(html, 'og:type')).toBe('website')
  })
})

test.describe('the mirror', () => {
  test('keeps itself out of search results — the loops are other people’s work', async ({
    request,
  }) => {
    const html = await (await request.get('/')).text()

    expect(meta(html, 'robots')).toBe('noindex, nofollow')
  })
})

test.describe('the browser tab', () => {
  test('carries the site name behind the loop’s own title', async ({ page }) => {
    await page.goto(loopPath)

    await expect(page).toHaveTitle(`${SECOND.title} · dornsloops`)
  })

  test('says the site name alone on the wall, not twice', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle('dornsloops')
  })
})
