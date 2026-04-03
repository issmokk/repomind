// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { inngest } from './client'

describe('Inngest client', () => {
  it('is configured with the app id "repomind"', () => {
    expect(inngest.id).toBe('repomind')
  })

  it('exports a send function for dispatching events', () => {
    expect(typeof inngest.send).toBe('function')
  })

  it('exports a createFunction method', () => {
    expect(typeof inngest.createFunction).toBe('function')
  })
})
