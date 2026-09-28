import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import ErrorPage from './error.vue'

describe('the error page', () => {
  it('shows the status code Nuxt handed it', async () => {
    const wrapper = await mountSuspended(ErrorPage, { props: { error: { statusCode: 404 } } })

    expect(wrapper.get('h1').text()).toBe('404')
    expect(wrapper.text()).toContain('Hier läuft nichts.')
  })

  it('offers the way back to the wall', async () => {
    const wrapper = await mountSuspended(ErrorPage, { props: { error: { statusCode: 500 } } })
    const link = wrapper.get('a')

    expect(link.attributes('href')).toBe('/')
    expect(link.text()).toBe('Zurück zur Loop-Wand')
  })

  it('takes the error down on the way out, so the wall renders instead of the error page', async () => {
    showError(createError({ statusCode: 404, fatal: true }))
    const wrapper = await mountSuspended(ErrorPage, { props: { error: { statusCode: 404 } } })

    await wrapper.get('a').trigger('click')

    expect(useError().value).toBeUndefined()
  })
})
