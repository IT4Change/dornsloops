import { expect } from '@playwright/test'

import type { Page } from '@playwright/test'

/**
 * Waits until Vue has taken over the prerendered markup.
 *
 * Everything that reacts on these pages is attached in `onMounted` — the loop navigation,
 * the player's keys, the tag buttons. A key pressed before that is lost without a trace,
 * and the assertion that follows then fails against a page that never moved. That is how
 * `→ und ← walk the queue` failed on the CI runner and passed on the retry: fast enough
 * locally, not on a cold machine.
 *
 * `__vue_app__` lands on the root element when `mount()` returns, and neither page has an
 * `await` in its setup — so nothing is still pending behind it.
 *
 * Deliberately no `waitForTimeout` in here: a fixed wait is a guess that a slower runner
 * invalidates, which is this same bug again with a longer fuse.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => '__vue_app__' in (document.getElementById('__nuxt') ?? {}))
}

/**
 * Opens a loop page and waits until its player is live.
 *
 * On top of hydration the progress bar is an exact second signal: the build writes
 * `aria-valuemax="0"` because the length is unknown until the browser has the metadata, so
 * any other value means the client is running *and* has seen a real media event.
 */
export async function openLoop(page: Page, id: number): Promise<void> {
  await page.goto(`/loop/${String(id)}`)
  await waitForHydration(page)
  await expect(page.getByRole('slider', { name: 'Position im Loop' })).not.toHaveAttribute(
    'aria-valuemax',
    '0',
    { timeout: 15_000 },
  )
}
