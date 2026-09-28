import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeLoop } from '~/test/fixtures'

import LoopPlayer from './LoopPlayer.vue'

import type { VueWrapper } from '@vue/test-utils'
import type { MockInstance } from 'vitest'

const STORAGE_KEY = 'dornsloops:prefs'

/**
 * What the browser decides rather than the component: how long the media is, whether it
 * is running, and whether it is willing to start with sound. happy-dom ships the
 * accessors but no playback behind them, so the ones the player reads are answered here.
 */
const media = {
  duration: 100,
  paused: true,
  /** The autoplay policy of Chrome and Safari: sound needs a gesture first. */
  refusesSound: false,
}

/** The spy behind `play()`, for the one test that asks whether it was called again. */
let play: MockInstance<HTMLMediaElement['play']>

function stubMedia(): void {
  vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockImplementation(() => media.duration)
  vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(() => media.paused)
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async function (
    this: HTMLMediaElement,
  ) {
    if (media.refusesSound && !this.muted) {
      return Promise.reject(new DOMException('play() failed: no user gesture', 'NotAllowedError'))
    }
    media.paused = false
    this.dispatchEvent(new Event('play'))
    return Promise.resolve()
  })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    media.paused = true
    this.dispatchEvent(new Event('pause'))
  })
}

let wrapper: VueWrapper | null = null

async function mountPlayer(loop = makeLoop()): Promise<VueWrapper> {
  wrapper = await mountSuspended(LoopPlayer, { props: { loop } })
  await flushPromises()
  return wrapper
}

const video = (): HTMLVideoElement => wrapper!.get('video').element
const muteButton = () => wrapper!.get('button[title$="(M)"]')
const playButton = () => wrapper!.get('button[title$="(Leertaste)"]')
const bar = () => wrapper!.get('.player__progress')

/** A keystroke as it reaches the window listener, from wherever the focus is. */
function press(key: string, init: KeyboardEventInit = {}, target?: HTMLElement): void {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  ;(target ?? window).dispatchEvent(event)
}

function stored(): unknown {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === null ? null : JSON.parse(raw)
}

beforeEach(() => {
  clearNuxtState()
  localStorage.clear()
  media.duration = 100
  media.paused = true
  media.refusesSound = false
  stubMedia()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.restoreAllMocks()
})

describe('starting a loop', () => {
  it('plays with sound when the browser allows it', async () => {
    await mountPlayer()

    expect(video().muted).toBe(false)
    expect(video().volume).toBe(0.8)
    expect(wrapper!.find('.player__blocked').exists()).toBe(false)
  })

  it('falls back to a silent start when the browser refuses sound', async () => {
    media.refusesSound = true

    await mountPlayer()

    expect(video().muted).toBe(true)
    expect(video().paused).toBe(false)
    expect(wrapper!.get('.player__blocked').text()).toContain('Der Browser hat den Ton blockiert')
  })

  it('does not write a refused autoplay into the stored preferences', async () => {
    media.refusesSound = true

    await mountPlayer()

    // A browser policy is not a decision of the human, so nothing is remembered.
    expect(stored()).toBeNull()
  })

  it('takes the stored preferences over the defaults', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ volume: 0.25, muted: true }))

    await mountPlayer()

    expect(video().volume).toBe(0.25)
    expect(video().muted).toBe(true)
  })

  it('says nothing about a block when the silence was asked for', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ volume: 0.8, muted: true }))
    media.refusesSound = true

    await mountPlayer()

    // A muted element plays fine under the policy, so there is nothing to explain.
    expect(wrapper!.find('.player__blocked').exists()).toBe(false)
  })

  it('starts over when the page moves to the next loop', async () => {
    await mountPlayer()
    play.mockClear()

    await wrapper!.setProps({ loop: makeLoop({ id: 6447228 }) })
    await flushPromises()

    expect(play).toHaveBeenCalledTimes(1)
  })
})

describe('the mute control', () => {
  it('shows what the video does, not what the preference says', async () => {
    media.refusesSound = true

    await mountPlayer()

    // The element is silent against the human's wish — the button has to offer sound.
    expect(muteButton().attributes('aria-label')).toBe('Ton an')
    expect(muteButton().text()).toBe('🔇')
  })

  it('gives sound on the first press after a refused start', async () => {
    media.refusesSound = true
    await mountPlayer()
    // The click is the gesture the policy was waiting for.
    media.refusesSound = false

    await muteButton().trigger('click')

    expect(video().muted).toBe(false)
    expect(muteButton().attributes('aria-label')).toBe('Stumm')
    expect(wrapper!.find('.player__blocked').exists()).toBe(false)
    expect(stored()).toStrictEqual({ volume: 0.8, muted: false })
  })

  it('mutes on request and remembers it', async () => {
    await mountPlayer()

    await muteButton().trigger('click')

    expect(video().muted).toBe(true)
    expect(muteButton().attributes('aria-label')).toBe('Ton an')
    expect(stored()).toStrictEqual({ volume: 0.8, muted: true })
  })

  it('unmutes again on the next press', async () => {
    await mountPlayer()

    await muteButton().trigger('click')
    await muteButton().trigger('click')

    expect(video().muted).toBe(false)
    expect(stored()).toStrictEqual({ volume: 0.8, muted: false })
  })

  it('does not bring the browser’s excuse back after a deliberate mute', async () => {
    media.refusesSound = true
    await mountPlayer()
    media.refusesSound = false

    await muteButton().trigger('click') // sound
    await muteButton().trigger('click') // silence, this time on purpose

    expect(video().muted).toBe(true)
    expect(wrapper!.find('.player__blocked').exists()).toBe(false)
  })
})

describe('the volume slider', () => {
  it('sets the volume and takes the mute off with it', async () => {
    await mountPlayer()
    await muteButton().trigger('click')

    const slider = wrapper!.get<HTMLInputElement>('.player__volume')
    slider.element.value = '0.3'
    await slider.trigger('input')

    expect(video().volume).toBeCloseTo(0.3)
    expect(video().muted).toBe(false)
    expect(stored()).toStrictEqual({ volume: 0.3, muted: false })
  })
})

describe('the keyboard', () => {
  it('toggles the sound with M', async () => {
    await mountPlayer()

    press('m')
    await flushPromises()

    expect(video().muted).toBe(true)
  })

  it('takes a capital M too — with Shift or CapsLock the key reads that way', async () => {
    await mountPlayer()

    press('M')
    await flushPromises()

    expect(video().muted).toBe(true)
  })

  it('leaves a keystroke meant for a field alone', async () => {
    await mountPlayer()
    const input = document.createElement('input')
    document.body.append(input)

    press('m', {}, input)
    await flushPromises()

    expect(video().muted).toBe(false)

    input.remove()
  })

  it.each([['ctrlKey'], ['metaKey'], ['altKey']])(
    'leaves %s+M to the browser or the system',
    async (modifier) => {
      await mountPlayer()

      press('m', { [modifier]: true })
      await flushPromises()

      expect(video().muted).toBe(false)
    },
  )

  it('pauses and resumes with the space bar', async () => {
    await mountPlayer()

    press(' ')
    await flushPromises()

    expect(video().paused).toBe(true)
    expect(playButton().text()).toBe('▶️')

    press(' ')
    await flushPromises()

    expect(video().paused).toBe(false)
    expect(playButton().text()).toBe('⏸️')
  })

  it.each([['BUTTON'], ['A']])(
    'leaves the space bar to a focused %s, which needs it to activate',
    async (tag) => {
      await mountPlayer()
      const element = document.createElement(tag)
      document.body.append(element)

      press(' ', {}, element)
      await flushPromises()

      expect(video().paused).toBe(false)

      element.remove()
    },
  )

  it('leaves a key it has no answer for to the page around it', async () => {
    await mountPlayer()

    const event = new KeyboardEvent('keydown', { key: 'q', cancelable: true })
    window.dispatchEvent(event)
    await flushPromises()

    expect(event.defaultPrevented).toBe(false)
    expect(video().muted).toBe(false)
    expect(video().paused).toBe(false)
  })
})

describe('the progress bar', () => {
  it('reports the position and the length to assistive tech', async () => {
    await mountPlayer()
    video().currentTime = 30
    await wrapper!.get('video').trigger('timeupdate')

    expect(bar().attributes()).toMatchObject({
      role: 'slider',
      tabindex: '0',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': '30',
      'aria-valuetext': '0:30 von 1:40',
    })
  })

  it('fills in proportion to the position', async () => {
    await mountPlayer()
    video().currentTime = 25
    await wrapper!.get('video').trigger('timeupdate')

    expect(wrapper!.get('.player__progress-fill').attributes('style')).toContain('scaleX(0.25)')
  })

  it('stays empty while the length is still unknown', async () => {
    media.duration = Number.NaN

    await mountPlayer()

    expect(bar().attributes('aria-valuemax')).toBe('0')
    expect(wrapper!.get('.player__progress-fill').attributes('style')).toContain('scaleX(0)')
  })

  it('seeks a tenth of the loop forward on Page up', async () => {
    await mountPlayer()
    video().currentTime = 30

    await bar().trigger('keydown', { key: 'PageUp' })

    expect(video().currentTime).toBeCloseTo(40)
  })

  it('seeks a tenth back on Page down', async () => {
    await mountPlayer()
    video().currentTime = 30

    await bar().trigger('keydown', { key: 'PageDown' })

    expect(video().currentTime).toBeCloseTo(20)
  })

  it('does not seek before the start', async () => {
    await mountPlayer()
    video().currentTime = 2

    await bar().trigger('keydown', { key: 'PageDown' })

    expect(video().currentTime).toBe(0)
  })

  it('jumps to the start on Home', async () => {
    await mountPlayer()
    video().currentTime = 30

    await bar().trigger('keydown', { key: 'Home' })

    expect(video().currentTime).toBe(0)
  })

  it('stops just short of the end on End, so a looping video does not wrap', async () => {
    await mountPlayer()

    await bar().trigger('keydown', { key: 'End' })

    expect(video().currentTime).toBeCloseTo(99.95)
  })

  it('leaves the arrow keys to the loop navigation of the page around it', async () => {
    await mountPlayer()
    video().currentTime = 30

    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true })
    bar().element.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(video().currentTime).toBe(30)
  })

  it('seeks to the spot that was clicked', async () => {
    await mountPlayer()
    const element = bar().element
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ left: 100 } as DOMRect)
    Object.defineProperty(element, 'offsetWidth', { configurable: true, value: 200 })

    await bar().trigger('click', { clientX: 150 })

    expect(video().currentTime).toBeCloseTo(25)
  })

  it('ignores a click while the length is still unknown', async () => {
    media.duration = Number.NaN
    await mountPlayer()

    await bar().trigger('click', { clientX: 150 })

    expect(video().currentTime).toBe(0)
  })

  it('ignores a seeking key while the length is still unknown', async () => {
    media.duration = Number.NaN
    await mountPlayer()

    const event = new KeyboardEvent('keydown', { key: 'End', cancelable: true })
    bar().element.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(video().currentTime).toBe(0)
  })
})

describe('the video itself', () => {
  it('loops the source silently muted by nothing but the preference', async () => {
    await mountPlayer()

    expect(wrapper!.get('video').attributes()).toMatchObject({
      src: '/loops/7077671.mp4',
      poster: '/loops/7077671.jpg',
      loop: '',
      playsinline: '',
    })
  })

  it('pauses and resumes when it is clicked', async () => {
    await mountPlayer()

    await wrapper!.get('video').trigger('click')

    expect(video().paused).toBe(true)

    await wrapper!.get('video').trigger('click')

    expect(video().paused).toBe(false)
  })
})
