import { expect, test } from '@playwright/test'

import { openLoop, waitForHydration } from './helpers'
import { FIRST, LAST, LONGEST, LOOPS, SECOND } from './loops'

const detail = (id: number) => `/loop/${String(id)}`

/**
 * What `aria-valuetext` spells a whole second out as. Written out here rather than imported
 * from `formatDuration`, so the test states the format instead of agreeing with the code it
 * is checking.
 */
const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`

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

  test('→ and ← keep walking while the progress bar has the focus', async ({ page }) => {
    await openLoop(page, FIRST.id)
    // The bar is a slider, and a slider is where a browser normally expects ← and → to do
    // the seeking. Here the navigation wins everywhere, and the bar pages instead.
    await page.getByRole('slider', { name: 'Position im Loop' }).focus()

    await page.keyboard.press('ArrowRight')

    await expect(page).toHaveURL(detail(SECOND.id))

    await page.keyboard.press('ArrowLeft')

    await expect(page).toHaveURL(detail(FIRST.id))
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

  test('Shift+M mutes, Ctrl+M stays out of it', async ({ page }) => {
    await openLoop(page, SECOND.id)

    // Ctrl+M belongs to the browser and the screen reader, so the page has to let it pass.
    // Asserting that nothing happened would pass before a late toggle could even arrive —
    // hence the order: two keys, and only one of them may count. Had Ctrl+M counted too,
    // the two would cancel out and the button would read 'Stumm' below.
    await page.keyboard.press('Control+m')
    await page.keyboard.press('Shift+m')

    await expect(page.getByRole('button', { name: 'Ton an' })).toBeVisible()
    await expect
      .poll(async () => page.locator('video').evaluate((el: HTMLVideoElement) => el.muted))
      .toBe(true)
  })

  test('the space bar on a focused button presses that button, not Pause', async ({ page }) => {
    await openLoop(page, SECOND.id)
    // The mute button, deliberately: on the pause button both readings of Space end up
    // pausing, so it could not tell the two apart. Here the shortcut and the button want
    // opposite things — if the page took the keystroke, the video would stop and stay loud.
    await page.getByRole('button', { name: 'Stumm' }).focus()

    await page.keyboard.press('Space')

    await expect(page.getByRole('button', { name: 'Ton an' })).toBeVisible()
    expect(await page.locator('video').evaluate((el: HTMLVideoElement) => el.paused)).toBe(false)
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

  test('PageUp, PageDown and Home seek, and the announced position follows', async ({ page }) => {
    await openLoop(page, LONGEST.id)
    const slider = page.getByRole('slider', { name: 'Position im Loop' })
    await slider.focus()

    // Paused first: a running loop moves the position while the assertion is being made,
    // and "somewhere further along than before" would then hold without any seek at all.
    await page.keyboard.press('Space')

    await expect(page.getByRole('button', { name: 'Weiter' })).toBeVisible()

    const duration = await page.locator('video').evaluate((el: HTMLVideoElement) => el.duration)
    const step = duration / 10
    // Whole seconds are all the bar reports, and the browser lands on the nearest frame
    // rather than exactly on the time it was given.
    const at = async (seconds: number) =>
      expect
        .poll(async () => Math.abs(Number(await slider.getAttribute('aria-valuenow')) - seconds))
        .toBeLessThanOrEqual(1)

    // Twice forward, once back — one step each way. Starting from zero and going forward
    // once would leave a step backwards indistinguishable from the start it clamps to.
    await page.keyboard.press('PageUp')
    await page.keyboard.press('PageUp')

    await at(2 * step)

    await page.keyboard.press('PageDown')

    await at(step)
    // The number is for the bar, the text is what a screen reader says — they have to
    // agree, or the announcement describes a position the loop has left.
    const position = Number(await slider.getAttribute('aria-valuenow'))

    expect(await slider.getAttribute('aria-valuetext')).toBe(
      `${clock(position)} von ${clock(Math.round(duration))}`,
    )

    await page.keyboard.press('Home')

    await expect(slider).toHaveAttribute('aria-valuenow', '0')
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
