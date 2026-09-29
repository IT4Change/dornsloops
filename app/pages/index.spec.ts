import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import IndexPage from './index.vue'

// The composable reads the data file at import time, so the wall under test has to be in
// place before it loads.
vi.mock('~~/content/loops.json', async () => ({ default: (await import('~/test/fixtures')).WALL }))

async function mountWall() {
  return mountSuspended(IndexPage)
}

const tagButtons = (wrapper: Awaited<ReturnType<typeof mountWall>>) =>
  wrapper.findAll('.tags__item')

beforeEach(() => {
  clearNuxtState()
})

describe('the wall', () => {
  it('counts the loops and the time they add up to', async () => {
    const wrapper = await mountWall()

    expect(wrapper.get('.header__title').text()).toBe('dornsloops')
    expect(wrapper.get('.header__subtitle').text()).toBe('5 Loops · 4 min')
  })

  it('shows a tile per loop', async () => {
    const wrapper = await mountWall()

    expect(wrapper.findAll('.tile')).toHaveLength(5)
  })

  it('counts only what a filter leaves standing', async () => {
    const wrapper = await mountWall()

    await tagButtons(wrapper)[2]!.trigger('click') // chill, on two loops
    await nextTick()

    expect(wrapper.get('.header__subtitle').text()).toBe('2 Loops · 1 min')
    expect(wrapper.findAll('.tile')).toHaveLength(2)
  })
})

describe('the tag bar', () => {
  it('offers the shared tags with the number of loops behind each', async () => {
    const wrapper = await mountWall()

    // One button per tag, in the spelling the data mostly uses — `sandstorm` is written
    // three different ways across the wall and still gets one button reading three.
    expect(tagButtons(wrapper).map((button) => button.text())).toStrictEqual([
      'Sandstorm 3',
      'techno 3',
      'Chill 2',
    ])
  })

  it('shows every loop a button counts, whatever spelling it carries', async () => {
    const wrapper = await mountWall()

    await tagButtons(wrapper)[0]!.trigger('click') // Sandstorm, on loops 1, 2 and 4
    await nextTick()

    expect(wrapper.findAll('.tile')).toHaveLength(3)
  })

  it('marks the tag that is filtering as pressed', async () => {
    const wrapper = await mountWall()

    expect(tagButtons(wrapper)[0]!.attributes('aria-pressed')).toBe('false')

    await tagButtons(wrapper)[0]!.trigger('click')

    expect(tagButtons(wrapper)[0]!.attributes('aria-pressed')).toBe('true')
  })

  it('takes the filter off again when the pressed tag is pressed once more', async () => {
    const wrapper = await mountWall()

    await tagButtons(wrapper)[0]!.trigger('click')
    await tagButtons(wrapper)[0]!.trigger('click')
    await nextTick()

    expect(wrapper.findAll('.tile')).toHaveLength(5)
    expect(tagButtons(wrapper)[0]!.attributes('aria-pressed')).toBe('false')
  })
})

describe('an empty wall', () => {
  it('names the command that fills it instead of showing nothing', async () => {
    const wrapper = await mountWall()

    useLoops().setTag('a tag no loop carries')
    await nextTick()

    expect(wrapper.find('.grid').exists()).toBe(false)
    expect(wrapper.get('.empty').text()).toContain('npm run add')
  })
})
