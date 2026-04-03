// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { GET, POST, PUT } from './route'

describe('Inngest serve endpoint', () => {
  it('exports GET handler', () => {
    expect(typeof GET).toBe('function')
  })

  it('exports POST handler', () => {
    expect(typeof POST).toBe('function')
  })

  it('exports PUT handler', () => {
    expect(typeof PUT).toBe('function')
  })
})
