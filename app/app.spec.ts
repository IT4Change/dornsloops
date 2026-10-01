import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import App from './app.vue'

describe('the footer', () => {
  // The runtime config is one object per app, and the specs below write into it.
  let config: ReturnType<typeof useRuntimeConfig>['public']
  let original: Pick<typeof config, 'version' | 'releaseUrl'>

  beforeEach(() => {
    config = useRuntimeConfig().public
    original = { version: config.version, releaseUrl: config.releaseUrl }
  })

  afterEach(() => {
    Object.assign(config, original)
  })

  it('links the live version to its release, where the changelog is', async () => {
    Object.assign(config, {
      version: '1.4.0',
      releaseUrl: 'https://github.com/IT4Change/dornsloops/releases/tag/1.4.0',
    })
    const wrapper = await mountSuspended(App)
    const link = wrapper.get('.footer__version a')

    expect(link.text()).toBe('1.4.0')
    expect(link.attributes()).toMatchObject({
      href: 'https://github.com/IT4Change/dornsloops/releases/tag/1.4.0',
      target: '_blank',
      rel: 'noopener noreferrer',
    })
  })

  it('names a dev build without linking it — no release describes that state', async () => {
    Object.assign(config, { version: '1.4.0-dev', releaseUrl: '' })
    const wrapper = await mountSuspended(App)
    const version = wrapper.get('.footer__version')

    expect(version.text()).toBe('1.4.0-dev')
    expect(version.find('a').exists()).toBe(false)
  })
})
