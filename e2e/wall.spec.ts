import { expect, test } from '@playwright/test'

import { waitForHydration } from './helpers'
import { FIRST, LOOPS } from './loops'

test.describe('the wall', () => {
  test('shows every loop the data file holds', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('.tile')).toHaveCount(LOOPS.length)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('dornsloops')
    await expect(page.locator('.header__subtitle')).toContainText(`${String(LOOPS.length)} Loops`)
  })

  test('shows posters, not videos — the wall would pull the whole library otherwise', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(page.locator('video')).toHaveCount(0)
    await expect(page.locator('.tile__poster').first()).toHaveAttribute('src', FIRST.poster)
  })

  test('narrows to a tag and back out again', async ({ page }) => {
    await page.goto('/')
    // The tag bar is a row of click handlers; before hydration the press goes nowhere.
    await waitForHydration(page)
    const tag = page.locator('.tags__item').first()
    // The button shows one spelling of a tag the data may write several ways, and the filter
    // behind it matches all of them — so the expectation has to fold as well.
    const name = (await tag.textContent())!
      .trim()
      .replace(/\s+\d+$/, '')
      .toLowerCase()
    const expected = LOOPS.filter((loop) =>
      loop.tags.some((entry) => entry.toLowerCase() === name),
    ).length

    await tag.click()

    await expect(tag).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.tile')).toHaveCount(expected)

    await tag.click()

    await expect(tag).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('.tile')).toHaveCount(LOOPS.length)
  })

  test('gives a tag one button, however many ways the data spells it', async ({ page }) => {
    await page.goto('/')
    const labels = (await page.locator('.tags__item').allTextContents()).map((text) =>
      text
        .trim()
        .replace(/\s+\d+$/, '')
        .toLowerCase(),
    )

    // Against the real wall, not a fixture: the bar used to hand `Original Content` and
    // `original content` separate counts and then drop the smaller one. Two buttons folding
    // to one name means the counting came apart again.
    expect(labels.length).toBeGreaterThan(0)
    expect(new Set(labels).size).toBe(labels.length)
  })

  test('opens a loop when its tile is clicked', async ({ page }) => {
    await page.goto('/')

    await page.locator('.tile').first().click()

    await expect(page).toHaveURL(`/loop/${String(FIRST.id)}`)
    await expect(page.locator('.detail__title')).toHaveText(FIRST.title)
  })
})
