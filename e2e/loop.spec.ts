import { expect, test } from '@playwright/test'

import { openLoop, waitForHydration } from './helpers'
import { FIRST, LAST, LOOPS, SECOND } from './loops'

const detail = (id: number) => `/loop/${String(id)}`

test.describe('a loop page', () => {
  test('is a real prerendered URL, reachable without going through the wall', async ({ page }) => {
    const response = await page.goto(detail(SECOND.id))

    expect(response?.status()).toBe(200)
    await expect(page.locator('.detail__title')).toHaveText(SECOND.title)
    await expect(page.locator('video')).toHaveAttribute('src', SECOND.video)
  })

  test('credits the uploader and links the original post', async ({ page }) => {
    await page.goto(detail(SECOND.id))

    await expect(page.locator('.detail__source')).toContainText(SECOND.source.uploader)
    await expect(page.locator('.detail__source a').first()).toHaveAttribute(
      'href',
      SECOND.source.url,
    )
  })

  test('says where in the wall it sits', async ({ page }) => {
    await page.goto(detail(SECOND.id))

    await expect(page.locator('.detail__position')).toHaveText(`2 / ${String(LOOPS.length)}`)
  })
})

test.describe('the upload date', () => {
  // Fourteen hours ahead of the build host, which is where the two used to come apart: the
  // page is prerendered in the build's zone and read in the reader's. Vue says nothing
  // about a mismatch in a production build, so the two renderings are compared directly.
  test.use({ timezoneId: 'Pacific/Kiritimati' })

  test('reads the same before and after hydration, from any zone', async ({ page, request }) => {
    const berlin = new Date(SECOND.source.postedAt).toLocaleDateString('de-DE', {
      timeZone: 'Europe/Berlin',
    })

    const html = await (await request.get(detail(SECOND.id))).text()
    const prerendered = /Hochgeladen am<\/dt>\s*<dd[^>]*>([^<]*)<\/dd>/.exec(html)?.[1]?.trim()

    // Without the wait the "hydrated" value would still be the prerendered markup and the
    // comparison would hold for the wrong reason.
    await openLoop(page, SECOND.id)
    const hydrated = (await page.locator('dd').nth(2).textContent())?.trim()

    expect(prerendered).toBe(berlin)
    expect(hydrated).toBe(berlin)
  })
})

test.describe('stepping through the wall', () => {
  test('→ and ← walk the queue', async ({ page }) => {
    await openLoop(page, FIRST.id)

    await page.keyboard.press('ArrowRight')

    await expect(page).toHaveURL(detail(SECOND.id))

    await page.keyboard.press('ArrowLeft')

    await expect(page).toHaveURL(detail(FIRST.id))
  })

  test('wraps around at the front of the queue', async ({ page }) => {
    await openLoop(page, FIRST.id)

    await page.keyboard.press('ArrowLeft')

    await expect(page).toHaveURL(detail(LAST.id))
  })

  test('Esc goes back to the wall', async ({ page }) => {
    await openLoop(page, SECOND.id)

    await page.keyboard.press('Escape')

    await expect(page).toHaveURL('/')
    await expect(page.locator('.tile')).toHaveCount(LOOPS.length)
  })

  test('a tag filters the wall and goes back there', async ({ page }) => {
    const tag = SECOND.tags[0]!
    const expected = LOOPS.filter((loop) => loop.tags.includes(tag)).length
    await openLoop(page, SECOND.id)

    await page.locator('.detail__tag').first().click()

    await expect(page).toHaveURL('/')
    await expect(page.locator('.tile')).toHaveCount(expected)
  })
})

test.describe('the player', () => {
  test('plays the loop', async ({ page }) => {
    await page.goto(detail(SECOND.id))

    await expect
      .poll(async () => page.locator('video').evaluate((el: HTMLVideoElement) => el.currentTime), {
        timeout: 15_000,
      })
      .toBeGreaterThan(0)
  })

  test('the mute button silences the video and the choice survives a reload', async ({ page }) => {
    await openLoop(page, SECOND.id)
    const mute = page.getByRole('button', { name: 'Stumm' })

    await mute.click()

    await expect(page.getByRole('button', { name: 'Ton an' })).toBeVisible()
    await expect
      .poll(async () => page.locator('video').evaluate((el: HTMLVideoElement) => el.muted))
      .toBe(true)

    await page.reload()
    await waitForHydration(page)

    await expect(page.getByRole('button', { name: 'Ton an' })).toBeVisible()
    await expect
      .poll(async () => page.locator('video').evaluate((el: HTMLVideoElement) => el.muted))
      .toBe(true)
  })

  test('M does the same as the button', async ({ page }) => {
    await openLoop(page, SECOND.id)

    await page.keyboard.press('m')

    await expect(page.getByRole('button', { name: 'Ton an' })).toBeVisible()
  })

  test('the space bar pauses and resumes', async ({ page }) => {
    await openLoop(page, SECOND.id)

    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()

    await page.keyboard.press('Space')

    await expect(page.getByRole('button', { name: 'Weiter' })).toBeVisible()

    await page.keyboard.press('Space')

    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  })

  test('the progress bar is reachable with Tab and seeks from the keyboard', async ({ page }) => {
    await openLoop(page, SECOND.id)
    const slider = page.getByRole('slider', { name: 'Position im Loop' })
    await slider.focus()

    await page.keyboard.press('End')

    // `End` stops just short of the end so a looping video does not wrap straight back.
    await expect
      .poll(async () => page.locator('video').evaluate((el: HTMLVideoElement) => el.currentTime))
      .toBeGreaterThan(SECOND.duration / 2)
  })
})

test.describe('a loop that is not there', () => {
  test('answers 404 with the error page, not with an empty wall', async ({ page }) => {
    const response = await page.goto('/loop/1')

    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('404')
  })

  test('leads back to the wall', async ({ page }) => {
    await page.goto('/loop/1')

    await page.getByRole('link', { name: 'Zurück zur Loop-Wand' }).click()

    await expect(page).toHaveURL('/')
    await expect(page.locator('.tile')).toHaveCount(LOOPS.length)
  })
})
