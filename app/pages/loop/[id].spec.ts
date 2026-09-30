import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import LoopPage from './[id].vue'

import type { VueWrapper } from '@vue/test-utils'

// The composable reads the data file at import time, so the wall under test has to be in
// place before it loads.
vi.mock('~~/content/loops.json', async () => ({ default: (await import('~/test/fixtures')).WALL }))

const mounted: VueWrapper[] = []
const pushed: string[] = []

/** Where the page asked to go, in order. */
function routes(): readonly string[] {
  return pushed
}

/** The player has its own spec; here it would only pull a media element into every mount. */
async function mountLoop(id: number) {
  const wrapper = await mountSuspended(LoopPage, {
    route: `/loop/${String(id)}`,
    global: { stubs: { LoopPlayer: true } },
  })
  // The page listens on the window; a wrapper left standing would answer the next test's
  // keystrokes as well.
  mounted.push(wrapper)
  return wrapper
}

beforeEach(async () => {
  clearNuxtState()
  await clearError()
  pushed.length = 0
  // Navigation is what the page asks for, not something a unit test should carry out.
  vi.spyOn(useRouter(), 'push').mockImplementation(async (to) => {
    pushed.push(to as string)
    return Promise.resolve()
  })
})

afterEach(() => {
  while (mounted.length > 0) {
    mounted.pop()?.unmount()
  }
  vi.restoreAllMocks()
})

describe('the loop', () => {
  it('shows the title, the length and the dimensions', async () => {
    const wrapper = await mountLoop(3)

    expect(wrapper.get('.detail__title').text()).toBe('Loop 3')
    expect(wrapper.get('.detail__facts').text()).toBe('0:45 · 1280×720')
  })

  it('credits the source, the uploader and the post', async () => {
    const wrapper = await mountLoop(3)
    const link = wrapper.get('.detail__source a')

    expect(link.attributes('href')).toBe('https://pr0gramm.com/new/3')
    expect(link.text()).toBe('pr0gramm.com/3 ↗')
    expect(wrapper.get('.detail__source').text()).toContain('someone')
  })

  it('opens the source in a new tab without handing it a window reference', async () => {
    const wrapper = await mountLoop(3)

    expect(wrapper.get('.detail__source a').attributes()).toMatchObject({
      target: '_blank',
      rel: 'noopener noreferrer',
    })
  })

  it('names the earlier source when the uploader credited one', async () => {
    const wrapper = await mountLoop(4)

    expect(wrapper.get('.detail__source').text()).toContain('Originalquelle')
    expect(wrapper.get('.detail__source').text()).toContain('https://youtube.com/watch?v=x')
  })

  it('says nothing about an earlier source when there is none', async () => {
    const wrapper = await mountLoop(3)

    expect(wrapper.get('.detail__source').text()).not.toContain('Originalquelle')
  })

  it('credits both posts when the audio comes from a second one', async () => {
    const wrapper = await mountLoop(2)
    const block = wrapper.get('.detail__source')
    const links = wrapper.findAll('.detail__source a')

    // Two credits, and neither is called "Quelle" any more — with a mixed loop that word
    // would have to mean two different posts at once.
    expect(block.text()).not.toContain('Quelle')
    expect(links.map((link) => link.attributes('href'))).toStrictEqual([
      'https://pr0gramm.com/new/2',
      'https://pr0gramm.com/new/222',
    ])
    expect(links[1]!.text()).toBe('pr0gramm.com/222 ↗')
    expect(block.text()).toContain('somebody else')
    expect(wrapper.get('.detail__note').text()).toBe('Der eigene Ton dieses Posts ist kaputt.')
  })

  it('keeps one plain credit for a loop that plays its own audio', async () => {
    const wrapper = await mountLoop(3)

    expect(wrapper.get('.detail__source').text()).toContain('Quelle')
    expect(wrapper.findAll('.detail__source a')).toHaveLength(1)
    expect(wrapper.find('.detail__note').exists()).toBe(false)
  })

  it('says what a hand-cut loop had cut out of it', async () => {
    const wrapper = await mountLoop(4)

    expect(wrapper.get('.detail__source').text()).toContain('Schnitt')
    expect(wrapper.get('.detail__source').text()).toContain('Am Ende hing eine Sekunde Stille.')
  })

  it('says nothing about a cut for a loop that came out of the ingest as it is', async () => {
    const wrapper = await mountLoop(3)

    expect(wrapper.get('.detail__source').text()).not.toContain('Schnitt')
  })

  it('shows no tag list at all for a loop pr0gramm has no tags for', async () => {
    const wrapper = await mountLoop(5)

    expect(wrapper.find('.detail__tags').exists()).toBe(false)
    expect(wrapper.get('.detail__title').text()).toBe('Loop 5')
  })

  it('lists every tag, in the spelling this loop carries', async () => {
    const wrapper = await mountLoop(1)

    // Not the bar's list: `Video` and `Musik` are generic and hidden there, and `Sandstorm`
    // is one of three spellings the bar folds into a single button. Here the post's own
    // tags stand as pr0gramm handed them out.
    expect(wrapper.findAll('.detail__tag').map((button) => button.text())).toStrictEqual([
      'techno',
      'Sandstorm',
      'Video',
      'Musik',
    ])
  })
})

describe('the upload date', () => {
  const ELSEWHERE = 'Pacific/Kiritimati'
  let original: string | undefined

  beforeAll(() => {
    // Fourteen hours ahead of UTC, so a timestamp from a Berlin evening falls on the next
    // day here. A page that rendered in the ambient zone would say so — which is the
    // hydration mismatch this pins down, on whatever machine the suite runs.
    original = process.env.TZ
    process.env.TZ = ELSEWHERE
  })

  afterAll(() => {
    process.env.TZ = original
  })

  it('stands in Europe/Berlin however the reader’s clock is set', async () => {
    const wrapper = await mountLoop(3)

    expect(new Date('2026-09-26T19:34:16.000Z').toLocaleDateString('de-DE')).toBe('27.9.2026')
    expect(wrapper.get('.detail__source').text()).toContain('26.9.2026')
  })
})

describe('the queue', () => {
  it('says where in the wall this loop sits', async () => {
    const wrapper = await mountLoop(2)

    expect(wrapper.get('.detail__position').text()).toBe('2 / 5')
  })

  it('offers the step before and the step after', async () => {
    const wrapper = await mountLoop(2)
    const steps = wrapper.findAll('.detail__steps a')

    expect(steps.map((link) => link.attributes('href'))).toStrictEqual(['/loop/1', '/loop/3'])
  })

  it('wraps around at the end of the wall', async () => {
    const wrapper = await mountLoop(5)
    const steps = wrapper.findAll('.detail__steps a')

    expect(steps.map((link) => link.attributes('href'))).toStrictEqual(['/loop/4', '/loop/1'])
  })

  it('stays inside an active filter, skipping what it hides', async () => {
    useLoops().setTag('sandstorm') // loops 1, 2 and 4
    const wrapper = await mountLoop(2)

    expect(wrapper.get('.detail__position').text()).toBe('2 / 3')
    expect(
      wrapper.findAll('.detail__steps a').map((link) => link.attributes('href')),
    ).toStrictEqual(['/loop/1', '/loop/4'])
  })

  it('leads back to the wall', async () => {
    const wrapper = await mountLoop(2)

    expect(wrapper.get('.detail__nav a').attributes('href')).toBe('/')
  })
})

describe('the keyboard', () => {
  function press(key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, cancelable: true })
    window.dispatchEvent(event)
    return event
  }

  it('steps to the next and the previous loop', async () => {
    await mountLoop(2)

    press('ArrowRight')

    expect(routes()).toStrictEqual(['/loop/3'])

    press('ArrowLeft')

    expect(routes()).toStrictEqual(['/loop/3', '/loop/1'])
  })

  it('leaves for the wall on Escape', async () => {
    await mountLoop(2)

    press('Escape')

    expect(routes()).toStrictEqual(['/'])
  })

  it('ignores a key it has no answer for', async () => {
    await mountLoop(2)

    const event = press('q')

    expect(routes()).toStrictEqual([])
    expect(event.defaultPrevented).toBe(false)
  })

  it('leaves a keystroke meant for a field alone', async () => {
    await mountLoop(2)
    const input = document.createElement('input')
    document.body.append(input)

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(routes()).toStrictEqual([])

    input.remove()
  })

  it('stops listening once the page is gone', async () => {
    const wrapper = await mountLoop(2)

    mounted.pop()
    wrapper.unmount()
    press('Escape')

    expect(routes()).toStrictEqual([])
  })
})

describe('a tag on the detail page', () => {
  it('filters the wall by it and goes back there — a filter only shows there', async () => {
    const wrapper = await mountLoop(1)

    await wrapper.findAll('.detail__tag')[0]!.trigger('click')

    expect(useLoops().activeTag.value).toBe('techno')
    expect(routes()).toStrictEqual(['/'])
  })

  it('lands on the filter the bar would set, not on this loop’s spelling of it', async () => {
    const wrapper = await mountLoop(1)
    const { activeTag, loops } = useLoops()

    await wrapper.findAll('.detail__tag')[1]!.trigger('click') // `Sandstorm` on this loop

    expect(activeTag.value).toBe('sandstorm')
    expect(loops.value.map((loop) => loop.id)).toStrictEqual([1, 2, 4])
  })
})

describe('a loop that is not there', () => {
  it('is a fatal 404, which is what swaps the error page in', async () => {
    const wrapper = await mountLoop(99)

    expect(useError().value).toMatchObject({
      statusCode: 404,
      statusMessage: 'Diesen Loop gibt es hier nicht.',
      fatal: true,
    })
    expect(wrapper.find('.detail').exists()).toBe(false)
  })

  it('leaves no error behind for a loop that is there', async () => {
    await mountLoop(3)

    expect(useError().value).toBeUndefined()
  })
})
