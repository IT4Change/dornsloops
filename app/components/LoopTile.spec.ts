import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import { makeLoop } from '~/test/fixtures'

import LoopTile from './LoopTile.vue'

describe('loopTile', () => {
  it('shows the poster, not a video — the wall would pull the whole library otherwise', async () => {
    const wrapper = await mountSuspended(LoopTile, { props: { loop: makeLoop() } })

    expect(wrapper.find('video').exists()).toBe(false)
    expect(wrapper.get('img').attributes()).toMatchObject({
      src: '/loops/7077671.jpg',
      alt: 'Sandstorm',
      width: '1280',
      height: '720',
      loading: 'lazy',
    })
  })

  it('reserves the loop’s own aspect ratio so the masonry wall does not jump', async () => {
    const wrapper = await mountSuspended(LoopTile, {
      props: { loop: makeLoop({ width: 360, height: 640 }) },
    })

    expect(wrapper.get('article').attributes('style')).toContain('aspect-ratio: 360 / 640')
  })

  it('links to the loop’s own page with a name a screen reader can announce', async () => {
    const wrapper = await mountSuspended(LoopTile, { props: { loop: makeLoop() } })

    expect(wrapper.get('a').attributes('href')).toBe('/loop/7077671')
    expect(wrapper.get('.visually-hidden').text()).toBe('Sandstorm abspielen')
  })

  it('marks the tile as a video by showing how long it runs', async () => {
    const wrapper = await mountSuspended(LoopTile, {
      props: { loop: makeLoop({ duration: 95.4 }) },
    })

    expect(wrapper.get('.tile__duration').text()).toBe('1:35')
  })
})
