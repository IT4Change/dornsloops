import { expect, test } from '@playwright/test'

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
    const tag = page.locator('.tags__item').first()
    const name = (await tag.textContent())!.trim().replace(/\s+\d+$/, '')
    const expected = LOOPS.filter((loop) => loop.tags.includes(name)).length

    await tag.click()

    await expect(tag).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.tile')).toHaveCount(expected)

    await tag.click()

    await expect(tag).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('.tile')).toHaveCount(LOOPS.length)
  })

  test('opens a loop when its tile is clicked', async ({ page }) => {
    await page.goto('/')

    await page.locator('.tile').first().click()

    await expect(page).toHaveURL(`/loop/${String(FIRST.id)}`)
    await expect(page.locator('.detail__title')).toHaveText(FIRST.title)
  })
})
