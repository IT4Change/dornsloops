import { readFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'

// The suite runs against `nuxt generate`, the same build a deploy publishes — so this is the
// version a visitor would see, read from where release-please writes it.
const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string }

test.describe('the footer', () => {
  test('names the built release and links to it', async ({ page }) => {
    await page.goto('/')
    const link = page.locator('.footer__version a')

    await expect(link).toHaveText(version)
    await expect(link).toHaveAttribute(
      'href',
      `https://github.com/IT4Change/dornsloops/releases/tag/${version}`,
    )
  })
})
